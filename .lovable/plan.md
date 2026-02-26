

## Bug: Push Notifications Not Received When Other Players Ready Up

### Root Cause

There are two issues working together to cause this:

**Issue 1: `PartyDMScreen.tsx` requests notification permission but never registers the push subscription.**

`PartyDMScreen.tsx` (line 406-408) calls `requestPartyNotificationPermission()` on mount, but never calls `subscribePush()` afterward. The `usePushSubscription` hook is only used in `PartyPanel.tsx`. So if a user enters the DM screen without first opening the chat panel, their browser gets notification permission but their push subscription is never sent to the backend. The edge function then finds zero subscriptions for that user and pushes nothing.

**Issue 2: `usePushSubscription` auto-subscribe doesn't re-trigger after permission is granted.**

The hook's `useEffect` (line 109-112) fires when `user` changes. On first mount, `Notification.permission` is likely `'default'` (not yet granted), so `subscribe()` returns `false` on line 41. When the user later grants permission (via the browser prompt), the `useEffect` never re-fires because `user` hasn't changed. The push subscription is never registered.

### Why the user sees "push when I ready up"

When the user readies up, their app is in the foreground. The Realtime listener doesn't fire for their own action, but the in-app toast from the `setReady` flow is visible. On mobile PWAs, foreground toasts can appear similar to system notifications. The user is seeing the in-app toast, not a real push notification.

When another player readies up while the app is backgrounded, neither the Realtime toast (suspended WebSocket) nor the push notification (no subscription registered) reaches them.

### Fix Plan

**File 1: `src/components/ai-dm/PartyDMScreen.tsx`**
- Import and call `usePushSubscription` 
- After `requestPartyNotificationPermission()` resolves with `'granted'`, call `subscribePush()`

**File 2: `src/hooks/use-push-subscription.ts`**
- Add a `notificationPermission` state that tracks `Notification.permission`
- Listen for permission changes so auto-subscribe re-triggers when permission goes from `'default'` → `'granted'`
- Include `notificationPermission` in the `useEffect` dependency array so subscribe retries after permission is granted

**File 3: `supabase/functions/party-ready-notify/index.ts`**
- Add `console.log` statements for debugging: log member count, subscription count, and push results so future issues are diagnosable from edge function logs

### Summary of changes
1. Fix the permission→subscription gap so push subscriptions are registered reliably after permission is granted
2. Ensure `PartyDMScreen` also triggers push subscription registration
3. Add observability to the edge function for future debugging

