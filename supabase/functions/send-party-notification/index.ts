import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;

webpush.setVapidDetails(
  "mailto:push@assassinsledger.app",
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    // Action: return VAPID public key (no auth needed)
    if (body.action === "get-vapid-key") {
      return new Response(JSON.stringify({ vapidPublicKey: VAPID_PUBLIC_KEY }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { partyId, triggerType, playerName, readyCount, totalPlayers, message } = body;
    console.log(`[Notify] trigger=${triggerType} party=${partyId} player=${playerName}`);

    if (!partyId || !triggerType) {
      return new Response(JSON.stringify({ error: "Missing partyId or triggerType" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all party member user IDs
    const { data: members } = await supabase
      .from("party_members")
      .select("user_id")
      .eq("party_id", partyId);

    if (!members || members.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const memberUserIds = members
      .map((m: { user_id: string }) => m.user_id)
      .filter((id: string) => id !== user.id);

    if (memberUserIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get push subscriptions for those members
    const { data: subscriptions } = await supabase
      .from("party_push_subscriptions")
      .select("*")
      .in("user_id", memberUserIds)
      .eq("notifications_enabled", true);

    console.log(`[Notify] Found ${subscriptions?.length ?? 0} subscriptions for ${memberUserIds.length} members`);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build notification payload
    let title = "";
    let notifBody = "";
    const tag = `party-${triggerType}-${Date.now()}`;

    if (triggerType === "ready") {
      title = `${playerName || "A player"} is ready!`;
      notifBody = `${readyCount || 0} of ${totalPlayers || 0} players ready`;
    } else if (triggerType === "chat") {
      title = `${playerName || "Someone"} sent a message`;
      notifBody = message ? message.slice(0, 100) : "New party message";
    } else {
      title = "Party Update";
      notifBody = `${playerName || "Someone"} triggered ${triggerType}`;
    }

    const payload = JSON.stringify({
      title,
      body: notifBody,
      tag,
      url: "/",
    });

    // Send to all subscriptions
    let sent = 0;
    let failed = 0;
    const expiredEndpoints: string[] = [];

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload
        );
        sent++;
      } catch (err: any) {
        failed++;
        // Remove expired/invalid subscriptions
        if (err.statusCode === 410 || err.statusCode === 404) {
          expiredEndpoints.push(sub.endpoint);
        }
        console.error(`Push failed for ${sub.user_id}:`, err.statusCode || err.message);
      }
    }

    // Clean up expired subscriptions
    if (expiredEndpoints.length > 0) {
      await supabase
        .from("party_push_subscriptions")
        .delete()
        .in("endpoint", expiredEndpoints);
    }

    // Log to notifications_log
    await supabase.from("notifications_log").insert({
      party_id: partyId,
      triggered_by_user_id: user.id,
      triggered_by_name: playerName || "Adventurer",
      ready_count: readyCount || 0,
      total_players: totalPlayers || 0,
      notification_type: triggerType,
    });

    return new Response(
      JSON.stringify({ sent, failed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-party-notification error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
