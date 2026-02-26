const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ONESIGNAL_APP_ID = 'a3a12480-739c-4740-8f35-add20696b6c8';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing auth' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { partyId, characterName, readyCount, totalCount } = await req.json();

    if (!partyId || !characterName || readyCount == null || totalCount == null) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get all party members except sender
    const { data: members } = await supabase
      .from('party_members')
      .select('user_id')
      .eq('party_id', partyId)
      .neq('user_id', user.id);

    if (!members || members.length === 0) {
      console.log(`[ready-notify] No other members in party ${partyId}`);
      return new Response(JSON.stringify({ ok: true, pushed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const memberUserIds = members.map((m) => m.user_id);
    console.log(`[ready-notify] Party ${partyId}: targeting ${memberUserIds.length} members via OneSignal`);

    // Build notification content
    const allReady = readyCount >= totalCount && totalCount > 0;
    const title = allReady ? '🎯 All Players Ready!' : '⚔️ Party Ready Up';
    const body = allReady
      ? `All ${totalCount} players are ready!`
      : `${characterName} has readied up! (${readyCount}/${totalCount} ready)`;

    // Send via OneSignal REST API
    const onesignalApiKey = Deno.env.get('ONESIGNAL_REST_API_KEY')!;
    const onesignalResp = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${onesignalApiKey}`,
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        include_aliases: { external_id: memberUserIds },
        target_channel: 'push',
        headings: { en: title },
        contents: { en: body },
        web_url: 'https://infinitypoolassassin.lovable.app/',
        chrome_web_icon: 'https://infinitypoolassassin.lovable.app/pwa-192x192.png',
        chrome_web_badge: 'https://infinitypoolassassin.lovable.app/pwa-192x192.png',
      }),
    });

    const onesignalResult = await onesignalResp.json();
    console.log(`[ready-notify] OneSignal response:`, JSON.stringify(onesignalResult));

    return new Response(
      JSON.stringify({ ok: true, onesignal: onesignalResult }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('party-ready-notify error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
