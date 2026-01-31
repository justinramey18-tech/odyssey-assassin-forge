// Mobile Branch View - Full mobile-optimized view of a single branch

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { PrestigeBranch, PrestigeAbility } from '@/lib/prestigeTree/types';
import { BRANCH_VISUAL_CONFIG } from '@/lib/prestigeTree/branchConfig';
import { getAbilitiesByBranch } from '@/lib/prestigeTree/abilities';
import { MobileTierSection } from './MobileTierSection';

interface MobileBranchViewProps {
  branch: PrestigeBranch;
  unlockedSet: Set<string>;
  canUnlockAbility: (id: string) => { canUnlock: boolean; reason?: string };
  onNodeClick: (ability: PrestigeAbility) => void;
  isTierUnlockedForBranch: (branch: PrestigeBranch, tier: 1 | 2 | 3) => boolean;
  getTierUnlockProgress: (branch: PrestigeBranch, tier: 1 | 2 | 3) => {
    unlockedCount: number;
    totalRequired: number;
    requiredTierName: string;
    targetTierName: string;
  };
}

export function MobileBranchView({
  branch,
  unlockedSet,
  canUnlockAbility,
  onNodeClick,
  isTierUnlockedForBranch,
  getTierUnlockProgress,
}: MobileBranchViewProps) {
  const config = BRANCH_VISUAL_CONFIG[branch];
  const abilities = useMemo(() => getAbilitiesByBranch(branch), [branch]);

  // Group by tier
  const tier1 = abilities.filter(a => a.tier === 1);
  const tier2 = abilities.filter(a => a.tier === 2);
  const tier3 = abilities.filter(a => a.tier === 3);

  // Calculate tier accessibility
  const isTier2Accessible = isTierUnlockedForBranch(branch, 2);
  const isTier3Accessible = isTierUnlockedForBranch(branch, 3);

  // Get progress for each tier
  const tier1Progress = getTierUnlockProgress(branch, 1);
  const tier2Progress = getTierUnlockProgress(branch, 2);
  const tier3Progress = getTierUnlockProgress(branch, 3);

  return (
    <div className="flex flex-col gap-4">
      {/* Branch Header */}
      <div className="flex items-center gap-3 px-1">
        <div 
          className="flex items-center justify-center w-10 h-10 rounded-full"
          style={{ 
            backgroundColor: `${config.glowColor}20`,
            boxShadow: `0 0 16px ${config.glowColor}30`,
          }}
        >
          <config.icon 
            className="w-5 h-5"
            style={{ color: config.glowColor }}
          />
        </div>
        <div>
          <h2 className="font-cinzel font-bold text-lg text-foreground">
            {config.name}
          </h2>
          <p className="text-xs text-muted-foreground">
            {config.subtitle}
          </p>
        </div>
      </div>

      {/* Tier 1 - Foundation */}
      <MobileTierSection
        tierName="Foundation"
        tierNumber={1}
        abilities={tier1}
        isAccessible={true}
        progress={tier1Progress}
        unlockedSet={unlockedSet}
        canUnlockAbility={canUnlockAbility}
        onNodeClick={onNodeClick}
        glowColor={config.glowColor}
      />

      {/* Tier 2 - Intermediate */}
      <MobileTierSection
        tierName="Intermediate"
        tierNumber={2}
        abilities={tier2}
        isAccessible={isTier2Accessible}
        progress={tier2Progress}
        previousTierProgress={tier1Progress}
        unlockedSet={unlockedSet}
        canUnlockAbility={canUnlockAbility}
        onNodeClick={onNodeClick}
        glowColor={config.glowColor}
      />

      {/* Tier 3 - Advanced */}
      <MobileTierSection
        tierName="Advanced"
        tierNumber={3}
        abilities={tier3}
        isAccessible={isTier3Accessible}
        progress={tier3Progress}
        previousTierProgress={tier2Progress}
        unlockedSet={unlockedSet}
        canUnlockAbility={canUnlockAbility}
        onNodeClick={onNodeClick}
        glowColor={config.glowColor}
      />
    </div>
  );
}
