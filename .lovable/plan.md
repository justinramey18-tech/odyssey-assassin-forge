

## What's happening (plain English)

Your iPhone user is hitting **two separate iOS-specific bugs** that compound each other:

### Bug 1: Auth session lost when switching from Safari to Home Screen app

When a user signs in via Safari and then installs the app to their Home Screen, **iOS treats the installed PWA as a completely separate browser context**. It does not share cookies, localStorage, or session tokens with Safari. So the user signs in on Safari, installs the app, opens the Home Screen version — and it has a blank localStorage with no auth session. They appear "not signed in."

Even if they sign in again inside the installed app, iOS can sometimes **wipe the standalone PWA's localStorage** during storage pressure events or after periods of inactivity, logging them out silently.

### Bug 2: Notifications only work "in the app"

This is the same root cause from the approved plan — the current notification system is entirely client-side. The `sendChatMessageNotification` function in `party-notifications.ts` runs in page JavaScript context. If iOS suspends the PWA process (which it does aggressively), no JS runs, no notifications fire. The `push` event listener exists in `custom-sw.js` but there is no backend actually sending Web Push payloads to trigger it.

---

## Fix plan

### Fix A — Resilient auth session persistence for iOS standalone PWA

**Problem**: `localStorage` is unreliable on iOS standalone. Sessions get wiped.

**Solution**: 
1. The Supabase client is already configured with `storage: localStorage` and `persistSession: true` — this is correct, but insufficient for iOS standalone where localStorage can be purged.
2. Add a **session recovery mechanism**: on app mount, if `useAuth` finds no session but the user was previously signed in (tracked via a secondary indicator like IndexedDB or a cookie), show a "Session expired — please sign in again" prompt instead of silently appearing logged out.
3. Add a **visible auth status indicator** in the party/home UI so the user always knows their sign-in state.
4. Add guidance in the install flow (`Install.tsx`) warning users they'll need to sign in again after installing to Home Screen.

**Files to modify**:
- `src/hooks/use-auth.ts` — Add session recovery detection and "was previously signed in" tracking via IndexedDB (more durable than localStorage on iOS)
- `src/pages/Install.tsx` — Add clear messaging: "You'll need to sign in again after installing"
- `src/components/party/PartyPanel.tsx` — Show auth status; if not authenticated, prompt sign-in before enabling party features

### Fix B — Complete the backend Web Push pipeline (from approved plan)

This is Phase 1 of the already-approved plan. Without the backend sending actual Web Push payloads, the `push` event listener in `custom-sw.js` will never fire. The service worker can only wake up and show notifications if a remote server sends a push message to the subscription endpoint.

**Already built** (from prior implementation):
- `public/custom-sw.js` has `push` event listener
- `src/hooks/use-push-subscription.ts` exists  
- `supabase/functions/party-push-subscribe/index.ts` exists
- `supabase/functions/party-chat-send/index.ts` exists

**Still needed**:
- Database table `party_push_subscriptions` must actually exist (migration needs to run)
- VAPID public key placeholder in `use-push-subscription.ts` line 11 needs real value
- `use-party-sync.ts` `sendMessage` must route through `party-chat-send` edge function
- Edge functions need `VAPID_PRIVATE_KEY` secret configured and accessible

### Fix C — iOS install flow UX hardening

**Files to modify**:
- `src/pages/Install.tsx` — Add step: "After installing, open the app from your Home Screen and sign in again"
- `src/components/home/InstallBanner.tsx` — For iOS users in Safari, add explicit warning about needing to re-authenticate after install

---

## Implementation order

1. **Database migration**: Create `party_push_subscriptions` table with RLS
2. **Auth resilience**: Add IndexedDB-backed "was signed in" flag + session-expired detection in `use-auth.ts`
3. **Install UX**: Update `Install.tsx` with re-auth messaging for iOS
4. **VAPID key**: Replace placeholder in `use-push-subscription.ts` with real public key
5. **Wire up send path**: Ensure `party-chat-send` edge function is called for messages
6. **Test on iPhone**: Install to Home Screen → sign in → background app → receive push

## Technical details

- **IndexedDB vs localStorage on iOS**: IndexedDB is slightly more durable under iOS storage pressure than localStorage, but neither is guaranteed permanent. The real fix is graceful session recovery UX, not fighting the platform.
- **Supabase auth tokens**: Stored in localStorage under `sb-<project-ref>-auth-token`. When iOS wipes localStorage, this key disappears and `getSession()` returns null.
- **Service Worker scope**: The workbox-generated SW with `custom-sw.js` imported is correctly scoped to `/`. iOS standalone mode does activate service workers, so the `push` listener will work once the backend actually sends payloads.

