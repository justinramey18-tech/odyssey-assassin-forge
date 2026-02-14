
# Party DM: Dedicated Quick Actions Drawer

## Problem
The current Quick Actions button in Party DM mode opens the global `QuickActionsDrawer` via `PromptDrawerProvider`, which causes the screen to freeze/navigate back to the home screen due to z-index and overlay state conflicts that have proven difficult to fix.

## Solution
Remove the broken Quick Actions button and build a **new, self-contained slide-up drawer** directly inside `PartyDMScreen.tsx` that:
- Lives entirely within the Party DM overlay (no external drawer dependencies)
- Auto-populates from the existing `characterContext` prop in real time
- Has "Use" buttons that populate the player's input field
- Uses the Vaul `Drawer` component for a native mobile bottom-sheet feel

## What the New Drawer Will Show

The drawer will display categorized sections in a vertical scroll layout:

1. **Equipped Weapons** - From `characterContext.equipment` (weapon slots), with attack prompts
2. **Abilities** - From `characterContext.abilities` (tier > 0) + `characterContext.equippedAbilities`, with ability prompts
3. **Prepared Spells** - From `characterContext.spellcasting.preparedSpells`, with spell prompts
4. **Cantrips** - Level 0 spells from prepared list
5. **Items / Consumables** - From `characterContext.consumables`, with use prompts
6. **Prestige Abilities** - From `characterContext.prestigeAbilities`

Each item gets a "Use" button that appends the AI DM prompt to the input field and shows a toast confirmation. The drawer stays open so multiple prompts can be queued.

## Technical Changes

### File: `src/components/ai-dm/PartyDMScreen.tsx`

1. **Remove** the `usePromptDrawers()` import and the `useEffect` that sets `setQuickActionPromptTarget`
2. **Remove** the `ListChecks` Quick Actions button (lines 721-737)
3. **Add** a new `PartyDMQuickActions` component (inline or same file) that:
   - Accepts `characterContext`, `characterName`, and `onUsePrompt` callback
   - Uses `Drawer` from `@/components/ui/drawer` for a bottom sheet
   - Renders categorized collapsible sections with vertical scroll
   - Each item has a "Use" button (Play icon) that calls `onUsePrompt(generatedPrompt)`
4. **Add** trigger button in the input area that opens the new drawer locally

### File: `src/components/ai-dm/PartyDMQuickActions.tsx` (new file)

Self-contained component with:
- Props: `open`, `onOpenChange`, `characterContext`, `characterName`, `onUsePrompt`
- Uses `Drawer`/`DrawerContent` for mobile-first bottom sheet
- Sections rendered via `Collapsible` components, each with an icon and count badge
- Prompt generation functions for weapons, abilities, spells, and consumables (reusing the `applyTimePrefix` pattern)
- "Use" button on each item triggers `onUsePrompt(prompt)` + toast

### File: `src/components/drawers/PromptDrawerProvider.tsx`

- Clean up the `quickActionPromptTarget` state and `setQuickActionPromptTarget` callback (optional, can leave for other consumers)

## UI Design

- **Trigger**: Emerald-themed button in the input area (same position as current, same styling)
- **Drawer**: Bottom sheet (70vh max-height), dark theme matching Party DM aesthetic
- **Sections**: Collapsible with amber/emerald accent, count badges, category icons
- **Items**: Compact rows with name, brief info, and a green "Use" button on the right
- **Behavior**: Stays open after tapping "Use"; toast confirms "Prompt added to input"
