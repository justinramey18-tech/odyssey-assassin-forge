// Dice rolling utilities

export type DieType = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100';

export interface DiceRoll {
  die: DieType;
  count: number;
  modifier: number;
  rolls: number[];
  total: number;
}

export function rollDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

export function rollDice(die: DieType, count: number = 1, modifier: number = 0): DiceRoll {
  const sides = parseInt(die.slice(1));
  const rolls: number[] = [];
  
  for (let i = 0; i < count; i++) {
    rolls.push(rollDie(sides));
  }
  
  const total = rolls.reduce((sum, r) => sum + r, 0) + modifier;
  
  return { die, count, modifier, rolls, total };
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
