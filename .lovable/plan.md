

## Diagnosis

The OneSignal error `"All included players are not subscribed"` means devices never completed push subscription registration. The current `init()` call has no `promptOptions`, so OneSignal never triggers the subscription flow. Even if the browser permission is "Allowed", OneSignal needs its own opt-in step.

## Plan: Fix OneSignal push subscription registration

### File: `src/hooks/use-onesignal.ts`

**Change 1 — Add `promptOptions` and `autoResubscribe` to `OneSignal.init()`:**

```typescript
initPromise = OneSignal.init({
  appId: ONESIGNAL_APP_ID,
  allowLocalhostAsSecureOrigin: true,
  serviceWorkerParam: { scope: '/' },
  serviceWorkerPath: '/OneSignalSDKWorker.js',
  autoResubscribe: true,
  promptOptions: {
    slidedown: {
      prompts: [{
        type: 'push',
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
}).catch(/* existing error handler */);
```

**Change 2 — After `OneSignal.login()`, explicitly call `optIn()` and add debug logging:**

```typescript
await OneSignal.login(user.id);
loggedInRef.current = true;

// Ensure push subscription is active
await OneSignal.User.PushSubscription.optIn();

const subId = OneSignal.User.PushSubscription.id;
const optedIn = OneSignal.User.PushSubscription.optedIn;
console.log('[OneSignal] Logged in as', user.id, '| Sub ID:', subId, '| Opted in:', optedIn);
```

**Change 3 — In `requestPermission`, call `optIn()` after permission grant:**

```typescript
const permission = await OneSignal.Notifications.requestPermission();
if (permission) {
  await OneSignal.User.PushSubscription.optIn();
  console.log('[OneSignal] Opted in after permission grant');
}
return permission;
```

**Change 4 — Enable debug logging temporarily to diagnose issues:**

Add after init resolves in the login effect:

```typescript
OneSignal.Debug.setLogLevel('debug');
```

### Why this fixes it

1. `autoPrompt: true` with slidedown triggers OneSignal's subscription registration flow
2. `autoResubscribe: true` re-registers returning users whose subscription expired
3. `optIn()` explicitly registers the push subscription with OneSignal servers -- this is the critical missing call
4. Debug logging will confirm subscription status in console

### Testing

1. Publish the app and open on two devices/browsers
2. Log in on both -- check console for `Sub ID: <non-null>` and `Opted in: true`
3. Verify subscribers appear in OneSignal dashboard under Audience > All Users
4. Send a chat message from one user -- the other should receive a push notification
5. Once confirmed working, remove `Debug.setLogLevel('debug')` line

