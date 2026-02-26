

# Fix Background Notifications on Android

## Problem

The current implementation uses `new Notification()` directly from the main page thread. On Android, when you press the home button, the browser tab is suspended — JavaScript stops executing, and `new Notification()` silently fails or never fires. This is why you see nothing in your notification bar.

## Root Cause

To show notifications when the app is backgrounded on Android, the notification **must** be dispatched from the **Service Worker**, not from the page. The Service Worker stays alive even when the tab is suspended.

## Solution

Since the app already has a service worker via `vite-plugin-pwa` + Workbox, we need to:

1. **Create a custom service worker file** (`public/custom-sw.js`) that listens for `postMessage` events from the main thread and calls `self.registration.showNotification()` — the only API that works when the app is backgrounded on Android.

2. **Import the custom SW into the generated Workbox SW** by adding `injectManifest` or using VitePWA's `customWorkerSrc` — actually, the simplest approach is to use the `importScripts` option in the workbox config to pull in the custom file.

3. **Update `src/lib/party-notifications.ts`** to send notifications via the Service Worker instead of `new Notification()`:
   - Get the active SW registration via `navigator.serviceWorker.ready`
   - Post a message to the SW with the notification payload
   - The SW receives the message and calls `self.registration.showNotification()`
   - Fall back to `new Notification()` if no SW is available

## Files Changed

| File | Change |
|------|--------|
| `public/custom-sw.js` | **New** — Service worker script that listens for `SHOW_NOTIFICATION` messages and calls `self.registration.showNotification()` |
| `vite.config.ts` | Add `importScripts: ['/custom-sw.js']` to the workbox config so the custom code is included in the generated SW |
| `src/lib/party-notifications.ts` | Replace `new Notification()` with `navigator.serviceWorker.ready` → `postMessage()` to delegate notification display to the SW |

## Technical Detail

**`public/custom-sw.js`:**
```js
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SHOW_NOTIFICATION') {
    const { title, body, icon, badge, tag } = event.data.payload;
    self.registration.showNotification(title, { body, icon, badge, tag });
  }
});
```

**`party-notifications.ts` change:**
```typescript
// Instead of: new Notification('Party Ready Up', { ... })
// Use:
const reg = await navigator.serviceWorker?.ready;
if (reg?.active) {
  reg.active.postMessage({
    type: 'SHOW_NOTIFICATION',
    payload: { title, body, icon, badge, tag },
  });
} else {
  // Fallback for browsers without SW
  new Notification(title, { body, icon, badge, tag });
}
```

**`vite.config.ts` workbox addition:**
```typescript
workbox: {
  importScripts: ['/custom-sw.js'],
  // ... existing config
}
```

This ensures the notification is dispatched by the Service Worker, which Android keeps alive even when the PWA tab is in the background.

