

## Plan: Geralt the Owlbear — Companion Management Screen (Easter Egg for "momo")

### Overview
A fullscreen, mobile-first, vertically-scrolling companion management screen for an owlbear named "Geralt." This is an easter egg: when the character name is "momo" (case-insensitive), the Map button on the home screen is replaced with an Owlbear button that opens the companion screen instead of the battle map.

### Implementation Steps

**1. Create easter egg detection utility**
- Update `src/lib/easter-eggs.ts` to export a function `isMomoEasterEgg(name: string): boolean` that checks if the character name is "momo" (case-insensitive, trimmed).

**2. Create the `GeraltCompanionScreen` component**
- New file: `src/components/companion/GeraltCompanionScreen.tsx`
- Fullscreen Dialog (same pattern as `StandaloneBattleMap`)
- Mobile-first, vertical scrolling layout with themed styling (owlbear/forest aesthetic)
- Widgets (all with localStorage persistence scoped by character):
  - **Header**: Geralt's name, species ("Owlbear"), portrait/icon area
  - **HP Widget**: Current/Max HP with damage/heal controls (reuse patterns from `HPWidget`)
  - **Level/XP**: Companion level tracker with simple +/- controls
  - **Ability Scores**: STR, DEX, CON, WIS displayed as stat cards (owlbear stats)
  - **Abilities**: Beak, Claws, Hug attack descriptions with damage info
  - **Status/Conditions**: Toggle conditions like Frightened, Prone, Charmed
  - **Loyalty/Mood**: A flavor tracker (Happy, Neutral, Agitated, Enraged)
  - **Notes**: Free-text area for the player to jot companion notes
- All state persisted to `localStorage` under `odyssey_${characterId}_geralt_companion`

**3. Create barrel export**
- New file: `src/components/companion/index.ts`

**4. Modify `EnlargedD20Section`**
- Add new prop `onCompanionClick?: () => void`
- When `onCompanionClick` is provided, render an Owlbear button (using a paw/bear icon) **instead of** the Map button
- The Owlbear button uses a warm amber/brown color scheme

**5. Modify `HomeScreen`**
- Import `isMomoEasterEgg` and `GeraltCompanionScreen`
- Add `showCompanionScreen` state
- Detect if `character.name` is "momo" → set `isMomo` flag
- Pass `onCompanionClick` to `EnlargedD20Section` when `isMomo` is true (replaces `onMapClick`)
- Render `GeraltCompanionScreen` dialog controlled by `showCompanionScreen`

### Technical Details
- Persistence key: `odyssey_${characterId}_geralt_companion` storing JSON with all companion state fields
- Default owlbear stats: STR 20, DEX 8, CON 17, WIS 12; HP 59/59; Level 3 (CR 3 owlbear baseline)
- The companion screen uses the same Dialog/fullscreen pattern as `StandaloneBattleMap` for consistency
- No new dependencies required; uses existing UI components (Card, Button, Progress, Input, ScrollArea)

