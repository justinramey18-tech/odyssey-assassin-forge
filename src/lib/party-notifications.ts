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
  const allReady = readyCount >= totalCount && totalCount > 0;
  const timestamp = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  if (allReady) {
    const allMessage = `All ${totalCount} players readied up at ${timestamp}!`;

    toast(`🎯 ${allMessage}`, {
      duration: 6000,
      icon: '🎯',
      id: 'all-ready-toast',
    });

    if ('Notification' in window && Notification.permission === 'granted') {
      const payload = {
        title: '🎯 All Players Ready!',
        body: allMessage,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: `all-ready-${Date.now()}`,
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

  // Individual ready-up notification (always sent, even when all ready)
  const message = `${characterName} has readied up! (${readyCount}/${totalCount} ready)`;

  toast(`⚔️ ${message}`, {
    duration: 4000,
    icon: '⚔️',
    id: `ready-up-toast-${Date.now()}`,
  });

  if ('Notification' in window && Notification.permission === 'granted') {
    const payload = {
      title: 'Party Ready Up',
      body: `⚔️ ${message}`,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: `ready-up-${Date.now()}`,
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
