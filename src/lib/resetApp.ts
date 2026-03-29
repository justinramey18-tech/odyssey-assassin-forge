// Complete app reset utility
// Clears all localStorage data to return app to fresh state

import { DEFAULT_XP_THRESHOLDS } from './xpSystem';

const ALL_STORAGE_KEYS = [
  // Core character data
  'odyssey-character-autosave',
  'odyssey-consumables-inventory',
  'odyssey-ability-scores',
  'odyssey-hp-state',
  'odyssey-death-saves',
  
  // Progression systems
  'odyssey-prestige-data',
  'odyssey-prestige-tree',
  'odyssey-xp-progression',
  
  // Magic system
  'odyssey-spellcasting',
  'odyssey-active-spells',
  
  // Combat system
  'odyssey-combat-log',
  'odyssey-combat-settings',
  'odyssey-action-economy',
  'odyssey-turn-actions',
  'odyssey-targets',
  'odyssey-initiative',
  
  // Conditions system
  'odyssey-conditions-state',
  
  // Cooldowns
  'odyssey-cooldown-state',
  'odyssey-cooldown-settings',
  
  // Dice roller
  'odyssey-dice-modifiers',
  'odyssey-proficiency-bonus',
  'odyssey-proficient-skills',
  'odyssey-proficient-saves',
  
  // Inventory & Equipment
  'odyssey-loot',
  'odyssey-shop',
  'odyssey-misc-items',
  'odyssey-equipment-custom-images',
  'odyssey-gear-locks',
  
  // Game settings
  'odyssey-game-mode',
  'odyssey-4th-wall-time',
  'odyssey-assassin-dice-odds',
  'floating-overlay-settings',
  
  // Navigation & UI
  'odyssey-category-navigation',
  'odyssey-custom-home-background',
  'odyssey-custom-home-background-url',
  
  // Onboarding & Wizard
  'odyssey-onboarding-v2',
  'odyssey-intro-seen',
  'odyssey-wizard-progress',
  
  // Chronicle sync & Campaigns
  'odyssey-chronicle-undo',
  'odyssey-chronicle-campaigns',
  'odyssey-chronicle-folders',
  
  // AI / Synthesis
  'odyssey-combat-synthesis-mode',
  'odyssey-combat-chaos-level',
  
  // DM chat theme
  'odyssey-dm-chat-theme',
  
  // Character Identity
  'dnd-character-gender',
  'dnd-character-race',
  'dnd-character-backstory',
  'dnd-character-relationships',

  // Narrative synthesis
  'odyssey-synthesis-recent-modes',
  'odyssey-pending-draft',
  'odyssey-pending-synthesis',
  'odyssey-draft-review-edits',
  'odyssey-synthesis-review-edits',

  // PWA
  'pwa-banner-dismissed',

  // DM response mode
  'odyssey-dm-response-mode',

  // Empyrean dragon bond
  'empyrean-dragon-bond-state',
  'empyrean-dragon-chat',
  'empyrean-dragon-chat-summary',
  'empyrean-autopilot-guide',
  'empyrean-autopilot-biases',
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
