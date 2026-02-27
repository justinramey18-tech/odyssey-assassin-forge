// Odyssey Assassin Character Sheet Types

import { DnDClass, ClassLevelMap } from '@/lib/classes/types';

export type AbilityTree = 'hunter' | 'warrior' | 'assassin';

export type ActionType = 'action' | 'bonus_action' | 'reaction' | 'passive';

export type UsageType = 'at_will' | 'short_rest' | 'long_rest';

export interface TierEffect {
  tier: 1 | 2 | 3;
  description: string;
}

// Re-export class types for convenience
export type { DnDClass, ClassLevelMap } from '@/lib/classes/types';

export interface Ability {
  id: string;
  name: string;
  tree: AbilityTree;
  icon: string; // Lucide icon name
  type: 'active' | 'passive';
  actionType: ActionType;
  usageType: UsageType;
  tierEffects: TierEffect[];
  synergies?: string[]; // IDs of synergistic abilities
  prerequisite?: { abilityId: string; tier: number }; // Required ability and tier
  minLevel?: number; // Minimum character level to unlock
}

export interface CharacterAbility {
  abilityId: string;
  currentTier: 0 | 1 | 2 | 3; // 0 = locked
}

export interface Character {
  name: string;
  level: number;
  abilities: CharacterAbility[];
  equippedAbilities: string[]; // Array of ability IDs in loadout slots
  
  // Portrait icon (Lucide icon name)
  portraitIcon?: string;
  
  // Multiclass support (optional - defaults to 'rogue' for backward compatibility)
  primaryClass?: DnDClass;
  multiclassLevels?: ClassLevelMap;
}

// Calculate ability points by level
// New tiered progression formula:
// - Level 1: 5 starting points
// - Level 2: +3 points
// - Levels 3-5: +2 points each
// - Levels 6-10: +3 points each
// - Levels 11-15: +4 points each
// - Levels 16-20: +5 points each
// Total at Level 20: 74 points
export function getAbilityPointsForLevel(level: number): number {
  if (level < 1) return 0;
  if (level > 20) level = 20;
  
  // Level 1: 5 starting points
  let points = 5;
  
  // Level 2: +3 points
  if (level >= 2) points += 3;
  
  // Levels 3-5: +2 points each
  for (let l = 3; l <= Math.min(level, 5); l++) {
    points += 2;
  }
  
  // Levels 6-10: +3 points each
  for (let l = 6; l <= Math.min(level, 10); l++) {
    points += 3;
  }
  
  // Levels 11-15: +4 points each
  for (let l = 11; l <= Math.min(level, 15); l++) {
    points += 4;
  }
  
  // Levels 16-20: +5 points each
  for (let l = 16; l <= Math.min(level, 20); l++) {
    points += 5;
  }
  
  return points;
}

// Calculate active ability slots by level (1 slot per level, max 20)
// Can optionally add prestige points for bonus slots
export function getActiveSlotsByLevel(level: number, prestigePoints: number = 0): number {
  // Base slots: 1 per level, capped at 20
  const baseSlots = Math.min(Math.max(level, 1), 20);
  
  // Bonus slots: 1 per prestige point earned (no max)
  const bonusSlots = Math.max(prestigePoints, 0);
  
  return baseSlots + bonusSlots;
}

// Get points spent in a specific tree
export function getPointsSpentInTree(
  abilities: CharacterAbility[],
  allAbilities: Ability[],
  tree: AbilityTree
): number {
  return abilities
    .filter(ca => {
      const ability = allAbilities.find(a => a.id === ca.abilityId);
      return ability?.tree === tree && ca.currentTier > 0;
    })
    .reduce((sum, ca) => sum + ca.currentTier, 0);
}

// Get total points spent
export function getTotalPointsSpent(abilities: CharacterAbility[]): number {
  return abilities.reduce((sum, ca) => sum + ca.currentTier, 0);
}
