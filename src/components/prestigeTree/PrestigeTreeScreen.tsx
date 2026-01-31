// Prestige Tree Screen - Main Screen Component for Drizzt's Legacy

import { useState, useCallback } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToast } from '@/hooks/use-toast';
import { PrestigeAbility, PrestigeBranch } from '@/lib/prestigeTree/types';
import { BRANCH_ORDER } from '@/lib/prestigeTree/branchConfig';
import { UsePrestigeTreeReturn } from '@/hooks/use-prestige-tree';

import { UnlockProgressGate } from './UnlockProgressGate';
import { DrizztCentralNode } from './DrizztCentralNode';
import { BranchSelector } from './BranchSelector';
import { PrestigeBranchColumn } from './PrestigeBranchColumn';
import { PrestigeAbilityDetails } from './PrestigeAbilityDetails';

interface PrestigeTreeScreenProps {
  prestigeTree: UsePrestigeTreeReturn;
  prestigeLevel: number;
}

export function PrestigeTreeScreen({
  prestigeTree,
  prestigeLevel,
}: PrestigeTreeScreenProps) {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  
  const [selectedBranch, setSelectedBranch] = useState<PrestigeBranch>('dual_wielding');
  const [selectedAbility, setSelectedAbility] = useState<PrestigeAbility | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);

  const {
    isLegacyUnlocked,
    unlockProgress,
    unlockedSet,
    availablePrestigePoints,
    spentOnTree,
    branchProgress,
    canUnlockAbility,
    unlockAbility,
    isAbilityUnlocked,
  } = prestigeTree;

  // Handle node click
  const handleNodeClick = useCallback((ability: PrestigeAbility) => {
    setSelectedAbility(ability);
    setIsDetailsOpen(true);
  }, []);

  // Handle ability unlock with double-click prevention
  const handleUnlock = useCallback((abilityId: string) => {
    if (isUnlocking) return;
    setIsUnlocking(true);
    
    const result = unlockAbility(abilityId);
    
    if (result.success) {
      const ability = prestigeTree.getAbilityDetails(abilityId);
      toast({
        title: "✨ Ability Unlocked!",
        description: `${ability?.name} is now available.`,
        className: "border-purple-500 bg-purple-500/10",
      });
    } else {
      toast({
        title: "Cannot Unlock",
        description: result.error,
        variant: "destructive",
      });
    }
    
    setIsUnlocking(false);
  }, [isUnlocking, unlockAbility, prestigeTree, toast]);

  // Show unlock gate if legacy tree is not unlocked
  if (!isLegacyUnlocked) {
    return (
      <UnlockProgressGate
        current={unlockProgress.current}
        required={unlockProgress.required}
        isUnlocked={isLegacyUnlocked}
        isLevelBased={unlockProgress.isLevelBased}
      />
    );
  }

  // Get unlock check for selected ability
  const selectedCheck = selectedAbility ? canUnlockAbility(selectedAbility.id) : { canUnlock: false };

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-purple-950/20 to-black/40">
      {/* Central Node - Always visible */}
      <DrizztCentralNode
        prestigeLevel={prestigeLevel}
        totalPointsEarned={prestigeTree.progress.unlockedAbilities.length}
        pointsSpentOnTree={spentOnTree}
        availablePoints={availablePrestigePoints}
        isMobile={isMobile}
        className="border-b border-purple-900/30"
      />

      {/* Mobile: Branch Selector Tabs */}
      {isMobile && (
        <div className="px-4 py-2">
          <BranchSelector
            selectedBranch={selectedBranch}
            onSelectBranch={setSelectedBranch}
            branchProgress={branchProgress}
          />
        </div>
      )}

      {/* Main Content Area */}
      <ScrollArea className="flex-1">
        {isMobile ? (
          // Mobile: Single branch view
          <div className="p-4">
            <PrestigeBranchColumn
              branch={selectedBranch}
              unlockedSet={unlockedSet}
              canUnlockAbility={canUnlockAbility}
              onNodeClick={handleNodeClick}
              isMobile={isMobile}
            />
          </div>
        ) : (
          // Desktop: Grid of all 4 branches
          <div className="grid grid-cols-2 gap-4 p-6">
            {BRANCH_ORDER.map((branch) => (
              <PrestigeBranchColumn
                key={branch}
                branch={branch}
                unlockedSet={unlockedSet}
                canUnlockAbility={canUnlockAbility}
                onNodeClick={handleNodeClick}
                isMobile={isMobile}
                className="border border-purple-900/20 rounded-xl bg-black/20"
              />
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Ability Details Sheet */}
      <PrestigeAbilityDetails
        ability={selectedAbility}
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        isUnlocked={selectedAbility ? isAbilityUnlocked(selectedAbility.id) : false}
        canUnlock={selectedCheck.canUnlock}
        unlockReason={selectedCheck.reason}
        onUnlock={handleUnlock}
        isMobile={isMobile}
      />
    </div>
  );
}
