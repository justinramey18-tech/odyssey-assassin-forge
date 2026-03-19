import { supabase } from '@/integrations/supabase/client';

export interface TelegramNotifyPayload {
  type: 'ready_up' | 'timer_expired' | 'combat_start' | 'combat_turn' | 'dragon_message' | 'condition_alert' | 'custom';
  partyId?: string;
  targetUserIds?: string[];
  title: string;
  body: string;
  dragonName?: string;
  conditionName?: string;
  conditionRounds?: number;
}

/**
 * Send a Telegram notification via the authenticated proxy.
 * Non-blocking — catches and logs errors silently.
 * Use this for ALL client-side Telegram notification triggers.
 */
export function sendTelegramNotification(payload: TelegramNotifyPayload): void {
  supabase.functions
    .invoke('telegram-notify-proxy', { body: payload })
    .then(({ error }) => {
      if (error) console.warn('[telegram-notify] proxy error:', error);
    })
    .catch((err) => console.warn('[telegram-notify] failed:', err));
}
