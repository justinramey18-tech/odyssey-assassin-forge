

## Plan: PWA Web Push Notifications for Party Ready-Up and Chat

Most of the requested functionality already exists in the project (party system, lobby, ready-up via `party_dm_prompts`, real-time sync, auth, PWA, party codes). The missing piece is **push notifications** — previously attempted via OneSignal and removed.

This plan uses the **Web Push API** directly (no third-party SDK) with the VAPID keys already stored in backend secrets. This is simpler and more reliable than OneSignal or FCM for PWAs.

---

### Architecture

```text
Player clicks "Ready" → Client calls edge function → Edge function:
  1. Queries party_push_subscriptions for all party members
  2. Sends Web Push via VAPID to each subscription endpoint
  3. Logs to notifications_log table

Service Worker (push event) → Shows system notification with party deep link
```

---

### Step 1: Create `notifications_log` table

New migration to create the logging table:

```sql
CREATE TABLE public.notifications_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL,
  triggered_by_user_id uuid NOT NULL,
  triggered_by_name text NOT NULL DEFAULT 'Adventurer',
  ready_count integer NOT NULL DEFAULT 0,
  total_players integer NOT NULL DEFAULT 0,
  notification_type text NOT NULL DEFAULT 'ready',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can insert notifications"
  ON public.notifications_log FOR INSERT
  WITH CHECK (auth.uid() = triggered_by_user_id);

CREATE POLICY "Members can read party notifications"
  ON public.notifications_log FOR SELECT
  USING (is_party_member(auth.uid(), party_id));
```

---

### Step 2: Create `public/push-sw.js` service worker

A dedicated push service worker (separate from the Workbox PWA SW) that handles `push` and `notificationclick` events. Shows system notifications with the party deep link. Notifications stack (unique tag per event).

---

### Step 3: Create `src/hooks/use-push-notifications.ts`

Client-side hook that:
- Registers `push-sw.js` service worker
- Requests notification permission
- Subscribes via `PushManager.subscribe()` using the VAPID public key (fetched from an edge function or hardcoded)
- Stores the subscription (`endpoint`, `p256dh`, `auth`) in `party_push_subscriptions` table
- Provides `isSubscribed`, `subscribe()`, `unsubscribe()` to the UI

---

### Step 4: Create edge function `send-party-notification`

New edge function at `supabase/functions/send-party-notification/index.ts`:
- Accepts `{ partyId, triggerType, playerName, readyCount, totalPlayers }`
- Queries `party_push_subscriptions` for all members of the party (excluding sender)
- Sends Web Push using the `web-push` npm package (or raw fetch to the push endpoint with VAPID signing)
- Uses existing `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` secrets
- Logs to `notifications_log`
- Returns success/failure count

---

### Step 5: Wire up notification triggers

**Ready-up trigger** — In `use-party-dm.ts`, after a player sets `is_ready = true`, call the edge function:
```typescript
await supabase.functions.invoke('send-party-notification', {
  body: { partyId, triggerType: 'ready', playerName, readyCount, totalPlayers }
});
```

**Chat trigger** — In `use-party-sync.ts`, after `sendMessage`, call the edge function:
```typescript
await supabase.functions.invoke('send-party-notification', {
  body: { partyId, triggerType: 'chat', playerName, message: messagePreview }
});
```

---

### Step 6: Add notification opt-in UI

Add a bell icon button in the `PartyPanel` header that:
- Shows current permission state (granted/denied/default)
- Calls `subscribe()` from the hook on click
- Shows toast confirmation

---

### Step 7: Update `vite.config.ts`

Ensure `push-sw.js` is excluded from Workbox precaching so it remains as a standalone service worker file.

---

### Dependencies

- **No new npm packages** — Web Push API is browser-native on the client side
- **Deno `web-push` for edge function** — use `npm:web-push` import in the edge function for VAPID signing
- **Existing secrets** — `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` already configured

### Testing

1. Publish the app, open on two devices/browsers
2. Both users join a party and click the bell to subscribe
3. User A clicks "Ready" — User B should receive a system notification
4. User A sends a chat message — User B should receive a notification
5. Verify notifications appear when app is backgrounded

