

## Solo DM UI Cleanup — Side Drawer for Tools

### Problem

The Solo DM header currently has **7 buttons** (Sync, Map, Saves, Guides, World, New, Trash) crammed into a horizontally scrolling row. On mobile, this is cluttered and hard to navigate.

### Solution

Move all secondary tools into a **right-side slide-out drawer** (using the existing `Sheet` component), keeping the header minimal with only:

- **Back arrow** (left)
- **Crown icon + Campaign dropdown** (left-center)
- **Drawer toggle button** (right) -- a single icon button that opens the tools drawer

### What Goes in the Tools Drawer

The drawer slides in from the right, styled to match the dark fantasy theme (amber accents, glass background). It contains all the tools as a vertical list of clearly labeled buttons:

| Tool | Icon | Description |
|------|------|-------------|
| New Campaign | RotateCcw | Opens the World Builder Wizard |
| Battle Map | Map | Toggles the inline battle map |
| Campaign Saves | FolderOpen | Opens the saves overlay |
| GM Guides | BookOpen | Opens guides overlay (shows active count badge) |
| World State | Globe | Opens the world state panel (shows anchor count badge) |
| Auto-Sync | Zap | Toggle on/off (only shown when autoSyncCallbacks exist) |
| Clear Chat | Trash2 | Clears messages (with destructive styling) |

Each button is a full-width row with icon + label + optional badge/toggle, similar to a settings menu. The drawer auto-closes after tapping any tool that opens an overlay (Saves, Guides, World Builder).

### Context Banner Stays

The collapsible HP/Level/Cloud status banner below the header remains unchanged -- it's useful and already compact.

### Files Modified

**`src/components/ai-dm/AIDMScreen.tsx`**
- Remove all 7 tool buttons from the header
- Add a single "tools" icon button (e.g., `Settings` or `MoreVertical` icon) in the header right side
- Add `showToolsDrawer` boolean state
- Import and render a new `DMToolsDrawer` component
- Pass all the existing callbacks (setShowBattleMap, setShowSessions, setShowGuides, etc.) to the drawer

**`src/components/ai-dm/DMToolsDrawer.tsx`** (New file)
- A `Sheet` (side="right") containing the vertical tool list
- Accepts props for all tool actions and state (autoSync enabled, guide count, anchor count)
- Auto-closes when a tool opens an overlay
- Styled with the dark fantasy amber theme matching the rest of the DM UI

### What Does NOT Change

- The bottom `DMBottomNav` (Dice/RP Prompts/Actions) stays as-is -- those are gameplay tools, not settings
- The context banner (HP/Level row) stays as-is
- The input area stays as-is
- The `WorldStatePanel`, `GMGuidesManager`, `CampaignSessionsManager` overlays are unchanged
- All existing functionality is preserved, just relocated to the drawer

### User Experience

**Before:** 7 tiny buttons scrolling horizontally in the header, easy to miss or mis-tap

**After:** Clean header with back + campaign name + one "tools" button. Tap it, a drawer slides out with clearly labeled options. Tap a tool, drawer closes and the tool opens.
