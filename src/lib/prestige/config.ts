// Prestige System Configuration
// Linear XP requirements for post-max-level progression

export const PRESTIGE_CONFIG = {
  MAX_BASE_LEVEL: 20,
  XP_PER_PRESTIGE_LEVEL: 5000,    // Fixed 5k XP per prestige level
  POINTS_PER_PRESTIGE: 1,         // Ability points earned per prestige level
  MAX_PRESTIGE_LEVEL: Infinity,   // No cap - unlimited prestige levels
} as const;

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
