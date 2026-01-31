// Prestige Branch Column - Renders a Single Branch's Abilities

import { useMemo } from 'react';
import { Lock, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { PrestigeBranch, PrestigeAbility } from '@/lib/prestigeTree/types';
import { BRANCH_VISUAL_CONFIG } from '@/lib/prestigeTree/branchConfig';
import { getAbilitiesByBranch } from '@/lib/prestigeTree/abilities';
import { calculateBranchLayout } from '@/lib/prestigeTree/layout';
import { PrestigeAbilityNode } from './PrestigeAbilityNode';
import { PrestigeConnectionLines } from './PrestigeConnectionLines';

interface PrestigeBranchColumnProps {
  branch: PrestigeBranch;
  unlockedSet: Set<string>;
  canUnlockAbility: (id: string) => { canUnlock: boolean; reason?: string };
  onNodeClick: (ability: PrestigeAbility) => void;
  isMobile: boolean;
  className?: string;
  isTierUnlockedForBranch: (branch: PrestigeBranch, tier: 1 | 2 | 3) => boolean;
  getTierUnlockProgress: (branch: PrestigeBranch, tier: 1 | 2 | 3) => {
    unlockedCount: number;
    totalRequired: number;
    requiredTierName: string;
    targetTierName: string;
  };
}

// Tier Header Component with Progress
function TierHeader({
  tierName,
  isAccessible,
  progress,
  isMobile,
}: {
  tierName: string;
  isAccessible: boolean;
  progress: { unlockedCount: number; totalRequired: number };
  isMobile: boolean;
}) {
  const isComplete = progress.totalRequired > 0 && progress.unlockedCount === progress.totalRequired;
  const percentage = progress.totalRequired > 0 
    ? Math.round((progress.unlockedCount / progress.totalRequired) * 100)
    : 0;

  return (
    <div className={cn(
      "flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2",
      "py-2 mb-2"
    )}>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground/70 uppercase tracking-widest">
          {tierName}
        </span>
        
        {/* Status Badge */}
        {!isAccessible && (
          <Badge variant="secondary" className="text-[8px] gap-1 px-1.5 py-0.5">
            <Lock className="w-2 h-2" />
            Locked
          </Badge>
        )}
        
        {isAccessible && !isComplete && (
          <Badge variant="outline" className="text-[8px] px-1.5 py-0.5">
            {progress.unlockedCount}/{progress.totalRequired}
          </Badge>
        )}
        
        {isComplete && (
          <Badge className="text-[8px] gap-1 px-1.5 py-0.5 bg-green-600">
            <Check className="w-2 h-2" />
          </Badge>
        )}
      </div>

      {/* Progress Bar */}
      {progress.totalRequired > 0 && (
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="w-16 sm:w-20 h-1.5 bg-muted rounded-full overflow-hidden">
            <div 
              className={cn(
                "h-full transition-all duration-500 ease-out",
                isComplete ? "bg-green-500" : isAccessible ? "bg-amber-500" : "bg-slate-600"
              )}
              style={{ width: `${percentage}%` }}
            />
          </div>
          <span className="text-[9px] text-muted-foreground/50 w-8">
            {percentage}%
          </span>
        </div>
      )}
    </div>
  );
}

export function PrestigeBranchColumn({
  branch,
  unlockedSet,
  canUnlockAbility,
  onNodeClick,
  isMobile,
  className,
  isTierUnlockedForBranch,
  getTierUnlockProgress,
}: PrestigeBranchColumnProps) {
  const config = BRANCH_VISUAL_CONFIG[branch];
  const abilities = useMemo(() => getAbilitiesByBranch(branch), [branch]);
  const positions = useMemo(() => calculateBranchLayout(abilities, branch), [abilities, branch]);

  // Group by tier for layout
  const tier1 = abilities.filter(a => a.tier === 1);
  const tier2 = abilities.filter(a => a.tier === 2);
  const tier3 = abilities.filter(a => a.tier === 3);

  // Calculate tier accessibility for this branch
  const isTier2Accessible = isTierUnlockedForBranch(branch, 2);
  const isTier3Accessible = isTierUnlockedForBranch(branch, 3);

  // Get progress for each tier
  const tier1Progress = getTierUnlockProgress(branch, 1);
  const tier2Progress = getTierUnlockProgress(branch, 2);
  const tier3Progress = getTierUnlockProgress(branch, 3);

  return (
    <div 
      className={cn(
        "relative flex flex-col items-center p-4",
        "min-h-[400px]",
        className
      )}
    >
      {/* Branch Header */}
      <div className="flex items-center gap-2 mb-6">
        <config.icon 
          className="w-5 h-5"
          style={{ color: config.glowColor }}
        />
        <h3 className="font-cinzel text-sm uppercase tracking-wider">
          {config.name}
        </h3>
      </div>

      {/* Connection Lines */}
      <PrestigeConnectionLines
        abilities={abilities}
        positions={positions}
        unlockedSet={unlockedSet}
        isMobile={isMobile}
        isTier2Accessible={isTier2Accessible}
        isTier3Accessible={isTier3Accessible}
        className="absolute inset-0"
      />

      {/* Tier 1 - Foundation (Top) */}
      <TierHeader
        tierName="Foundation"
        isAccessible={true}
        progress={tier1Progress}
        isMobile={isMobile}
      />
      <div className="relative z-10 flex justify-center gap-4 mb-6">
        {tier1.map((ability) => {
          const check = canUnlockAbility(ability.id);
          return (
            <PrestigeAbilityNode
              key={ability.id}
              ability={ability}
              isUnlocked={unlockedSet.has(ability.id)}
              canUnlock={check.canUnlock}
              unlockReason={check.reason}
              onClick={() => onNodeClick(ability)}
              isMobile={isMobile}
              isTierLocked={false}
            />
          );
        })}
      </div>

      {/* Tier 2 - Intermediate (Middle) */}
      <TierHeader
        tierName="Intermediate"
        isAccessible={isTier2Accessible}
        progress={tier2Progress}
        isMobile={isMobile}
      />
      {/* Lock message if tier is locked */}
      {!isTier2Accessible && (
        <div className="text-center text-[10px] text-amber-400/60 mb-3">
          Complete all Foundation abilities ({tier1Progress.unlockedCount}/{tier1Progress.totalRequired})
        </div>
      )}
      <div className="relative z-10 flex justify-center gap-4 mb-6">
        {tier2.map((ability) => {
          const check = canUnlockAbility(ability.id);
          return (
            <PrestigeAbilityNode
              key={ability.id}
              ability={ability}
              isUnlocked={unlockedSet.has(ability.id)}
              canUnlock={check.canUnlock}
              unlockReason={check.reason}
              onClick={() => onNodeClick(ability)}
              isMobile={isMobile}
              isTierLocked={!isTier2Accessible}
            />
          );
        })}
      </div>

      {/* Tier 3 - Advanced (Bottom) */}
      <TierHeader
        tierName="Advanced"
        isAccessible={isTier3Accessible}
        progress={tier3Progress}
        isMobile={isMobile}
      />
      {/* Lock message if tier is locked */}
      {!isTier3Accessible && (
        <div className="text-center text-[10px] text-amber-400/60 mb-3">
          Complete all Intermediate abilities ({tier2Progress.unlockedCount}/{tier2Progress.totalRequired})
        </div>
      )}
      <div className="relative z-10 flex justify-center gap-4 mb-4">
        {tier3.map((ability) => {
          const check = canUnlockAbility(ability.id);
          return (
            <PrestigeAbilityNode
              key={ability.id}
              ability={ability}
              isUnlocked={unlockedSet.has(ability.id)}
              canUnlock={check.canUnlock}
              unlockReason={check.reason}
              onClick={() => onNodeClick(ability)}
              isMobile={isMobile}
              isTierLocked={!isTier3Accessible}
            />
          );
        })}
      </div>

      {/* Background gradient */}
      <div 
        className="absolute inset-0 -z-10 rounded-xl opacity-20"
        style={{
          background: `radial-gradient(ellipse at center, ${config.glowColor}20 0%, transparent 70%)`,
        }}
      />
    </div>
  );
}
