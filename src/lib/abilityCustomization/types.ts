// Ability Customization Types
// Per-character overrides for homebrew ability modifications

import { AbilityTree, ActionType, UsageType, TierEffect } from '@/lib/types';

/**
 * Custom override for an existing ability's properties
 * Only fields that are set will override the base ability
 */
export interface AbilityOverride {
  abilityId: string;
  // Display customization
  customName?: string;
  customIcon?: string; // Lucide icon name
  // Tier effect customization (index matches tier - 1)
  customTierEffects?: {
    tier: 1 | 2 | 3;
    description: string;
  }[];
  // Mechanics customization
  customActionType?: ActionType;
  customUsageType?: UsageType;
  // Dice customization for active abilities
  customDice?: {
    tier1?: { count: number; die: number }; // e.g., { count: 2, die: 6 } = 2d6
    tier2?: { count: number; die: number };
    tier3?: { count: number; die: number };
  };
  // Cooldown override (in minutes, 0 = no cooldown)
  customCooldownMinutes?: number;
  // Notes for the player
  notes?: string;
  // Timestamp for tracking
  createdAt: number;
  updatedAt: number;
}

/**
 * Attack type for homebrew abilities - determines which weapon is used in AI prompts
 */
export type HomebrewAttackType = 
  | 'none'           // No weapon involved (default)
  | 'unarmed'        // Unarmed strike
  | 'primary'        // Primary weapon slot
  | 'secondary'      // Secondary weapon slot
  | 'ranged'         // Ranged weapon slot
  | 'any_melee'      // Any melee weapon
  | 'any_weapon';    // Any equipped weapon

export const ATTACK_TYPE_OPTIONS: { value: HomebrewAttackType; label: string; description: string }[] = [
  { value: 'none', label: 'None', description: 'No weapon involved' },
  { value: 'unarmed', label: 'Unarmed', description: 'Unarmed strike or natural weapons' },
  { value: 'primary', label: 'Primary Weapon', description: 'Uses equipped primary weapon' },
  { value: 'secondary', label: 'Secondary Weapon', description: 'Uses equipped secondary weapon' },
  { value: 'ranged', label: 'Ranged Weapon', description: 'Uses equipped ranged weapon' },
  { value: 'any_melee', label: 'Any Melee', description: 'Uses any melee weapon' },
  { value: 'any_weapon', label: 'Any Weapon', description: 'Uses any equipped weapon' },
];

/**
 * Fully custom homebrew ability created by the player
 */
export interface HomebrewAbility {
  id: string; // Generated unique ID with 'homebrew_' prefix
  name: string;
  tree: AbilityTree;
  icon: string;
  type: 'active' | 'passive';
  actionType: ActionType;
  usageType: UsageType;
  tierEffects: TierEffect[];
  // Attack type for AI prompt context
  attackType?: HomebrewAttackType;
  // Dice for active abilities
  dice?: {
    tier1?: { count: number; die: number };
    tier2?: { count: number; die: number };
    tier3?: { count: number; die: number };
  };
  // Cooldown in minutes (0 = no cooldown)
  cooldownMinutes: number;
  // Prerequisites (optional)
  minLevel?: number;
  prerequisite?: { abilityId: string; tier: number };
  // Metadata
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Complete customization state for a character
 */
export interface AbilityCustomizationState {
  // Overrides for existing abilities (keyed by abilityId)
  overrides: Record<string, AbilityOverride>;
  // Custom homebrew abilities
  homebrewAbilities: HomebrewAbility[];
  // Version for future migrations
  version: number;
}

/**
 * Default empty state
 */
export const DEFAULT_CUSTOMIZATION_STATE: AbilityCustomizationState = {
  overrides: {},
  homebrewAbilities: [],
  version: 1,
};

/**
 * Available dice options for customization
 */
export const DICE_OPTIONS = [4, 6, 8, 10, 12, 20] as const;
export type DieType = typeof DICE_OPTIONS[number];

/**
 * Icon suggestions for abilities
 */
export const SUGGESTED_ICONS = [
  'Sword', 'Shield', 'Crosshair', 'Target', 'Eye', 'Zap', 'Flame',
  'Snowflake', 'Wind', 'Droplet', 'Skull', 'Heart', 'Star', 'Moon',
  'Sun', 'Sparkles', 'Bolt', 'Anchor', 'Axe', 'Hammer', 'Wand',
  'Feather', 'Leaf', 'Mountain', 'Waves', 'Ghost', 'Bug', 'Bird',
] as const;
