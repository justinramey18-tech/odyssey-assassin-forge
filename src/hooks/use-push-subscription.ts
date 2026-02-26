import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';

/**
 * VAPID public key for Web Push subscription.
 * Must match the VAPID_PUBLIC_KEY secret configured in the backend.
 */
const VAPID_PUBLIC_KEY = 'BNS-CRxKMjyKQBMFMqGwKR6I1Oc_1h6MBLJOVcVez2MHETDl3MaEKYb8i1zzpxFaYLFezCiNr8bz2haHiYaLfM';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Hook that subscribes the browser to Web Push notifications
 * and registers the subscription with the backend.
 * Call this once after the user joins a party and grants notification permission.
 */
export function usePushSubscription() {
  const { user } = useAuth();
  const subscribedRef = useRef(false);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
    if (Notification.permission !== 'granted') return false;

    try {
      const registration = await navigator.serviceWorker.ready;
      const pushManager = (registration as any).pushManager as PushManager;

      // Check for existing subscription first
      let subscription = await pushManager.getSubscription();

      if (!subscription) {
        subscription = await pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
        });
      }

      const key = subscription.getKey('p256dh');
      const auth = subscription.getKey('auth');
      if (!key || !auth) return false;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return false;

      const response = await supabase.functions.invoke('party-push-subscribe', {
        body: {
          action: 'subscribe',
          endpoint: subscription.endpoint,
          p256dh: arrayBufferToBase64Url(key),
          auth: arrayBufferToBase64Url(auth),
          platform: /android/i.test(navigator.userAgent) ? 'android'
            : /iPad|iPhone|iPod/.test(navigator.userAgent) ? 'ios'
            : 'desktop',
          userAgent: navigator.userAgent.slice(0, 200),
        },
      });

      if (response.error) {
        console.error('Push subscribe failed:', response.error);
        return false;
      }

      subscribedRef.current = true;
      return true;
    } catch (err) {
      console.error('Push subscription error:', err);
      return false;
    }
  }, [user]);

  const unsubscribe = useCallback(async (): Promise<void> => {
    if (!('serviceWorker' in navigator)) return;
    try {
      const registration = await navigator.serviceWorker.ready;
      const pushManager = (registration as any).pushManager as PushManager;
      const subscription = await pushManager.getSubscription();
      if (subscription) {
        await supabase.functions.invoke('party-push-subscribe', {
          body: { action: 'unsubscribe', endpoint: subscription.endpoint },
        });
        await subscription.unsubscribe();
      }
      subscribedRef.current = false;
    } catch (err) {
      console.error('Push unsubscribe error:', err);
    }
  }, []);

  // Auto-subscribe when conditions are met
  useEffect(() => {
    if (user && !subscribedRef.current) {
      subscribe();
    }
  }, [user, subscribe]);

  return { subscribe, unsubscribe, isSubscribed: subscribedRef.current };
}
