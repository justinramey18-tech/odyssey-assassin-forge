// HP Calculation System
// D&D 5e compliant with Prestige extensions

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
