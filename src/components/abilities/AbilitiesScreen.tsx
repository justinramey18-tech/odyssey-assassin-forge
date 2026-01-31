import { useState, useCallback, useMemo } from 'react';
import { Character, CharacterAbility, AbilityTree, getAbilityPointsForLevel, getTotalPointsSpent, getPointsSpentInTree } from '@/lib/types';
import { allAbilities, getAbilityById } from '@/lib/abilities';
import { TREE_VISUAL_CONFIG } from '@/lib/abilityTrees/colors';
import { TreeColumn } from './TreeColumn';
import { TreeSelector } from './TreeSelector';
import { AbilityDetailsPanel } from './AbilityDetailsPanel';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSwipe } from '@/hooks/use-swipe';
import { cn } from '@/lib/utils';
import { ArrowLeft, Star } from 'lucide-react';

interface AbilitiesScreenProps {
  character: Character;
  availablePoints: number;
  prestigePoints?: number;
  onUpgradeAbility: (id: string) => void;
  onDowngradeAbility: (id: string) => void;
  onEquipAbility: (id: string, slot: number) => void;
  onBack: () => void;
}

const TREE_ORDER: AbilityTree[] = ['hunter', 'warrior', 'assassin'];

export function AbilitiesScreen({
  character,
  availablePoints,
  prestigePoints = 0,
  onUpgradeAbility,
  onDowngradeAbility,
  onEquipAbility,
  onBack,
}: AbilitiesScreenProps) {
  const isMobile = useIsMobile();
  const [selectedTree, setSelectedTree] = useState<AbilityTree>('hunter');
  const [selectedAbility, setSelectedAbility] = useState<string | null>(null);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null);

  // Calculate points spent per tree
  const pointsByTree = useMemo(() => ({
    hunter: getPointsSpentInTree(character.abilities, allAbilities, 'hunter'),
    warrior: getPointsSpentInTree(character.abilities, allAbilities, 'warrior'),
    assassin: getPointsSpentInTree(character.abilities, allAbilities, 'assassin'),
  }), [character.abilities]);

  const totalPoints = getAbilityPointsForLevel(character.level);

  // Swipe handlers for mobile tree navigation
  const handleSwipeLeft = useCallback(() => {
    const idx = TREE_ORDER.indexOf(selectedTree);
    if (idx < 2) {
      setSlideDirection('left');
      setSelectedTree(TREE_ORDER[idx + 1]);
      if (navigator.vibrate) navigator.vibrate(10);
      setTimeout(() => setSlideDirection(null), 300);
    }
  }, [selectedTree]);

  const handleSwipeRight = useCallback(() => {
    const idx = TREE_ORDER.indexOf(selectedTree);
    if (idx > 0) {
      setSlideDirection('right');
      setSelectedTree(TREE_ORDER[idx - 1]);
      if (navigator.vibrate) navigator.vibrate(10);
      setTimeout(() => setSlideDirection(null), 300);
    }
  }, [selectedTree]);

  const { handlers: swipeHandlers, swipeOffset } = useSwipe(
    handleSwipeLeft,
    handleSwipeRight,
    { threshold: 60, velocityThreshold: 0.4 }
  );

  // Get selected ability data
  const selectedAbilityData = selectedAbility ? getAbilityById(selectedAbility) : null;
  const currentTier = selectedAbility 
    ? (character.abilities.find(ca => ca.abilityId === selectedAbility)?.currentTier || 0) as 0 | 1 | 2 | 3
    : 0;

  // Check prerequisite for selected ability
  const prerequisiteMet = useMemo(() => {
    if (!selectedAbilityData?.prerequisite) return true;
    const prereqTier = character.abilities.find(
      ca => ca.abilityId === selectedAbilityData.prerequisite!.abilityId
    )?.currentTier || 0;
    return prereqTier >= selectedAbilityData.prerequisite.tier;
  }, [selectedAbilityData, character.abilities]);

  // Handle upgrade
  const handleUpgrade = () => {
    if (selectedAbility) {
      onUpgradeAbility(selectedAbility);
    }
  };

  // Handle downgrade  
  const handleDowngrade = () => {
    if (selectedAbility) {
      onDowngradeAbility(selectedAbility);
    }
  };

  // Handle equip
  const handleEquip = (slot: number) => {
    if (selectedAbility) {
      onEquipAbility(selectedAbility, slot);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-screen bg-background">
      {/* Header */}
      <header className={cn(
        'flex items-center justify-between p-4 border-b border-border/50',
        'bg-gradient-to-b from-background to-background/80',
        isMobile && 'flex-col gap-2'
      )}>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
            {!isMobile && <span className="ml-2">Back</span>}
          </Button>
          <h1 className={cn(
            'font-display font-bold uppercase tracking-wider',
            isMobile ? 'text-lg' : 'text-2xl'
          )}>
            Abilities
          </h1>
        </div>
        
        <div className={cn(
          'flex items-center gap-2',
          isMobile && 'w-full justify-center'
        )}>
          <span className="text-sm text-muted-foreground">Available:</span>
          <span className="text-2xl font-bold text-yellow-400">
            {availablePoints}
          </span>
          {isMobile ? (
            <span className="text-sm text-muted-foreground">pts</span>
          ) : (
            <div className="flex gap-1">
              {Array.from({ length: Math.min(totalPoints, 25) }).map((_, i) => (
                <Star
                  key={i}
                  className={cn(
                    'w-4 h-4',
                    i < availablePoints
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'fill-muted text-muted-foreground'
                  )}
                />
              ))}
              {totalPoints > 25 && (
                <span className="text-xs text-muted-foreground ml-1">+{totalPoints - 25}</span>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {isMobile ? (
          // Mobile Layout: Single tree with selector and swipe
          <div className="flex flex-col flex-1">
            <TreeSelector
              selected={selectedTree}
              onChange={setSelectedTree}
              pointsByTree={pointsByTree}
            />
            
            <div 
              {...swipeHandlers}
              className="flex-1 overflow-hidden relative"
              style={{
                transform: `translateX(${swipeOffset}px)`,
                transition: slideDirection ? 'transform 0.3s ease-out' : undefined,
              }}
            >
              <ScrollArea className="h-full">
                <TreeColumn
                  tree={selectedTree}
                  abilities={allAbilities}
                  characterAbilities={character.abilities}
                  selectedAbilityId={selectedAbility}
                  isMobile={true}
                  pointsInvested={pointsByTree[selectedTree]}
                  onSelectAbility={setSelectedAbility}
                />
              </ScrollArea>
            </div>
          </div>
        ) : (
          // Desktop Layout: All three trees + details panel
          <>
            <div className="flex flex-1 overflow-x-auto">
              {TREE_ORDER.map(tree => (
                <ScrollArea key={tree} className="flex-1 border-r border-border/30 last:border-r-0">
                  <TreeColumn
                    tree={tree}
                    abilities={allAbilities}
                    characterAbilities={character.abilities}
                    selectedAbilityId={selectedAbility}
                    isMobile={false}
                    pointsInvested={pointsByTree[tree]}
                    onSelectAbility={setSelectedAbility}
                  />
                </ScrollArea>
              ))}
            </div>
            
            {/* Desktop Details Sidebar */}
            <aside className="w-[380px] border-l border-border/50 bg-muted/5 overflow-y-auto">
              <AbilityDetailsPanel
                ability={selectedAbilityData || null}
                currentTier={currentTier}
                characterLevel={character.level}
                prestigePoints={prestigePoints}
                availablePoints={availablePoints}
                prerequisiteMet={prerequisiteMet}
                equippedSlots={character.equippedAbilities}
                onUpgrade={handleUpgrade}
                onDowngrade={handleDowngrade}
                onEquip={handleEquip}
                onClose={() => setSelectedAbility(null)}
                isMobile={false}
              />
            </aside>
          </>
        )}
      </div>

      {/* Mobile Bottom Sheet */}
      {isMobile && (
        <Sheet 
          open={!!selectedAbility} 
          onOpenChange={(open) => !open && setSelectedAbility(null)}
        >
          <SheetContent 
            side="bottom" 
            className="h-[75vh] rounded-t-xl overflow-y-auto"
          >
            {/* Drag handle */}
            <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-4" />
            <SheetTitle className="sr-only">
              Ability Details
            </SheetTitle>
            <AbilityDetailsPanel
              ability={selectedAbilityData || null}
              currentTier={currentTier}
              characterLevel={character.level}
              prestigePoints={prestigePoints}
              availablePoints={availablePoints}
              prerequisiteMet={prerequisiteMet}
              equippedSlots={character.equippedAbilities}
              onUpgrade={handleUpgrade}
              onDowngrade={handleDowngrade}
              onEquip={handleEquip}
              onClose={() => setSelectedAbility(null)}
              isMobile={true}
            />
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
