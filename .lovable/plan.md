
# Real-Time Combat State Sync Between Combat Tab and DM Combat Drawer

## Problem
The combat drawer rendered inside the DM screens creates its own independent hook instances (`useCombatLog`, `useTargets`, `useInitiative`, `useAttackQueue`). Even though they all use localStorage, changes in one instance don't propagate to the other's React state in real-time.

## Solution: CustomEvent Bridge Pattern

Follow the same pattern already used in the codebase for rest mechanics (`odyssey-rest` CustomEvent). Each combat hook will broadcast a CustomEvent when its state changes, and all instances will listen for that event to sync their React state.

This is lightweight, requires no new context providers, and keeps each hook self-contained.

## What Changes

### 1. Add Sync Events to `useCombatLog` hook
**File:** `src/hooks/use-combat-log.ts`

- Dispatch a `CustomEvent('odyssey-combat-log-sync')` whenever entries change (addEntry, clearLog, removeEntry)
- Listen for the same event and reload from localStorage when received
- Guard against self-triggered events using a ref flag

### 2. Add Sync Events to `useTargets` hook
**File:** `src/hooks/use-targets.ts`

- Dispatch `CustomEvent('odyssey-targets-sync')` on every state mutation (addEnemy, removeEnemy, updateHP, setTarget, etc.)
- Listen and reload from localStorage on event
- Same ref-guard pattern to prevent infinite loops

### 3. Add Sync Events to `useInitiative` hook
**File:** `src/hooks/use-initiative.ts`

- Dispatch `CustomEvent('odyssey-initiative-sync')` on state changes
- Listen and reload from localStorage on event

### 4. Add Sync Events to `useAttackQueue` hook
**File:** `src/hooks/use-attack-queue.ts`

- Dispatch `CustomEvent('odyssey-attack-queue-sync')` on queue mutations
- Listen and reload from localStorage on event

### 5. Add Sync to `useCombatStats` (derived -- no changes needed)
Combat stats are derived from props (character, equipmentStats, abilityModifiers) which are already passed from the same source (Index.tsx), so they will naturally stay in sync.

### 6. Combat Log `addEntry` sync for DM drawer
The DM drawer's combat actions (weapon rolls, spell casts) will write to the same combat log via `useCombatLog`, and the sync event will propagate to the main combat tab's log view.

## Sync Pattern (applied to each hook)

```typescript
const SYNC_EVENT = 'odyssey-combat-log-sync';
const isSelfUpdate = useRef(false);

// On state change:
const addEntry = useCallback((entry) => {
  isSelfUpdate.current = true;
  setEntries(prev => {
    const updated = [newEntry, ...prev].slice(0, MAX);
    saveLog(updated);
    window.dispatchEvent(new CustomEvent(SYNC_EVENT));
    return updated;
  });
  setTimeout(() => { isSelfUpdate.current = false; }, 50);
}, []);

// Listen for external changes:
useEffect(() => {
  const handler = () => {
    if (isSelfUpdate.current) return;
    setEntries(loadLog());
  };
  window.addEventListener(SYNC_EVENT, handler);
  return () => window.removeEventListener(SYNC_EVENT, handler);
}, []);
```

## Files Modified
1. **Edit:** `src/hooks/use-combat-log.ts` -- add dispatch + listen for sync events
2. **Edit:** `src/hooks/use-targets.ts` -- add dispatch + listen for sync events
3. **Edit:** `src/hooks/use-initiative.ts` -- add dispatch + listen for sync events
4. **Edit:** `src/hooks/use-attack-queue.ts` -- add dispatch + listen for sync events

## Testing Criteria
1. Open Combat tab, add an enemy target -- open DM combat drawer, verify the same enemy appears
2. In the DM combat drawer, roll a weapon attack -- switch to Combat tab LOG section, verify the entry appears
3. Add attacks to the queue in either view -- verify they appear in both
4. Advance initiative in either view -- verify round number syncs
5. Clear combat log in either view -- verify it clears in both
