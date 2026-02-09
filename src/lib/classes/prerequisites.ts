// Multiclass Prerequisites
// D&D 5e ability score requirements for multiclassing

import { BaseAbilityScores, AbilityName } from '@/lib/abilityScores/types';
import { DnDClass, ClassConfig } from './types';

/**
 * Result of a prerequisite check
 */
export interface PrerequisiteResult {
  allowed: boolean;
  reason?: string;
  missingRequirements?: { ability: AbilityName; required: number; current: number }[];
}

/**
 * Check if ability scores meet multiclass prerequisites for a class
 */
export function meetsMulticlassPrerequisites(
  classConfig: ClassConfig,
  abilityScores: BaseAbilityScores
): PrerequisiteResult {
  const missing: { ability: AbilityName; required: number; current: number }[] = [];
  
  for (const [ability, minimum] of Object.entries(classConfig.multiclassRequirements)) {
    const abilityName = ability as AbilityName;
    const current = abilityScores[abilityName];
    
    if (current < (minimum ?? 0)) {
      missing.push({
        ability: abilityName,
        required: minimum ?? 0,
        current,
      });
    }
  }
  
  if (missing.length > 0) {
    const reasons = missing.map(
      m => `${m.ability.toUpperCase()} ${m.current}/${m.required}`
    );
    return {
      allowed: false,
      reason: `Requires: ${reasons.join(', ')}`,
      missingRequirements: missing,
    };
  }
  
  return { allowed: true };
}

/**
 * Check if a character can add a multiclass level
 */
export function canAddMulticlassLevel(
  classConfig: ClassConfig,
  abilityScores: BaseAbilityScores,
  currentTotalLevel: number,
  maxLevel: number = 20
): PrerequisiteResult {
  // Check level cap
  if (currentTotalLevel >= maxLevel) {
    return {
      allowed: false,
      reason: `Maximum level (${maxLevel}) reached`,
    };
  }
  
  // Check ability score prerequisites
  return meetsMulticlassPrerequisites(classConfig, abilityScores);
}

/**
 * Get a formatted string describing multiclass requirements
 */
export function formatPrerequisites(classConfig: ClassConfig): string {
  const reqs = Object.entries(classConfig.multiclassRequirements)
    .map(([ability, min]) => `${ability.substring(0, 3).toUpperCase()} ${min}`)
    .join(', ');
  
  return reqs || 'None';
}
