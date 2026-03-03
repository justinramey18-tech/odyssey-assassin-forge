

## Problem

The `searchPlaylists` function in `src/lib/spotify.ts` uses Spotify's `/search` endpoint exclusively. This endpoint only searches **public** playlists across all of Spotify — it does not return the user's own private or collaborative playlists. That's why personal playlists are missing.

The "0 tracks" issue is likely due to the Spotify search API sometimes returning `tracks` as an object with only an `href` and no `total` for certain results, or returning `null` items that slip through.

## Plan

### 1. Add a "My Playlists" fetch function (`src/lib/spotify.ts`)
- Add a new `getUserPlaylists(query?: string)` function that calls `/me/playlists?limit=50`
- If a search query is provided, filter results client-side by name match

### 2. Update `searchPlaylists` to merge personal + public results (`src/lib/spotify.ts`)
- Call both `/me/playlists` and `/search` in parallel
- Deduplicate by playlist ID (personal results first)
- Return merged list so personal playlists always appear at the top

### 3. Fix "0 tracks" display (`src/components/settings/SpotifySettingsTab.tsx`)
- The `/me/playlists` endpoint returns `tracks.total` reliably
- For search results, fall back to `pl.tracks?.total ?? '?'` instead of `|| 0` to avoid showing misleading zeros

These changes touch two files: `src/lib/spotify.ts` and `src/components/settings/SpotifySettingsTab.tsx`.

