// XP and Level Progression System
import { Achievement } from './achievements';

export interface XPConfig {
  baseXPPerLevel: number;
  xpMultiplier: number;
  achievementBonusPercent: number;
}

export interface CharacterXP {
  currentXP: number;
  totalXPEarned: number;
  xpToNextLevel: number;
  pendingLevelUps: number;
}

// Default XP thresholds for D&D 5e-inspired progression
export const DEFAULT_XP_THRESHOLDS: Record<number, number> = {
  1: 0,
  2: 300,
  3: 900,
  4: 2700,
  5: 6500,
  6: 14000,
  7: 23000,
  8: 34000,
  9: 48000,
  10: 64000,
  11: 85000,
  12: 100000,
  13: 120000,
  14: 140000,
  15: 165000,
  16: 195000,
  17: 225000,
  18: 265000,
  19: 305000,
  20: 355000,
};

// Custom XP presets
export const XP_PRESETS = {
  standard: { name: 'Standard', multiplier: 1.0 },
  fast: { name: 'Fast Track', multiplier: 0.5 },
  slow: { name: 'Epic Journey', multiplier: 2.0 },
  milestone: { name: 'Milestone', multiplier: 0 }, // Level up manually
} as const;

export type XPPreset = keyof typeof XP_PRESETS;

// Calculate XP required to reach next level
export function getXPForLevel(level: number, multiplier: number = 1.0): number {
  if (level < 1) return 0;
  if (level > 20) return Infinity;
  
  const baseXP = DEFAULT_XP_THRESHOLDS[level] || 0;
  return Math.floor(baseXP * multiplier);
}

// Calculate XP to next level from current level
export function getXPToNextLevel(currentLevel: number, currentXP: number, multiplier: number = 1.0): number {
  if (currentLevel >= 20) return 0;
  const nextLevelXP = getXPForLevel(currentLevel + 1, multiplier);
  return Math.max(0, nextLevelXP - currentXP);
}

// Get progress percentage to next level
export function getLevelProgress(currentLevel: number, currentXP: number, multiplier: number = 1.0): number {
  if (currentLevel >= 20) return 100;
  
  const currentLevelXP = getXPForLevel(currentLevel, multiplier);
  const nextLevelXP = getXPForLevel(currentLevel + 1, multiplier);
  const xpInLevel = currentXP - currentLevelXP;
  const xpNeeded = nextLevelXP - currentLevelXP;
  
  return Math.min(100, Math.max(0, (xpInLevel / xpNeeded) * 100));
}

// Check if character should level up
export function shouldLevelUp(currentLevel: number, currentXP: number, multiplier: number = 1.0): boolean {
  if (currentLevel >= 20) return false;
  const nextLevelXP = getXPForLevel(currentLevel + 1, multiplier);
  return currentXP >= nextLevelXP;
}

// Calculate how many levels to gain
export function calculatePendingLevelUps(currentLevel: number, currentXP: number, multiplier: number = 1.0): number {
  let level = currentLevel;
  let pendingLevels = 0;
  
  while (level < 20 && currentXP >= getXPForLevel(level + 1, multiplier)) {
    level++;
    pendingLevels++;
  }
  
  return pendingLevels;
}

// Calculate bonus XP from achievements
export function calculateAchievementXPBonus(achievements: Achievement[], baseXP: number): number {
  // Calculate total achievement progress as a percentage
  const totalProgress = achievements.reduce((sum, a) => sum + (a.currentValue / a.maxValue), 0);
  const avgProgress = totalProgress / achievements.length;
  
  // Up to 25% bonus XP based on achievement progress
  const bonusMultiplier = avgProgress * 0.25;
  return Math.floor(baseXP * bonusMultiplier);
}

// XP gain sources with achievement bonuses
export interface XPGainResult {
  baseXP: number;
  achievementBonus: number;
  totalXP: number;
}

export function calculateXPGain(
  baseAmount: number,
  achievements: Achievement[],
  includeAchievementBonus: boolean = true
): XPGainResult {
  const achievementBonus = includeAchievementBonus 
    ? calculateAchievementXPBonus(achievements, baseAmount)
    : 0;
  
  return {
    baseXP: baseAmount,
    achievementBonus,
    totalXP: baseAmount + achievementBonus,
  };
}

// Common XP rewards
export const XP_REWARDS = {
  combatVictory: { min: 25, max: 100, label: 'Combat Victory' },
  questComplete: { min: 50, max: 300, label: 'Quest Complete' },
  bossDefeated: { min: 200, max: 500, label: 'Boss Defeated' },
  roleplayMoment: { min: 10, max: 50, label: 'Roleplay Moment' },
  discoveryMade: { min: 15, max: 75, label: 'Discovery Made' },
  socialVictory: { min: 25, max: 100, label: 'Social Victory' },
  customAmount: { min: 1, max: 10000, label: 'Custom Amount' },
} as const;

export type XPRewardType = keyof typeof XP_REWARDS;

// Get random XP within reward range
export function getRandomXPReward(rewardType: XPRewardType): number {
  const reward = XP_REWARDS[rewardType];
  return Math.floor(Math.random() * (reward.max - reward.min + 1)) + reward.min;
}
