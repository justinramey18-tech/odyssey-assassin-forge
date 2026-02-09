// D&D Classes - Central Registry
// Single source of truth for all class configurations

import { DnDClass, ClassConfig, ClassLevelMap } from './types';
import {
  ROGUE_CONFIG,
  WIZARD_CONFIG,
  SORCERER_CONFIG,
  WARLOCK_CONFIG,
  CLERIC_CONFIG,
  DRUID_CONFIG,
  BARD_CONFIG,
} from './spellcasters';

// Re-export types
export * from './types';
export * from './hitDice';
export * from './proficiencies';
export * from './prerequisites';
export * from './features';
export * from './druidCircles';
export * from './clericDomains';

/**
 * Complete registry of all D&D class configurations
 */
export const CLASS_REGISTRY: Record<DnDClass, ClassConfig> = {
  rogue: ROGUE_CONFIG,
  wizard: WIZARD_CONFIG,
  sorcerer: SORCERER_CONFIG,
  warlock: WARLOCK_CONFIG,
  cleric: CLERIC_CONFIG,
  druid: DRUID_CONFIG,
  bard: BARD_CONFIG,
};

/**
 * Get class configuration by ID
 */
export function getClassById(classId: DnDClass): ClassConfig {
  return CLASS_REGISTRY[classId];
}

/**
 * Get all available classes
 */
export function getAllClasses(): ClassConfig[] {
  return Object.values(CLASS_REGISTRY);
}

/**
 * Get all spellcaster classes (excludes rogue which uses MagicPath)
 */
export function getSpellcasterClasses(): ClassConfig[] {
  return getAllClasses().filter(c => c.id !== 'rogue');
}

/**
 * Calculate total character level from class levels
 */
export function calculateTotalLevel(
  primaryClassLevel: number,
  multiclassLevels: ClassLevelMap
): number {
  let total = primaryClassLevel;
  
  for (const levels of Object.values(multiclassLevels)) {
    total += levels ?? 0;
  }
  
  return Math.min(total, 20); // Cap at 20
}

/**
 * Get the default class for existing characters
 */
export function getDefaultClass(): DnDClass {
  return 'rogue';
}

/**
 * Check if a class ID is valid
 */
export function isValidClass(classId: string): classId is DnDClass {
  return classId in CLASS_REGISTRY;
}
