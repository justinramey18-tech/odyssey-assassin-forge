

## Plan: Server-Side Ready-Up Push Notifications

### Problem
Ready-up notifications are entirely client-side: the Realtime subscription in `use-party-dm.ts` calls `sendReadyUpNotification()` which fires a local push. When the app is backgrounded, the Realtime WebSocket is suspended by the OS, so no notification fires. Chat messages work in background because `party-chat-send` does server-side Web Push fan-out.

### Changes

#### 1. Create `supabase/functions/party-ready-notify/index.ts`
Clone the Web Push encryption helpers from `party-chat-send` (base64, HKDF, ECDH, VAPID, `sendWebPush`). The handler will:
- Accept `{ partyId, characterName, readyCount, totalCount }` 
- Auth the caller via JWT
- Fetch push subscriptions for all party members except the sender
- Build payload: `{ title: "⚔️ Party Ready Up", body: "CharName has readied up! (X/Y ready)" }` (or "🎯 All Players Ready!" when `readyCount >= totalCount`)
- Fan out via Web Push, clean up expired (410/404) subscriptions

#### 2. Register the function in `supabase/config.toml`
Add `[functions.party-ready-notify]` with `verify_jwt = false` (matches existing pattern; auth is done in-code).

#### 3. Update `src/hooks/use-party-dm.ts` — `setReady` callback
After the DB update/insert succeeds, call:
```typescript
supabase.functions.invoke('party-ready-notify', {
  body: { partyId, characterName, readyCount, totalCount }
});
```
Calculate `readyCount` from `currentPrompts` (adding 1 for self) and `totalCount` from `memberCount`.

#### 4. Update `src/lib/party-notifications.ts` — `sendReadyUpNotification`
Remove the `pushNotification()` calls (server handles push now). Keep the in-app toasts so foreground users still see them instantly.

### Files
- **Create:** `supabase/functions/party-ready-notify/index.ts`
- **Modify:** `src/hooks/use-party-dm.ts` (add edge function call in `setReady`)
- **Modify:** `src/lib/party-notifications.ts` (remove local push calls, keep toasts)

