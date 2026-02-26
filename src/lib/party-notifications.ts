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
 * Send a ready-up notification via in-app toast and browser push.
 * Tagged to replace (not stack) successive ready-up notifications.
 */
export function sendReadyUpNotification(
  characterName: string,
  readyCount: number,
  totalCount: number,
): void {
  const message = `${characterName} has readied up! (${readyCount}/${totalCount} ready)`;

  // In-app toast (always shown)
  toast(`⚔️ ${message}`, {
    duration: 4000,
    icon: '⚔️',
    id: 'ready-up-toast', // replace previous ready-up toast
  });

  // Browser push notification (if permitted & app is backgrounded)
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification('Party Ready Up', {
        body: `⚔️ ${message}`,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: 'ready-up', // replaces previous ready-up notification
        requireInteraction: false,
        silent: false,
      });
    } catch {
      // Fail silently if notification API errors
    }
  }
}
