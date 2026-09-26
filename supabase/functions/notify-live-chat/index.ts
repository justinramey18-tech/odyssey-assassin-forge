import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const logDelivery = async (entry: {
    party_id?: string | null;
    message_id?: string | null;
    recipients?: number;
    sent?: number;
    failed?: number;
    detail: string;
  }) => {
    try {
      await supabase.from('push_delivery_log').insert({
        function_name: 'notify-live-chat',
        party_id: entry.party_id ?? null,
        message_id: entry.message_id ?? null,
        recipients: entry.recipients ?? 0,
        sent: entry.sent ?? 0,
        failed: entry.failed ?? 0,
        detail: entry.detail.slice(0, 300),
      });
    } catch {
      // Logging must never stop a push.
    }
  };

  let messageId = '';
  try {
    const body = await req.json();
    messageId = typeof body.messageId === 'string' ? body.messageId : '';
    if (!messageId) {
      await logDelivery({ detail: 'stale or missing' });
      return json({ error: 'Missing messageId' }, 400);
    }
  } catch {
    await logDelivery({ detail: 'stale or missing' });
    return json({ error: 'Invalid JSON body' }, 400);
  }

  try {
    const { data: message } = await supabase
      .from('party_round_chat')
      .select('id, party_id, user_id, character_name, content, created_at')
      .eq('id', messageId)
      .maybeSingle();

    const age = message ? Date.now() - Date.parse(message.created_at) : Infinity;
    if (!message || !Number.isFinite(age) || age > 2 * 60 * 1000) {
      await logDelivery({ message_id: messageId, detail: 'stale or missing' });
      return json({ sent: 0, reason: 'stale or missing' });
    }

    const partyId: string = message.party_id;
    const senderUserId: string = message.user_id;
    const characterName: string =
      typeof message.character_name === 'string' && message.character_name.trim()
        ? message.character_name.trim().slice(0, 80)
        : 'A player';
    const content: string = typeof message.content === 'string' ? message.content.slice(0, 400) : '';

    const { data: members } = await supabase
      .from('party_members')
      .select('user_id, character_name')
      .eq('party_id', partyId);

    const recipientIds = Array.from(
      new Set((members || []).map((m) => m.user_id).filter((id) => id && id !== senderUserId)),
    );
    if (recipientIds.length === 0) {
      await logDelivery({ party_id: partyId, message_id: messageId, detail: 'no recipients' });
      return json({ sent: 0 });
    }

    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    if (!vapidPublicKey || !vapidPrivateKey) {
      console.error('VAPID keys not configured');
      await logDelivery({ party_id: partyId, message_id: messageId, detail: 'VAPID not configured' });
      return json({ error: 'VAPID not configured' }, 500);
    }
    webpush.setVapidDetails(
      'mailto:notifications@infinitypoolassassin.lovable.app',
      vapidPublicKey,
      vapidPrivateKey,
    );

    const preview = buildPreview(content);
    let sentCount = 0;
    let failedCount = 0;
    let recipientCount = 0;

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
      recipientCount++;

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
          failedCount++;
          const statusCode = (error as { statusCode?: number })?.statusCode;
          if (statusCode === 410 || statusCode === 404) {
            await supabase.from('party_push_subscriptions').delete().eq('endpoint', sub.endpoint);
          } else {
            console.error('Push send failed:', (error as Error)?.message || error);
          }
        }
      }));
    }));

    await logDelivery({
      party_id: partyId,
      message_id: messageId,
      recipients: recipientCount,
      sent: sentCount,
      failed: failedCount,
      detail: 'ok',
    });

    return json({ sent: sentCount });
  } catch (error: unknown) {
    const message = (error as Error)?.message || String(error);
    await logDelivery({ message_id: messageId, detail: message.slice(0, 300) });
    return json({ error: message }, 500);
  }
});
