import { useState, useCallback, useEffect } from 'react';
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
} from '@/lib/prestige/config';

const STORAGE_KEY = 'odyssey-prestige-data';

// Custom event for same-tab synchronization
export const PRESTIGE_CHANGE_EVENT = 'odyssey-prestige-change';

/**
 * Load prestige data from localStorage
 */
function loadPrestigeData(): PrestigeData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_PRESTIGE_DATA, ...JSON.parse(stored) };
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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
  spendPrestigePoint: (cost?: number) => { success: boolean; message?: string };
  resetPrestigePoints: () => void;
  setPrestigeData: React.Dispatch<React.SetStateAction<PrestigeData>>;
}

/**
 * Hook to manage prestige system state
 * Handles XP tracking, level ups, and point allocation post-max-level
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

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener(PRESTIGE_CHANGE_EVENT, handlePrestigeChange as EventListener);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener(PRESTIGE_CHANGE_EVENT, handlePrestigeChange as EventListener);
    };
  }, []);

  /**
   * Award XP to prestige system (only works at max level)
   * Returns result indicating what happened
   */
  const awardPrestigeXP = useCallback((amount: number): PrestigeXPResult => {
    if (!isMaxLevel) {
      return { type: 'normal', amount };
    }

    // Check if already at max prestige level
    if (prestigeData.prestigeLevel >= PRESTIGE_CONFIG.MAX_PRESTIGE_LEVEL) {
      return { type: 'prestige_xp', amount: 0 };
    }

    const newPrestigeXP = prestigeData.prestigeXP + amount;
    const xpRequired = getPrestigeXPRequired(prestigeData.prestigeLevel);

    if (newPrestigeXP >= xpRequired) {
      // Level up prestige
      const newPrestigeLevel = prestigeData.prestigeLevel + 1;
      const overflow = newPrestigeXP - xpRequired;
      
      setPrestigeData(prev => ({
        ...prev,
        prestigeLevel: newPrestigeLevel,
        prestigeXP: overflow,
        totalPrestigePoints: prev.totalPrestigePoints + PRESTIGE_CONFIG.POINTS_PER_PRESTIGE,
        availablePrestigePoints: prev.availablePrestigePoints + PRESTIGE_CONFIG.POINTS_PER_PRESTIGE,
      }));

      return { 
        type: 'prestige_levelup', 
        newLevel: newPrestigeLevel,
        pointsAwarded: PRESTIGE_CONFIG.POINTS_PER_PRESTIGE,
      };
    } else {
      setPrestigeData(prev => ({
        ...prev,
        prestigeXP: newPrestigeXP,
      }));

      return { type: 'prestige_xp', amount };
    }
  }, [isMaxLevel, prestigeData.prestigeLevel, prestigeData.prestigeXP]);

  /**
   * Spend prestige points on ability upgrades
   * @param cost - Number of points to spend (default: 1)
   */
  const spendPrestigePoint = useCallback((cost: number = 1): { success: boolean; message?: string } => {
    if (prestigeData.availablePrestigePoints < cost) {
      return { success: false, message: `Need ${cost} prestige points, only have ${prestigeData.availablePrestigePoints}` };
    }

    setPrestigeData(prev => ({
      ...prev,
      spentPrestigePoints: prev.spentPrestigePoints + cost,
      availablePrestigePoints: prev.availablePrestigePoints - cost,
    }));

    return { success: true };
  }, [prestigeData.availablePrestigePoints]);

  /**
   * Reset all prestige point allocations (respec)
   */
  const resetPrestigePoints = useCallback(() => {
    setPrestigeData(prev => ({
      ...prev,
      spentPrestigePoints: 0,
      availablePrestigePoints: prev.totalPrestigePoints,
    }));
  }, []);

  return {
    prestigeData,
    isMaxLevel,
    isPrestigeActive,
    nextPrestigeXPRequired: getPrestigeXPRequired(prestigeData.prestigeLevel),
    prestigeProgress: getPrestigeProgress(prestigeData.prestigeXP, prestigeData.prestigeLevel),
    xpToNextPrestige: getXPToNextPrestige(prestigeData.prestigeXP, prestigeData.prestigeLevel),
    awardPrestigeXP,
    spendPrestigePoint,
    resetPrestigePoints,
    setPrestigeData,
  };
}
