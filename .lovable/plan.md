

## Spotify Ambient Music Integration

### Overview
Add Spotify integration for ambient D&D music. Users authenticate with Spotify via PKCE OAuth, then can search/browse curated playlists and control playback -- all within the existing settings and DM screens.

**Important caveat**: Spotify Web Playback SDK requires a **Spotify Premium** account to play audio directly in the browser. For free-tier users, the app can control playback on their active Spotify device (phone/desktop app) via the Connect API. We'll support both paths.

### Architecture

```text
┌─────────────────────┐     PKCE OAuth      ┌──────────────┐
│  Browser (React)    │ ◄──────────────────► │ Spotify Auth │
│                     │                      └──────────────┘
│  SpotifyPlayer      │──── Web Playback SDK (Premium)
│  component          │──── Connect API (control external device)
│                     │
│  Edge Function      │──── Token refresh via client_secret
│  spotify-auth       │     (stored as backend secret)
└─────────────────────┘
```

### What gets built

**1. Backend: `spotify-auth` edge function**
- Handles token exchange (auth code → access/refresh tokens) and token refresh
- Uses your Spotify Client ID + Client Secret (stored as backend secrets: `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`)
- Client ID will also be exposed on the frontend (it's a publishable key)

**2. Spotify Auth Flow (PKCE + backend token exchange)**
- New `src/lib/spotify.ts` -- PKCE helpers, token storage in localStorage, auth redirect/callback
- Callback handled at current URL with `?code=` param detection
- Tokens: access token (1hr), refresh token (via edge function)

**3. Settings UI: New "Spotify" tab in Settings**
- Add a new settings tab (icon: Music) between ElevenLabs and App & System
- Contains: Connect/Disconnect button, playlist search, mood presets, volume control
- Mood presets: "D&D Combat", "Tavern & Inn", "Dark Dungeon", "Forest Exploration", "Epic Boss Battle", "Mystery & Intrigue"
- Each preset searches Spotify for matching playlists and lets user pick one

**4. Ambient Player Component**
- Floating mini-player (bottom corner) visible during DM sessions
- Shows: track name, play/pause, skip, volume
- Uses Spotify Web Playback SDK for Premium users
- Falls back to Connect API for free-tier (controls their Spotify app)

**5. Auto-mood detection (stretch feature)**
- When DM narrates, detect keywords ("combat", "tavern", "dragon") and auto-switch playlist
- Leverages existing AI DM message stream

### Files to create/modify

| File | Action |
|------|--------|
| `supabase/functions/spotify-auth/index.ts` | Create -- token exchange + refresh |
| `src/lib/spotify.ts` | Create -- PKCE flow, API helpers, token management |
| `src/components/settings/SpotifySettingsTab.tsx` | Create -- connect, playlists, mood presets |
| `src/components/spotify/SpotifyPlayer.tsx` | Create -- floating mini-player |
| `src/hooks/use-spotify.ts` | Create -- auth state, playback control, playlist management |
| `src/components/settings/MobileSettingsTabs.tsx` | Modify -- add Spotify tab |
| `src/components/settings/SettingsContent.tsx` | Modify -- render Spotify tab |

### Secrets needed
- `SPOTIFY_CLIENT_ID` -- your Client ID (also used client-side, publishable)
- `SPOTIFY_CLIENT_SECRET` -- your Client Secret (edge function only, private)

### Implementation order
1. Store secrets (Client ID + Client Secret)
2. Create `spotify-auth` edge function
3. Create `src/lib/spotify.ts` with PKCE + API helpers
4. Create `use-spotify` hook
5. Create Settings tab with connect button + playlist browser
6. Create floating player component
7. Wire into DM screen

