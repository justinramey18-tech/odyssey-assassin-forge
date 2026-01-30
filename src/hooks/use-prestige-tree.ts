// Drizzt's Legacy Prestige Tree State Management Hook

import { useState, useCallback, useEffect, useMemo } from 'react';
import { 
  PrestigeTreeProgress,
  DEFAULT_PRESTIGE_TREE_PROGRESS,
  PrestigeAbility,
  LEGACY_UNLOCK_THRESHOLD,
} from '@/lib/prestigeTree/types';
import { prestigeAbilities, getPrestigeAbilityById, ABILITY_COUNTS } from '@/lib/prestigeTree/abilities';
import { PrestigeData } from '@/lib/prestige/types';
import { CharacterAbility, getTotalPointsSpent } from '@/lib/types';

const STORAGE_KEY = 'odyssey-prestige-tree';

function loadProgress(): PrestigeTreeProgress {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_PRESTIGE_TREE_PROGRESS, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error('[PrestigeTree] Failed to load:', e);
  }
  return DEFAULT_PRESTIGE_TREE_PROGRESS;
}

function saveProgress(data: PrestigeTreeProgress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('[PrestigeTree] Failed to save:', e);
  }
}

export interface UsePrestigeTreeReturn {
  // Unlock status
  isLegacyUnlocked: boolean;
  unlockProgress: { current: number; required: number };
  
  // Prestige tree state
  progress: PrestigeTreeProgress;
  unlockedSet: Set<string>;
  
  // Point tracking
  availablePrestigePoints: number;
  spentOnTree: number;
  
  // Branch progress
  branchProgress: Record<string, { unlocked: number; total: number }>;
  
  // Actions
  canUnlockAbility: (abilityId: string) => { 
    canUnlock: boolean; 
    reason?: string; 
  };
  unlockAbility: (abilityId: string) => { 
    success: boolean; 
    error?: string; 
  };
  resetTree: () => void;
  
  // Helpers
  getAbilityDetails: (abilityId: string) => PrestigeAbility | undefined;
  isAbilityUnlocked: (abilityId: string) => boolean;
  getPrerequisitesStatus: (abilityId: string) => {
    met: boolean;
    missing: string[];
  };
}

