import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';

// VAPID public key — fetched from edge function on first subscribe
let cachedVapidKey: string | null = null;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const { user } = useAuth();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [isLoading, setIsLoading] = useState(false);

  // Check existing subscription on mount
  useEffect(() => {
    if (!user || !('serviceWorker' in navigator)) return;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration('/push-sw.js');
        if (reg) {
          const sub = await (reg as any).pushManager.getSubscription();
          setIsSubscribed(!!sub);
        }
      } catch {
        // ignore
      }
    })();
  }, [user]);

  const getVapidKey = useCallback(async (): Promise<string> => {
    if (cachedVapidKey) return cachedVapidKey;
    const { data, error } = await supabase.functions.invoke('send-party-notification', {
      body: { action: 'get-vapid-key' },
    });
    if (error || !data?.vapidPublicKey) throw new Error('Failed to fetch VAPID key');
    cachedVapidKey = data.vapidPublicKey;
    return cachedVapidKey!;
  }, []);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!user || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      return false;
    }
    setIsLoading(true);
    try {
      // Register push SW
      const reg = await navigator.serviceWorker.register('/push-sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;

      // Request permission
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        setIsLoading(false);
        return false;
      }

      // Get VAPID key and subscribe
      const vapidKey = await getVapidKey();
      const subscription = await (reg as any).pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      const subJson = subscription.toJSON();
      const endpoint = subJson.endpoint!;
      const p256dh = subJson.keys!.p256dh!;
      const auth = subJson.keys!.auth!;

      // Upsert to party_push_subscriptions
      console.log('[PushNotifications] Upserting subscription for user:', user.id, 'endpoint:', endpoint.slice(0, 60));
      const { error: upsertError } = await (supabase.from('party_push_subscriptions') as any).upsert({
        user_id: user.id,
        endpoint,
        p256dh,
        auth,
        notifications_enabled: true,
        platform: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
        user_agent: navigator.userAgent.slice(0, 200),
      }, { onConflict: 'user_id,endpoint' });

      if (upsertError) {
        console.error('[PushNotifications] Upsert failed:', upsertError);
        return false;
      }
      console.log('[PushNotifications] Subscription stored successfully');

      setIsSubscribed(true);
      return true;
    } catch (err) {
      console.error('[PushNotifications] Subscribe failed:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user, getVapidKey]);

  const unsubscribe = useCallback(async (): Promise<void> => {
    if (!user) return;
    try {
      const reg = await navigator.serviceWorker.getRegistration('/push-sw.js');
      if (reg) {
        const sub = await (reg as any).pushManager.getSubscription();
        if (sub) {
          await sub.unsubscribe();
          await (supabase.from('party_push_subscriptions') as any)
            .delete()
            .eq('user_id', user.id)
            .eq('endpoint', sub.endpoint);
        }
      }
      setIsSubscribed(false);
    } catch (err) {
      console.error('[PushNotifications] Unsubscribe failed:', err);
    }
  }, [user]);

  return { isSubscribed, permission, isLoading, subscribe, unsubscribe };
}
