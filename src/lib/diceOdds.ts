// Dice Roll Odds System
// Allows weighted dice rolls for different play styles

export type DiceOddsMode = 'fair' | 'heroic' | 'dramatic' | 'chaotic' | 'cursed';

export interface DiceOddsConfig {
  mode: DiceOddsMode;
  label: string;
  description: string;
  deadpoolQuote: string;
  // Weights for roll quality (low, mid, high rolls)
  weights: {
    low: number;   // Rolls in bottom third
    mid: number;   // Rolls in middle third
    high: number;  // Rolls in top third
  };
}

export const DICE_ODDS_CONFIGS: Record<DiceOddsMode, DiceOddsConfig> = {
  fair: {
    mode: 'fair',
    label: 'Fair Play',
    description: 'Pure random chance. May the dice gods favor you.',
    deadpoolQuote: '"Boring, but mathematically honest."',
    weights: { low: 1, mid: 1, high: 1 },
  },
  heroic: {
    mode: 'heroic',
    label: 'Heroic',
    description: 'Slightly better odds. For protagonists who deserve a break.',
    deadpoolQuote: '"Plot armor: activated."',
    weights: { low: 0.6, mid: 1, high: 1.4 },
  },
  dramatic: {
    mode: 'dramatic',
    label: 'Dramatic',
    description: 'Extremes are more likely. Epic highs and crushing lows.',
    deadpoolQuote: '"Go big or go home... probably crying."',
    weights: { low: 1.3, mid: 0.4, high: 1.3 },
  },
  chaotic: {
    mode: 'chaotic',
    label: 'Chaotic Neutral',
    description: 'Completely unpredictable. Pure narrative chaos.',
    deadpoolQuote: '"I roll dice like I live life—recklessly."',
    weights: { low: 1.2, mid: 0.8, high: 1.2 },
  },
  cursed: {
    mode: 'cursed',
    label: 'Cursed',
    description: 'The dice hate you. Embrace the suffering.',
    deadpoolQuote: '"Maximum pain, minimal effort."',
    weights: { low: 1.5, mid: 1, high: 0.5 },
  },
};

// Weighted random roll
export function rollWeightedDie(sides: number, mode: DiceOddsMode): number {
  const config = DICE_ODDS_CONFIGS[mode];
  const { weights } = config;
  
  // Divide dice into thirds
  const lowMax = Math.floor(sides / 3);
  const midMax = Math.floor((2 * sides) / 3);
  
  // Calculate total weight
  const totalWeight = weights.low + weights.mid + weights.high;
  
  // Pick which third to roll in
  const roll = Math.random() * totalWeight;
  
  let min: number, max: number;
  
  if (roll < weights.low) {
    // Low roll (1 to lowMax)
    min = 1;
    max = lowMax;
  } else if (roll < weights.low + weights.mid) {
    // Mid roll (lowMax+1 to midMax)
    min = lowMax + 1;
    max = midMax;
  } else {
    // High roll (midMax+1 to sides)
    min = midMax + 1;
    max = sides;
  }
  
  // Roll within the selected range
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Storage key for persisting odds preference
const DICE_ODDS_STORAGE_KEY = 'odyssey-assassin-dice-odds';

export function saveDiceOddsMode(mode: DiceOddsMode): void {
  localStorage.setItem(DICE_ODDS_STORAGE_KEY, mode);
}

export function loadDiceOddsMode(): DiceOddsMode {
  const stored = localStorage.getItem(DICE_ODDS_STORAGE_KEY);
  if (stored && stored in DICE_ODDS_CONFIGS) {
    return stored as DiceOddsMode;
  }
  return 'fair';
}
