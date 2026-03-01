

## Plan: Paste Playlist Links & Per-Preset Assignment

Allow players to paste a Spotify playlist URL/link directly onto any mood preset, giving them full control over which playlist plays for each mood.

### Changes

**1. `src/lib/spotify.ts`** — Add playlist URI extraction helper
- Add `extractPlaylistUri(input: string): string | null` that accepts:
  - Full URLs like `https://open.spotify.com/playlist/37i9dQZF1DX...`
  - Spotify URIs like `spotify:playlist:37i9dQZF1DX...`
  - Raw playlist IDs
- Returns a normalized `spotify:playlist:<id>` URI or null if invalid

**2. `src/components/spotify/DMSpotifyControls.tsx`** — Add paste-to-assign UI
- When a user **long-presses or taps an edit icon** on a preset, show a small inline input field where they can paste a Spotify playlist link
- Add a small "link" icon badge on presets that have a custom-assigned playlist (vs auto-searched)
- Add a "clear" option to remove a custom assignment and revert to search-based
- Update the "Add Preset" form to include an optional "Playlist Link" field so new custom presets can be created with a direct link from the start

**3. `src/hooks/use-spotify.ts`** — Add `assignPlaylistToPreset` method
- New method: `assignPlaylistToPreset(presetId: string, playlistUrl: string)` — validates the URL with `extractPlaylistUri`, fetches the playlist name via the Spotify API, and updates the preset with the URI and name
- Expose in return value

### UI Flow
1. Player taps a preset pill → opens a small popover/inline editor
2. Two options: "Search Spotify" (existing behavior) or "Paste Link"
3. Pasting a valid link immediately assigns and saves it
4. A small link icon on the pill indicates a custom assignment
5. Long-press or edit shows option to clear the custom link

### Technical Details
- Validates pasted URLs client-side before making any API calls
- Fetches playlist metadata (name, image) via `GET /playlists/{id}` to confirm it exists and display the name
- Falls back gracefully if the playlist is private or invalid
- No database changes needed — presets remain in localStorage

