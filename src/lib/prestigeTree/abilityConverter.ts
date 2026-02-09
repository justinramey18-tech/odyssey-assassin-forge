// Converts PrestigeAbility (legacy tree) → Ability (base system)
// Enables legacy abilities to be equipped in loadout slots and used in combat

import { Ability, AbilityTree, ActionType, UsageType } from '@/lib/types';
import { PrestigeAbility, PrestigeBranch } from './types';
import { getPrestigeAbilityById, prestigeAbilities } from './abilities';

// Map prestige branches to closest base ability tree for styling
const BRANCH_TO_TREE: Record<PrestigeBranch, AbilityTree> = {
  dual_wielding: 'warrior',
  guenhwyvar: 'hunter',
  drow_abilities: 'assassin',
  monk_abilities: 'warrior',
};

// Infer action type from effects/description
function inferActionType(pa: PrestigeAbility): ActionType {
  const desc = pa.description.toLowerCase();
  const mech = pa.mechanicalContext.toLowerCase();
  
  if (desc.includes('passive') || mech.includes('passive')) return 'passive';
  if (desc.includes('bonus action') || mech.includes('bonus action')) return 'bonus_action';
  if (desc.includes('reaction') || mech.includes('reaction')) return 'reaction';
  return 'action';
}

// Infer usage type from cooldown/effects
function inferUsageType(pa: PrestigeAbility): UsageType {
  const cd = pa.effects.cooldown?.toLowerCase() ?? '';
  const mech = pa.mechanicalContext.toLowerCase();
  
  if (cd.includes('long rest') || mech.includes('long rest')) return 'long_rest';
  if (cd.includes('short rest') || mech.includes('short rest')) return 'short_rest';
  return 'at_will';
}

// Infer ability type (active vs passive) 
function inferAbilityType(pa: PrestigeAbility): 'active' | 'passive' {
  const actionType = inferActionType(pa);
  return actionType === 'passive' ? 'passive' : 'active';
}

/**
 * Convert a single PrestigeAbility into a base Ability for loadout/combat use.
 * The id is prefixed with 'legacy_' to distinguish from base abilities.
 */
export function prestigeAbilityToAbility(pa: PrestigeAbility): Ability {
  return {
    id: `legacy_${pa.id}`,
    name: pa.name,
    tree: BRANCH_TO_TREE[pa.branch],
    icon: pa.icon,
    type: inferAbilityType(pa),
    actionType: inferActionType(pa),
    usageType: inferUsageType(pa),
    tierEffects: [
      {
        tier: 1,
        description: pa.description,
      },
      {
        tier: 2,
        description: `${pa.description} (Enhanced)`,
      },
      {
        tier: 3,
        description: `${pa.description} (Mastered)`,
      },
    ],
  };
}

/**
 * Check if an ability ID is a legacy prestige ability
 */
export function isLegacyAbilityId(id: string): boolean {
  return id.startsWith('legacy_');
}

/**
 * Get the original prestige ability ID from a legacy-prefixed ID
 */
export function getOriginalPrestigeId(legacyId: string): string {
  return legacyId.replace(/^legacy_/, '');
}

/**
 * Resolve a legacy ability ID to an Ability object, or null if not found
 */
export function resolveLegacyAbility(id: string): Ability | null {
  if (!isLegacyAbilityId(id)) return null;
  const originalId = getOriginalPrestigeId(id);
  const pa = getPrestigeAbilityById(originalId);
  if (!pa) return null;
  return prestigeAbilityToAbility(pa);
}

/**
 * Get all unlocked legacy abilities as Ability objects
 */
export function getUnlockedLegacyAbilities(unlockedIds: string[]): Ability[] {
  return unlockedIds
    .map(id => {
      const pa = getPrestigeAbilityById(id);
      if (!pa) return null;
      return prestigeAbilityToAbility(pa);
    })
    .filter(Boolean) as Ability[];
}
