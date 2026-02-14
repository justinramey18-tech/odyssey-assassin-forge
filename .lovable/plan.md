

# Add Bottom Navigation Drawer to Solo and Party DM Screens

## Overview
Replace the current inline placement of the Dice Roller, Infinity Stones, and Quick Actions with a persistent bottom navigation bar in both Solo and Party DM screens. This bar will mirror the pattern used by `CombatBottomNav` -- a fixed footer with icon tabs that open full-content drawers/panels when tapped.

## Current State
- **Dice Roller** (`DMDiceRoller`): Rendered inline between messages and the input area as a collapsible accordion
- **Infinity Stones** (`InfinityStoneDMDrawer`): Triggered by a Gem icon button in the input bar area
- **Quick Actions**: In Solo DM, rendered inline as chip buttons (`DMQuickActions`). In Party DM, triggered by a button that opens `PartyDMQuickActions` drawer

These tools are scattered across the input area and message list, making them less discoverable.

## What Changes

### 1. New Component: `DMBottomNav.tsx`
**File:** `src/components/ai-dm/DMBottomNav.tsx`

A fixed bottom navigation bar (72px tall, matching `CombatBottomNav`) with 3 tabs:

| Tab | Icon | Color | Content |
|-----|------|-------|---------|
| Dice | `Dices` | amber-400 | Opens/closes the existing `DMDiceRoller` panel above the nav |
| RP Prompts | `Gem` | yellow-400 | Opens the `InfinityStoneDMDrawer` |
| Quick Actions | `ListChecks` | emerald-400 | Opens the Quick Actions drawer (`PartyDMQuickActions` for Party, `DMQuickActions` for Solo) |

- Fixed to bottom of viewport with `z-50`, dark background with backdrop blur
- Active tab highlighted with glow and color, matching `CombatBottomNav` styling
- Touch-friendly 44px+ tap targets
- Safe area padding for notched devices

### 2. Solo DM Updates
**File:** `src/components/ai-dm/AIDMScreen.tsx`

- Remove the inline `DMDiceRoller` from between messages and input
- Remove the Gem button from the input bar
- Remove the inline `DMQuickActions` strip (both starter and in-conversation variants kept, but the inline variant moves to a drawer)
- Add `DMBottomNav` fixed at the bottom
- Add padding-bottom to the message scroll area and input area to account for the 72px nav bar
- Wire the 3 tabs: Dice opens `DMDiceRoller` as a panel above the nav, Gem opens `InfinityStoneDMDrawer`, Quick Actions opens a new drawer with `PartyDMQuickActions` (reused, passing character context)
- Keep the starter quick actions (shown when no messages) as-is -- they remain in the empty state

### 3. Party DM Updates
**File:** `src/components/ai-dm/PartyDMScreen.tsx`

- Remove the inline `DMDiceRoller` from between file inputs and the input area
- Remove the Quick Actions and RP buttons from the input area
- Add `DMBottomNav` fixed at the bottom
- Add padding-bottom to message scroll area and input area for the 72px nav bar
- Wire tabs identically: Dice panel, Infinity Stone drawer, Quick Actions drawer (already uses `PartyDMQuickActions`)

## Technical Details

### DMBottomNav Props
```typescript
interface DMBottomNavProps {
  activeTab: 'dice' | 'prompts' | 'actions' | null;
  onTabChange: (tab: 'dice' | 'prompts' | 'actions') => void;
  disabled?: boolean;
}
```

### Layout Structure (both screens)
```text
+---------------------------+
| Header                    |
+---------------------------+
| Messages (scrollable)     |
| pb-[144px] for nav+input  |
+---------------------------+
| DMDiceRoller (if active)  |  <- Slides up above input
+---------------------------+
| Input Area                |
+---------------------------+
| DMBottomNav (fixed 72px)  |
+---------------------------+
```

### Dice Roller Behavior
- Tapping the Dice tab toggles the `DMDiceRoller` panel visibility (same expand/collapse as current)
- The dice roller renders directly above the input area, below messages
- Tapping another tab closes the dice panel

### Infinity Stones Behavior
- Tapping the RP Prompts tab opens the existing `InfinityStoneDMDrawer` (full-screen overlay with z-9999)
- No persistent panel -- it's a full drawer

### Quick Actions Behavior
- Tapping Quick Actions opens `PartyDMQuickActions` drawer (already a Vaul drawer)
- For Solo DM: create a self-contained Quick Actions drawer reusing `PartyDMQuickActions` (it already accepts `characterContext` and generates prompts from weapons/spells/abilities)

### Files Modified
1. **New:** `src/components/ai-dm/DMBottomNav.tsx`
2. **Edit:** `src/components/ai-dm/AIDMScreen.tsx` -- add bottom nav, remove inline tools from input bar
3. **Edit:** `src/components/ai-dm/PartyDMScreen.tsx` -- add bottom nav, remove inline tool buttons

