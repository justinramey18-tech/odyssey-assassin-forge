
## Dedicated Empyrean Campaign UI

### What Changes

A new fullscreen page/screen for all Empyrean content, accessed via a third button in the DM Drawer (right-edge swipe panel on the home screen).

### Entry Point: DMDrawer.tsx

Add a third button below "Party DM" labeled **"The Empyrean Campaign"** with a purple/indigo accent (to distinguish from the amber Solo and emerald Party buttons). Uses a `BookOpen` or `ScrollText` icon.

- New prop: `onOpenEmpyrean: () => void`
- The button is always enabled (no gating like Party mode)
- Styled consistently with Solo/Party buttons but with indigo/purple theme

### New Fullscreen Screen: EmpyreanScreen.tsx

A new component at `src/components/empyrean/EmpyreanScreen.tsx` -- a mobile-first, fullscreen, vertically scrolling page that consolidates all Empyrean content into one place.

**Structure:**
- Fixed top bar with back arrow, title "The Empyrean Campaign", and the Empyrean book icon
- Vertically scrolling body with all sections in order:

```text
+----------------------------------+
|  <- The Empyrean Campaign   [X]  |  Fixed header
+----------------------------------+
|                                  |
|  [Empyrean Prompt Library]       |  Section 1: Prompts (Stones)
|    - Filter by category/favs     |
|    - All 8 stones (incl. Void)   |
|                                  |
|  [GM Guides - Campaign Pack]     |  Section 2: GM Guides
|    - Lore, Tone, Pacing, Alt     |
|    - Install/toggle/copy         |
|                                  |
|  [Air Wizard]                    |  Section 3: Existing wizard
|                                  |
|  [Session Zero Wizard]           |  Section 4: New wizard
|                                  |
|  [Arc Planner Wizard]            |  Section 5: New wizard
|                                  |
|  [Session Planner]               |  Section 6: New wizard
|    - Templates + custom builder  |
|                                  |
+----------------------------------+
```

Each section is a collapsible card/accordion so users can expand what they need without being overwhelmed.

### Routing and State

- The Empyrean screen opens as a fullscreen overlay (z-index layered like the existing AI DM screens), not a new route -- consistent with how Solo DM and Party DM screens work
- Opened via `drawerContext` or local state in `HomeScreen.tsx`, same pattern as `openAIDMScreen()`
- The screen manages its own GM guides state via `useGMGuides()` hook internally

### Refactoring Existing Empyrean Components

The existing `EmpyreanCampaignPack` and `EmpyreanPromptLibrary` are currently rendered inside `SettingsContent.tsx` as fullscreen overlays. They will be:

1. **Kept in Settings** as-is (no removal) -- users who are already in Settings can still access them there
2. **Reused inside `EmpyreanScreen.tsx`** -- the new screen imports and renders both components as inline sections (not as overlays). This means refactoring them slightly to support an `inline` mode where they render their content directly instead of as fixed overlays

Alternatively (simpler approach): The `EmpyreanScreen.tsx` simply has buttons that open the existing fullscreen overlays, plus the new wizards. This avoids refactoring existing components.

**Recommended approach**: The simpler option -- `EmpyreanScreen.tsx` is a hub page with section cards. Tapping "Prompt Library" opens `EmpyreanPromptLibrary`, tapping "Campaign Pack" opens `EmpyreanCampaignPack`. The new wizards (Session Zero, Arc Planner, Session Planner) render inline as collapsible sections on the hub page itself.

---

### Technical Details

**Files created:**
| File | Purpose |
|------|---------|
| `src/components/empyrean/EmpyreanScreen.tsx` | Fullscreen hub page with section cards and inline wizards |

**Files modified:**
| File | Change |
|------|--------|
| `src/components/home/DMDrawer.tsx` | Add `onOpenEmpyrean` prop + third "The Empyrean Campaign" button below Party DM |
| `src/components/home/HomeScreen.tsx` | Add `showEmpyreanScreen` state, pass `onOpenEmpyrean` to DMDrawer, render `EmpyreanScreen` |

**Props flow:**
- `HomeScreen` manages `showEmpyreanScreen` boolean state
- Passes `onOpenEmpyrean={() => setShowEmpyreanScreen(true)}` to `DMDrawer`
- Renders `<EmpyreanScreen open={showEmpyreanScreen} onClose={() => setShowEmpyreanScreen(false)} characterName={character.name} />`

**EmpyreanScreen internally:**
- Calls `useGMGuides()` for guide state
- Manages `showPack` and `showPrompts` booleans to open the existing fullscreen overlays
- Renders new wizards (Session Zero, Arc Planner, Session Planner) as collapsible inline sections
- Uses `ScrollArea` for the main body with proper bottom padding

**UI/Styling:**
- Indigo/purple accent color throughout (`text-purple-400`, `border-purple-500/30`, etc.)
- Mobile-first: full viewport width, no max-width constraint on mobile
- Fixed header with `bg-background/80 backdrop-blur-sm`
- Section cards use the glass card pattern from the design system
- Touch-friendly targets (min 44px)
- `z-[60]` for the fullscreen overlay (same level as existing Empyrean overlays)

**DMDrawer button styling:**
- Icon: `ScrollText` from lucide-react
- Color: `border-purple-500/25 bg-purple-500/5 hover:bg-purple-500/15`
- Label: "The Empyrean Campaign"
- Subtitle: "Empyrean content hub"
- Always enabled

This plan focuses solely on the dedicated UI and entry point. The new content (Forbidden Lore prompts, Session Zero Wizard, Arc Planner, Session Planner) from the previously approved plan will be implemented as separate tasks that slot into this screen's sections.
