// Prestige System Configuration
// Linear XP requirements for post-max-level progression
// Variable ability points per prestige level

export const PRESTIGE_CONFIG = {
  MAX_BASE_LEVEL: 20,
  XP_PER_PRESTIGE_LEVEL: 5000,    // Fixed 5k XP per prestige level
  MAX_PRESTIGE_LEVEL: Infinity,   // No cap - unlimited prestige levels
} as const;

/**
 * Get points awarded for reaching a specific prestige level
 * Variable scaling per spec:
 * - Level 1: 3 points
 * - Levels 2-4: 2 points each
 * - Level 5: 3 points
 * - Levels 6-7: 2 points each
 * - Levels 8-9: 3 points each
 * - Level 10: 5 points
 * - Levels 11+: 3 points each (fallback)
 */
export function getPrestigePointsForLevel(prestigeLevel: number): number {
  const levelRewards: Record<number, number> = {
    1: 3, 2: 2, 3: 2, 4: 2, 5: 3,
    6: 2, 7: 2, 8: 3, 9: 3, 10: 5,
  };
  return levelRewards[prestigeLevel] ?? 3; // 3 points for levels 11+
}

/**
 * Calculate total prestige points earned from level 1 to current level
 * Used for migration and validation
 */
export function getTotalPrestigePointsForLevel(prestigeLevel: number): number {
  if (prestigeLevel <= 0) return 0;
  let total = 0;
  for (let l = 1; l <= prestigeLevel; l++) {
    total += getPrestigePointsForLevel(l);
  }
  return total;
}

/**
 * Calculate XP required for next prestige level
 * Linear scaling: always 5,000 XP
 */
export function getPrestigeXPRequired(prestigeLevel: number): number {
  return PRESTIGE_CONFIG.XP_PER_PRESTIGE_LEVEL;
}

/**
 * Get total XP needed to reach a prestige level from 0
 * Triangular number formula: sum of 1 to N levels × 5000
 */
export function getTotalPrestigeXP(targetLevel: number): number {
  return targetLevel * PRESTIGE_CONFIG.XP_PER_PRESTIGE_LEVEL;
}

/**
 * Get progress percentage towards next prestige level
 */
export function getPrestigeProgress(currentXP: number, prestigeLevel: number): number {
  const required = PRESTIGE_CONFIG.XP_PER_PRESTIGE_LEVEL;
  return Math.min(100, Math.max(0, (currentXP / required) * 100));
}

/**
 * Calculate XP remaining to next prestige level
 */
export function getXPToNextPrestige(currentXP: number, prestigeLevel: number): number {
  const required = PRESTIGE_CONFIG.XP_PER_PRESTIGE_LEVEL;
  return Math.max(0, required - currentXP);
}

// Example prestige XP scaling table for reference:
// | Level | XP Required | Cumulative XP |
// |-------|-------------|---------------|
// | 1     | 5,000       | 5,000         |
// | 2     | 5,000       | 10,000        |
// | 3     | 5,000       | 15,000        |
// | 10    | 5,000       | 50,000        |
// | 50    | 5,000       | 250,000       |
// | 100   | 5,000       | 500,000       |
