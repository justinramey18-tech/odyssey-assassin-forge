// Drizzt's Legacy Prestige Tree State Management Hook

import { useState, useCallback, useEffect, useMemo } from 'react';
import { 
  PrestigeTreeProgress,
  DEFAULT_PRESTIGE_TREE_PROGRESS,
  PrestigeAbility,
  PrestigeBranch,
  LEGACY_UNLOCK_THRESHOLD,
} from '@/lib/prestigeTree/types';
import { prestigeAbilities, getPrestigeAbilityById, getAbilitiesByBranch, ABILITY_COUNTS } from '@/lib/prestigeTree/abilities';
import { PrestigeData } from '@/lib/prestige/types';
import { CharacterAbility, getTotalPointsSpent } from '@/lib/types';
import { useGameMode } from '@/hooks/use-game-mode';

const STORAGE_KEY = 'odyssey-prestige-tree';

// Tier display names for UI
const TIER_NAMES: Record<1 | 2 | 3, string> = {
  1: 'Foundation',
  2: 'Intermediate', 
  3: 'Advanced',
};
const HONEST_MODE_LEVEL_REQUIREMENT = 20;

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
  unlockProgress: { current: number; required: number; isLevelBased?: boolean };
  
  // Prestige tree state
  progress: PrestigeTreeProgress;
  unlockedSet: Set<string>;
  
  // Point tracking - now uses unified points
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
  
  // Tier unlock helpers
  isTierUnlockedForBranch: (branch: PrestigeBranch, tier: 1 | 2 | 3) => boolean;
  getTierUnlockProgress: (branch: PrestigeBranch, tier: 1 | 2 | 3) => {
    unlockedCount: number;
    totalRequired: number;
    requiredTierName: string;
    targetTierName: string;
  };
}

