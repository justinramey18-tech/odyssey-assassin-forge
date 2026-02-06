// Dice rolling utilities
import { DiceOddsMode, rollWeightedDie, loadDiceOddsMode } from './diceOdds';

export type DieType = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100';

export interface DiceRoll {
  die: DieType;
  count: number;
  modifier: number;
  rolls: number[];
  total: number;
  oddsMode?: DiceOddsMode;
}

export function rollDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

export function rollDice(
  die: DieType, 
  count: number = 1, 
  modifier: number = 0,
  oddsMode?: DiceOddsMode
): DiceRoll {
  const sides = parseInt(die.slice(1));
  const rolls: number[] = [];
  
  // Use provided mode or load from storage
  const mode = oddsMode ?? loadDiceOddsMode();
  
  for (let i = 0; i < count; i++) {
    // Use weighted roll for d20s and ability dice, fair for damage
    if (die === 'd20' || die === 'd6' || die === 'd8' || die === 'd10') {
      rolls.push(rollWeightedDie(sides, mode));
    } else {
      rolls.push(rollDie(sides));
    }
  }
  
  const total = rolls.reduce((sum, r) => sum + r, 0) + modifier;
  
  return { die, count, modifier, rolls, total, oddsMode: mode };
}

// Get appropriate dice for an ability based on its tier
export function getAbilityDice(tier: 1 | 2 | 3): { die: DieType; count: number } {
  switch (tier) {
    case 1: return { die: 'd6', count: 1 };
    case 2: return { die: 'd8', count: 1 };
    case 3: return { die: 'd10', count: 2 };
  }
}

export function formatRollResult(roll: DiceRoll): string {
  const rollsStr = roll.rolls.join(' + ');
  const modStr = roll.modifier !== 0 
    ? ` ${roll.modifier > 0 ? '+' : ''}${roll.modifier}` 
    : '';
  return `${roll.count}${roll.die}${modStr}: [${rollsStr}]${modStr} = ${roll.total}`;
}

// ============= 5e-Compliant Critical Detection =============

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
  
  // Default: assume advantage for 2d20 (keep highest)
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
