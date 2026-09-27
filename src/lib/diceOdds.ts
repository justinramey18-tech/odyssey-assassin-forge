// Dice Roll Odds System
// Uses explicit bracket-based probability distributions
import { getScopedItem, setScopedItem } from '@/lib/scoped-storage';
import { maybePlayCritSound } from '@/lib/critSound';

export type DiceOddsMode =
  'fair' | 'heroic' | 'dramatic' | 'chaotic' | 'cursed' | 'godmode' | 'doomed';

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
  godmode: {
    mode: 'godmode',
    label: 'God Mode',
    description: 'Every d20 rolls a natural 20. No exceptions.',
    deadpoolQuote: '"This is cheating and I love it."',
    brackets: [
      { chance: 1.0, min: 20, max: 20, label: 'Nat 20' },
    ],
  },
  doomed: {
    mode: 'doomed',
    label: 'Doomed',
    description: 'Every d20 rolls a natural 1. Abandon hope.',
    deadpoolQuote: '"Why would you do this to yourself?"',
    brackets: [
      { chance: 1.0, min: 1, max: 1, label: 'Nat 1' },
    ],
  },
};

// Bracket-based weighted roll for d20
export function rollWeightedDie(sides: number, mode: DiceOddsMode): number {
  const value = rollWeightedDieInternal(sides, mode);
  maybePlayCritSound(value, sides);
  return value;
}

/** Same as rollWeightedDie but never plays the crit sound. rollD20() decides sound itself. */
export function rollWeightedDieSilent(sides: number, mode: DiceOddsMode): number {
  return rollWeightedDieInternal(sides, mode);
}

function rollWeightedDieInternal(sides: number, mode: DiceOddsMode): number {
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
  // Picking a single mode selects its uniform profile.
  saveOddsProfileId(mode);
}

/** Legacy single-mode read (the raw old key). Rolls use resolveOddsForContext(). */
export function loadDiceOddsMode(): DiceOddsMode {
  const stored = getScopedItem(DICE_ODDS_STORAGE_KEY);
  if (stored && stored in DICE_ODDS_CONFIGS) {
    return stored as DiceOddsMode;
  }
  return 'fair';
}

// ─── Odds profiles: pick a mode per scene kind (combat vs roleplay) ─────────
import type { D20Context } from '@/lib/rollD20';

export type SceneKind = 'combat' | 'roleplay';

export const CONTEXT_SCENE: Record<D20Context, SceneKind> = {
  'attack': 'combat',
  'spell-attack': 'combat',
  'initiative': 'combat',
  'death-save': 'combat',
  'concentration': 'combat',
  'save': 'combat',      // most saves happen in combat
  'skill': 'roleplay',
  'other': 'roleplay',
};

export interface OddsProfile {
  id: string;
  label: string;
  description: string;
  deadpoolQuote: string;
  /** Which odds mode to use per scene kind. */
  byScene: Record<SceneKind, DiceOddsMode>;
  /** True for the plain single-mode profiles. */
  uniform: boolean;
}

const UNIFORM_PROFILES: Record<string, OddsProfile> = Object.fromEntries(
  (Object.keys(DICE_ODDS_CONFIGS) as DiceOddsMode[]).map((m) => {
    const c = DICE_ODDS_CONFIGS[m];
    return [m, { id: m, label: c.label, description: c.description, deadpoolQuote: c.deadpoolQuote, byScene: { combat: m, roleplay: m }, uniform: true }];
  }),
);

export const ADAPTIVE_PROFILES: Record<string, OddsProfile> = {
  protagonist: {
    id: 'protagonist',
    label: 'Protagonist',
    description: 'Heroic in a fight, honest everywhere else. You will survive the battle — the story is genuinely uncertain.',
    deadpoolQuote: '"Plot armor, but only when swords are out."',
    byScene: { combat: 'heroic', roleplay: 'fair' },
    uniform: false,
  },
  mastermind: {
    id: 'mastermind',
    label: 'Mastermind',
    description: 'Silver-tongued out of combat, mortal in it. You steer the story, but a fight could go any way.',
    deadpoolQuote: '"I talk my way out of things for a reason."',
    byScene: { combat: 'fair', roleplay: 'heroic' },
    uniform: false,
  },
};

export const ODDS_PROFILES: Record<string, OddsProfile> = { ...UNIFORM_PROFILES, ...ADAPTIVE_PROFILES };

const ODDS_PROFILE_STORAGE_KEY = 'odyssey-dice-odds-profile';
export const ODDS_PROFILE_CHANGED_EVENT = 'odyssey-odds-profile-changed';

export function loadOddsProfileId(): string {
  const stored = getScopedItem(ODDS_PROFILE_STORAGE_KEY);
  if (stored && stored in ODDS_PROFILES) return stored;
  // Migration: an existing bare mode becomes its matching uniform profile.
  return loadDiceOddsMode();
}

export function loadOddsProfile(): OddsProfile {
  return ODDS_PROFILES[loadOddsProfileId()] ?? ODDS_PROFILES.fair;
}

export function saveOddsProfileId(id: string): void {
  const profile = ODDS_PROFILES[id];
  if (!profile) return;
  setScopedItem(ODDS_PROFILE_STORAGE_KEY, id);
  // Keep the legacy key meaningful for older readers (uniform profiles only).
  if (profile.uniform) setScopedItem(DICE_ODDS_STORAGE_KEY, profile.byScene.combat);
  try { window.dispatchEvent(new CustomEvent(ODDS_PROFILE_CHANGED_EVENT, { detail: id })); } catch { /* non-browser */ }
}

export function resolveOddsForContext(context: D20Context): DiceOddsMode {
  const profile = loadOddsProfile();
  return profile.byScene[CONTEXT_SCENE[context] ?? 'roleplay'];
}

/** "Combat: Heroic · Roleplay: Fair" */
export function describeProfileScenes(p: OddsProfile): string {
  return `Combat: ${DICE_ODDS_CONFIGS[p.byScene.combat].label} · Roleplay: ${DICE_ODDS_CONFIGS[p.byScene.roleplay].label}`;
}
