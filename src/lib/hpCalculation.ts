// HP Calculation System
// D&D 5e compliant with Prestige extensions and Multiclass support

import { DnDClass, ClassLevelMap, CLASS_REGISTRY } from '@/lib/classes';

/**
 * Calculate maximum HP based on level, constitution modifier, and prestige level.
 * 
 * D&D 5e Rogue/Assassin Formula:
 * - Level 1: 8 (d8 max) + CON modifier
 * - Each level 2+: 5 (d8 average) + CON modifier
 * - Prestige Bonus: +2 HP per prestige level
 * 
 * @param level Character level (1-20)
 * @param constitutionModifier CON modifier (derived from constitution score)
 * @param prestigeLevel Optional prestige level for bonus HP
 * @returns Calculated maximum HP
 */
export function calculateMaxHP(
  level: number,
  constitutionModifier: number,
  prestigeLevel: number = 0
): number {
  // Validate inputs
  const validLevel = Math.max(1, Math.min(level, 20));
  const validPrestige = Math.max(0, prestigeLevel);
  
  // Base HP at level 1: d8 max (8) + CON mod
  let maxHP = 8 + constitutionModifier;
  
  // Additional HP per level after 1: d8 average (5) + CON mod per level
  if (validLevel > 1) {
    maxHP += (validLevel - 1) * (5 + constitutionModifier);
  }
  
  // Prestige bonus: +2 HP per prestige level
  maxHP += validPrestige * 2;
  
  // Ensure minimum of 1 HP (even with negative CON)
  return Math.max(1, maxHP);
}

/**
 * Get HP breakdown for UI display
 */
export interface HPBreakdown {
  baseHP: number;        // HP from level 1 (8 base)
  levelHP: number;       // HP from levels 2-20
  constitutionHP: number; // Total CON contribution
  prestigeHP: number;    // Bonus from prestige
  totalHP: number;
}

export function getHPBreakdown(
  level: number,
  constitutionModifier: number,
  prestigeLevel: number = 0
): HPBreakdown {
  const validLevel = Math.max(1, Math.min(level, 20));
  const validPrestige = Math.max(0, prestigeLevel);
  
  const baseHP = 8; // d8 max at level 1
  const levelHP = validLevel > 1 ? (validLevel - 1) * 5 : 0; // 5 per level after 1
  const constitutionHP = validLevel * constitutionModifier; // CON mod applies to every level
  const prestigeHP = validPrestige * 2;
  
  const totalHP = Math.max(1, baseHP + levelHP + constitutionHP + prestigeHP);
  
  return {
    baseHP,
    levelHP,
    constitutionHP,
    prestigeHP,
    totalHP,
  };
}

/**
 * Constants for HP calculation
 */
export const HP_CONFIG = {
  HIT_DIE: 'd8',
  HIT_DIE_MAX: 8,
  HIT_DIE_AVG: 5,
  PRESTIGE_HP_PER_LEVEL: 2,
} as const;

// ============================================================================
// MULTICLASS HP CALCULATION
// ============================================================================

/**
 * Calculate maximum HP for a multiclass character.
 * 
 * Rules:
 * - Level 1 (in primary class): Hit die MAX + CON modifier
 * - Primary class levels 2+: Hit die AVG + CON modifier per level
 * - Multiclass levels: Hit die AVG + CON modifier per level (each class uses its own die)
 * - Prestige bonus: +2 HP per prestige level
 * 
 * @param primaryClass The character's starting class
 * @param primaryLevel Levels in the primary class (character.level)
 * @param multiclassLevels Map of class IDs to levels in each multiclass
 * @param constitutionModifier CON modifier
 * @param prestigeLevel Prestige level for bonus HP
 * @returns Calculated maximum HP
 */
