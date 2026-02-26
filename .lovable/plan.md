
Goal: make party chat notifications reliable for Android + iPhone in the background, including messages sent by the same account, while users are signed in.

What I found (root causes)
1) Current notifications are client-side only, not true server push:
- `src/hooks/use-party-sync.ts` triggers `sendChatMessageNotification(...)` only when realtime events are received in the browser.
- If iOS/Android suspends the web app process in background, that realtime callback won’t run consistently.
- This explains “worked once on Android, then not again” behavior.

2) Current “push” helper is still page-context initiated:
- `src/lib/party-notifications.ts` uses `navigator.serviceWorker.ready` + `reg.showNotification(...)`, but this still depends on page JS being alive enough to execute.
- There is no `push` event pipeline in `public/custom-sw.js` for true remote Web Push delivery.

3) iPhone limitation is real and non-negotiable:
- iOS web push only works for Home Screen installed web apps opened from Safari install flow.
- If used as regular URL tab, permission path is unavailable or unreliable by platform design.

4) There is no backend subscription + send pipeline yet:
- No table for push subscriptions.
- No backend function that sends Web Push to subscribed devices on new `party_messages`.
- No `PushManager.subscribe()` flow on the client.

Decision/Design (workaround + real fix)
- Workaround (immediate UX clarity): enforce and clearly surface install requirements on iPhone, plus a diagnostics/test button.
- Real fix (reliability): move chat notifications to true backend-driven Web Push using Lovable Cloud functions + stored device subscriptions.

Architecture to implement
```text
User opens app (signed in)
  -> app requests notification permission
  -> app creates/refreshes PushSubscription via Service Worker
  -> app upserts subscription in backend (device endpoint + keys + user_id)

User sends party chat message
  -> backend function inserts message into party_messages
  -> backend function resolves party recipients (including sender account by your requirement)
  -> backend function sends Web Push to all active subscriptions
  -> Service Worker 'push' event shows OS notification
  -> tapping notification opens/focuses app to party chat
```

Implementation plan (files + scope)

Phase 1: Build true backend Web Push pipeline
A) Database migration
- New table: `public.party_push_subscriptions`
  - `id uuid pk`
  - `user_id uuid not null`
  - `endpoint text unique not null`
  - `p256dh text not null`
  - `auth text not null`
  - `platform text`
  - `user_agent text`
  - `notifications_enabled boolean default true`
  - timestamps + `last_seen_at`
- RLS:
  - user can CRUD only own subscriptions (`auth.uid() = user_id`)
- Indexes:
  - `user_id`, `notifications_enabled`, `last_seen_at`
- Optional cleanup function for stale endpoints.

B) Backend functions (Lovable Cloud)
1. `party-push-subscriptions`:
- `POST` upsert subscription for current user
- `DELETE` remove endpoint (unsubscribe / invalid token cleanup)
- validates auth from bearer token

2. `party-chat-send`:
- authenticated endpoint replacing direct client insert for party chat
- validates sender is party member
- inserts into `party_messages`
- finds all party members (including sender user id per requirement)
- fetches active subscriptions
- sends Web Push payload to each endpoint
- handles `410/404` endpoint invalidation by soft-deleting/removing bad subscriptions
- returns inserted message row for optimistic UI consistency.

Phase 2: Service Worker true push handling
File: `public/custom-sw.js`
- Add:
  - `self.addEventListener('push', ...)` to parse payload and call `self.registration.showNotification(...)`
  - robust fallback when payload is empty
  - include `data` payload (partyId, route target)
- Keep `notificationclick` but route to party chat deep link (e.g. `/?panel=party&chat=1&partyId=...`).

Phase 3: Client subscription lifecycle
Files:
- `src/lib/party-notifications.ts`
- new hook `src/hooks/use-party-push-subscription.ts` (or equivalent in existing party hooks)
- responsibilities:
  - check iOS standalone + permission status
  - register/refresh `PushSubscription` with `pushManager.subscribe(...)`
  - send subscription payload to `party-push-subscriptions`
  - retry on app resume/visibilitychange
  - expose diagnostics state for UI

Phase 4: Route party chat sending through backend sender
File: `src/hooks/use-party-sync.ts`
- Update `sendMessage(...)` to call `party-chat-send` function instead of direct table insert.
- Keep realtime subscription for message rendering, but remove local dependency for notification delivery.
- Adjust local notify filter logic to avoid duplicate in-app toasts when server push is now primary.

Phase 5: iPhone install + permission UX hardening
Files:
- `src/components/party/PartyPanel.tsx`
- `src/pages/Install.tsx`
- `src/components/home/InstallBanner.tsx`
- Improvements:
  - if iOS non-standalone: persistent “Install to enable notifications” CTA
  - one-tap route to install instructions
  - explicit status text: “Notifications unavailable until installed”
  - permission request after install + first chat open

Phase 6: User controls + diagnostics
Files:
- `src/components/settings/GameModeSettings.tsx`
- possibly `src/components/settings/SettingsContent.tsx`
- Keep existing `showPartyChatNotifications` toggle and bind it to backend subscription state:
  - OFF => disable/remove subscription(s) for this device
  - ON => register/refresh subscription
- Add “Send test notification” action for quick verification on mobile.

Platform behavior after fix
- Android: notifications delivered even when tab is backgrounded/suspended (as long as subscription exists and browser/device allows background push).
- iPhone: reliable only when installed to Home Screen and permission granted; regular Safari tab remains unsupported by Apple platform policy.
- Own messages: included by backend recipient resolution (including sender account subscriptions).

Data/security considerations
- All subscription rows scoped by authenticated user via RLS.
- Notification send function validates party membership before sending.
- No anonymous flow.
- Keep sensitive private VAPID key in backend secrets only.
- Invalid endpoints are pruned automatically on send failures.

Test plan (must pass before rollout)
1) Android E2E (first priority)
- Sign in on two Android devices/accounts in same party.
- Enable notifications on both.
- Background receiver app.
- Send 10+ messages rapidly from Home Party Chat.
- Verify 10+ notifications appear in notification tray (stacking behavior acceptable).

2) iPhone E2E
- In Safari tab (not installed): verify install-required messaging appears.
- Install via Add to Home Screen.
- Open installed app, grant permission, background app.
- Send party messages from another member.
- Verify notifications consistently appear in iOS Notification Center.

3) Own-message delivery
- Same account on two devices.
- Send from device A while device B is backgrounded.
- Verify B gets notification for own-account message.

4) Toggle behavior
- Turn Party Chat Notifications OFF on one device.
- Verify no push on that device, while other devices still receive.

5) Regression checks
- Ready-up notifications still function.
- Party chat UI + realtime updates remain immediate.
- No console errors in service worker or message send flows.

Technical details (for implementation handoff)
- Replace client-side “notify on realtime callback” as primary mechanism with server-side fanout.
- Keep realtime for UI sync only.
- Introduce Web Push standards:
  - VAPID public key on client
  - VAPID private key in backend secret
  - `PushSubscription` persisted per device endpoint
  - service worker `push` event is mandatory.
- This is the only path to close the reliability gap caused by OS background process suspension.

Acceptance criteria
- Users receive party chat notifications while app is backgrounded on Android.
- iPhone users receive notifications when using installed Home Screen app and granted permission.
- Notification delivery no longer depends on active realtime JS callback in foreground tab.
- Sender’s own messages are included in push delivery set.
