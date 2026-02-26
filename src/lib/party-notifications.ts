import { toast } from 'sonner';

/**
 * Request notification permission for party events.
 * Gracefully handles unsupported browsers.
 */
export async function requestPartyNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission !== 'default') return Notification.permission;

  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

/**
 * Send an in-app toast for ready-up events.
 * Push notifications are now handled server-side via the Postgres trigger
 * → send-party-notification edge function → VAPID Web Push.
 * This function only provides foreground UI feedback.
 */
export function sendReadyUpNotification(
  characterName: string,
  readyCount: number,
  totalCount: number,
): void {
  const allReady = readyCount >= totalCount && totalCount > 0;

  if (allReady) {
    const timestamp = new Date().toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });
    toast(`🎯 All ${totalCount} players readied up at ${timestamp}!`, {
      duration: 6000,
      icon: '🎯',
      id: 'all-ready-toast',
    });
  }

  // Individual ready-up toast (always shown, even when all ready)
  toast(`⚔️ ${characterName} has readied up! (${readyCount}/${totalCount} ready)`, {
    duration: 4000,
    icon: '⚔️',
    id: `ready-up-toast-${Date.now()}`,
  });
}
