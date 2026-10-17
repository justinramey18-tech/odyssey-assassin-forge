import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    if(!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Server configuration error');

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { partyId, delaySeconds, scheduledAt, eventId, travelEventId, launchTravelEvent } = body;
    if(travelEventId !== undefined) {
      const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if(!uuid.test(String(partyId)) || !uuid.test(String(travelEventId)) || typeof scheduledAt!=='string' || !Number.isFinite(Date.parse(scheduledAt))
        || (launchTravelEvent !== undefined && typeof launchTravelEvent !== 'boolean')
        || (launchTravelEvent === true && Date.parse(scheduledAt) <= Date.now()))
        return new Response(JSON.stringify({error:'Invalid travel schedule'}),{status:400,headers:{...corsHeaders,'Content-Type':'application/json'}});
      const {data:party}=await supabase.from('parties').select('created_by').eq('id',partyId).maybeSingle();
      if(!party || party.created_by!==claimsData.claims.sub)
        return new Response(JSON.stringify({error:'Only the original host can schedule travel'}),{status:403,headers:{...corsHeaders,'Content-Type':'application/json'}});
      const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if(!service) throw new Error('Server configuration error');
      const privateDb=createClient(SUPABASE_URL,service);
      const {data:travel,error:travelError}=await privateDb.from('party_travel_events').select('status,scheduled_at,has_event,qstash_message_id').eq('id',travelEventId).eq('party_id',partyId).maybeSingle();
      const scheduleMatches = launchTravelEvent === true
        ? travel?.has_event === true && travel.status === 'planned' && travel.scheduled_at === null && travel.qstash_message_id === null
        : travel?.status === 'scheduled' && Date.parse(travel.scheduled_at) === Date.parse(scheduledAt);
      if(travelError || !scheduleMatches)
        return new Response(JSON.stringify({error:'Travel schedule changed'}),{status:409,headers:{...corsHeaders,'Content-Type':'application/json'}});
    }

    if (!partyId) {
      return new Response(JSON.stringify({ error: "partyId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Must have either delaySeconds (timer) or scheduledAt (scheduled event)
    const hasDelay = typeof delaySeconds === "number" && delaySeconds >= 1;
    const hasScheduledAt = typeof scheduledAt === "string" && scheduledAt.length > 0;

    if (!hasDelay && !hasScheduledAt) {
      return new Response(JSON.stringify({ error: "Either delaySeconds or scheduledAt required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const QSTASH_TOKEN = Deno.env.get("QSTASH_TOKEN");
    if (!QSTASH_TOKEN) {
      return new Response(JSON.stringify({ error: "QSTASH_TOKEN not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const TRIGGER_SECRET = Deno.env.get("TRIGGER_SECRET") || "";
    const targetUrl = `${SUPABASE_URL}/functions/v1/party-timer-generate`;

    // Build QStash headers
    const qstashHeaders: Record<string, string> = {
      Authorization: `Bearer ${QSTASH_TOKEN}`,
      "Content-Type": "application/json",
      "Upstash-Url": targetUrl,
      "Upstash-Retries": travelEventId ? "5" : "2",
    };

    if (hasScheduledAt) {
      // Absolute scheduling — use Not-Before header (Unix timestamp in seconds)
      const targetTime = new Date(scheduledAt).getTime();
      const notBefore = travelEventId ? Math.ceil(targetTime / 1000) : Math.floor(targetTime / 1000);
      qstashHeaders["Upstash-Not-Before"] = String(notBefore);
    } else {
      // Relative delay
      qstashHeaders["Upstash-Delay"] = `${Math.ceil(delaySeconds)}s`;
    }

    const qstashBody: Record<string, unknown> = {
      partyId,
      triggerSecret: TRIGGER_SECRET,
    };

    // If this is a scheduled narrative event or round, pass the eventId so the generator knows
    if (eventId) {
      qstashBody.eventId = eventId;
    }
    if(travelEventId) qstashBody.travelEventId=travelEventId;

    const qstashResponse = await fetch("https://qstash.upstash.io/v2/publish", {
      method: "POST",
      headers: qstashHeaders,
      body: JSON.stringify(qstashBody),
    });

    if (!qstashResponse.ok) {
      const errText = await qstashResponse.text();
      if(!travelEventId) console.error("[schedule-timer] QStash error:", qstashResponse.status, errText);
      return new Response(JSON.stringify({ error: `QStash scheduling failed: ${qstashResponse.status}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await qstashResponse.json();
    const logMsg = hasScheduledAt
      ? `Scheduled event for party ${partyId} at ${scheduledAt}, messageId: ${result.messageId}`
      : `Scheduled callback for party ${partyId} in ${delaySeconds}s, messageId: ${result.messageId}`;
    if(!travelEventId) console.log(`[schedule-timer] ${logMsg}`);

    return new Response(JSON.stringify({ ok: true, messageId: result.messageId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[schedule-timer] Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
