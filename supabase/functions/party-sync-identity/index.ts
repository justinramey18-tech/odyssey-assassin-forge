import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { partyId } = await req.json().catch(() => ({}));
    if (!partyId || typeof partyId !== "string") {
      return new Response(JSON.stringify({ error: "partyId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: authError } = await userClient.auth.getClaims(token);
    const callerId = (claimsData?.claims as any)?.sub as string | undefined;
    if (authError || !callerId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // AUTHORIZE: caller must be a member of this party.
    const { data: callerMembership, error: membershipError } = await admin
      .from("party_members")
      .select("user_id")
      .eq("party_id", partyId)
      .eq("user_id", callerId)
      .maybeSingle();

    if (membershipError) throw membershipError;
    if (!callerMembership) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: members, error: membersError } = await admin
      .from("party_members")
      .select("user_id, character_name, character_status")
      .eq("party_id", partyId);

    if (membersError) throw membersError;

    let updated = 0;
    let skipped = 0;
    const report: { character_name: string; fields: string[] }[] = [];

    for (const member of members || []) {
      const { data: saves } = await admin
        .from("character_saves")
        .select("id, character_data, extended_data, updated_at")
        .eq("user_id", member.user_id)
        .order("updated_at", { ascending: false })
        .limit(5);

      if (!saves || saves.length === 0) {
        skipped++;
        console.log(`[party-sync-identity] ${member.character_name}: no saves, skipped`);
        continue;
      }

      const target = String(member.character_name || "").trim().toLowerCase();
      const save =
        saves.find(
          (s: any) =>
            String((s.character_data as any)?.name || "").trim().toLowerCase() === target && target
        ) || saves[0];

      const scoped = ((save.extended_data as any)?.scopedLocalStorage || {}) as Record<string, unknown>;
      const status = (member.character_status || {}) as Record<string, unknown>;

      const patch: Record<string, string> = {};

      const rawBackstory = typeof scoped["dnd-character-backstory"] === "string"
        ? (scoped["dnd-character-backstory"] as string).trim().slice(0, 1000)
        : "";
      if (rawBackstory && status.backstory !== rawBackstory) patch.backstory = rawBackstory;

      const rawRace = typeof scoped["dnd-character-race"] === "string"
        ? (scoped["dnd-character-race"] as string).trim()
        : "";
      if (rawRace && status.race !== rawRace) patch.race = rawRace;

      if (String(scoped["odyssey-cosmic-chef"] ?? "") === "true" && status.className !== "Cosmic Chef") {
        patch.className = "Cosmic Chef";
      }

      const fields = Object.keys(patch);
      if (fields.length === 0) {
        skipped++;
        console.log(`[party-sync-identity] ${member.character_name}: nothing to change, skipped`);
        continue;
      }

      const { error: updateError } = await admin
        .from("party_members")
        .update({ character_status: { ...status, ...patch } })
        .eq("party_id", partyId)
        .eq("user_id", member.user_id);

      if (updateError) {
        skipped++;
        console.log(`[party-sync-identity] ${member.character_name}: update failed - ${updateError.message}`);
        continue;
      }

      updated++;
      report.push({ character_name: member.character_name, fields });
      console.log(`[party-sync-identity] ${member.character_name}: updated ${fields.join(", ")}`);
    }

    return new Response(JSON.stringify({ updated, skipped, members: report }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("party-sync-identity error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
