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
export async function sendReadyUpNotification(
  characterName: string,
  readyCount: number,
  totalCount: number,
): Promise<void> {
  const message = `${characterName} has readied up! (${readyCount}/${totalCount} ready)`;

  // In-app toast (always shown)
  toast(`⚔️ ${message}`, {
    duration: 4000,
    icon: '⚔️',
    id: 'ready-up-toast',
  });

  // Browser push notification via Service Worker (works when backgrounded on Android)
  if ('Notification' in window && Notification.permission === 'granted') {
    const payload = {
      title: 'Party Ready Up',
      body: `⚔️ ${message}`,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: 'ready-up',
    };

    try {
      const reg = await navigator.serviceWorker?.ready;
      if (reg?.active) {
        reg.active.postMessage({ type: 'SHOW_NOTIFICATION', payload });
      } else {
        new Notification(payload.title, payload);
      }
    } catch {
      try { new Notification(payload.title, payload); } catch { /* silent */ }
    }
  }
}