export function calculateMulticlassMaxHP(
  primaryClass: DnDClass,
  primaryLevel: number,
  multiclassLevels: ClassLevelMap,
  constitutionModifier: number,
  prestigeLevel: number = 0
): number {
  // Validate inputs
  const validPrimaryLevel = Math.max(1, Math.min(primaryLevel, 20));
  const validPrestige = Math.max(0, prestigeLevel);
  
  // Get primary class config
  const primaryConfig = CLASS_REGISTRY[primaryClass];
  if (!primaryConfig) {
    // Fallback to legacy calculation if class not found
    return calculateMaxHP(primaryLevel, constitutionModifier, prestigeLevel);
  }
  
  // Level 1 in primary class: Hit die MAX + CON
  let maxHP = primaryConfig.hitDieMax + constitutionModifier;
  
  // Primary class levels 2+: Hit die AVG + CON per level
  if (validPrimaryLevel > 1) {
    maxHP += (validPrimaryLevel - 1) * (primaryConfig.hitDieAvg + constitutionModifier);
  }
  
  // Multiclass levels: Each class uses its own hit die average
  for (const [classId, levels] of Object.entries(multiclassLevels)) {
    if (levels && levels > 0) {
      const mcConfig = CLASS_REGISTRY[classId as DnDClass];
      if (mcConfig) {
        maxHP += levels * (mcConfig.hitDieAvg + constitutionModifier);
      }
    }
  }
  
  // Prestige bonus (unchanged from base system)
  maxHP += validPrestige * HP_CONFIG.PRESTIGE_HP_PER_LEVEL;
  
  // Ensure minimum of 1 HP
  return Math.max(1, maxHP);
}

/**
 * Get HP breakdown for multiclass characters (for UI display)
 */
export interface MulticlassHPBreakdown {
  primaryClassHP: number;      // HP from primary class (level 1 max + avg for rest)
  multiclassHP: Record<DnDClass, number>;  // HP from each multiclass
  constitutionHP: number;      // Total CON contribution across all levels
  prestigeHP: number;          // Bonus from prestige
  totalHP: number;
}

export function getMulticlassHPBreakdown(
  primaryClass: DnDClass,
  primaryLevel: number,
  multiclassLevels: ClassLevelMap,
  constitutionModifier: number,
  prestigeLevel: number = 0
): MulticlassHPBreakdown {
  const validPrimaryLevel = Math.max(1, Math.min(primaryLevel, 20));
  const validPrestige = Math.max(0, prestigeLevel);
  
  const primaryConfig = CLASS_REGISTRY[primaryClass];
  
  // Calculate total levels for CON contribution
  let totalLevels = validPrimaryLevel;
  for (const levels of Object.values(multiclassLevels)) {
    totalLevels += levels ?? 0;
  }
  
  // Primary class HP (pure die contribution)
  const primaryClassHP = primaryConfig
    ? primaryConfig.hitDieMax + (validPrimaryLevel > 1 ? (validPrimaryLevel - 1) * primaryConfig.hitDieAvg : 0)
    : 8 + (validPrimaryLevel > 1 ? (validPrimaryLevel - 1) * 5 : 0); // Fallback to d8
  
  // Multiclass HP by class
  const multiclassHP: Record<string, number> = {};
  for (const [classId, levels] of Object.entries(multiclassLevels)) {
    if (levels && levels > 0) {
      const mcConfig = CLASS_REGISTRY[classId as DnDClass];
      if (mcConfig) {
        multiclassHP[classId] = levels * mcConfig.hitDieAvg;
      }
    }
  }
  
  // Constitution contribution (applies to every level)
  const constitutionHP = totalLevels * constitutionModifier;
  
  // Prestige bonus
  const prestigeHP = validPrestige * HP_CONFIG.PRESTIGE_HP_PER_LEVEL;
  
  // Total
  const baseHP = primaryClassHP + Object.values(multiclassHP).reduce((sum, hp) => sum + hp, 0);
  const totalHP = Math.max(1, baseHP + constitutionHP + prestigeHP);
  
  return {
    primaryClassHP,
    multiclassHP: multiclassHP as Record<DnDClass, number>,
    constitutionHP,
    prestigeHP,
    totalHP,
  };
}

/**
 * Get aggregated hit dice pool for multiclass character
 * Returns count of each die type for short rest healing
 */
export function getHitDicePool(
  primaryClass: DnDClass,
  primaryLevel: number,
  multiclassLevels: ClassLevelMap
): Record<string, number> {
  const pool: Record<string, number> = {};
  
  // Primary class hit dice
  const primaryConfig = CLASS_REGISTRY[primaryClass];
  if (primaryConfig) {
    pool[primaryConfig.hitDie] = (pool[primaryConfig.hitDie] ?? 0) + primaryLevel;
  }
  
  // Multiclass hit dice
  for (const [classId, levels] of Object.entries(multiclassLevels)) {
    if (levels && levels > 0) {
      const mcConfig = CLASS_REGISTRY[classId as DnDClass];
      if (mcConfig) {
        pool[mcConfig.hitDie] = (pool[mcConfig.hitDie] ?? 0) + levels;
      }
    }
  }
  
  return pool;
}
