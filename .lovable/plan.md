

# Fix: PWA Service Worker Blocking Authentication on Cached Devices

## Root Cause

The app is a PWA with a service worker (configured in `vite.config.ts` via `VitePWA`). The service worker aggressively caches all assets but has **no exclusions for authentication API calls** or auth-related routes.

On your Galaxy A14 (which has been using the app longer), the service worker is likely:
- Intercepting Supabase auth network requests and serving stale/cached responses
- Caching the `/auth` navigation route in ways that prevent proper form submission

Your Galaxy A15 works because it either has a fresh install (no stale service worker) or hasn't cached the problematic responses yet.

## Fix

### File: `vite.config.ts` (workbox config, around line 51)

Add two things to the `workbox` configuration:

1. **`navigateFallbackDenylist`** to prevent the service worker from intercepting auth routes and OAuth callbacks:
   - `/^\/auth/` 
   - `/^\/reset-password/`
   - `/^\/~oauth/`

2. **A `NetworkOnly` runtime caching rule** for all Supabase API calls so auth requests always hit the network and are never served from cache:
   - Pattern: any request to the Supabase project URL (`rkkgmonjfvncpvlzsojw.supabase.co`)

### Result

```
workbox: {
  navigateFallbackDenylist: [/^\/auth/, /^\/reset-password/, /^\/~oauth/],
  globPatterns: [...],  // unchanged
  maximumFileSizeToCacheInBytes: ...,  // unchanged
  runtimeCaching: [
    {
      // NEW: Never cache Supabase API calls (auth, database, etc.)
      urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
      handler: "NetworkOnly",
    },
    // ...existing font caching rules unchanged
  ],
}
```

### Why This Fixes It
- Auth sign-in requests will **always go to the network**, never served from a stale cache
- Navigation to `/auth` won't be hijacked by the service worker's fallback
- After deployment, the `registerType: "autoUpdate"` setting will push the new service worker to your A14 automatically on next visit

### Additional Note
After this fix deploys, you may need to **clear your browser data / site data** on the Galaxy A14 once to flush the old broken service worker. After that, the new one takes over and the problem won't recur.

