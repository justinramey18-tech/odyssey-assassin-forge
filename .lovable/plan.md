

## Plan: Embed Spotify Web Playback SDK

Add an in-browser Spotify player so Premium users can play music without opening Spotify separately.

### How It Works
The Web Playback SDK creates a virtual player device in the browser. When a user plays a mood preset, it targets this embedded device instead of requiring an external Spotify app.

### Changes

**1. `index.html`** — Load the SDK script
- Add `<script src="https://sdk.scdn.co/spotify-player.js"></script>`

**2. `src/lib/spotify-player-sdk.ts`** (new file) — SDK wrapper
- Initialize `Spotify.Player` with the user's access token
- Handle `ready`, `not_ready`, `player_state_changed` events
- Export `initPlayer()`, `destroyPlayer()`, `getDeviceId()`
- Auto-reconnect on token refresh

**3. `src/hooks/use-spotify.ts`** — Integrate the SDK player
- When connected and Premium, call `initPlayer()` to create the browser device
- Store the SDK device ID so `playPlaylist` can target it as a fallback when no other device is active
- On disconnect, call `destroyPlayer()`
- Update `playPlaylist`: if no active external device found, use the SDK device ID

**4. `src/components/spotify/DMSpotifyControls.tsx`** — UI indicator
- Show a small badge/label like "Playing in browser" when the SDK device is active
- Show "Requires Premium" note near the embedded player toggle for Free users

### Limitations
- **Premium only** — Free accounts cannot use the SDK; they still need the Spotify app open
- The `isPremium` check already exists in the hook, so we gate SDK initialization on it

### No database or edge function changes needed.

