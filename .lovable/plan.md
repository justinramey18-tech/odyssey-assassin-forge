

## Plan: Auto-Mood — AI DM Automatically Sets Spotify Presets Based on Story

### How It Works
After each AI DM response, if Auto-Mood is enabled and Spotify is connected, a lightweight post-processing step extracts the narrative mood and maps it to a matching preset, then auto-plays it.

### Architecture

```text
AI Response Complete
       │
       ▼
handleMessageComplete()
       │
       ├─ (existing) auto-sync extraction
       ├─ (existing) memory extraction  
       └─ (NEW) mood detection + auto-play
              │
              ▼
        Call a small function that:
        1. Takes last AI response text
        2. Matches mood keywords against preset search queries
        3. If mood changed → play matching preset via spotify.playPlaylist()
```

### Changes

**1. `src/lib/spotify.ts`** — Add Auto-Mood localStorage key + helpers
- Add `autoMood` key to `KEYS`
- Export `loadAutoMood()` / `saveAutoMood()` functions
- Export `detectMoodFromText(text: string, presets: MoodPreset[]): MoodPreset | null` — keyword-based matcher that scores each preset against the AI response content (e.g., "combat", "battle", "sword" → Combat preset; "tavern", "inn", "drink" → Tavern preset). Uses a keyword map per preset ID and falls back to search query word matching.

**2. `src/hooks/use-spotify.ts`** — Add autoMood state + `playMoodForText` method
- New state: `autoMoodEnabled` (boolean, loaded from localStorage)
- New method: `setAutoMoodEnabled(enabled: boolean)` — persists to localStorage
- New method: `playMoodForText(text: string)` — calls `detectMoodFromText`, and if the detected preset differs from the currently playing one, calls `playPlaylist` (or `searchAndAssignPreset` if no URI assigned yet). Tracks `lastAutoMoodPresetId` to avoid re-triggering the same mood.
- Expose `autoMoodEnabled`, `setAutoMoodEnabled`, `playMoodForText` in the return value.

**3. `src/components/spotify/DMSpotifyControls.tsx`** — Add Auto-Mood toggle
- Add a `ToggleRow`-style switch between the volume section and mood presets section:
  - Icon: sparkle/wand icon
  - Label: "Auto-Mood"
  - Description: "AI DM picks music based on the story"
  - Toggles `spotify.autoMoodEnabled` via `spotify.setAutoMoodEnabled`
  - Only shown when connected

**4. `src/components/ai-dm/AIDMScreen.tsx`** — Wire into `handleMessageComplete`
- Import `useSpotify` hook
- In `handleMessageComplete`, after existing logic, call `spotify.playMoodForText(content)` if `spotify.autoMoodEnabled && spotify.connected`

**5. `src/components/ai-dm/PartyDMScreen.tsx`** — Same wiring for party DM
- Import `useSpotify`, add `playMoodForText` call in the party DM's message-complete handler (or pass it down to the component that handles AI responses)

### Mood Detection Keyword Map (in `detectMoodFromText`)
Each preset gets weighted keywords derived from its theme:
- **combat/boss** → fight, battle, sword, attack, initiative, combat, charge, clash
- **tavern** → tavern, inn, ale, drink, bard, music, laughter, hearth
- **dungeon** → dungeon, cave, dark, creep, shadows, underground, tunnel
- **exploration** → forest, path, travel, journey, wilderness, trek, nature
- **mystery** → mystery, clue, investigate, whisper, secret, hidden, puzzle
- **village** → village, town, market, peaceful, morning, farmer
- **ocean** → ocean, sea, ship, sail, wave, harbor, port
- **court** → king, queen, throne, court, noble, palace, royal
- **stealth** → sneak, stealth, shadow, silent, hide, ambush, thief
- **temple** → temple, prayer, holy, divine, altar, sacred, blessed
- **campfire** → camp, rest, fire, night, stars, sleep, tent

The detector scores all presets, picks the highest-scoring one above a minimum threshold, and only triggers a change if it differs from the last auto-mood.

### Technical Details
- Mood detection is purely client-side keyword matching — no extra AI calls, zero latency cost
- A debounce/cooldown (e.g., 30 seconds) prevents rapid playlist switching during fast exchanges
- The toggle state persists in localStorage so it survives page reloads
- Custom user-created presets can participate in auto-mood if their search query words match narrative content

