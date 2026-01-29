import { useState } from 'react';
import { Character, getAbilityPointsForLevel, getTotalPointsSpent } from '@/lib/types';
import { allAbilities, getAbilitiesByTree } from '@/lib/abilities';
import { AbilityTreeAccordion } from './AbilityTreeAccordion';
import { Accordion } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Sparkles, Star, ChevronUp, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LevelUpModalProps {
  open: boolean;
  onClose: () => void;
  character: Character;
  newLevel: number;
  pointsToSpend: number;
  onUpgradeAbility: (abilityId: string) => void;
  onDowngradeAbility: (abilityId: string) => void;
  onConfirmLevelUp: () => void;
  // Prestige mode props
  isPrestigeMode?: boolean;
  prestigeLevel?: number;
  onSpendPrestigePoint?: () => { success: boolean; message?: string };
}

export function LevelUpModal({
  open,
  onClose,
  character,
  newLevel,
  pointsToSpend,
  onUpgradeAbility,
  onDowngradeAbility,
  onConfirmLevelUp,
  isPrestigeMode = false,
  prestigeLevel = 0,
  onSpendPrestigePoint,
}: LevelUpModalProps) {
  const [selectedAbilityId, setSelectedAbilityId] = useState<string | null>(null);
  const [pointsSpentThisSession, setPointsSpentThisSession] = useState(0);

  const getCharacterAbilityTier = (abilityId: string): 0 | 1 | 2 | 3 => {
    const ca = character.abilities.find(a => a.abilityId === abilityId);
    return ca?.currentTier ?? 0;
  };

  const getPointsInTree = (tree: 'hunter' | 'warrior' | 'assassin') => {
    return character.abilities
      .filter(ca => allAbilities.find(a => a.id === ca.abilityId)?.tree === tree)
      .reduce((sum, ca) => sum + ca.currentTier, 0);
  };

  const remainingPoints = pointsToSpend - pointsSpentThisSession;

  const canUpgrade = (abilityId: string): boolean => {
    if (remainingPoints <= 0) return false;
    
    const ability = allAbilities.find(a => a.id === abilityId);
    if (!ability) return false;

    const currentTier = getCharacterAbilityTier(abilityId);
    if (currentTier >= 3) return false;

    // Check level requirement
    if (ability.minLevel && newLevel < ability.minLevel) return false;

    // Check prerequisite
    if (ability.prerequisite) {
      const prereqTier = getCharacterAbilityTier(ability.prerequisite.abilityId);
      if (prereqTier < ability.prerequisite.tier) return false;
    }

    return true;
  };

  const handleUpgrade = (abilityId: string) => {
    // In prestige mode, we need to spend a prestige point
    if (isPrestigeMode && onSpendPrestigePoint) {
      const result = onSpendPrestigePoint();
      if (!result.success) return;
    }
    
    onUpgradeAbility(abilityId);
    setSelectedAbilityId(abilityId);
    setPointsSpentThisSession(prev => prev + 1);
  };

  const handleDowngrade = (abilityId: string) => {
    const currentTier = getCharacterAbilityTier(abilityId);
    if (currentTier > 0) {
      onDowngradeAbility(abilityId);
      setPointsSpentThisSession(prev => Math.max(0, prev - 1));
      if (selectedAbilityId === abilityId && currentTier === 1) {
        setSelectedAbilityId(null);
      }
    }
  };

  const handleConfirm = () => {
    onConfirmLevelUp();
    setPointsSpentThisSession(0);
    setSelectedAbilityId(null);
  };

  const handleClose = () => {
    setPointsSpentThisSession(0);
    setSelectedAbilityId(null);
    onClose();
  };

  const selectedAbility = selectedAbilityId 
    ? allAbilities.find(a => a.id === selectedAbilityId)
    : null;

  // Dynamic styling for prestige mode
  const headerGradient = isPrestigeMode 
    ? 'from-amber-900 via-orange-900 to-amber-900'
    : 'from-background via-background to-primary/5';
  
  const accentColor = isPrestigeMode ? 'amber' : 'primary';

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className={cn(
        "max-w-lg max-h-[90vh] overflow-hidden flex flex-col border-primary/30",
        isPrestigeMode 
          ? "bg-gradient-to-b from-amber-950 via-background to-orange-950/30 border-amber-500/50"
          : "bg-gradient-to-b from-background via-background to-primary/5"
      )}>
        {/* Header with level up celebration */}
        <DialogHeader className={cn(
          "relative pb-4 border-b",
          isPrestigeMode ? "border-amber-500/30" : "border-primary/20"
        )}>
          <div className="absolute -top-2 left-1/2 -translate-x-1/2">
            <div className="relative">
              {isPrestigeMode ? (
                <Star className="w-8 h-8 text-amber-400 fill-amber-400 animate-pulse" />
              ) : (
                <Sparkles className="w-8 h-8 text-primary animate-pulse" />
              )}
              <div className={cn(
                "absolute inset-0 w-8 h-8 blur-xl animate-pulse",
                isPrestigeMode ? "bg-amber-400/30" : "bg-primary/30"
              )} />
            </div>
          </div>
          
          <DialogTitle className="text-center pt-6">
            <div className="flex items-center justify-center gap-2 mb-2">
              <ChevronUp className={cn("w-5 h-5", isPrestigeMode ? "text-amber-400" : "text-primary")} />
              <span className={cn(
                "text-2xl font-display font-bold",
                isPrestigeMode ? "text-amber-400" : "text-primary"
              )}>
                {isPrestigeMode ? '★ PRESTIGE UPGRADE!' : 'LEVEL UP!'}
              </span>
              <ChevronUp className={cn("w-5 h-5", isPrestigeMode ? "text-amber-400" : "text-primary")} />
            </div>
            <p className="text-sm text-muted-foreground font-body">
              {isPrestigeMode 
                ? `${character.name} • Prestige ${prestigeLevel}`
                : `${character.name} has reached Level ${newLevel}`
              }
            </p>
          </DialogTitle>

          {/* Close button */}
          <button
            onClick={handleClose}
            className="absolute top-2 right-2 p-1.5 rounded-full hover:bg-muted/50 transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </DialogHeader>

        {/* Points indicator */}
        <div className={cn(
          "px-4 py-3 border-b",
          isPrestigeMode ? "bg-amber-950/50 border-amber-500/20" : "bg-card/50 border-border/50"
        )}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-body text-muted-foreground">
              {isPrestigeMode ? 'Prestige Points Available' : 'Ability Points Available'}
            </span>
            <div className="flex items-center gap-1">
              {Array.from({ length: pointsToSpend }).map((_, i) => (
                <Star 
                  key={i} 
                  className={cn(
                    'w-4 h-4 transition-all',
                    i < remainingPoints 
                      ? isPrestigeMode 
                        ? 'text-amber-400 fill-amber-400' 
                        : 'text-primary fill-primary'
                      : 'text-muted-foreground/30'
                  )} 
                />
              ))}
            </div>
          </div>
          <Progress 
            value={((pointsToSpend - remainingPoints) / pointsToSpend) * 100} 
            className={cn("h-2", isPrestigeMode && "[&>div]:bg-gradient-to-r [&>div]:from-amber-500 [&>div]:to-orange-500")}
          />
          <p className="text-xs text-center mt-1 text-muted-foreground">
            {remainingPoints} of {pointsToSpend} points remaining
          </p>
        </div>

        {/* Scrollable ability trees */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <Accordion type="single" collapsible className="space-y-3">
            <AbilityTreeAccordion
              tree="hunter"
              abilities={getAbilitiesByTree('hunter')}
              pointsInTree={getPointsInTree('hunter')}
              characterLevel={newLevel}
              characterName={character.name}
              getAbilityTier={getCharacterAbilityTier}
              canUpgrade={canUpgrade}
              onUpgrade={handleUpgrade}
              onDowngrade={handleDowngrade}
            />

            <AbilityTreeAccordion
              tree="warrior"
              abilities={getAbilitiesByTree('warrior')}
              pointsInTree={getPointsInTree('warrior')}
              characterLevel={newLevel}
              characterName={character.name}
              getAbilityTier={getCharacterAbilityTier}
              canUpgrade={canUpgrade}
              onUpgrade={handleUpgrade}
              onDowngrade={handleDowngrade}
            />

            <AbilityTreeAccordion
              tree="assassin"
              abilities={getAbilitiesByTree('assassin')}
              pointsInTree={getPointsInTree('assassin')}
              characterLevel={newLevel}
              characterName={character.name}
              getAbilityTier={getCharacterAbilityTier}
              canUpgrade={canUpgrade}
              onUpgrade={handleUpgrade}
              onDowngrade={handleDowngrade}
            />
          </Accordion>
        </div>

        {/* Footer with selected ability preview and confirm */}
        <div className={cn(
          "px-4 py-3 border-t space-y-3",
          isPrestigeMode ? "bg-amber-950/50 border-amber-500/20" : "bg-card/50 border-border/50"
        )}>
          {selectedAbility && (
            <div className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-md border",
              isPrestigeMode 
                ? "bg-amber-500/10 border-amber-500/30"
                : "bg-primary/10 border-primary/30"
            )}>
              <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center",
                isPrestigeMode ? "bg-amber-500/20" : "bg-primary/20"
              )}>
                {isPrestigeMode ? (
                  <Star className="w-3 h-3 text-amber-400" />
                ) : (
                  <Sparkles className="w-3 h-3 text-primary" />
                )}
              </div>
              <div className="flex-1">
                <p className={cn("text-xs font-display", isPrestigeMode ? "text-amber-400" : "text-primary")}>
                  Selected Ability
                </p>
                <p className="text-sm font-body font-medium">{selectedAbility.name}</p>
              </div>
              <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">
                Will be equipped
              </span>
            </div>
          )}

          <Button
            onClick={handleConfirm}
            disabled={isPrestigeMode ? pointsSpentThisSession === 0 : remainingPoints > 0}
            className={cn(
              "w-full",
              isPrestigeMode 
                ? "bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500"
                : "bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
            )}
          >
            {isPrestigeMode 
              ? pointsSpentThisSession === 0 
                ? 'Select Ability to Upgrade'
                : `Confirm ${pointsSpentThisSession} Upgrade${pointsSpentThisSession > 1 ? 's' : ''}`
              : remainingPoints > 0 
                ? `Spend ${remainingPoints} More Point${remainingPoints > 1 ? 's' : ''}` 
                : 'Confirm Level Up'
            }
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}