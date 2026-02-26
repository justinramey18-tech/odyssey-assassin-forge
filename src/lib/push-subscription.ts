/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from '@/integrations/supabase/client';

/**
 * VAPID public key — safe to expose in client code.
 * Generate a new pair with: npx web-push generate-vapid-keys
 */
const VAPID_PUBLIC_KEY = 'REPLACE_WITH_YOUR_VAPID_PUBLIC_KEY';

export type PushSubscriptionState =
  | 'supported'
  | 'unsupported'
  | 'denied'
  | 'subscribed'
  | 'unsubscribed';

/**
 * Detect push support, including iOS PWA requirements.
 */
export async function getPushSubscriptionState(): Promise<PushSubscriptionState> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return 'unsupported';
  }

  // iOS requires PWA (home screen) mode for push
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true;

  if (isIOS && !isStandalone) {
    return 'unsupported';
  }

  if (Notification.permission === 'denied') {
    return 'denied';
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await (registration as any).pushManager.getSubscription();
    return subscription ? 'subscribed' : 'unsubscribed';
  } catch (error) {
    console.error('Error checking push state:', error);
    return 'unsupported';
  }
}

/**
 * Subscribe this device to VAPID Web Push and persist to DB.
 */
export async function subscribeToPush(userId: string): Promise<boolean> {
  if (VAPID_PUBLIC_KEY === 'REPLACE_WITH_YOUR_VAPID_PUBLIC_KEY') {
    console.warn('VAPID public key not configured');
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready as any;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return false;
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    const subJSON = subscription.toJSON();

    const { error } = await supabase.from('party_push_subscriptions').upsert(
      {
        user_id: userId,
        endpoint: subscription.endpoint,
        p256dh: subJSON.keys?.p256dh ?? '',
        auth: subJSON.keys?.auth ?? '',
        notifications_enabled: true,
        platform: detectPlatform(),
        user_agent: navigator.userAgent.substring(0, 255),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,endpoint' },
    );

    if (error) {
      console.error('Failed to save push subscription:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Push subscription failed:', error);
    return false;
  }
}

/**
 * Unsubscribe from push and remove from DB.
 */
export async function unsubscribeFromPush(userId: string): Promise<void> {
  try {
    const registration = await navigator.serviceWorker.ready as any;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      await subscription.unsubscribe();
      await supabase
        .from('party_push_subscriptions')
        .delete()
        .eq('user_id', userId)
        .eq('endpoint', subscription.endpoint);
    }
  } catch (error) {
    console.error('Unsubscribe failed:', error);
  }
}

function detectPlatform(): string {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return 'android';
  if (/iPad|iPhone|iPod/i.test(ua)) return 'ios';
  if (/Windows/i.test(ua)) return 'windows';
  if (/Mac/i.test(ua)) return 'macos';
  if (/Linux/i.test(ua)) return 'linux';
  return 'unknown';
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
