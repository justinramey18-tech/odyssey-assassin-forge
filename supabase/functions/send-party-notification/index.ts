import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-trigger-secret',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate trigger source
  const triggerSecret = req.headers.get('X-Trigger-Secret');
  if (!triggerSecret || triggerSecret !== Deno.env.get('TRIGGER_SECRET')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let partyId: string;
  let userId: string;
  let roundId: string;

  try {
    const body = await req.json();
    partyId = body.partyId;
    userId = body.userId;
    roundId = body.roundId || '';
    if (!partyId || !userId) {
      return new Response(JSON.stringify({ error: 'Missing partyId or userId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Initialize Supabase with service role (bypasses RLS)
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Rate limit per party (5s window)
  const fiveSecondsAgo = new Date(Date.now() - 5000).toISOString();
  const { data: recentLog } = await supabase
    .from('notifications_log')
    .select('id')
    .eq('party_id', partyId)
    .gte('created_at', fiveSecondsAgo)
    .limit(1)
    .maybeSingle();

  if (recentLog) {
    return new Response(JSON.stringify({ sent: 0, message: 'rate limited' }), {
      status: 429,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Query actual party state for this round
  const { data: prompts, error: promptsError } = await supabase
    .from('party_dm_prompts')
    .select('is_ready, user_id')
    .eq('party_id', partyId)
    .eq('round_id', roundId);

  if (promptsError) {
    console.error('Failed to query prompts:', promptsError);
    return new Response(JSON.stringify({ error: 'DB query failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const readyCount = (prompts || []).filter((p) => p.is_ready).length;
  const totalPlayers = (prompts || []).length;

  // Get triggering user's character name
  const { data: member } = await supabase
    .from('party_members')
    .select('character_name')
    .eq('user_id', userId)
    .eq('party_id', partyId)
    .maybeSingle();

  const characterName = member?.character_name || 'A player';

  // Get all party member user_ids
  const { data: partyMembers } = await supabase
    .from('party_members')
    .select('user_id')
    .eq('party_id', partyId);

  const partyMemberIds = (partyMembers || []).map((m) => m.user_id);

  // Get push subscriptions for party members EXCEPT triggering user
  const otherMemberIds = partyMemberIds.filter((id) => id !== userId);
  if (otherMemberIds.length === 0) {
    return new Response(JSON.stringify({ sent: 0, message: 'no recipients' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: subscriptions } = await supabase
    .from('party_push_subscriptions')
    .select('endpoint, p256dh, auth, user_id')
    .in('user_id', otherMemberIds)
    .eq('notifications_enabled', true);

  if (!subscriptions || subscriptions.length === 0) {
    // Still log the notification even with no subscribers
    await supabase.from('notifications_log').insert({
      party_id: partyId,
      triggered_by_user_id: userId,
      triggered_by_name: characterName,
      ready_count: readyCount,
      total_players: totalPlayers,
      notification_type: 'ready',
    });

    return new Response(JSON.stringify({ sent: 0, message: 'no subscriptions' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Configure VAPID
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

  if (!vapidPublicKey || !vapidPrivateKey) {
    console.error('VAPID keys not configured');
    return new Response(JSON.stringify({ error: 'VAPID not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  webpush.setVapidDetails(
    'mailto:notifications@infinitypoolassassin.lovable.app',
    vapidPublicKey,
    vapidPrivateKey,
  );

  // Build notification payload — single tag for replacement behavior
  const allReady = readyCount >= totalPlayers && totalPlayers > 0;
  const title = allReady ? '🎯 All Players Ready!' : '⚔️ Party Ready Update';
  const timestamp = new Date().toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
  const body = allReady
    ? `All ${totalPlayers} players readied up at ${timestamp}!`
    : `${characterName} readied up! (${readyCount}/${totalPlayers} ready)`;

  const payload = JSON.stringify({
    title,
    body,
    tag: `party-ready-${partyId}`,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    data: { url: '/', partyId },
  });

  // Send push notifications
  let sentCount = 0;
  const sendPromises = subscriptions.map(async (sub) => {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload,
      );
      sentCount++;
    } catch (error: unknown) {
      const statusCode = (error as { statusCode?: number })?.statusCode;
      if (statusCode === 410 || statusCode === 404) {
        // Subscription expired — clean up
        console.log('Removing stale subscription:', sub.endpoint.substring(0, 50));
        await supabase
          .from('party_push_subscriptions')
          .delete()
          .eq('endpoint', sub.endpoint);
      } else {
        console.error('Push send failed:', (error as Error)?.message || error);
      }
    }
  });

  await Promise.allSettled(sendPromises);

  // NOTE: Telegram ready-up notifications are now sent client-side via telegram-notify-proxy
  // in use-party-dm.ts setReady(). Removed server-side duplicate to avoid double notifications.

  // Log notification
  await supabase.from('notifications_log').insert({
    party_id: partyId,
    triggered_by_user_id: userId,
    triggered_by_name: characterName,
    ready_count: readyCount,
    total_players: totalPlayers,
    notification_type: allReady ? 'all_ready' : 'ready',
  });

  return new Response(
    JSON.stringify({ sent: sentCount, readyCount, totalPlayers }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  );
});
