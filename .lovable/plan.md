

## Fix: Inaccurate Critical Hit/Miss Detection for Advantage/Disadvantage Rolls

### Problem Analysis

The current critical detection logic is **incorrect for 5e D&D mechanics** when rolling with advantage or disadvantage.

**Current Broken Logic:**
```typescript
const isCrit = roll.rolls.includes(20);  // Checks if ANY die shows 20
const isFumble = roll.rolls.includes(1); // Checks if ANY die shows 1
```

**Example from Screenshot:**
- Roll: `2d20kh1+14 = [11, 1] = 26` (advantage - keep highest)
- Current output: "NATURAL 1! CRITICAL MISS!" 
- Correct behavior: This is a **normal hit** (the 11 was kept, the 1 was dropped)

**5e Rules:**
- **Advantage (2d20kh1):** Only the **highest** die matters for crits
- **Disadvantage (2d20kl1):** Only the **lowest** die matters for crits
- **Normal (1d20):** The single die determines crits

### Solution Overview

Create a centralized utility function that correctly determines critical status based on the roll mode and dice values, then update all locations that currently use the broken `rolls.includes()` pattern.

### Files to Modify

| File | Purpose |
|------|---------|
| `src/lib/diceRoller.ts` | Add new utility functions for 5e-compliant crit detection |
| `src/components/combat/mobile/MobileCombatLayout.tsx` | Update weapon prompt generation and combat log entries |
| `src/components/combat/CombatTabScreen.tsx` | Update weapon prompt generation |
| `src/components/combat/mobile/CombatAbilityCard.tsx` | Update ability prompt generation |
| `src/lib/rpPromptGenerator.ts` | Update RP prompt generation for abilities |
| `src/components/character/DiceRollModal.tsx` | Update modal display |

---

### Technical Implementation

#### 1. Add Centralized Crit Detection Utility

Add to `src/lib/diceRoller.ts`:

```typescript
export type RollMode = 'normal' | 'advantage' | 'disadvantage';

/**
 * Get the effective die value for crit determination based on roll mode.
 * For advantage: use the highest die
 * For disadvantage: use the lowest die
 * For normal: use the single die
 */
export function getEffectiveDie(rolls: number[], rollMode: RollMode = 'normal'): number {
  if (rolls.length === 0) return 0;
  if (rolls.length === 1) return rolls[0];
  
  // Multiple dice - determine based on roll mode
  if (rollMode === 'advantage') {
    return Math.max(...rolls);
  } else if (rollMode === 'disadvantage') {
    return Math.min(...rolls);
  }
  
  // Infer mode from context: if 2 d20s, assume advantage (keep highest)
  return Math.max(...rolls);
}

/**
 * Determine if the roll is a critical hit (natural 20 on the effective die).
 * Correctly handles advantage/disadvantage per 5e rules.
 */
export function isCriticalHit(
  rolls: number[], 
  rollMode: RollMode = 'normal',
  die: DieType = 'd20'
): boolean {
  if (die !== 'd20') return false; // Only d20s can crit in 5e
  const effectiveDie = getEffectiveDie(rolls, rollMode);
  return effectiveDie === 20;
}

/**
 * Determine if the roll is a critical miss (natural 1 on the effective die).
 * Correctly handles advantage/disadvantage per 5e rules.
 */
export function isCriticalMiss(
  rolls: number[], 
  rollMode: RollMode = 'normal',
  die: DieType = 'd20'
): boolean {
  if (die !== 'd20') return false; // Only d20 attack/saves use nat 1 rules
  const effectiveDie = getEffectiveDie(rolls, rollMode);
  return effectiveDie === 1;
}

/**
 * Infer roll mode from roll data (for backward compatibility).
 * If 2 d20s are rolled, infers advantage/disadvantage from which die was used.
 */
export function inferRollMode(rolls: number[], total: number, modifier: number): RollMode {
  if (rolls.length !== 2) return 'normal';
  
  const rawTotal = total - modifier;
  if (rawTotal === Math.max(...rolls)) return 'advantage';
  if (rawTotal === Math.min(...rolls)) return 'disadvantage';
  
  return 'advantage'; // Default assumption for 2d20
}
```

