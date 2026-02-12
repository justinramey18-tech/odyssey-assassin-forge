
# Auto-Sync Mode + Battle Map Integration for AI DM

## Overview
Extends the approved Auto-Sync plan with two major additions:
1. **Full-screen battle map accessible from within the AI DM chat** -- a toggle/button that opens the standalone battle map as a split-view or overlay while the DM session continues
2. **AI-driven auto-population of the battle map** -- the extraction edge function also detects creatures and spatial information from DM narration, then automatically places enemy markers on the map

---

## Part 1: Auto-Sync Mode (Previously Approved)

Everything from the approved plan remains unchanged:
- New edge function `ai-dm-extract` using `google/gemini-3-flash-preview` with tool calling
- Extracts HP changes, XP, gold, conditions, items, rest events
- `use-dm-auto-sync.ts` hook with toggle, undo, and apply logic
- `AutoSyncBanner.tsx` showing applied changes with undo
- Toggle in `AIDMScreen` header

---

## Part 2: Battle Map in AI DM (New)

### What it does
A "Map" button in the AI DM header opens the full-screen battle map as an overlay on top of the DM chat. Players can place tokens, measure distances, and use all existing map tools. Closing the map returns to the chat. The map state persists via the existing `StandaloneBattleMap` localStorage mechanism.

### File Changes

**Modified: `src/components/ai-dm/AIDMScreen.tsx`**
- Add a Map icon button in the header toolbar (next to context, guides, etc.)
- Clicking it sets `showBattleMap = true`
- Render `StandaloneBattleMap` component with `open={showBattleMap}` and `onClose` to dismiss
- Pass `characterName` from props so the player's token is labeled correctly

That's it -- `StandaloneBattleMap` is already fully self-contained with its own Dialog wrapper and localStorage persistence. No new components needed.

---

## Part 3: AI Auto-Population of Battle Map (New)

### What it does
When Auto-Sync mode is enabled, the extraction also detects **enemies/creatures that appear in the narrative** and **auto-places them as markers on the battle map**. For example, if the DM says "Three goblins emerge from the shadows," three enemy markers named "Goblin #1", "Goblin #2", "Goblin #3" are placed on the map automatically.

### Extraction Schema Addition

The `ai-dm-extract` edge function's tool definition gains a new field:

```
extract_state_changes({
  // ...existing fields (hp_changes, xp_gained, etc.)...
  
  map_entities: [{
    name: string,          // e.g. "Goblin"
    count: number,         // e.g. 3
    type: "enemy" | "ally" | "object",
    size?: string,         // "small", "medium", "large", etc.
    notes?: string         // brief descriptor, e.g. "armed with shortbow"
  }],
  map_entities_removed: string[]  // names of defeated/fled creatures to remove
})
```

The system prompt instructs the AI to only extract entities when they are **newly introduced** in the scene (not re-mentioned), and to mark creatures as removed when they are explicitly defeated, killed, or flee.

### New: `src/lib/battlemap-auto-populate.ts`

A utility module that translates extracted `map_entities` into battle map markers:

- **Placement algorithm**: Places new enemy markers in available cells near the center-right of the grid (enemy side), avoiding occupied cells. Uses a simple spiral outward search from a starting position.
- **Naming**: Adds `#1`, `#2` suffixes when count > 1
- **Removal**: Matches `map_entities_removed` names against existing markers (fuzzy match on name) and removes them
- **Returns**: `{ markersToAdd: MapMarker[], markerIdsToRemove: string[] }` so the caller can update state

```typescript
export function computeMapUpdates(
  extraction: { map_entities: MapEntity[], map_entities_removed: string[] },
  existingMarkers: MapMarker[],
  gridSize: GridSize
): { markersToAdd: MapMarker[], namesToRemove: string[] }
```

### Modified: `src/hooks/use-dm-auto-sync.ts`

- After extraction, if `map_entities` is non-empty, call `computeMapUpdates` and invoke a new callback `onMapUpdate(markersToAdd, namesToRemove)`
- The undo snapshot also captures the map markers before changes so "Undo" reverts map placements too

