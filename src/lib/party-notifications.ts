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
 * Helper: send a push notification via Service Worker (preferred on Android)
 * or fallback to the Notification constructor.
 */
async function pushNotification(title: string, body: string, tag: string): Promise<void> {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const payload = {
    title,
    body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag,
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

    await pushNotification('🎯 All Players Ready!', allMessage, `all-ready-${Date.now()}`);
  }

  // Individual ready-up notification (always sent, even when all ready)
  const message = `${characterName} has readied up! (${readyCount}/${totalCount} ready)`;

  toast(`⚔️ ${message}`, {
    duration: 4000,
    icon: '⚔️',
    id: `ready-up-toast-${Date.now()}`,
  });

  await pushNotification('Party Ready Up', `⚔️ ${message}`, `ready-up-${Date.now()}`);
}

/**
 * Send a chat message notification via in-app toast and browser push.
 * Each notification gets a unique tag so they stack on Android.
 * Skips the in-app toast when the page is hidden (backgrounded) to avoid
 * queued toasts flooding the screen on return.
 */
export async function sendChatMessageNotification(
  senderName: string,
  messageText: string,
): Promise<void> {
  // Only show in-app toast when page is visible
  if (document.visibilityState === 'visible') {
    toast(`💬 ${senderName}: ${messageText}`, {
      duration: 4000,
      icon: '💬',
      id: `chat-msg-toast-${Date.now()}`,
    });
  }

  await pushNotification(`💬 ${senderName}`, messageText, `chat-msg-${Date.now()}`);
}
