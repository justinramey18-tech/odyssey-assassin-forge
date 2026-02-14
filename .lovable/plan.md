

# Sync Battle Map Layer Images in Party DM Mode

## Overview
Currently, the battle map in Party DM mode (InlineBattleMap) stores tier backgrounds locally via localStorage. This plan adds real-time synchronization so the host's uploaded layer images, distance settings, and opacity are shared with all party members. Non-host members see the map in read-only mode (no upload or distance config controls).

## Changes

### 1. Thread `partySync` map data into StandalonePartyDMScreen
- **File**: `src/components/drawers/PromptDrawerProvider.tsx`
  - Pass the `partySync` map-related props (mapTierBackgrounds, mapBackgroundOpacity, mapCustomTiers, and their update functions) down to `StandalonePartyDMScreen`.

- **File**: `src/components/ai-dm/StandalonePartyDMScreen.tsx`
  - Accept new optional props for synced map state: `syncedTierBackgrounds`, `syncedBackgroundOpacity`, `syncedCustomTiers`, and corresponding update callbacks (`onSyncTierBackgroundUpload`, `onSyncTierBackgroundRemove`, `onSyncOpacityChange`, `onSyncTierConfigChange`).
  - Pass `isCreator` flag to InlineBattleMap so it knows whether to show edit controls.
  - Forward these props into the `InlineBattleMap` component.

### 2. Update InlineBattleMap to support synced party mode
- **File**: `src/components/ai-dm/InlineBattleMap.tsx`
  - Add optional props: `isPartyMode`, `isCreator`, `syncedTierBackgrounds`, `syncedBackgroundOpacity`, `syncedCustomTiers`, and sync callbacks.
  - When `isPartyMode` is true:
    - Use `syncedTierBackgrounds` / `syncedBackgroundOpacity` / `syncedCustomTiers` as the source of truth instead of local state.
    - Host uploads call the sync callbacks (which write to `party_shared_state` via `use-party-sync`), updating all members in real-time.
    - Non-host members receive updates via the existing Realtime subscription on `party_shared_state.map_markers`.
  - When `isPartyMode` is false (solo mode): behavior unchanged (localStorage).

### 3. Gate editing controls for non-host members
- **File**: `src/components/ai-dm/InlineBattleMap.tsx`
  - Conditionally render the `TierBackgroundPanel` only for the host (`isCreator`).
  - Non-host members see the synced tier backgrounds rendered on the map but cannot upload, remove, or change distance/unit settings.

- **File**: `src/components/party/battlemap/TierBackgroundPanel.tsx`
  - No changes needed here -- the entire panel is simply hidden for non-creators.

### 4. Wire up from PromptDrawerProvider
- **File**: `src/components/drawers/PromptDrawerProvider.tsx`
  - The `partySync` object (from `use-party-sync`) is already available in the parent (`HomeScreen`). Pass the relevant map fields as new props to `PromptDrawerProvider` and then to `StandalonePartyDMScreen`.
  - Specifically: `mapTierBackgrounds`, `mapBackgroundOpacity`, `mapCustomTiers`, `updateMapTierBackgrounds`, `updateMapBackgroundOpacity`, `updateMapCustomTiers`.

### 5. Handle upload flow for host in party mode
- When the host uploads a tier background in Party DM mode:
  1. Upload file to cloud storage (`gear-images` bucket) -- same pattern as `PartyPanel.tsx`
  2. Get the public URL
  3. Call `updateMapTierBackgrounds` (from `partySync`) which upserts to `party_shared_state`
  4. Realtime subscription pushes the update to all party members
  5. Members' `InlineBattleMap` re-renders with the new tier backgrounds

## Data Flow

```text
Host uploads image
  -> Cloud Storage (gear-images bucket)
  -> Gets public URL
  -> partySync.updateMapTierBackgrounds([...updated])
  -> Upserts to party_shared_state (state_type: 'map_markers')
  -> Realtime broadcast
  -> All members' use-party-sync receives update
  -> syncedTierBackgrounds prop updates
  -> InlineBattleMap re-renders with new layer images
```

## What stays the same
- Solo mode InlineBattleMap (no changes)
- Marker placement/movement (already synced separately)
- The PartyPanel battle map (already synced, unaffected)

## Technical Details

### New props for InlineBattleMap
```typescript
interface InlineBattleMapProps {
  // ...existing props...
  isPartyMode?: boolean;
  isCreator?: boolean;
  syncedTierBackgrounds?: TierBackground[];
  syncedBackgroundOpacity?: number;
  syncedCustomTiers?: ScaleTier[];
  onSyncTierBackgroundUpload?: (tierId: string, file: File) => void;
  onSyncTierBackgroundRemove?: (tierId: string) => void;
  onSyncOpacityChange?: (opacity: number) => void;
  onSyncTierConfigChange?: (tierId: string, updates: Partial<Pick<ScaleTier, 'distancePerSquare' | 'distanceUnit'>>) => void;
}
```

### Key logic in InlineBattleMap
```typescript
// Use synced state in party mode, local state in solo mode
const effectiveTierBackgrounds = isPartyMode ? (syncedTierBackgrounds ?? []) : tierBackgrounds;
const effectiveOpacity = isPartyMode ? (syncedBackgroundOpacity ?? 1) : backgroundOpacity;
const effectiveCustomTiers = isPartyMode ? (syncedCustomTiers as ScaleTier[] ?? [...DEFAULT_SCALE_TIERS]) : customTiers;
```

### Files modified (summary)
1. `src/components/drawers/PromptDrawerProvider.tsx` -- pass partySync map data
2. `src/components/ai-dm/StandalonePartyDMScreen.tsx` -- accept and forward sync props
3. `src/components/ai-dm/InlineBattleMap.tsx` -- dual-mode (local vs synced), hide controls for non-creators

### Testing
- Host opens Party DM, clicks Map, opens Layers panel, uploads a tier image -- verify it appears
- Non-host member opens Party DM, clicks Map -- verify they see the host's uploaded image but cannot see the Layers panel or upload controls
- Host changes distance-per-square or opacity -- verify non-host sees the change in real-time
- Host removes a tier image -- verify it disappears for all members
- Solo DM mode -- verify behavior is unchanged (localStorage-based)
