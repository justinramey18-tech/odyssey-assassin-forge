import { useState, useEffect, useCallback } from 'react';
import { 
  GameModeSettings, 
  loadGameModeSettings, 
  saveGameModeSettings,
  isRuleActive,
  HonestModeRules,
  GAME_MODE_CHANGE_EVENT,
} from '@/lib/gameModes';

/**
 * Hook to manage and react to game mode settings throughout the app.
 * Provides both the current settings and helper functions to check rule states.
 */
export function useGameMode() {
  const [settings, setSettings] = useState<GameModeSettings>(() => loadGameModeSettings());

  // Listen for both storage changes (other tabs) and custom events (same tab)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'odyssey-game-mode') {
        setSettings(loadGameModeSettings());
      }
    };

    const handleGameModeChange = (e: CustomEvent<GameModeSettings>) => {
      setSettings(e.detail);
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener(GAME_MODE_CHANGE_EVENT, handleGameModeChange as EventListener);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener(GAME_MODE_CHANGE_EVENT, handleGameModeChange as EventListener);
    };
  }, []);

  // Reload settings when they might have changed
  const refreshSettings = useCallback(() => {
    setSettings(loadGameModeSettings());
  }, []);

  // Check if a specific rule is active
  const checkRule = useCallback((rule: keyof HonestModeRules): boolean => {
    return isRuleActive(settings, rule);
  }, [settings]);

  // Helper getters for common checks
  const isInfinityPoolMode = settings.mode === 'infinityPool';
  const isHonestMode = settings.mode === 'honest';

  // Rule-specific checks
  const requiresGearUnlocks = checkRule('requireGearUnlocks');
  const requiresOrganicLevelUp = checkRule('organicLevelUp');
  const infinityStonesLocked = checkRule('maxLevelInfinityStones');
  const rerollsDisabled = checkRule('noRerolls');
  const requiresScribeVerification = checkRule('scribeItemVerification');

  return {
    settings,
    refreshSettings,
    checkRule,
    isInfinityPoolMode,
    isHonestMode,
    // Individual rule states
    requiresGearUnlocks,
    requiresOrganicLevelUp,
    infinityStonesLocked,
    rerollsDisabled,
    requiresScribeVerification,
  };
}

/**
 * Check if infinity stones should be accessible based on game mode and character level
 */
export function shouldShowInfinityStones(characterLevel: number, infinityStonesLocked: boolean): boolean {
  if (!infinityStonesLocked) return true; // Infinity Pool mode or rule disabled
  return characterLevel >= 20; // Max level required in Honest Mode
}

/**
 * Check if a gear item is accessible based on game mode and unlock requirements
 */
export function isGearAccessible(
  item: { unlockRequirement?: { achievementId: string; threshold: number } },
  requiresGearUnlocks: boolean,
  getAchievementProgress: (achievementId: string) => number
): boolean {
  if (!requiresGearUnlocks) return true; // Infinity Pool mode or rule disabled
  if (!item.unlockRequirement) return true; // No unlock requirement
  
  const progress = getAchievementProgress(item.unlockRequirement.achievementId);
  return progress >= item.unlockRequirement.threshold;
}
