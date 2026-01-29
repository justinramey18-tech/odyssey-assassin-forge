// Prestige System Configuration
// Escalating XP requirements for post-max-level progression

export const PRESTIGE_CONFIG = {
  MAX_BASE_LEVEL: 20,
  BASE_PRESTIGE_XP: 5000,        // XP needed for first prestige level
  XP_SCALING_FACTOR: 1.5,        // Each level requires 50% more XP
  POINTS_PER_PRESTIGE: 1,        // Ability points earned per prestige level
  MAX_PRESTIGE_LEVEL: 50,        // Optional cap (or set to Infinity)
} as const;

/**
 * Calculate XP required for a specific prestige level
 * Uses exponential scaling: base * (factor ^ level)
 */
export function getPrestigeXPRequired(prestigeLevel: number): number {
  return Math.floor(
    PRESTIGE_CONFIG.BASE_PRESTIGE_XP * 
    Math.pow(PRESTIGE_CONFIG.XP_SCALING_FACTOR, prestigeLevel)
  );
}

/**
 * Get total XP needed to reach a prestige level from 0
 * Sums all XP requirements from level 0 to targetLevel-1
 */
export function getTotalPrestigeXP(targetLevel: number): number {
  let total = 0;
  for (let i = 0; i < targetLevel; i++) {
    total += getPrestigeXPRequired(i);
  }
  return total;
}

/**
 * Get progress percentage towards next prestige level
 */
export function getPrestigeProgress(currentXP: number, prestigeLevel: number): number {
  const required = getPrestigeXPRequired(prestigeLevel);
  return Math.min(100, Math.max(0, (currentXP / required) * 100));
}

/**
 * Calculate XP remaining to next prestige level
 */
export function getXPToNextPrestige(currentXP: number, prestigeLevel: number): number {
  const required = getPrestigeXPRequired(prestigeLevel);
  return Math.max(0, required - currentXP);
}

// Example prestige XP scaling table for reference:
// | Level | XP Required | Cumulative XP |
// |-------|-------------|---------------|
// | 1     | 5,000       | 5,000         |
// | 2     | 7,500       | 12,500        |
// | 3     | 11,250      | 23,750        |
// | 5     | 25,313      | 68,438        |
// | 10    | 288,403     | 1,533,203     |