#### 2. Update Weapon Prompt Generation

In `MobileCombatLayout.tsx` and `CombatTabScreen.tsx`, update the `generateWeaponPrompt` function:

```typescript
// BEFORE (broken):
const isCrit = roll.rolls.includes(20);
const isFumble = roll.rolls.includes(1);

// AFTER (correct):
import { isCriticalHit, isCriticalMiss, inferRollMode } from '@/lib/diceRoller';

const rollMode = inferRollMode(roll.rolls, roll.total, roll.modifier);
const isCrit = isCriticalHit(roll.rolls, rollMode, roll.die);
const isFumble = isCriticalMiss(roll.rolls, rollMode, roll.die);
```

#### 3. Update Combat Log Entries

In `MobileCombatLayout.tsx`, update the 4 locations where combat log entries are added:

```typescript
// BEFORE:
isCrit: roll.rolls.includes(20),
isFumble: roll.rolls.includes(1),

// AFTER:
isCrit: isCriticalHit(roll.rolls, inferRollMode(roll.rolls, roll.total, roll.modifier), roll.die),
isFumble: isCriticalMiss(roll.rolls, inferRollMode(roll.rolls, roll.total, roll.modifier), roll.die),
```

#### 4. Update Ability Card Prompt

In `CombatAbilityCard.tsx`, update the `generateAbilityPrompt` function:

```typescript
// BEFORE:
const isCrit = roll.rolls.includes(20);
const isFumble = roll.rolls.includes(1);

// AFTER:
const rollMode = inferRollMode(roll.rolls, roll.total, roll.modifier);
const isCrit = isCriticalHit(roll.rolls, rollMode, roll.die);
const isFumble = isCriticalMiss(roll.rolls, rollMode, roll.die);
```

#### 5. Update RP Prompt Generator

In `rpPromptGenerator.ts`, fix the ability dice crit detection (note: this is for ability dice, not d20s, so the logic differs):

```typescript
// BEFORE:
const isCritical = roll.rolls.includes(parseInt(roll.die.slice(1)));
const isFumble = roll.rolls.every(r => r === 1);

// AFTER:
// For ability dice (d6/d8/d10), max roll = crit, all 1s = fumble
const maxDieValue = parseInt(roll.die.slice(1));
const isCritical = roll.rolls.some(r => r === maxDieValue);
const isFumble = roll.rolls.every(r => r === 1);
```

#### 6. Update Dice Roll Modal

In `DiceRollModal.tsx`, update the display logic:

```typescript
// BEFORE:
const isCritical = roll.rolls.includes(parseInt(roll.die.slice(1)));
const isFumble = roll.rolls.every(r => r === 1);

// AFTER:
import { isCriticalHit, isCriticalMiss, inferRollMode } from '@/lib/diceRoller';

const maxDieValue = parseInt(roll.die.slice(1));
const rollMode = inferRollMode(roll.rolls, roll.total, roll.modifier);

// For d20s, use proper 5e crit rules; for other dice, use max value check
const isCritical = roll.die === 'd20' 
  ? isCriticalHit(roll.rolls, rollMode, roll.die)
  : roll.rolls.some(r => r === maxDieValue);
const isFumble = roll.die === 'd20'
  ? isCriticalMiss(roll.rolls, rollMode, roll.die)
  : roll.rolls.every(r => r === 1);
```

---

### Expected Behavior After Fix

| Scenario | Roll | Old Result | New Result |
|----------|------|------------|------------|
| Advantage [20, 5] | Keep 20 | CRIT | CRIT ✓ |
| Advantage [15, 1] | Keep 15 | MISS | Normal ✓ |
| Advantage [11, 1] | Keep 11 | MISS | Normal ✓ |
| Disadvantage [20, 5] | Keep 5 | CRIT | Normal ✓ |
| Disadvantage [3, 1] | Keep 1 | MISS | MISS ✓ |
| Normal [20] | 20 | CRIT | CRIT ✓ |
| Normal [1] | 1 | MISS | MISS ✓ |

