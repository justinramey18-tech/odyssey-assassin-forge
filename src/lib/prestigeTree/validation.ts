// Prerequisite Chain Validation for Drizzt's Legacy Prestige Tree

import { PrestigeAbility } from './types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate the entire prestige ability tree for consistency
 * Checks for:
 * - Missing prerequisites
 * - Tier 1 abilities with prerequisites
 * - Prerequisites from higher tiers
 * - Circular dependencies
 */
export function validatePrerequisiteChain(
  abilities: PrestigeAbility[]
): ValidationResult {
  const errors: string[] = [];
  const abilityIds = new Set(abilities.map(a => a.id));
  const abilityMap = new Map(abilities.map(a => [a.id, a]));
  
  for (const ability of abilities) {
    // Check 1: Prerequisites must exist
    for (const prereq of ability.prerequisites) {
      if (!abilityIds.has(prereq)) {
        errors.push(`${ability.id}: Missing prerequisite "${prereq}"`);
      }
    }
    
    // Check 2: Tier 1 abilities cannot have prerequisites
    if (ability.tier === 1 && ability.prerequisites.length > 0) {
      errors.push(`${ability.id}: Tier 1 ability has prerequisites`);
    }
    
    // Check 3: Prerequisites must be same or lower tier
    for (const prereq of ability.prerequisites) {
      const prereqAbility = abilityMap.get(prereq);
      if (prereqAbility && prereqAbility.tier >= ability.tier) {
        errors.push(`${ability.id}: Prerequisite "${prereq}" is same or higher tier`);
      }
    }
    
    // Check 4: Detect circular dependencies (DFS)
    if (hasCircularDependency(ability.id, abilityMap)) {
      errors.push(`${ability.id}: Circular dependency detected`);
    }
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Check if an ability has circular dependencies using DFS
 */
function hasCircularDependency(
  abilityId: string,
  abilityMap: Map<string, PrestigeAbility>
): boolean {
  const visited = new Set<string>();
  const stack = new Set<string>();
  
  function dfs(currentId: string): boolean {
    if (stack.has(currentId)) return true; // Cycle detected
    if (visited.has(currentId)) return false;
    
    visited.add(currentId);
    stack.add(currentId);
    
    const ability = abilityMap.get(currentId);
    if (ability) {
      for (const prereq of ability.prerequisites) {
        if (dfs(prereq)) return true;
      }
    }
    
    stack.delete(currentId);
    return false;
  }
  
  return dfs(abilityId);
}

/**
 * Check if all prerequisites for an ability are met
 */
export function arePrerequisitesMet(
  abilityId: string,
  unlockedAbilities: Set<string>,
  abilityMap: Map<string, PrestigeAbility>
): { met: boolean; missing: string[] } {
  const ability = abilityMap.get(abilityId);
  if (!ability) return { met: true, missing: [] };
  
  const missing = ability.prerequisites.filter(prereq => !unlockedAbilities.has(prereq));
  return { met: missing.length === 0, missing };
}

/**
 * Get all abilities that would be unlockable given current progress
 */
export function getUnlockableAbilities(
  abilities: PrestigeAbility[],
  unlockedAbilities: Set<string>,
  availablePoints: number,
  prestigeLevel: number
): PrestigeAbility[] {
  return abilities.filter(ability => {
    // Already unlocked
    if (unlockedAbilities.has(ability.id)) return false;
    
    // Check cost
    if (ability.prestigeCost > availablePoints) return false;
    
    // Check prestige level requirement
    if (ability.minimumPrestigeLevel && prestigeLevel < ability.minimumPrestigeLevel) {
      return false;
    }
    
    // Check prerequisites
    const prereqsMet = ability.prerequisites.every(prereq => unlockedAbilities.has(prereq));
    return prereqsMet;
  });
}
