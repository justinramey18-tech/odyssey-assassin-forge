import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { VAPID_PUBLIC_KEY, urlBase64ToUint8Array } from '@/lib/vapid-public-key';

// Extend ServiceWorkerRegistration to include pushManager (not in all TS lib targets)
interface PushManagerRegistration extends ServiceWorkerRegistration {
  pushManager: PushManager;
}
/**
 * Manages the Web Push subscription lifecycle:
 * - Requests notification permission
 * - Creates/refreshes PushSubscription via PushManager
 * - Upserts subscription to backend
 * - Handles re-subscription on app resume
 */
export function usePartyPushSubscription(partyId: string | null) {
  const { user } = useAuth();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const subscriptionRef = useRef<PushSubscription | null>(null);

  // Check if Web Push is supported
  useEffect(() => {
    const supported = 'serviceWorker' in navigator
      && 'PushManager' in window
      && 'Notification' in window;
    setIsSupported(supported);
  }, []);

  // Subscribe to push notifications
  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!user || !isSupported) return false;

    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.log('[PushSub] Permission denied');
        return false;
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready as PushManagerRegistration;

      // Check for existing subscription
      let subscription = await registration.pushManager.getSubscription();

      // Create new subscription if none exists
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleNotificationsOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
        } as PushSubscriptionOptionsInit);
      }

      subscriptionRef.current = subscription;

      // Extract keys
      const rawKey = subscription.getKey('p256dh');
      const rawAuth = subscription.getKey('auth');

      if (!rawKey || !rawAuth) {
        console.error('[PushSub] Missing subscription keys');
        return false;
      }

      const p256dh = arrayBufferToBase64url(rawKey);
      const auth = arrayBufferToBase64url(rawAuth);

      // Detect platform
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isAndroid = /Android/.test(navigator.userAgent);
      const platform = isIOS ? 'ios' : isAndroid ? 'android' : 'desktop';

      // Send subscription to backend
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('party-push-subscribe', {
        body: {
          endpoint: subscription.endpoint,
          p256dh,
          auth,
          platform,
          userAgent: navigator.userAgent.slice(0, 200),
        },
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (res.error) {
        console.error('[PushSub] Backend error:', res.error);
        return false;
      }

      setIsSubscribed(true);
      console.log('[PushSub] Subscribed successfully');
      return true;
    } catch (err) {
      console.error('[PushSub] Subscription failed:', err);
      return false;
    }
  }, [user, isSupported]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async (): Promise<void> => {
    if (!user) return;

    try {
      const subscription = subscriptionRef.current;
      if (subscription) {
        // Remove from backend
        const { data: { session } } = await supabase.auth.getSession();
        await supabase.functions.invoke('party-push-subscribe', {
          method: 'DELETE',
          body: { endpoint: subscription.endpoint },
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        });

        // Unsubscribe from browser
        await subscription.unsubscribe();
        subscriptionRef.current = null;
      }

      setIsSubscribed(false);
    } catch (err) {
      console.error('[PushSub] Unsubscribe failed:', err);
    }
  }, [user]);

  // Auto-subscribe when party is active and user is authenticated
  useEffect(() => {
    if (!partyId || !user || !isSupported) return;

    // Check if already subscribed
    const checkExisting = async () => {
      try {
        const registration = await navigator.serviceWorker.ready as PushManagerRegistration;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          subscriptionRef.current = subscription;
          setIsSubscribed(true);

          // Refresh the backend record (update last_seen_at)
          const rawKey = subscription.getKey('p256dh');
          const rawAuth = subscription.getKey('auth');
          if (rawKey && rawAuth) {
            const { data: { session } } = await supabase.auth.getSession();
            await supabase.functions.invoke('party-push-subscribe', {
              body: {
                endpoint: subscription.endpoint,
                p256dh: arrayBufferToBase64url(rawKey),
                auth: arrayBufferToBase64url(rawAuth),
                platform: /iPad|iPhone|iPod/.test(navigator.userAgent) ? 'ios' :
                  /Android/.test(navigator.userAgent) ? 'android' : 'desktop',
                userAgent: navigator.userAgent.slice(0, 200),
              },
              headers: {
                Authorization: `Bearer ${session?.access_token}`,
              },
            });
          }
        }
      } catch (err) {
        console.error('[PushSub] Check existing failed:', err);
      }
    };

    checkExisting();
  }, [partyId, user, isSupported]);

  // Re-subscribe on visibility change (app foregrounded)
  useEffect(() => {
    if (!partyId || !user || !isSupported) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isSubscribed) {
        // Refresh subscription silently
        subscribe().catch(console.error);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [partyId, user, isSupported, isSubscribed, subscribe]);

  return {
    isSubscribed,
    isSupported,
    subscribe,
    unsubscribe,
  };
}

// Helper: ArrayBuffer to URL-safe base64
function arrayBufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let str = '';
  for (const byte of bytes) str += String.fromCharCode(byte);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
