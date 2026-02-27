import { useState, useCallback, useEffect } from 'react';
import { getScopedItem, setScopedItem } from '@/lib/scoped-storage';
import { 
  PrestigeData, 
  DEFAULT_PRESTIGE_DATA,
  PrestigeXPResult,
} from '@/lib/prestige/types';
import { 
  PRESTIGE_CONFIG, 
  getPrestigeXPRequired,
  getPrestigeProgress,
  getXPToNextPrestige,
  getPrestigePointsForLevel,
  getTotalPrestigePointsForLevel,
} from '@/lib/prestige/config';

const STORAGE_KEY = 'odyssey-prestige-data';

// Custom event for same-tab synchronization
export const PRESTIGE_CHANGE_EVENT = 'odyssey-prestige-change';

/**
 * Migrate old prestige data format to new format
 * Recalculates totalPrestigePoints using the new variable formula
 * (Old format used 1 point per level, new format uses variable 2-5 points)
 */
function migratePrestigeData(saved: any): PrestigeData {
  const prestigeLevel = saved.prestigeLevel ?? 0;
  
  // Always recalculate total points from prestige level
  // This ensures old saves (with 1 point per level) get updated to new formula
  const recalculatedPoints = getTotalPrestigePointsForLevel(prestigeLevel);
  
  // Handle legacy format with spentPrestigePoints/availablePrestigePoints
  if ('spentPrestigePoints' in saved || 'availablePrestigePoints' in saved) {
    console.log('[Prestige Migration] Old format detected, recalculating points');
  }
  
  // If stored points differ from recalculated, log the migration
  if (saved.totalPrestigePoints !== recalculatedPoints && prestigeLevel > 0) {
    console.log(`[Prestige Migration] Points updated: ${saved.totalPrestigePoints ?? 0} → ${recalculatedPoints}`);
  }
  
  return {
    prestigeLevel,
    prestigeXP: saved.prestigeXP ?? 0,
    totalPrestigePoints: recalculatedPoints,
  };
}

/**
 * Load prestige data from localStorage
 */
function loadPrestigeData(): PrestigeData {
  try {
    const stored = getScopedItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return migratePrestigeData(parsed);
    }
  } catch (e) {
    console.error('Failed to load prestige data:', e);
  }
  return DEFAULT_PRESTIGE_DATA;
}

/**
 * Save prestige data to localStorage and dispatch sync event
 */
function savePrestigeData(data: PrestigeData): void {
  try {
    setScopedItem(STORAGE_KEY, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent(PRESTIGE_CHANGE_EVENT, { detail: data }));
  } catch (e) {
    console.error('Failed to save prestige data:', e);
  }
}

export interface UsePrestigeReturn {
  prestigeData: PrestigeData;
  isMaxLevel: boolean;
  isPrestigeActive: boolean;
  nextPrestigeXPRequired: number;
  prestigeProgress: number;
  xpToNextPrestige: number;
  awardPrestigeXP: (amount: number) => PrestigeXPResult;
  setPrestigeData: React.Dispatch<React.SetStateAction<PrestigeData>>;
}

/**
 * Hook to manage prestige system state
 * Handles XP tracking and level ups post-max-level
 * Points are unified with regular ability points - no separate spending
 */
export function usePrestige(currentLevel: number): UsePrestigeReturn {
  const [prestigeData, setPrestigeData] = useState<PrestigeData>(() => loadPrestigeData());

  const isMaxLevel = currentLevel >= PRESTIGE_CONFIG.MAX_BASE_LEVEL;
  const isPrestigeActive = isMaxLevel;

  // Persist changes to localStorage
  useEffect(() => {
    savePrestigeData(prestigeData);
  }, [prestigeData]);

  // Listen for storage changes from other tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setPrestigeData(loadPrestigeData());
      }
    };

    const handlePrestigeChange = (e: CustomEvent<PrestigeData>) => {
      setPrestigeData(e.detail);
    };

    // Re-init when character is switched in-memory
    const handleCharacterLoaded = () => {
      setPrestigeData(loadPrestigeData());
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener(PRESTIGE_CHANGE_EVENT, handlePrestigeChange as EventListener);
    window.addEventListener('odyssey-character-loaded', handleCharacterLoaded);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener(PRESTIGE_CHANGE_EVENT, handlePrestigeChange as EventListener);
      window.removeEventListener('odyssey-character-loaded', handleCharacterLoaded);
    };
  }, []);

  /**
   * Award XP to prestige system (only works at max level)
   * Handles overflow for multiple level-ups from large XP gains
   * Uses variable points per prestige level (2-5 based on level)
   */
  const awardPrestigeXP = useCallback((amount: number): PrestigeXPResult => {
    if (!isMaxLevel) {
      return { type: 'normal', amount };
    }

    let newPrestigeXP = prestigeData.prestigeXP + amount;
    let newPrestigeLevel = prestigeData.prestigeLevel;
    let totalPointsAwarded = 0;

    // Loop to handle multiple level-ups from large XP gains
    while (newPrestigeXP >= PRESTIGE_CONFIG.XP_PER_PRESTIGE_LEVEL) {
      newPrestigeXP -= PRESTIGE_CONFIG.XP_PER_PRESTIGE_LEVEL;
      newPrestigeLevel++;
      // Use variable points per level instead of fixed POINTS_PER_PRESTIGE
      totalPointsAwarded += getPrestigePointsForLevel(newPrestigeLevel);
    }

    if (totalPointsAwarded > 0) {
      setPrestigeData(prev => ({
        ...prev,
        prestigeLevel: newPrestigeLevel,
        prestigeXP: newPrestigeXP,
        totalPrestigePoints: prev.totalPrestigePoints + totalPointsAwarded,
      }));

      return { 
        type: 'prestige_levelup', 
        newLevel: newPrestigeLevel,
        pointsAwarded: totalPointsAwarded,
      };
    } else {
      setPrestigeData(prev => ({
        ...prev,
        prestigeXP: newPrestigeXP,
      }));

      return { type: 'prestige_xp', amount };
    }
  }, [isMaxLevel, prestigeData.prestigeLevel, prestigeData.prestigeXP]);

  return {
    prestigeData,
    isMaxLevel,
    isPrestigeActive,
    nextPrestigeXPRequired: getPrestigeXPRequired(prestigeData.prestigeLevel),
    prestigeProgress: getPrestigeProgress(prestigeData.prestigeXP, prestigeData.prestigeLevel),
    xpToNextPrestige: getXPToNextPrestige(prestigeData.prestigeXP, prestigeData.prestigeLevel),
    awardPrestigeXP,
    setPrestigeData,
  };
}
