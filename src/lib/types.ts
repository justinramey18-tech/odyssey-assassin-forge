// Odyssey Assassin Character Sheet Types

export type AbilityTree = 'hunter' | 'warrior' | 'assassin';

export type ActionType = 'action' | 'bonus_action' | 'reaction' | 'passive';

export type UsageType = 'at_will' | 'short_rest' | 'long_rest';

export interface TierEffect {
  tier: 1 | 2 | 3;
  description: string;
}

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
}

// Calculate ability points by level
export function getAbilityPointsForLevel(level: number): number {
  if (level < 1) return 0;
  if (level > 20) level = 20;
  
  // Base: 1 point per level
  let points = level;
  
  // Bonus points at levels 4, 8, 12, 16, 19
  const bonusLevels = [4, 8, 12, 16, 19];
  for (const bonusLevel of bonusLevels) {
    if (level >= bonusLevel) {
      points += 1;
    }
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
