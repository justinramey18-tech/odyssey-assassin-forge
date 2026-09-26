import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-trigger-secret',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

function buildPreview(content: string): string {
  let t = String(content || '');
  t = t.replace(/⟪AC⟫[\s\S]*?⟪\/AC⟫/g, '');
  t = t.replace(/^\s*\[reply:[^\]]*\]/i, '');
  t = t.replace(/\s+/g, ' ').trim();
  if (t.length > 90) t = t.slice(0, 90).trimEnd() + '…';
  return t || 'rolled the dice';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const triggerSecret = req.headers.get('X-Trigger-Secret');
  if (!triggerSecret || triggerSecret !== Deno.env.get('TRIGGER_SECRET')) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let partyId: string;
  let senderUserId: string;
  let characterName: string;
  let content: string;
  try {
    const body = await req.json();
    partyId = typeof body.partyId === 'string' ? body.partyId : '';
    senderUserId = typeof body.senderUserId === 'string' ? body.senderUserId : '';
    characterName = typeof body.characterName === 'string' && body.characterName.trim()
      ? body.characterName.trim().slice(0, 80)
      : 'A player';
    content = typeof body.content === 'string' ? body.content.slice(0, 400) : '';
    if (!partyId || !senderUserId) return json({ error: 'Missing partyId or senderUserId' }, 400);
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: members } = await supabase
    .from('party_members')
    .select('user_id, character_name')
    .eq('party_id', partyId);

  const recipientIds = Array.from(
    new Set((members || []).map((m) => m.user_id).filter((id) => id && id !== senderUserId)),
  );
  if (recipientIds.length === 0) return json({ sent: 0 });

  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.error('VAPID keys not configured');
    return json({ error: 'VAPID not configured' }, 500);
  }
  webpush.setVapidDetails(
    'mailto:notifications@infinitypoolassassin.lovable.app',
    vapidPublicKey,
    vapidPrivateKey,
  );

  const preview = buildPreview(content);
  let sentCount = 0;

  await Promise.allSettled(recipientIds.map(async (recipientId) => {
    const { data: marker } = await supabase
      .from('party_shared_state')
      .select('state_data')
      .eq('party_id', partyId)
      .eq('user_id', recipientId)
      .eq('state_type', 'round_chat_read')
      .maybeSingle();

    const rawLast = (marker?.state_data as { lastReadAt?: unknown } | null)?.lastReadAt;
    const parsed = typeof rawLast === 'string' ? Date.parse(rawLast) : NaN;
    const since = Number.isFinite(parsed)
      ? new Date(parsed).toISOString()
      : new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

    const { count } = await supabase
      .from('party_round_chat')
      .select('id', { count: 'exact', head: true })
      .eq('party_id', partyId)
      .neq('user_id', recipientId)
      .gt('created_at', since);

    const unread = Number.isFinite(count) ? Number(count) : 0;
    if (unread <= 0) return;

    const body = unread === 1
      ? `${characterName}: ${preview}`
      : `${unread} new messages · ${characterName}: ${preview}`;

    const { data: subs } = await supabase
      .from('party_push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', recipientId)
      .eq('notifications_enabled', true);
    if (!subs || subs.length === 0) return;

    const payload = JSON.stringify({
      type: 'live_chat',
      title: 'Live DM Table',
      body,
      tag: `live-chat-${partyId}`,
      badgeCount: unread,
      data: { url: '/', partyId, type: 'live_chat' },
    });

    await Promise.allSettled(subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
        sentCount++;
      } catch (error: unknown) {
        const statusCode = (error as { statusCode?: number })?.statusCode;
        if (statusCode === 410 || statusCode === 404) {
          await supabase.from('party_push_subscriptions').delete().eq('endpoint', sub.endpoint);
        } else {
          console.error('Push send failed:', (error as Error)?.message || error);
        }
      }
    }));
  }));

  return json({ sent: sentCount });
});
