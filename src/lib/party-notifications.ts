import { toast } from 'sonner';

/**
 * Detect if the app is running as an installed PWA (standalone mode).
 */
function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true
  );
}

/**
 * Detect iOS (iPhone/iPad).
 */
function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

/**
 * Request notification permission for party events.
 * On iOS Safari (not installed as PWA), shows a guidance toast instead
 * because iOS only supports push notifications in installed PWAs.
 */
export async function requestPartyNotificationPermission(): Promise<NotificationPermission> {
  // iOS Safari doesn't have Notification API at all unless installed as PWA
  if (!('Notification' in window)) {
    if (isIOS() && !isStandalone()) {
      toast.info('📲 To receive notifications on iPhone, install this app first: tap the Share button in Safari, then "Add to Home Screen".', {
        duration: 8000,
        id: 'ios-install-prompt',
      });
    }
    return 'denied';
  }

  if (Notification.permission !== 'default') return Notification.permission;

  try {
    const result = await Notification.requestPermission();
    if (result === 'granted') {
      toast.success('Notifications enabled! You\'ll be alerted when party members send messages.', {
        duration: 4000,
        id: 'notif-granted',
      });
    }
    return result;
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

  const options: NotificationOptions = {
    body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag,
    requireInteraction: false,
  };

  // Prefer ServiceWorkerRegistration.showNotification for Android/PWA reliability.
  try {
    const reg = await navigator.serviceWorker?.ready;
    if (reg) {
      await reg.showNotification(title, options);
      return;
    }
  } catch {
    // fallback below
  }

  try {
    new Notification(title, options);
  } catch {
    // silent
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
  }

  // Individual ready-up notification (always sent, even when all ready)
  // Push notification is handled server-side by party-ready-notify edge function
  const message = `${characterName} has readied up! (${readyCount}/${totalCount} ready)`;

  toast(`⚔️ ${message}`, {
    duration: 4000,
    icon: '⚔️',
    id: `ready-up-toast-${Date.now()}`,
  });
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
