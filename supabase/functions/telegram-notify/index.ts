import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/telegram';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-trigger-secret',
};

interface NotifyPayload {
  type: 'ready_up' | 'timer_expired' | 'combat_start' | 'combat_turn' | 'dragon_message' | 'condition_alert' | 'custom';
  partyId?: string;
  userId?: string; // triggering user (excluded from notifications)
  targetUserIds?: string[]; // specific users to notify (optional)
  targetChatIds?: number[]; // specific chat IDs to send to (optional, filters linked chats)
  title: string;
  body: string;
  dragonName?: string; // for dragon bond messages
  conditionName?: string; // for condition alerts
  conditionRounds?: number; // rounds remaining
  mode?: 'party' | 'solo' | 'empyrean'; // game mode for routing
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate trigger
  const triggerSecret = req.headers.get('X-Trigger-Secret');
  if (!triggerSecret || triggerSecret !== Deno.env.get('TRIGGER_SECRET')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not set' }), { status: 500 });

  const TELEGRAM_API_KEY = Deno.env.get('TELEGRAM_API_KEY');
  if (!TELEGRAM_API_KEY) return new Response(JSON.stringify({ error: 'TELEGRAM_API_KEY not set' }), { status: 500 });

  let payload: NotifyPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Determine which users to notify
  let userIds: string[] = [];

  if (payload.targetUserIds && payload.targetUserIds.length > 0) {
    userIds = payload.targetUserIds;
  } else if (payload.partyId) {
    const { data: members } = await supabase
      .from('party_members')
      .select('user_id')
      .eq('party_id', payload.partyId);
    userIds = (members || []).map((m) => m.user_id);
  }

  // Exclude the triggering user
  if (payload.userId) {
    userIds = userIds.filter((id) => id !== payload.userId);
  }

  if (userIds.length === 0) {
    return new Response(JSON.stringify({ sent: 0, reason: 'no recipients' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Map notification type to the notification preference column
  const notifyColumn: Record<string, string> = {
    ready_up: 'notify_ready_up',
    timer_expired: 'notify_timer',
    combat_start: 'notify_combat',
    combat_turn: 'notify_combat',
    dragon_message: 'notify_dragon',
    condition_alert: 'notify_combat',
    custom: 'notify_ready_up',
  };

  const col = notifyColumn[payload.type] || 'notify_ready_up';

  // For dragon_message, fetch all linked accounts — the host is deliberately
  // sending this message and it should not be blocked by a player's notification prefs.
  const linkQuery = supabase
    .from('telegram_user_links')
    .select('chat_id, user_id, notify_modes')
    .in('user_id', userIds);

  // dragon_message and custom bypass the per-column boolean filter entirely —
  // these are host/DM-authored messages that should not be gated by player prefs.
  const bypassColumnFilter = payload.type === 'dragon_message' || payload.type === 'custom';
  const { data: allLinks } = bypassColumnFilter
    ? await linkQuery
    : await linkQuery.eq(col, true);

  // Filter by game mode if specified.
  // Exception: dragon_message always bypasses the notify_modes filter —
  // these are host-authored messages that should always reach the target
  // regardless of whether the player has configured empyrean mode notifications.
  let links = allLinks;
  if (links && payload.mode && !bypassColumnFilter) {
    links = links.filter((l: any) => {
      const modes: string[] = l.notify_modes ?? [];
      return modes.includes(payload.mode!);
    });
  }

  // Filter by target chat IDs if specified
  if (links && payload.targetChatIds && payload.targetChatIds.length > 0) {
    const targetSet = new Set(payload.targetChatIds);
    links = links.filter((l) => targetSet.has(l.chat_id));
  }

  if (!links || links.length === 0) {
    return new Response(JSON.stringify({ sent: 0, reason: 'no telegram links' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Build message based on type
  const emoji: Record<string, string> = {
    ready_up: '⚔️',
    timer_expired: '⏰',
    combat_start: '🗡️',
    combat_turn: '⚡',
    dragon_message: '🐉',
    condition_alert: '⚠️',
    custom: '📢',
  };

  const icon = emoji[payload.type] || '📢';
  let message = `${icon} <b>${payload.title}</b>\n\n${payload.body}`;

  // Enhanced formatting for specific types
  if (payload.type === 'dragon_message' && payload.dragonName) {
    message = `🐉 <b>${payload.dragonName}</b> <i>(Dragon Bond)</i>\n\n<i>"${payload.body}"</i>`;
  } else if (payload.type === 'condition_alert' && payload.conditionName) {
    message = `⚠️ <b>Condition: ${payload.conditionName}</b>\n\n${payload.body}`;
    if (payload.conditionRounds !== undefined) {
      message += `\n⏳ ${payload.conditionRounds} round${payload.conditionRounds === 1 ? '' : 's'} remaining`;
    }
  } else if (payload.type === 'combat_turn') {
    message = `⚡ <b>Your Turn!</b>\n\n${payload.body}\n\n<i>Use /hp to check health, /slots for spell slots</i>`;
  }

  // Send messages
  let sentCount = 0;
  const sendPromises = links.map(async (link) => {
    try {
      const res = await fetch(`${GATEWAY_URL}/sendMessage`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'X-Connection-Api-Key': TELEGRAM_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: link.chat_id,
          text: message,
          parse_mode: 'HTML',
        }),
      });
      if (res.ok) sentCount++;
      else {
        const err = await res.text();
        console.error(`Failed to send to ${link.chat_id}:`, err);
      }
    } catch (err) {
      console.error(`Error sending to ${link.chat_id}:`, err);
    }
  });

  await Promise.allSettled(sendPromises);

  return new Response(
    JSON.stringify({ sent: sentCount, total: links.length }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
