

## Rebalance App Modes (Option D: 1-4-5-7-10-15) + New "Magic Build" Mode

### Overview

Restructure all mode tab counts into a smooth progressive ramp and add a new **Magic Build** mode that swaps the Player's martial focus for a caster-oriented loadout.

### New Mode Progression

| Mode | Tabs | Count | Focus |
|------|------|-------|-------|
| Companion | settings | 1 | Dice + Empyrean assistant |
| Player | combat, skills, abilities, settings | 4 | Core martial character sheet |
| Magic Build | combat, skills, arcana, consumables, settings | 5 | Core caster character sheet |
| Storyteller | combat, skills, abilities, arcana, scribe, chronicle, settings | 7 | Player + narrative/AI tools |
| Party | combat, skills, abilities, arcana, gear, consumables, loot, shop, cloud, settings | 10 | Full co-op with economy |
| Full Access | all 15 | 15 | Everything |

**Key design decisions:**
- Player gets the 3 martial essentials (combat, skills, abilities) -- no inventory clutter
- Magic Build mirrors Player but swaps `abilities` for `arcana` and adds `consumables` (potions/scrolls)
- Storyteller bridges the gap with narrative tools (scribe, chronicle) on top of both combat paths
- Party adds the full economy/inventory layer (gear, consumables, loot, shop, cloud)
- Advanced progression tabs (legacy, stars, feats) are Full Access only

### Companion Mode Switcher

A subtle ghost "Change Mode" button on the home screen when in Companion mode, so users aren't stuck with no way to find Settings.

---

### Technical Changes

**File 1: `src/lib/app-modes.ts`**
- Add `'magicBuild'` to the `AppMode` union type
- Add `magicBuild` config entry with icon `'Wand2'`, color `'cyan'`, and the 5 tabs listed above
- Rebalance `player.visibleTabs` to `['combat', 'skills', 'abilities', 'settings']`
- Rebalance `storyteller.visibleTabs` to `['combat', 'skills', 'abilities', 'arcana', 'scribe', 'chronicle', 'settings']`
- Rebalance `party.visibleTabs` to `['combat', 'skills', 'abilities', 'arcana', 'gear', 'consumables', 'loot', 'shop', 'cloud', 'settings']`
- Trim `visibleQuickAccess` and `visibleHomeFeatures` proportionally for each mode
- Update `APP_MODES_ORDERED` to include `'magicBuild'` after `'player'`

**File 2: `src/components/home/ModeSelectionScreen.tsx`**
- Import `Wand2` from lucide-react
- Add `Wand2` to the `ICON_MAP`
- Add `cyan` to the `COLOR_MAP`

**File 3: `src/components/settings/AppModeSettings.tsx`**
- Import `Wand2` from lucide-react
- Add `Wand2` to `ICON_MAP`
- Add `cyan` color class to `COLOR_MAP`

**File 4: `src/components/home/HomeScreen.tsx`**
- Accept `appMode` as a prop
- When `appMode === 'companion'`, render a small ghost button ("Change Mode") that calls `onOpenSettings`

**File 5: `src/pages/Index.tsx`**
- Pass `appMode` (from `useAppMode()`) to `HomeScreen`

