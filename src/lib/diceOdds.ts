// Dice Roll Odds System
// Uses explicit bracket-based probability distributions
import { getScopedItem, setScopedItem } from '@/lib/scoped-storage';

export type DiceOddsMode = 'fair' | 'heroic' | 'dramatic' | 'chaotic' | 'cursed';

export interface OddsBracket {
  chance: number;  // 0-1 probability
  min: number;     // minimum roll value
  max: number;     // maximum roll value
  label?: string;  // display label for visualization
}

export interface DiceOddsConfig {
  mode: DiceOddsMode;
  label: string;
  description: string;
  deadpoolQuote: string;
  brackets: OddsBracket[];
}

export const DICE_ODDS_CONFIGS: Record<DiceOddsMode, DiceOddsConfig> = {
  fair: {
    mode: 'fair',
    label: 'Fair Play',
    description: 'Pure random chance. May the dice gods favor you.',
    deadpoolQuote: '"Boring, but mathematically honest."',
    brackets: [], // empty = pure uniform random
  },
  heroic: {
    mode: 'heroic',
    label: 'Heroic',
    description: 'Slightly better odds. For protagonists who deserve a break.',
    deadpoolQuote: '"Plot armor: activated."',
    brackets: [
      { chance: 0.15, min: 20, max: 20, label: 'Nat 20' },
      { chance: 0.65, min: 15, max: 19, label: '15-19' },
      { chance: 0.15, min: 10, max: 14, label: '10-14' },
      { chance: 0.05, min: 1, max: 9, label: '1-9' },
    ],
  },
  dramatic: {
    mode: 'dramatic',
    label: 'Dramatic',
    description: 'Extremes are more likely. Epic highs and crushing lows.',
    deadpoolQuote: '"Go big or go home... probably crying."',
    brackets: [
      { chance: 0.50, min: 18, max: 20, label: '18-20' },
      { chance: 0.50, min: 1, max: 7, label: '1-7' },
    ],
  },
  chaotic: {
    mode: 'chaotic',
    label: 'Chaotic Neutral',
    description: 'Completely unpredictable. Pure narrative chaos.',
    deadpoolQuote: '"I roll dice like I live life—recklessly."',
    brackets: [
      { chance: 0.50, min: 15, max: 20, label: '15-20' },
      { chance: 0.25, min: 8, max: 14, label: '8-14' },
      { chance: 0.25, min: 1, max: 3, label: '1-3' },
    ],
  },
  cursed: {
    mode: 'cursed',
    label: 'Cursed',
    description: 'The dice hate you. Embrace the suffering.',
    deadpoolQuote: '"Maximum pain, minimal effort."',
    brackets: [
      { chance: 0.15, min: 1, max: 1, label: 'Nat 1' },
      { chance: 0.65, min: 2, max: 7, label: '2-7' },
      { chance: 0.15, min: 8, max: 14, label: '8-14' },
      { chance: 0.05, min: 15, max: 20, label: '15-20' },
    ],
  },
};

// Bracket-based weighted roll for d20
export function rollWeightedDie(sides: number, mode: DiceOddsMode): number {
  // Fair mode: pure uniform random
  if (mode === 'fair') {
    return Math.floor(Math.random() * sides) + 1;
  }

  const config = DICE_ODDS_CONFIGS[mode];
  const { brackets } = config;

  // For non-d20 dice, fall back to uniform
  if (sides !== 20 || brackets.length === 0) {
    return Math.floor(Math.random() * sides) + 1;
  }

  // Pick bracket based on cumulative probability
  const roll = Math.random();
  let cumulative = 0;

  for (const bracket of brackets) {
    cumulative += bracket.chance;
    if (roll < cumulative) {
      return Math.floor(Math.random() * (bracket.max - bracket.min + 1)) + bracket.min;
    }
  }

  // Fallback (shouldn't happen if brackets sum to 1)
  const last = brackets[brackets.length - 1];
  return Math.floor(Math.random() * (last.max - last.min + 1)) + last.min;
}

// Storage key for persisting odds preference
const DICE_ODDS_STORAGE_KEY = 'odyssey-assassin-dice-odds';

export function saveDiceOddsMode(mode: DiceOddsMode): void {
  setScopedItem(DICE_ODDS_STORAGE_KEY, mode);
}

export function loadDiceOddsMode(): DiceOddsMode {
  const stored = getScopedItem(DICE_ODDS_STORAGE_KEY);
  if (stored && stored in DICE_ODDS_CONFIGS) {
    return stored as DiceOddsMode;
  }
  return 'fair';
}
