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
