// Complete app reset utility
// Clears all localStorage data to return app to fresh state

import { DEFAULT_XP_THRESHOLDS } from './xpSystem';

const ALL_STORAGE_KEYS = [
  // Core character data
  'odyssey-character-autosave',
  'odyssey-consumables-inventory',
  
  // Progression systems
  'odyssey-prestige-data',
  'odyssey-prestige-tree',
  'odyssey-xp-progression',
  
  // Cooldowns
  'odyssey-cooldown-state',
  'odyssey-cooldown-settings',
  
  // Game settings
  'odyssey-game-mode',
  'odyssey-4th-wall-time',
  'odyssey-assassin-dice-odds',
  'floating-overlay-settings',
  
  // Onboarding
  'odyssey-onboarding-v2',
  'odyssey-intro-seen',
  
  // Chronicle sync
  'odyssey-chronicle-undo',
  
  // PWA
  'pwa-banner-dismissed',
] as const;

/**
 * Reset all app data to fresh state
 * Returns list of keys that were cleared
 */
export function resetAllAppData(): string[] {
  const clearedKeys: string[] = [];
  
  for (const key of ALL_STORAGE_KEYS) {
    try {
      if (localStorage.getItem(key) !== null) {
        localStorage.removeItem(key);
        clearedKeys.push(key);
      }
    } catch (e) {
      console.error(`Failed to clear ${key}:`, e);
    }
  }
  
  console.log('[AppReset] Cleared storage keys:', clearedKeys);
  return clearedKeys;
}

/**
 * Check if app has any saved data
 */
export function hasAnySavedData(): boolean {
  return ALL_STORAGE_KEYS.some(key => localStorage.getItem(key) !== null);
}

/**
 * Get all storage keys used by the app
 */
export function getStorageKeys(): readonly string[] {
  return ALL_STORAGE_KEYS;
}

/**
 * Repair XP data to match character level
 * Fixes corrupted XP values that are below the threshold for current level
 * Uses D&D 5e thresholds from xpSystem.ts (single source of truth)
 */
export function repairXPData(currentLevel: number, currentXP: number, multiplier: number = 1.0): number {
  const minXPForLevel = Math.floor((DEFAULT_XP_THRESHOLDS[currentLevel] || 0) * multiplier);
  
  // If XP is below minimum for current level, repair it
  if (currentXP < minXPForLevel) {
    console.log(`[XP Repair] XP ${currentXP} is below minimum ${minXPForLevel} for level ${currentLevel}. Repairing...`);
    return minXPForLevel;
  }
  
  return currentXP;
}
