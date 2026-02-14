
# Auto-Scaling Zoom with Per-Tier Background Layers

## Overview
This extends the previously approved auto-scaling plan with a **layered background image system**. Each scale tier (e.g., tactical/feet, regional/miles, continental/leagues) can have its own dedicated background image. As you zoom in or out and the grid transitions between tiers, the corresponding backgrounds **cross-fade** -- the outgoing tier's image fades out while the incoming tier's image fades in, creating a smooth visual transition between map scales.

## How It Works

### Scale Tiers (recap + extension)
Each tier now includes an optional background image:

```text
Tier 0  "Tactical"    5 ft/sq     --> e.g., dungeon room map
Tier 1  "Local"       50 ft/sq    --> e.g., town or building complex
Tier 2  "Regional"    0.25 mi/sq  --> e.g., regional wilderness map
```

### Background Layer Behavior
- Each tier has an **optional** uploaded image
- All tier images are rendered as stacked `<img>` elements behind the grid (z-index 0)
- Each image's **opacity** is computed from the current zoom position relative to that tier's zoom range:
  - Fully visible (user-set opacity) when zoom is in the middle of the tier's range
  - Cross-fades near tier boundaries -- as zoom approaches a threshold, the current tier's image fades out and the next tier's image fades in
- The existing single "background opacity" slider acts as a **master opacity** cap -- per-tier fade values are multiplied by it
- When no image is uploaded for a tier, that layer is simply transparent

### Upload UX
- The existing **Image** button in the toolbar opens a small panel/popover showing the current scale tiers
- Each tier row displays:
  - Tier label (e.g., "Tactical - 5 ft/sq")
  - A thumbnail preview if an image is already uploaded
  - An upload button to add/replace the image
  - A remove button to clear that tier's image
- Uploading works the same as today: file goes to cloud storage, URL is stored in state

### Cross-Fade Math

```text
For each tier with an image:
  if zoom is within [tier.minZoom, tier.maxZoom]:
    // Compute fade based on distance from tier edges
    fadeZone = 15% of tier's zoom range on each edge
    if near lower edge: opacity ramps from 0 to 1
    if near upper edge: opacity ramps from 1 to 0
    if in the middle: full opacity
  else:
    opacity = 0

  finalOpacity = tierFade * masterOpacity
```

This means at a tier boundary, the outgoing image is at ~50% and the incoming is at ~50%, creating a smooth blend.

## Technical Details

### New/Updated Types in `types.ts`

```text
ScaleTier {
  id: string                    // e.g., 'tactical', 'local', 'regional'
  label: string                 // e.g., 'Tactical', 'Regional'
  minZoom: number
  maxZoom: number
  distancePerSquare: number
  distanceUnit: DistanceUnit
  gridMergeFactor: number
  minorLineOpacity: number
}

TierBackground {
  tierId: string
  imageUrl: string
}

DEFAULT_SCALE_TIERS: ScaleTier[]

getActiveTier(zoom, tiers): ScaleTier
getTierOpacity(zoom, tier): number   // Returns 0-1 fade value
```

### Files to Modify

**`src/components/party/battlemap/types.ts`**
- Add `ScaleTier` interface, `TierBackground` interface, `DEFAULT_SCALE_TIERS`
- Add `getActiveTier()` and `getTierOpacity()` utility functions

**`src/components/party/battlemap/FullscreenBattleMap.tsx`**
- Add `autoScale` state (default true), `tierBackgrounds` state (array of `TierBackground`)
- Compute active tier from zoom via `useMemo`
- When `autoScale` is on, update effective `distancePerSquare` and `distanceUnit`
- Apply `gridMergeFactor` and `minorLineOpacity` to cell border rendering
- Render one `<img>` per tier that has a background, each with computed opacity from `getTierOpacity(zoom, tier) * masterOpacity`
- Replace single background `<img>` with the layered rendering
- Add tier background upload handler (reuses existing cloud upload pattern)
- Pass `autoScale` toggle and tier background props to MapControls
- When user manually changes distance/unit selectors, set `autoScale = false`

**`src/components/party/battlemap/MapControls.tsx`**
- Add `autoScale` prop and `onToggleAutoScale` callback
- Show "Auto" badge/toggle near distance controls
- Replace single Image button with a tier-aware background panel:
  - Small popover listing each tier with upload/remove/preview per row
  - Master opacity slider remains as-is

**`src/components/ai-dm/InlineBattleMap.tsx`**
- Add `autoScale`, `tierBackgrounds` state
- Compute active tier and grid merge logic
- Render layered background images
- Persist `autoScale` and `tierBackgrounds` in `SavedMapState`

**`src/components/home/StandaloneBattleMap.tsx`**
- Add `autoScale` and `tierBackgrounds` to `SavedMapState`
- Initialize from localStorage, pass down to FullscreenBattleMap

**`src/components/party/PartyBattleMap.tsx`**
- Wire new props through to FullscreenBattleMap

**`src/components/party/PartyPanel.tsx`**
- Handle tier background uploads to cloud storage
- Optionally sync tier backgrounds to party shared state

### Persistence
- `autoScale` (boolean) and `tierBackgrounds` (array of `{tierId, imageUrl}`) saved to localStorage alongside existing map state
- Scale tier definitions are constants, not user-configurable
- For party mode, tier background URLs can be synced via the existing `party_shared_state` row

### Data Flow

```text
User zooms (pinch / +/- buttons)
  --> zoom state updates
  --> useMemo computes active ScaleTier
  --> if autoScale ON:
        distancePerSquare = tier.distancePerSquare
        distanceUnit = tier.distanceUnit
        gridMergeFactor = tier.gridMergeFactor
  --> For each tier with a background:
        layerOpacity = getTierOpacity(zoom, tier) * masterOpacity
  --> Grid cells render with conditional border opacity
  --> Background layers render with cross-fade opacity
  --> Measure/Move overlays use effective distance values
  --> Footer label updates

User uploads image to a tier
  --> File uploaded to cloud storage
  --> URL stored in tierBackgrounds array
  --> Image layer appears at that tier's zoom range
```

### Edge Cases
- **No images on any tier**: Map works exactly as today (grid only)
- **Image on only one tier**: That image fades in/out at its zoom range; other tiers are transparent
- **Migration from single background**: The existing single background URL maps to tier 0 (tactical) on first load
- **Party sync**: Tier backgrounds are synced as an array of URLs in the shared state, same pattern as the current single background
- **Large images**: Same 5MB limit per upload; each tier image is independent
