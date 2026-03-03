

## Analysis: Why Battle Map Markers Still Don't Sync

### The Problem

The database has **zero** `map_markers` rows in `party_shared_state`. The data never reaches the server. The prop chain from `Index.tsx → PromptDrawerProvider → StandalonePartyDMScreen → InlineBattleMap` is correctly wired, so the issue is upstream — specifically a **stale closure bug** in `use-party-sync.ts`.

### Root Cause: `buildMapStateData` Stale Closure

Every `update*` function (e.g. `updateMapMarkers`) does this:

```ts
const stateData = { ...buildMapStateData(), markers };
await upsertMapState(stateData);
```

`buildMapStateData` is a `useCallback` that closes over `mapMarkers`, `mapBackgroundUrl`, etc. But React state setters (`setMapMarkers(markers)`) are async — the state hasn't updated yet when `buildMapStateData()` is called on the next line. So `buildMapStateData()` returns the **previous** values, and the spread merges stale data with the one new field.

On the very first marker placement, `buildMapStateData()` returns `{ markers: [], backgroundUrl: undefined, ... }`. Then `{ ...that, markers: newMarkers }` correctly has the new markers. But the real problem is that `updateMapMarkers` itself has a stale `buildMapStateData` in its dependency closure — it won't see the latest `buildMapStateData` until after a re-render triggered by `setMapMarkers`. This creates a race condition where rapid successive updates can overwrite each other.

However, for the **first call ever**, this should still work since it does `{ ...buildMapStateData(), markers }` where the explicit `markers` override should win. The fact that zero rows exist in the DB suggests the `upsertMapState` call is either not firing or failing silently.

### Are We Going About This the Wrong Way?

**Yes, partially.** The current approach has two architectural problems:

1. **Too many layers of prop threading** — 4 components deep just to pass map state. Every new synced field requires editing 4 files.

2. **Stale closure pattern** — `buildMapStateData` + spread is fragile. Each `update*` function should do a fresh fetch from DB (the "fetch-then-update" pattern your memory notes recommend) rather than relying on React state snapshots.

### Simpler Alternative: Direct DB Read Before Write

Instead of the `buildMapStateData` spread pattern, each `update*` function should fetch the current `state_data` from the database, merge the new field, and write back. This eliminates all stale closure bugs in one shot.

### Proposed Plan

**Single file change: `src/hooks/use-party-sync.ts`**

1. **Replace `buildMapStateData` + spread pattern** with a `fetchAndMergeMapState` helper that:
   - Reads the current `map_markers` row from `party_shared_state` 
   - Merges the new partial data into the fetched `state_data`
   - Upserts the merged result

2. **Refactor all 5 `update*` functions** (`updateMapMarkers`, `updateMapBackground`, `updateMapBackgroundOpacity`, `updateMapTierBackgrounds`, `updateMapCustomTiers`) to use `fetchAndMergeMapState` instead of `{ ...buildMapStateData(), field }`.

3. **Remove `buildMapStateData`** entirely — it's no longer needed.

This approach:
- Eliminates all stale closure bugs
- Follows the "fetch-then-update" pattern already established in the codebase (per your memory notes on real-time concurrency)
- Requires editing only 1 file
- Doesn't change any props, components, or the realtime subscription

No other files need to change. The prop chain is already correct — the data just needs to actually reach the database.