### Modified: `src/components/home/StandaloneBattleMap.tsx`

- Expose a way for external code to imperatively add/remove markers. Add two new optional props:
  - `pendingMarkerAdds?: MapMarker[]` -- markers to merge into state on next render
  - `pendingMarkerRemovals?: string[]` -- marker names to remove
- Use a `useEffect` to process these, then clear them via an `onPendingProcessed` callback
- This keeps the component's internal state as source of truth while allowing the auto-sync system to push changes in

### Modified: `src/components/ai-dm/AIDMScreen.tsx`

- Hold `pendingMapAdds` and `pendingMapRemovals` state
- Pass them to `StandaloneBattleMap`
- Wire `onMapUpdate` from `useDmAutoSync` to set these pending states

### Modified: `src/components/ai-dm/AutoSyncBanner.tsx`

- Show map entity changes in the banner: "👹 +3 Goblins placed on map" or "💀 Goblin removed"
- Undo also reverts map changes

---

## Data Flow (Complete)

```text
DM response finishes streaming
  -> AIDMScreen checks autoSyncEnabled
  -> Calls useDmAutoSync.extractAndApply(messageText, characterContext)
    -> Snapshot: HP, XP, gold, conditions, AND current map markers
    -> POST to ai-dm-extract edge function
    -> Returns: { hp_changes, xp_gained, gold_changes, ..., map_entities, map_entities_removed }
    -> Apply character changes via existing handlers
    -> Call computeMapUpdates() with map_entities + existing markers
    -> Set pendingMapAdds / pendingMapRemovals state
    -> StandaloneBattleMap picks up pending changes via props
    -> Show AutoSyncBanner: "💔 -8 HP  💰 +15 GP  👹 +3 Goblins"
    -> Undo reverts everything including map markers
```

---

## Summary of All File Changes

| File | Action | Purpose |
|------|--------|---------|
| `supabase/functions/ai-dm-extract/index.ts` | Create | Edge function with tool-calling extraction (character state + map entities) |
| `src/hooks/use-dm-auto-sync.ts` | Create | Toggle, extract, apply, undo logic for auto-sync |
| `src/lib/battlemap-auto-populate.ts` | Create | Translates extracted entities into map marker operations |
| `src/components/ai-dm/AutoSyncBanner.tsx` | Create | Compact banner showing applied changes with undo |
| `src/components/ai-dm/AIDMScreen.tsx` | Modify | Add auto-sync toggle, map button, wire hooks and pending map state |
| `src/components/home/StandaloneBattleMap.tsx` | Modify | Add pendingMarkerAdds/Removals props for external map updates |
| `src/hooks/use-ai-dm.ts` | Modify | Expose onMessageComplete callback for post-stream hook |
| `src/pages/Index.tsx` | Modify | Thread character state handlers through to AI DM for auto-sync |

---

## Technical Details

### Enemy Placement Algorithm
New markers are placed using a spiral search starting from grid position `(gridSize * 0.7, gridSize * 0.5)` -- the right side of the map, representing the "enemy side." The spiral expands outward checking for unoccupied cells. Each enemy gets the standard red color (`#ef4444`).

### Fuzzy Name Matching for Removal
When the DM says "the goblin falls," the removal matcher:
1. Exact match on full name (case-insensitive)
2. Base name match ignoring `#N` suffixes (removes first matching instance)

### Extraction Prompt Addition
```
For map_entities, extract ONLY creatures or objects that are newly introduced 
into the scene. Do NOT re-extract creatures already mentioned in previous 
messages. Include a count for groups (e.g., "three goblins" = count 3).
For map_entities_removed, include creatures that are definitively killed, 
defeated, destroyed, or flee the scene.
```

### Performance
- Map auto-population runs as part of the same extraction call (no additional API call)
- Marker placement is O(n) where n = grid cells checked (negligible)
- Pending props pattern avoids re-mounting the battle map component
