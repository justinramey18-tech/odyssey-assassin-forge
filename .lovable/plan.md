

## Fix the broken update flow and stale-cache problem

### The problem in plain language

Right now, every time you publish a new version of the app, your phone keeps showing the old one until you manually wipe browser site data. The "Check for Updates" button doesn't reliably help. There are three cooperating reasons:

1. The offline/cache helper (the "service worker") that gets installed with new builds never actually takes over — it sits politely in the background waiting for permission that we never give it.
2. The app's main HTML page is cached aggressively, so even when new JavaScript files exist on the server, the browser keeps loading the old HTML, which still points at the old JavaScript.
3. The app has no "the new version just took over — reload now" listener, so even when an update does install, the page doesn't refresh to use it.

We have to fix all three together. Fixing one or two leaves the chain broken.

### What you'll see after this prompt

- Within ~30 seconds of a new deploy, the app reloads itself on your phone with the new version. No manual steps.
- Tapping **Settings → Check for Updates** either says "Update found! Applying…" and reloads within 1–2 seconds, or confirms "You have the latest version".
- No more clearing site data after deploys.
- Offline navigation still works (cached HTML is used as a fallback when the network is down).
- Auth, Supabase calls, and font caching all behave exactly as before.

### What's being changed

**1. `vite.config.ts` — the cache rules**
- Tell new background helpers to take over immediately (`skipWaiting`, `clientsClaim`).
- Clean up old leftover caches automatically (`cleanupOutdatedCaches`).
- Stop pre-caching `index.html`. Instead, always try the network first for it (with a 3-second timeout), falling back to cache only when offline. This is what makes new bundle hashes get picked up immediately.
- Keep all existing rules (Supabase = network only, Google Fonts = cache first) untouched.

**2. `src/main.tsx` — the auto-reload listener**
- Add a small block at the bottom that listens for "a new version just took control" and reloads the page once when it happens. A guard flag prevents reload loops.
- We do NOT manually register the service worker — the existing PWA plugin already does that.

**3. `src/components/settings/SettingsContent.tsx` — the Check for Updates button**
- Rewrite the button's handler to be more robust:
  - If a new version is already waiting → tell it to activate, show "Update found! Applying…", and let the new auto-reload listener handle the refresh (with an 8-second hard-fallback reload just in case).
  - If a new version is mid-install → wait for install to finish, then activate it.
  - If nothing's new → "You have the latest version".
  - Friendly messages for "no service worker" and "not supported" cases (e.g. local dev).
- The "Refresh App" button stays exactly as-is as a hard fallback.

### What stays untouched

- `public/custom-sw.js` (still imported as before).
- The PWA manifest, icons, theme colors, `registerType: 'autoUpdate'`.
- All other runtime caching rules (Supabase, Google Fonts, gstatic).
- The Updates & API settings section layout — only the button's logic changes.
- Every other component in `SettingsContent.tsx`.

### One-time caveat

The very first reload after this deploy will still show the old version once, because the currently-installed background helper has to be replaced by the new one. After that single transition, all future deploys will auto-update within ~30 seconds.

### Verification

- App compiles cleanly.
- After the one-time transition reload, push a tiny visible change → phone updates itself within ~30 seconds.
- Check for Updates button shows correct messages in all three states (update found / installing / up to date).
- Offline navigation still works.
- Console shows `[SW] New service worker activated — reloading for fresh bundles` once per update.