export function usePrestigeTree(
  characterAbilities: CharacterAbility[],
  prestigeData: PrestigeData,
  availableUnifiedPoints: number,  // Unified ability points available
  onPointsSpent?: (cost: number) => void,  // Callback when points are spent
  characterLevel?: number
): UsePrestigeTreeReturn {
  const [progress, setProgress] = useState<PrestigeTreeProgress>(() => loadProgress());
  const { isInfinityPoolMode, isHonestMode } = useGameMode();

  // Calculate base points spent for progress display
  const basePointsSpent = useMemo(() => 
    getTotalPointsSpent(characterAbilities), 
    [characterAbilities]
  );

  // Game mode aware unlock logic:
  // - Infinity Pool Mode: Always unlocked
  // - Honest Mode: Requires level 20
  const isLegacyUnlocked = useMemo(() => {
    if (isInfinityPoolMode) {
      return true; // Always unlocked in Infinity Pool
    }
    if (isHonestMode) {
      return (characterLevel ?? 1) >= HONEST_MODE_LEVEL_REQUIREMENT;
    }
    // Fallback to original logic
    return basePointsSpent >= LEGACY_UNLOCK_THRESHOLD;
  }, [isInfinityPoolMode, isHonestMode, characterLevel, basePointsSpent]);

  // Progress display depends on game mode
  const unlockProgress = useMemo(() => {
    if (isHonestMode) {
      return { 
        current: characterLevel ?? 1, 
        required: HONEST_MODE_LEVEL_REQUIREMENT,
        isLevelBased: true 
      };
    }
    return { 
      current: basePointsSpent, 
      required: LEGACY_UNLOCK_THRESHOLD,
      isLevelBased: false 
    };
  }, [isHonestMode, characterLevel, basePointsSpent]);

  // Convert to Set for fast lookups
  const unlockedSet = useMemo(() => 
    new Set(progress.unlockedAbilities), 
    [progress.unlockedAbilities]
  );

  // Calculate points spent on tree (variable costs per ability)
  const spentOnTree = useMemo(() => {
    return progress.unlockedAbilities.reduce((sum, abilityId) => {
      const ability = getPrestigeAbilityById(abilityId);
      return sum + (ability?.prestigeCost ?? 0);
    }, 0);
  }, [progress.unlockedAbilities]);

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

  /**
   * Check if a tier is unlocked for a specific branch.
   * Tier 1 (Foundation) is always unlocked.
   * Tier 2 (Intermediate) requires ALL Tier 1 abilities in the same branch to be unlocked.
   * Tier 3 (Advanced) requires ALL Tier 2 abilities in the same branch to be unlocked.
   */
  const isTierUnlockedForBranch = useCallback((branch: PrestigeBranch, tier: 1 | 2 | 3): boolean => {
    // Tier 1 is always unlocked
    if (tier === 1) return true;

    // Get the required previous tier
    const requiredTier = (tier - 1) as 1 | 2;
    
    // Get all abilities in the previous tier for this specific branch
    const branchAbilities = getAbilitiesByBranch(branch);
    
    // Validate branch has abilities
    if (branchAbilities.length === 0) {
      console.error(`[PrestigeTree] No abilities found for branch: ${branch}`);
      return false;
    }
    
    const previousTierAbilities = branchAbilities.filter(a => a.tier === requiredTier);
    
    // If no abilities in previous tier, allow unlock (edge case)
    if (previousTierAbilities.length === 0) {
      console.warn(`[PrestigeTree] No tier ${requiredTier} abilities in branch ${branch}`);
      return true;
    }
    
    // All previous tier abilities must be unlocked
    return previousTierAbilities.every(ability => unlockedSet.has(ability.id));
  }, [unlockedSet]);

  /**
   * Get progress for unlocking a specific tier in a branch.
   * Returns count of unlocked abilities and total required.
   */
  const getTierUnlockProgress = useCallback((branch: PrestigeBranch, tier: 1 | 2 | 3): {
    unlockedCount: number;
    totalRequired: number;
    requiredTierName: string;
    targetTierName: string;
  } => {
    const targetTierName = TIER_NAMES[tier];
    
    // For Tier 1, show its own progress
    if (tier === 1) {
      const branchAbilities = getAbilitiesByBranch(branch);
      const tier1Abilities = branchAbilities.filter(a => a.tier === 1);
      const unlockedCount = tier1Abilities.filter(a => unlockedSet.has(a.id)).length;
      
      return { 
        unlockedCount, 
        totalRequired: tier1Abilities.length, 
        requiredTierName: '',
        targetTierName 
      };
    }

    // For Tier 2/3, show previous tier progress
    const requiredTier = (tier - 1) as 1 | 2;
    const requiredTierName = TIER_NAMES[requiredTier];
    
    const branchAbilities = getAbilitiesByBranch(branch);
    const previousTierAbilities = branchAbilities.filter(a => a.tier === requiredTier);
    
    const unlockedCount = previousTierAbilities.filter(a => unlockedSet.has(a.id)).length;
    
    return {
      unlockedCount,
      totalRequired: previousTierAbilities.length,
      requiredTierName,
      targetTierName,
    };
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

    // Check tier unlock requirement (per-branch tier gating)
    // Tier 2/3 abilities require ALL previous tier abilities in the same branch to be unlocked
    if (ability.tier > 1) {
      const tierUnlocked = isTierUnlockedForBranch(ability.branch, ability.tier);
      if (!tierUnlocked) {
        const progress = getTierUnlockProgress(ability.branch, ability.tier);
        return {
          canUnlock: false,
          reason: `${progress.targetTierName} locked. Complete all ${progress.requiredTierName} abilities (${progress.unlockedCount}/${progress.totalRequired})`,
        };
      }
    }

    // Check prestige level requirement
    if (ability.minimumPrestigeLevel && prestigeData.prestigeLevel < ability.minimumPrestigeLevel) {
      return { 
        canUnlock: false, 
        reason: `Requires Prestige Level ${ability.minimumPrestigeLevel}` 
      };
    }

    // Check unified ability point cost
    if (availableUnifiedPoints < ability.prestigeCost) {
      const needed = ability.prestigeCost - availableUnifiedPoints;
      return { 
        canUnlock: false, 
        reason: `Need ${needed} more ability point${needed === 1 ? '' : 's'}` 
      };
    }

    // Check prerequisites (individual ability dependencies)
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
  }, [unlockedSet, prestigeData.prestigeLevel, availableUnifiedPoints, isLegacyUnlocked, isTierUnlockedForBranch, getTierUnlockProgress]);

  // Unlock ability - validates before updating state
  const unlockAbility = useCallback((abilityId: string): { success: boolean; error?: string } => {
    const check = canUnlockAbility(abilityId);
    if (!check.canUnlock) {
      return { success: false, error: check.reason };
    }

    const ability = getPrestigeAbilityById(abilityId)!;
    
    // Notify parent about points spent (unified pool handles the deduction)
    if (onPointsSpent) {
      onPointsSpent(ability.prestigeCost);
    }

    // Update local progress
    setProgress(prev => ({
      ...prev,
      unlockedAbilities: [...prev.unlockedAbilities, abilityId],
      spentPrestigePoints: prev.spentPrestigePoints + ability.prestigeCost,
      unlockTimestamps: {
        ...prev.unlockTimestamps,
        [abilityId]: Date.now(),
      },
    }));

    return { success: true };
  }, [canUnlockAbility, onPointsSpent]);

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
    spentOnTree,
    branchProgress,
    canUnlockAbility,
    unlockAbility,
    resetTree,
    getAbilityDetails,
    isAbilityUnlocked,
    getPrerequisitesStatus,
    isTierUnlockedForBranch,
    getTierUnlockProgress,
  };
}
