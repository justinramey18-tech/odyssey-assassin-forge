// Class Features Type Definitions
// D&D 5e class feature system

import { DnDClass } from '../types';
import { UsageType } from '@/lib/types';

/**
 * A class feature granted at a specific level
 */
export interface ClassFeature {
  id: string;
  classId: DnDClass;
  name: string;
  level: number;
  description: string;
  /** Mechanical effect summary for quick reference */
  mechanicalEffect?: string;
  /** How often this feature can be used */
  usageType?: UsageType;
  /** Number of uses (if applicable) */
  uses?: number | 'proficiency' | 'modifier';
  /** Which ability modifier affects uses (if uses = 'modifier') */
  usesAbility?: 'INT' | 'WIS' | 'CHA';
  /** Whether this is a subclass feature (deferred to Phase 2) */
  isSubclassFeature: boolean;
  /** Icon name from Lucide */
  iconName?: string;
}

/**
 * A feature that has been unlocked by a character
 */
export interface UnlockedFeature {
  feature: ClassFeature;
  /** The level in that class when this was unlocked */
  classLevel: number;
  /** Any selections made for this feature (e.g., Fighting Style choice) */
  selections?: string[];
  /** Current remaining uses (if applicable) */
  currentUses?: number;
}

/**
 * Get all features for a class up to a given level
 */
export type FeatureFilter = (feature: ClassFeature) => boolean;

/**
 * Feature that scales with level
 */
export interface ScalingFeature extends ClassFeature {
  scaling: {
    level: number;
    value: string;
  }[];
}

/**
 * Check if a feature is a scaling feature
 */
export function isScalingFeature(feature: ClassFeature): feature is ScalingFeature {
  return 'scaling' in feature;
}
