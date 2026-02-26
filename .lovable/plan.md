

# Add Dice Odds Selector to Inline DM Dice Roller + New Odds Distributions

## Overview

Add a "Dice Odds" button at the bottom of the `DMDiceRoller` component (used in both Solo and Party DM). Tapping it reveals a rising panel with the 5 mode options. Selecting one applies it immediately and auto-closes the panel. Also completely rework the odds engine to use the user's specific percentage-based bracket distributions instead of the current simple thirds weighting.

## New Odds Distributions (d20)

| Mode | Bracket 1 | Bracket 2 | Bracket 3 | Bracket 4 |
|------|-----------|-----------|-----------|-----------|
| Fair | Uniform 1-20 (5% each) | | | |
| Heroic | 15% → nat 20 | 65% → 15-19 | 15% → 10-14 | 5% → 1-9 |
| Dramatic | 50% → 18-20 | — | — | 50% → 1-7 |
| Chaotic | 50% → 15-20 | 25% → 8-14 | 25% → 1-3 | — |
| Cursed | 15% → nat 1 | 65% → 2-7 | 15% → 8-14 | 5% → 15-20 |

## Changes

### 1. `src/lib/diceOdds.ts` — Rewrite odds engine

Replace the `weights: {low, mid, high}` system with explicit bracket definitions:

```typescript
interface OddsBracket {
  chance: number;  // 0-1 probability
  min: number;     // minimum roll value
  max: number;     // maximum roll value
}
```

Each mode gets an array of `OddsBracket[]`. The `rollWeightedDie` function picks a bracket based on cumulative probability, then rolls uniformly within that bracket's range.

**Fair mode** bypasses brackets entirely — pure `Math.random()`.

Keep the existing `DiceOddsConfig` interface shape (label, description, deadpoolQuote) but replace `weights` with `brackets`. The `DiceOddsWidget` in settings still works since it only reads label/description/quote — the weight visualization bar will be updated to show the new brackets instead.

### 2. `src/components/ai-dm/DMDiceRoller.tsx` — Add odds selector UI

Add to the bottom of the component:
- A "Dice Odds" button showing the current mode icon + label
- When tapped, a panel slides up (using local state `showOddsPanel`) displaying the 5 mode buttons in a row (reusing the same icon map from `DiceOddsWidget`)
- Selecting a mode calls `saveDiceOddsMode()`, updates local state, and closes the panel
- The dice roller remains open throughout

The component will track `currentOddsMode` in local state (initialized from `loadDiceOddsMode()`). When changed, the next roll automatically uses the new mode since `rollD20` calls `loadDiceOddsMode()`.

### 3. `src/components/settings/DiceOddsWidget.tsx` — Update visualization

Update the weight distribution bar at the bottom to reflect the new bracket system instead of the old low/mid/high thirds. Show each bracket as a proportional bar segment labeled with its range.

## Files Changed

| File | Change |
|------|--------|
| `src/lib/diceOdds.ts` | Rewrite: replace thirds-based weights with explicit bracket distributions, new `rollWeightedDie` implementation |
| `src/components/ai-dm/DMDiceRoller.tsx` | Add "Dice Odds" button + sliding panel with mode selection at bottom of roller |
| `src/components/settings/DiceOddsWidget.tsx` | Update distribution visualization bar to show new bracket data |

## Technical Notes

- The `rollWeightedDie` function signature stays the same `(sides: number, mode: DiceOddsMode) => number` so all existing callers (combat, ability cards, equipped loadout) work without changes
- For non-d20 dice, the bracket ranges will be proportionally scaled to the die's sides
- The odds panel in DMDiceRoller uses simple absolute positioning within the roller container, no Sheet/Dialog needed
- Current mode persists via `localStorage` (existing `saveDiceOddsMode`/`loadDiceOddsMode`)

