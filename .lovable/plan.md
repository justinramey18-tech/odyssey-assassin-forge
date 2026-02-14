

# Inline Battle Map for Solo DM and Party DM

## Overview
Replace the current fullscreen Dialog-based battle map with an inline map that renders inside the chat window area as an overlay. When the Map button is tapped, the chat messages area transforms into the map grid. The DM header stays visible above, the chat input stays visible below, and the map toolbar (MapControls) renders below the bottom border of the chat container. Both Solo DM and Party DM share the same inline map component.

## Current Architecture
- `StandaloneBattleMap` wraps `FullscreenBattleMap` inside a `Dialog` (fullscreen modal)
- `FullscreenBattleMap` contains: header (with grid selector, zoom, exit), grid area, minimap, and bottom controls (legend + MapControls)
- Both `AIDMScreen` (Solo) and `StandalonePartyDMScreen` (Party) render `StandaloneBattleMap` as an overlay dialog

## New Architecture

### 1. New Component: `InlineBattleMap`
**File:** `src/components/ai-dm/InlineBattleMap.tsx`

A self-contained component that manages all battle map state (same state as current `StandaloneBattleMap`) but renders inline rather than in a Dialog. It accepts the same props for auto-sync integration (pending markers, grid size callbacks, etc.).

**Layout structure:**
```text
+----------------------------------+
| [DM Header - unchanged]         |  <-- stays from parent
+----------------------------------+
|                                  |
|  Grid area (scrollable)         |  <-- replaces chat messages
|  + minimap overlay              |
|  + spell/area/measure overlays  |
|                                  |
+----------------------------------+
| [MapControls toolbar]           |  <-- below the map area, above input
+----------------------------------+
| [Chat Input - unchanged]        |  <-- stays from parent
+----------------------------------+
```

The component renders:
- A compact header strip (grid size selector, zoom controls, exit button) -- slimmer than the current Dialog header
- The scrollable grid (reusing the grid rendering logic from `FullscreenBattleMap`)
- Minimap overlay
- All overlays (area, spell, measure, movement range)
- MapControls toolbar at the bottom

### 2. Modify `AIDMScreen` (Solo DM)
- Replace `StandaloneBattleMap` Dialog with conditional rendering
- When `showBattleMap` is true: hide the messages area and show `InlineBattleMap` in its place
- The header and input bar remain untouched (they're separate flex children)
- The quick actions, dice roller, and auto-sync banner stay below the map when active

### 3. Modify `StandalonePartyDMScreen` / `PartyDMScreen` (Party DM)
- Same approach: replace `StandaloneBattleMap` Dialog usage
- When map is active, the messages area in `PartyDMScreen` is replaced by `InlineBattleMap`
- The Party DM header, prompt queue, and input area remain visible

### 4. Remove `StandaloneBattleMap` Dialog Usage from DM Screens
- `StandaloneBattleMap` itself is kept (it's used on the Home Screen too) but no longer referenced from `AIDMScreen` or `StandalonePartyDMScreen`
- The map state (markers, highlighted cells, spell templates, grid size) moves into `InlineBattleMap` with the same localStorage persistence pattern

## Technical Details

### InlineBattleMap Props
```text
characterName: string
pendingMarkerAdds?: MapMarker[]
pendingMarkerRemovals?: string[]
onPendingProcessed?: () => void
onMarkersChange?: (markers: MapMarker[]) => void
onGridSizeChange?: (size: GridSize) => void
onClose: () => void
```

### State Management
`InlineBattleMap` manages all map state internally (same as `StandaloneBattleMap`):
- markers, highlightedCells, spellTemplates, gridSize (persisted to localStorage)
- toolMode, undoStack, measureStart/End, spellOrigin, moveRangeOrigin
- zoom, viewport (for minimap)

### Integration in AIDMScreen
The chat area currently follows this flex layout:
```text
<div className="flex flex-col h-full"> (root)
  [header]
  [context bar]
  [messages - flex-1 min-h-0]     <-- conditionally swap this
  [quick actions]
  [auto-sync banner]
  [dice roller]
  [extracting indicator]
  [input area]
</div>
```

When `showBattleMap` is true, the messages div and some intermediate elements are hidden, and `InlineBattleMap` takes their place as `flex-1 min-h-0`.

### Integration in PartyDMScreen
Similar pattern -- the messages div (`flex-1 min-h-0`) is conditionally replaced by `InlineBattleMap`. The prompt queue status bar and input area remain visible.

Since `PartyDMScreen` receives `onShowMap` as a callback, and the map state lives in `StandalonePartyDMScreen`, the inline map will be rendered in `StandalonePartyDMScreen` as a sibling to `PartyDMScreen`, overlaying just the chat region. Alternatively, a `showBattleMap` prop is passed down to `PartyDMScreen` to conditionally swap content inline.

### Files Modified
- `src/components/ai-dm/InlineBattleMap.tsx` -- NEW (self-contained inline map with all state)
- `src/components/ai-dm/AIDMScreen.tsx` -- Replace StandaloneBattleMap dialog with InlineBattleMap inline rendering
- `src/components/ai-dm/PartyDMScreen.tsx` -- Accept optional inline map content, conditionally hide messages when map is active
- `src/components/ai-dm/StandalonePartyDMScreen.tsx` -- Pass InlineBattleMap into PartyDMScreen instead of rendering StandaloneBattleMap dialog

### What Stays the Same
- `FullscreenBattleMap` component is not modified (reuse its grid rendering patterns)
- `MapControls`, `AreaOverlay`, `SpellTemplateOverlay`, `MeasureOverlay`, `MovementRangeOverlay`, `MarkerTooltip` are reused as-is
- `StandaloneBattleMap` (Dialog version) remains for Home Screen usage
- All map state persistence (localStorage) uses the same keys and format
- Auto-sync map callbacks work identically