export function usePrestigeTree(
  characterAbilities: CharacterAbility[],
  prestigeData: PrestigeData,
  onPrestigePointSpent?: (cost: number) => void
): UsePrestigeTreeReturn {
  const [progress, setProgress] = useState<PrestigeTreeProgress>(() => loadProgress());

  // Calculate if legacy tree is unlocked (all 72 base ability points spent)
  const basePointsSpent = useMemo(() => 
    getTotalPointsSpent(characterAbilities), 
    [characterAbilities]
  );
  const isLegacyUnlocked = basePointsSpent >= LEGACY_UNLOCK_THRESHOLD;
  const unlockProgress = { current: basePointsSpent, required: LEGACY_UNLOCK_THRESHOLD };

  // Convert to Set for fast lookups
  const unlockedSet = useMemo(() => 
    new Set(progress.unlockedAbilities), 
    [progress.unlockedAbilities]
  );

  // Calculate points available for tree (from existing prestige system)
  const availablePrestigePoints = prestigeData.availablePrestigePoints;
  const spentOnTree = progress.spentPrestigePoints;

  // Calculate branch progress
  const branchProgress = useMemo(() => {
    const branches = ['dual_wielding', 'guenhwyvar', 'drow_abilities', 'monk_abilities'] as const;
    const result: Record<string, { unlocked: number; total: number }> = {};
    
    for (const branch of branches) {
      const branchAbilities = prestigeAbilities.filter(a => a.branch === branch);
      const unlockedCount = branchAbilities.filter(a => unlockedSet.has(a.id)).length;
      result[branch] = {
        unlocked: unlockedCount,
        total: branchAbilities.length,
      };
    }
    
    return result;
  }, [unlockedSet]);

  // Persist changes to localStorage
  useEffect(() => {
    saveProgress(progress);
  }, [progress]);

  // Check if ability can be unlocked
  const canUnlockAbility = useCallback((abilityId: string): { canUnlock: boolean; reason?: string } => {
    const ability = getPrestigeAbilityById(abilityId);
    if (!ability) {
      return { canUnlock: false, reason: 'Ability not found' };
    }

    // Legacy tree must be unlocked first
    if (!isLegacyUnlocked) {
      return { canUnlock: false, reason: 'Complete all base abilities first' };
    }

    // Already unlocked
    if (unlockedSet.has(abilityId)) {
      return { canUnlock: false, reason: 'Already unlocked' };
    }

    // Check prestige level requirement
    if (ability.minimumPrestigeLevel && prestigeData.prestigeLevel < ability.minimumPrestigeLevel) {
      return { 
        canUnlock: false, 
        reason: `Requires Prestige Level ${ability.minimumPrestigeLevel}` 
      };
    }

    // Check prestige point cost
    if (availablePrestigePoints < ability.prestigeCost) {
      const needed = ability.prestigeCost - availablePrestigePoints;
      return { 
        canUnlock: false, 
        reason: `Need ${needed} more prestige point${needed === 1 ? '' : 's'}` 
      };
    }

    // Check prerequisites
    const missingPrereqs = ability.prerequisites.filter(prereq => !unlockedSet.has(prereq));
    if (missingPrereqs.length > 0) {
      const missingNames = missingPrereqs
        .map(id => getPrestigeAbilityById(id)?.name || id)
        .join(', ');
      return { 
        canUnlock: false, 
        reason: `Requires: ${missingNames}` 
      };
    }

    return { canUnlock: true };
  }, [unlockedSet, prestigeData.prestigeLevel, availablePrestigePoints, isLegacyUnlocked]);

  // Unlock ability
  const unlockAbility = useCallback((abilityId: string): { success: boolean; error?: string } => {
    const check = canUnlockAbility(abilityId);
    if (!check.canUnlock) {
      return { success: false, error: check.reason };
    }

    const ability = getPrestigeAbilityById(abilityId)!;
    
    // Update local progress
    setProgress(prev => ({
      unlockedAbilities: [...prev.unlockedAbilities, abilityId],
      spentPrestigePoints: prev.spentPrestigePoints + ability.prestigeCost,
      unlockTimestamps: {
        ...prev.unlockTimestamps,
        [abilityId]: Date.now(),
      },
    }));

    // Notify parent to deduct prestige points from the main system
    if (onPrestigePointSpent) {
      onPrestigePointSpent(ability.prestigeCost);
    }

    return { success: true };
  }, [canUnlockAbility, onPrestigePointSpent]);

  // Reset tree (full respec)
  const resetTree = useCallback(() => {
    setProgress(DEFAULT_PRESTIGE_TREE_PROGRESS);
  }, []);

  // Helper: get ability details
  const getAbilityDetails = useCallback((abilityId: string) => 
    getPrestigeAbilityById(abilityId), 
  []);

  // Helper: check if unlocked
  const isAbilityUnlocked = useCallback((abilityId: string) => 
    unlockedSet.has(abilityId), 
  [unlockedSet]);

  // Helper: get prerequisites status
  const getPrerequisitesStatus = useCallback((abilityId: string) => {
    const ability = getPrestigeAbilityById(abilityId);
    if (!ability) return { met: true, missing: [] };
    
    const missing = ability.prerequisites.filter(prereq => !unlockedSet.has(prereq));
    return { met: missing.length === 0, missing };
  }, [unlockedSet]);

  return {
    isLegacyUnlocked,
    unlockProgress,
    progress,
    unlockedSet,
    availablePrestigePoints,
    spentOnTree,
    branchProgress,
    canUnlockAbility,
    unlockAbility,
    resetTree,
    getAbilityDetails,
    isAbilityUnlocked,
    getPrerequisitesStatus,
  };
}
