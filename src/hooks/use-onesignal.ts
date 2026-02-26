import { useEffect, useRef, useCallback } from 'react';
import OneSignal from 'react-onesignal';
import { useAuth } from '@/hooks/use-auth';

const ONESIGNAL_APP_ID = 'a3a12480-739c-4740-8f35-add20696b6c8';

let initPromise: Promise<void> | null = null;

/**
 * Initializes OneSignal Web SDK and logs in the current user
 * so they can be targeted by external_id from the backend.
 */
export function useOneSignal() {
  const { user } = useAuth();
  const loggedInRef = useRef(false);

  // Initialize OneSignal once globally
  useEffect(() => {
    if (!initPromise) {
      initPromise = OneSignal.init({
        appId: ONESIGNAL_APP_ID,
        allowLocalhostAsSecureOrigin: true,
        serviceWorkerParam: { scope: '/' },
        serviceWorkerPath: '/OneSignalSDKWorker.js',
        autoResubscribe: true,
        promptOptions: {
          slidedown: {
            prompts: [{
              type: 'push' as const,
              autoPrompt: true,
              delay: { pageViews: 1, timeDelay: 3 },
              text: {
                actionMessage: 'Get notified when your party sends messages or readies up!',
                acceptButton: 'Allow',
                cancelButton: 'Later',
              },
            }],
          },
        },
      }).catch((err) => {
        console.error('OneSignal init error:', err);
        initPromise = null;
      });
    }
  }, []);

  // Login user with their Supabase user ID as external_id
  useEffect(() => {
    if (!user || loggedInRef.current) return;

    const login = async () => {
      try {
        await initPromise;

        // Enable debug logging temporarily for diagnostics
        OneSignal.Debug.setLogLevel('debug');

        await OneSignal.login(user.id);
        loggedInRef.current = true;

        // Ensure push subscription is active
        await OneSignal.User.PushSubscription.optIn();

        const subId = OneSignal.User.PushSubscription.id;
        const optedIn = OneSignal.User.PushSubscription.optedIn;
        console.log('[OneSignal] Logged in as', user.id, '| Sub ID:', subId, '| Opted in:', optedIn);
      } catch (err) {
        console.error('[OneSignal] Login error:', err);
      }
    };

    login();
  }, [user]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      await initPromise;
      const permission = await OneSignal.Notifications.requestPermission();
      if (permission) {
        await OneSignal.User.PushSubscription.optIn();
        console.log('[OneSignal] Opted in after permission grant');
      }
      return permission;
    } catch (err) {
      console.error('[OneSignal] Permission request error:', err);
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await initPromise;
      await OneSignal.logout();
      loggedInRef.current = false;
    } catch (err) {
      console.error('[OneSignal] Logout error:', err);
    }
  }, []);

  return { requestPermission, logout };
}
