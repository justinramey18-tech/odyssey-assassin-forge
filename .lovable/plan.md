

## Diagnosis

Two problems preventing notifications:

1. **No subscribers exist** — The `party_push_subscriptions` table is empty. The bell icon opt-in was added but no unique constraint exists on `(user_id, endpoint)`, so the `upsert` with `onConflict: 'user_id,endpoint'` silently fails. Users who clicked subscribe were never actually stored.

2. **Ready-up only fires on first ready** — The `setReady` function fires the notification, but after `unready` + re-ready, the notification should fire again every time. The current code does handle this (it calls the edge function each time `setReady` is called), but since there are no subscribers stored, nothing is delivered.

## Plan

### Step 1: Add unique constraint on `party_push_subscriptions`

Database migration to add the missing unique constraint so the upsert actually works:

```sql
ALTER TABLE public.party_push_subscriptions
  ADD CONSTRAINT party_push_subscriptions_user_endpoint_unique
  UNIQUE (user_id, endpoint);
```

### Step 2: Add console logging to subscription flow

In `src/hooks/use-push-notifications.ts`, add `console.log` after the upsert call to confirm the subscription was stored, and log any errors from the upsert so failures are visible during testing.

### Step 3: Add logging to the edge function

Add `console.log` statements in `send-party-notification/index.ts` to trace execution: log the number of members found, subscriptions queried, and send results. This will make debugging visible in the function logs.

### Step 4: Verify ready-up notification fires on every ready (including after undo)

The current `setReady` already calls the edge function unconditionally each time it's invoked — this is correct. The fix is the subscription storage (Step 1). No logic change needed for re-ready after undo.

### Testing

1. Publish the app
2. Open on two devices/browsers, log in on both, join same party
3. Both users click the bell icon to subscribe — check console for successful storage log
4. User A clicks Ready — User B should receive a push notification
5. User A clicks Undo, then Ready again — User B should receive another notification

