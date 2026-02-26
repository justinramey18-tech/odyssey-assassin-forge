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

    const { partyId, message, senderName, replyToId, imageUrl } = await req.json();

    if (!partyId || !message || !senderName) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Insert the message into party_messages
    const insertData: Record<string, unknown> = {
      party_id: partyId,
      user_id: user.id,
      sender_name: senderName,
      message: message.slice(0, 500),
    };
    if (replyToId) insertData.reply_to_id = replyToId;
    if (imageUrl) insertData.image_url = imageUrl;

    const { error: insertError } = await supabase.from('party_messages').insert(insertData);
    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(JSON.stringify({ error: 'Failed to send message' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Get all party members except sender
    const { data: members } = await supabase
      .from('party_members')
      .select('user_id')
      .eq('party_id', partyId)
      .neq('user_id', user.id);

    if (!members || members.length === 0) {
      return new Response(JSON.stringify({ ok: true, pushed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const memberUserIds = members.map((m) => m.user_id);

    // 3. Send push notification via OneSignal
    const truncatedMessage = message.length > 100 ? message.slice(0, 97) + '...' : message;
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
        headings: { en: `💬 ${senderName}` },
        contents: { en: truncatedMessage },
        web_url: 'https://infinitypoolassassin.lovable.app/',
        chrome_web_icon: 'https://infinitypoolassassin.lovable.app/pwa-192x192.png',
        chrome_web_badge: 'https://infinitypoolassassin.lovable.app/pwa-192x192.png',
      }),
    });

    const onesignalResult = await onesignalResp.json();
    console.log(`[chat-send] OneSignal response:`, JSON.stringify(onesignalResult));

    return new Response(
      JSON.stringify({ ok: true, onesignal: onesignalResult }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('party-chat-send error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
