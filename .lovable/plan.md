

# Remove Redundant Dice Roller Toggle — 1-Click Access

## Problem
When you tap DICE in the tools drawer, the `DMDiceRoller` component renders but starts **collapsed** with its own internal toggle button ("Dice Roller"). This forces a second tap to actually see the dice — defeating the purpose of the tab.

## Solution
Remove the internal collapsible toggle from `DMDiceRoller` so its content (roll mode selector, d20/skills/saves tabs, dice buttons) renders **immediately** when the DICE tab is active. The flow becomes:

1. Tap TOOLS handle -- drawer expands, shows tabs
2. Tap DICE tab -- inline dice roller content animates up instantly
3. Start rolling

## Changes

### File: `src/components/ai-dm/DMDiceRoller.tsx`
- **Remove** the `isOpen` state and the toggle button (the `<button>` at lines 112-148 with the "Dice Roller" label, chevron icons, and roll mode indicator)
- **Remove** the `AnimatePresence` wrapper around the expanded content (lines 151-302) — the content should render directly without a collapse gate
- Keep all the actual roller content (roll mode toggle, tab selector, d20/skills/saves panels) as-is
- The component will simply render its dice UI immediately when mounted, since the parent (`DMBottomNav`) already controls visibility via the `showDiceContent` condition

### No changes needed to:
- `DMBottomNav.tsx` — already handles show/hide of `diceContent` with animation
- `AIDMScreen.tsx` / `PartyDMScreen.tsx` — already pass the correct `diceContent` prop

## Result
Tapping the DICE tab = dice roller content rises up immediately. One tap, zero redundancy.

