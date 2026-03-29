// D&D Ability Scores Type Definitions
import { isEmpyreanMode, EMPYREAN_ABILITY_LABELS } from '@/lib/empyreanLabels';

export type AbilityName = 'strength' | 'dexterity' | 'constitution' | 'intelligence' | 'wisdom' | 'charisma';

export interface AbilityScoreConfig {
  name: AbilityName;
  abbr: string; // STR, DEX, etc.
  label: string;
  icon: string; // Lucide icon name
  color: string; // Tailwind color class
}

export interface AbilityScoreBreakdown {
  base: number;
  gearBonus: number;
  buffBonus: number;
  total: number;
  modifier: number;
}

export interface BaseAbilityScores {
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
}

// Ability configuration matching DiceRoller styling
export const ABILITY_CONFIG: Record<AbilityName, AbilityScoreConfig> = {
  strength: {
    name: 'strength',
    abbr: 'STR',
    label: 'Strength',
    icon: 'Swords',
    color: 'text-red-400',
  },
  dexterity: {
    name: 'dexterity',
    abbr: 'DEX',
    label: 'Dexterity',
    icon: 'Move',
    color: 'text-green-400',
  },
  constitution: {
    name: 'constitution',
    abbr: 'CON',
    label: 'Constitution',
    icon: 'Heart',
    color: 'text-orange-400',
  },
  intelligence: {
    name: 'intelligence',
    abbr: 'INT',
    label: 'Intelligence',
    icon: 'Sparkles',
    color: 'text-blue-400',
  },
  wisdom: {
    name: 'wisdom',
    abbr: 'WIS',
    label: 'Wisdom',
    icon: 'Eye',
    color: 'text-purple-400',
  },
  charisma: {
    name: 'charisma',
    abbr: 'CHA',
    label: 'Charisma',
    icon: 'Gem',
    color: 'text-pink-400',
  },
};

export const ABILITY_ORDER: AbilityName[] = [
  'strength',
  'dexterity',
  'constitution',
  'intelligence',
  'wisdom',
  'charisma',
];

// Standard array for quick character creation
export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

// Default base scores (all 10s = neutral/commoner)
export const DEFAULT_BASE_SCORES: BaseAbilityScores = {
  strength: 10,
  dexterity: 10,
  constitution: 10,
  intelligence: 10,
  wisdom: 10,
  charisma: 10,
};

/**
 * Calculate the modifier for a given ability score
 * D&D formula: floor((score - 10) / 2)
 */
export function scoreToModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

/**
 * Format modifier as string with sign (e.g., +3, -1, +0)
 */
export function modifierToString(modifier: number): string {
  if (modifier >= 0) return `+${modifier}`;
  return `${modifier}`;
}

/**
 * Clamp score to valid D&D range (1-30)
 */
export function clampScore(score: number): number {
  return Math.max(1, Math.min(30, score));
}

export function getAbilityConfig(ability: AbilityName): AbilityScoreConfig {
  const base = ABILITY_CONFIG[ability];
  if (!isEmpyreanMode()) return base;
  const emp = EMPYREAN_ABILITY_LABELS[ability];
  if (!emp) return base;
  return { ...base, abbr: emp.abbr, label: emp.label };
}
