// Prestige Branch Column - Renders a Single Branch's Abilities

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
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
}

export function PrestigeBranchColumn({
  branch,
  unlockedSet,
  canUnlockAbility,
  onNodeClick,
  isMobile,
  className,
}: PrestigeBranchColumnProps) {
  const config = BRANCH_VISUAL_CONFIG[branch];
  const abilities = useMemo(() => getAbilitiesByBranch(branch), [branch]);
  const positions = useMemo(() => calculateBranchLayout(abilities, branch), [abilities, branch]);

  // Group by tier for layout
  const tier1 = abilities.filter(a => a.tier === 1);
  const tier2 = abilities.filter(a => a.tier === 2);
  const tier3 = abilities.filter(a => a.tier === 3);

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
        className="absolute inset-0"
      />

      {/* Tier 1 - Foundation (Top) */}
      <div className="relative z-10 flex justify-center gap-4 mb-8">
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
            />
          );
        })}
      </div>

      {/* Tier Label */}
      <div className="text-[10px] text-muted-foreground/50 uppercase tracking-widest mb-4">
        Foundation
      </div>

      {/* Tier 2 - Intermediate (Middle) */}
      <div className="relative z-10 flex justify-center gap-4 mb-8">
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
            />
          );
        })}
      </div>

      {/* Tier Label */}
      <div className="text-[10px] text-muted-foreground/50 uppercase tracking-widest mb-4">
        Intermediate
      </div>

      {/* Tier 3 - Advanced (Bottom) */}
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
            />
          );
        })}
      </div>

      {/* Tier Label */}
      <div className="text-[10px] text-muted-foreground/50 uppercase tracking-widest">
        Advanced
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
