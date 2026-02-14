

# Combat Tab in Solo and Party DM with Real-Time Sync

## Overview
Two connected changes: (1) add a full-screen Combat drawer accessible from Solo and Party DM chat interfaces, and (2) add CustomEvent-based real-time sync so combat state stays identical between the main Combat tab and the DM Combat drawer.

## Part 1: Combat Drawer

### New Component: `CombatDMDrawer.tsx`
**File:** `src/components/ai-dm/CombatDMDrawer.tsx`

A full-screen Vaul-based Drawer wrapping the existing `MobileCombatLayout`:
- Uses the same z-index override as InfinityStoneDMDrawer (z-9999 for drawer, z-9998 for overlay) to render above DM screens (z-60)
- `max-h-[95vh]` for maximum combat space
- Header with "Combat" title and close (X) button
- Body renders `MobileCombatLayout` directly inside scrollable content
- Receives all combat-relevant props forwarded from PromptDrawerProvider

### PromptDrawerProvider Update
**File:** `src/components/drawers/PromptDrawerProvider.tsx`

- Add `combatDrawerOpen` state
- Add `openCombatDrawer` method to context interface and value
- Render `CombatDMDrawer` alongside existing AI DM overlays
- Pass through character, equipment, spellcasting, HP, conditions, and other props already available in the provider

### Solo DM Integration
**File:** `src/components/ai-dm/AIDMScreen.tsx`

- Import `usePromptDrawers` context
- Add a Sword icon button in the input bar (next to the Gem button)
- On tap, call `openCombatDrawer()` from context

### Party DM Integration
**File:** `src/components/ai-dm/PartyDMScreen.tsx`

- Same pattern: add Sword icon button next to existing RP/Quick Actions buttons
- Call `openCombatDrawer()` from context on tap

## Part 2: Real-Time Sync via CustomEvent Bridge

Each of the 4 combat hooks that use localStorage will broadcast a CustomEvent on mutation and listen for it to reload state. A `useRef` flag prevents self-triggered loops.

### Hook: `use-combat-log.ts`
- Event: `odyssey-combat-log-sync`
- Dispatch after `addEntry`, `clearLog`, `removeEntry`
- Listen and reload via `loadLog()`

### Hook: `use-targets.ts`
- Event: `odyssey-targets-sync`
- Dispatch after every `setState` call (addEnemy, removeEnemy, dealDamage, healEnemy, conditions, clearAll, etc.)
- Listen and reload via `loadFromStorage()`

### Hook: `use-initiative.ts`
- Event: `odyssey-initiative-sync`
- Dispatch after every `setState` call (setPlayerInitiative, nextTurn, prevTurn, startCombat, endCombat, etc.)
- Listen and reload via `loadState()`

### Hook: `use-attack-queue.ts`
- Event: `odyssey-attack-queue-sync`
- Dispatch after every `setState` call (addToQueue, removeFromQueue, reorderAttack, clearQueue, etc.)
- Listen and reload via `loadAttackQueue()`

### Sync Pattern Applied to Each Hook

```text
const SYNC_EVENT = 'odyssey-<hook>-sync';
const isSelfUpdate = useRef(false);

// Every mutation:
isSelfUpdate.current = true;
setState(prev => { ... });  // also saves to localStorage
window.dispatchEvent(new CustomEvent(SYNC_EVENT));
setTimeout(() => { isSelfUpdate.current = false; }, 50);

// Listener (useEffect):
window.addEventListener(SYNC_EVENT, () => {
  if (!isSelfUpdate.current) setState(loadFromStorage());
});
```

Combat stats (`useCombatStats`) are derived from props passed from the same source (Index.tsx), so they stay in sync automatically.

## Files Summary

| File | Action |
|------|--------|
| `src/components/ai-dm/CombatDMDrawer.tsx` | New -- full-screen drawer wrapper |
| `src/components/drawers/PromptDrawerProvider.tsx` | Edit -- add combat drawer state, context, render |
| `src/components/ai-dm/AIDMScreen.tsx` | Edit -- add Sword button |
| `src/components/ai-dm/PartyDMScreen.tsx` | Edit -- add Sword button |
| `src/hooks/use-combat-log.ts` | Edit -- add sync dispatch + listener |
| `src/hooks/use-targets.ts` | Edit -- add sync dispatch + listener |
| `src/hooks/use-initiative.ts` | Edit -- add sync dispatch + listener |
| `src/hooks/use-attack-queue.ts` | Edit -- add sync dispatch + listener |

## Testing Criteria
1. Open Solo DM, tap Sword icon -- combat drawer appears above chat, fully interactive
2. Open Party DM, tap Sword icon -- same behavior
3. Add an enemy in main Combat tab -- open DM combat drawer, enemy appears immediately
4. Roll a weapon attack in DM combat drawer -- switch to Combat tab LOG, entry appears
5. Advance initiative in either view -- round number syncs to the other
6. Clear combat log in either view -- clears in both
7. Close drawer -- DM chat state preserved

