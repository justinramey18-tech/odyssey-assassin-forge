// Class Features Registry
// Central export for all class feature definitions

import { DnDClass } from '../types';
import { ClassFeature, UnlockedFeature } from './types';
import { ROGUE_FEATURES, getSneakAttackDice } from './rogue';
import { WIZARD_FEATURES, getArcaneRecoverySlots } from './wizard';
import { SORCERER_FEATURES, getSorceryPoints, METAMAGIC_OPTIONS } from './sorcerer';
import { WARLOCK_FEATURES, getInvocationsKnown, ELDRITCH_INVOCATIONS } from './warlock';
import { CLERIC_FEATURES, getChannelDivinityUses, DESTROY_UNDEAD_CR } from './cleric';
import { DRUID_FEATURES, getWildShapeMaxCR, WILD_SHAPE_CR_LIMITS } from './druid';
import { BARD_FEATURES, getBardicInspirationDie, getSongOfRestDie, SONG_OF_REST_DIE } from './bard';

// Re-export types
export * from './types';

// Re-export individual class features
export { ROGUE_FEATURES, getSneakAttackDice } from './rogue';
export { WIZARD_FEATURES, getArcaneRecoverySlots } from './wizard';
export { SORCERER_FEATURES, getSorceryPoints, METAMAGIC_OPTIONS } from './sorcerer';
export { WARLOCK_FEATURES, getInvocationsKnown, ELDRITCH_INVOCATIONS } from './warlock';
export { CLERIC_FEATURES, getChannelDivinityUses, DESTROY_UNDEAD_CR } from './cleric';
export { DRUID_FEATURES, getWildShapeMaxCR, WILD_SHAPE_CR_LIMITS } from './druid';
export { BARD_FEATURES, getBardicInspirationDie, getSongOfRestDie, SONG_OF_REST_DIE } from './bard';

/**
 * Complete registry of all class features by class
 */
export const CLASS_FEATURES_REGISTRY: Record<DnDClass, ClassFeature[]> = {
  rogue: ROGUE_FEATURES,
  wizard: WIZARD_FEATURES,
  sorcerer: SORCERER_FEATURES,
  warlock: WARLOCK_FEATURES,
  cleric: CLERIC_FEATURES,
  druid: DRUID_FEATURES,
  bard: BARD_FEATURES,
};

/**
 * Get all features for a class
 */
export function getClassFeatures(classId: DnDClass): ClassFeature[] {
  return CLASS_FEATURES_REGISTRY[classId] ?? [];
}

/**
 * Get features unlocked at or before a given class level
 */
export function getFeaturesForLevel(
  classId: DnDClass,
  classLevel: number,
  includeSubclass: boolean = false
): ClassFeature[] {
  const allFeatures = getClassFeatures(classId);
  return allFeatures.filter(
    feature => 
      feature.level <= classLevel && 
      (includeSubclass || !feature.isSubclassFeature)
  );
}

/**
 * Get features unlocked at exactly a given class level
 */
export function getFeaturesAtLevel(
  classId: DnDClass,
  classLevel: number,
  includeSubclass: boolean = false
): ClassFeature[] {
  const allFeatures = getClassFeatures(classId);
  return allFeatures.filter(
    feature => 
      feature.level === classLevel && 
      (includeSubclass || !feature.isSubclassFeature)
  );
}

/**
 * Get a specific feature by ID
 */
export function getFeatureById(featureId: string): ClassFeature | undefined {
  for (const features of Object.values(CLASS_FEATURES_REGISTRY)) {
    const found = features.find(f => f.id === featureId);
    if (found) return found;
  }
  return undefined;
}

/**
 * Convert class levels to unlocked features
 */
export function getUnlockedFeatures(
  classLevels: Partial<Record<DnDClass, number>>,
  includeSubclass: boolean = false
): UnlockedFeature[] {
  const unlocked: UnlockedFeature[] = [];
  
  for (const [classId, level] of Object.entries(classLevels)) {
    if (!level || level <= 0) continue;
    
    const features = getFeaturesForLevel(classId as DnDClass, level, includeSubclass);
    for (const feature of features) {
      unlocked.push({
        feature,
        classLevel: level,
      });
    }
  }
  
  // Sort by level, then by class
  return unlocked.sort((a, b) => {
    if (a.feature.level !== b.feature.level) {
      return a.feature.level - b.feature.level;
    }
    return a.feature.classId.localeCompare(b.feature.classId);
  });
}

/**
 * Get scaling value for a feature at a given level
 */
export function getScalingValue(
  featureId: string,
  classLevel: number
): string | undefined {
  const feature = getFeatureById(featureId);
  if (!feature || !('scaling' in feature)) return undefined;
  
  const scalingFeature = feature as ClassFeature & { scaling: { level: number; value: string }[] };
  
  // Find the highest scaling entry at or below the class level
  for (let i = scalingFeature.scaling.length - 1; i >= 0; i--) {
    if (classLevel >= scalingFeature.scaling[i].level) {
      return scalingFeature.scaling[i].value;
    }
  }
  
  return undefined;
}

/**
 * Count total features unlocked across all classes
 */
export function countUnlockedFeatures(
  classLevels: Partial<Record<DnDClass, number>>,
  includeSubclass: boolean = false
): number {
  return getUnlockedFeatures(classLevels, includeSubclass).length;
}
