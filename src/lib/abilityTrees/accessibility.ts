import { AbilityTree } from '@/lib/types';
import { ABILITY_CONNECTIONS, ABILITY_TREE_LAYOUT } from './layout';

export interface AccessibilityResult {
  isAccessible: boolean;
  reason: string;
  requiredParents: string[];
  requiresAll: boolean; // True if ALL parents needed (convergence point)
}

/**
 * AC Odyssey-style parent-child accessibility logic:
 * - Foundation (no parents): Always accessible
 * - Single parent: Parent must have >= 1 point invested
 * - Multiple parents (converge): ALL parents must have >= 1 point invested
 */
export function getAbilityAccessibility(
  abilityId: string,
  unlockedAbilities: Map<string, number>
): AccessibilityResult {
  const parents = ABILITY_CONNECTIONS[abilityId];
  
  // No parents = foundation tier = always accessible
  if (!parents || parents.length === 0) {
    return {
      isAccessible: true,
      reason: 'Foundation ability',
      requiredParents: [],
      requiresAll: false,
    };
  }
  
  // Check which parents are unlocked (tier >= 1)
  const unlockedParents = parents.filter(parentId => 
    (unlockedAbilities.get(parentId) || 0) >= 1
  );
  
  // For converging nodes (multiple parents), ALL must be unlocked
  if (parents.length > 1) {
    const allUnlocked = unlockedParents.length === parents.length;
    return {
      isAccessible: allUnlocked,
      reason: allUnlocked 
        ? 'All prerequisites met' 
        : `Requires all ${parents.length} abilities below`,
      requiredParents: parents,
      requiresAll: true,
    };
  }
  
  // Single parent - just needs that one unlocked
  const isUnlocked = unlockedParents.length > 0;
  return {
    isAccessible: isUnlocked,
    reason: isUnlocked 
      ? 'Prerequisite met' 
      : 'Unlock the ability below first',
    requiredParents: parents,
    requiresAll: false,
  };
}

/**
 * Get connection lines for visual rendering.
 * Returns array of {from, to} pairs based on parent-child relationships.
 * Lines are drawn FROM parent TO child (bottom to top after inversion).
 */
export function getTreeConnections(tree: AbilityTree): Array<{ from: string; to: string }> {
  const connections: Array<{ from: string; to: string }> = [];
  
  Object.entries(ABILITY_CONNECTIONS).forEach(([childId, parents]) => {
    const childLayout = ABILITY_TREE_LAYOUT[childId];
    if (childLayout?.tree !== tree) return;
    
    parents.forEach(parentId => {
      connections.push({ from: parentId, to: childId });
    });
  });
  
  return connections;
}
