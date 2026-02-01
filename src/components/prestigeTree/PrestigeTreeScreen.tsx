// Prestige Tree Screen - Mobile-First Main Screen Component for Drizzt's Legacy

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
import { MobilePrestigeHeader } from './MobilePrestigeHeader';
import { MobileBranchView } from './MobileBranchView';

// Background image
import drizztBackground from '@/assets/trees/legacy-drizzt-mobile.jpg';

interface PrestigeTreeScreenProps {
  prestigeTree: UsePrestigeTreeReturn;
  prestigeLevel: number;
  availableAbilityPoints: number;
}

export function PrestigeTreeScreen({
  prestigeTree,
  prestigeLevel,
  availableAbilityPoints,
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
    spentOnTree,
    branchProgress,
    canUnlockAbility,
    unlockAbility,
    isAbilityUnlocked,
    isTierUnlockedForBranch,
    getTierUnlockProgress,
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

  // Mobile Layout
  if (isMobile) {
    return (
      <div className="relative flex flex-col h-full">
        {/* Background Image */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat z-0"
          style={{ backgroundImage: `url(${drizztBackground})` }}
        />
        {/* Gradient Overlay for legibility */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/60 to-background/90 z-0" />
        {/* Compact Mobile Header */}
        <MobilePrestigeHeader
          prestigeLevel={prestigeLevel}
          totalUnlocked={prestigeTree.progress.unlockedAbilities.length}
          pointsSpent={spentOnTree}
          availablePoints={availableAbilityPoints}
          className="relative z-10"
        />

        {/* Branch Selector Tabs */}
        <div className="relative z-10 px-3 py-2 border-b border-purple-900/30 bg-background/40 backdrop-blur-sm">
          <BranchSelector
            selectedBranch={selectedBranch}
            onSelectBranch={setSelectedBranch}
            branchProgress={branchProgress}
          />
        </div>

        {/* Branch Content - Scrollable */}
        <ScrollArea className="relative z-10 flex-1">
          <div className="p-4 pb-24">
            <MobileBranchView
              branch={selectedBranch}
              unlockedSet={unlockedSet}
              canUnlockAbility={canUnlockAbility}
              onNodeClick={handleNodeClick}
              isTierUnlockedForBranch={isTierUnlockedForBranch}
              getTierUnlockProgress={getTierUnlockProgress}
            />
          </div>
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

  // Desktop Layout
  return (
    <div className="relative flex flex-col h-full">
      {/* Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat z-0"
        style={{ backgroundImage: `url(${drizztBackground})` }}
      />
      {/* Gradient Overlay for legibility */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/60 to-background/90 z-0" />
      {/* Central Node - Desktop */}
      <DrizztCentralNode
        prestigeLevel={prestigeLevel}
        totalPointsEarned={prestigeTree.progress.unlockedAbilities.length}
        pointsSpentOnTree={spentOnTree}
        availablePoints={availableAbilityPoints}
        isMobile={isMobile}
        className="relative z-10 border-b border-purple-900/30 bg-background/40 backdrop-blur-sm"
      />

      {/* Main Content Area - Desktop Grid */}
      <ScrollArea className="relative z-10 flex-1">
        <div className="grid grid-cols-2 gap-4 p-6">
          {BRANCH_ORDER.map((branch) => (
            <PrestigeBranchColumn
              key={branch}
              branch={branch}
              unlockedSet={unlockedSet}
              canUnlockAbility={canUnlockAbility}
              onNodeClick={handleNodeClick}
              isMobile={isMobile}
              isTierUnlockedForBranch={isTierUnlockedForBranch}
              getTierUnlockProgress={getTierUnlockProgress}
              className="border border-purple-900/20 rounded-xl bg-black/30 backdrop-blur-sm"
            />
          ))}
        </div>
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
