import { useState, useMemo } from 'react';
import { Character, CharacterAbility, getAbilityPointsForLevel, getTotalPointsSpent, getActiveSlotsByLevel } from '@/lib/types';
import { allAbilities } from '@/lib/abilities';
import { achievementCategories, Achievement } from '@/lib/achievements';
import { 
  XPPreset, 
  XP_PRESETS,
  calculatePendingLevelUps,
  getXPForLevel,
} from '@/lib/xpSystem';
import { WizardStepOne } from '@/components/character/WizardStepOne';
import { CharacterHeader } from '@/components/character/CharacterHeader';
import { EquippedLoadout } from '@/components/character/EquippedLoadout';
import { ActionWheelButton } from '@/components/character/ActionWheelButton';
import { XPTracker } from '@/components/character/XPTracker';
import { LevelUpModal } from '@/components/character/LevelUpModal';
import { InventoryScreen } from '@/components/inventory/InventoryScreen';
import { AchievementsScreen } from '@/components/achievements/AchievementsScreen';
import { ConstellationScreen } from '@/components/constellation/ConstellationScreen';
import { HomeScreen } from '@/components/home/HomeScreen';
import { NarrativeForgeScreen } from '@/components/scribe/NarrativeForgeScreen';
import { PromptDrawerProvider } from '@/components/drawers';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Swords, Backpack, Trophy, Sparkles, Home, BookOpen, ChevronUp, Crosshair, Lock } from 'lucide-react';
import { SettingsModal } from '@/components/settings/SettingsModal';
import { CombatTabScreen } from '@/components/combat/CombatTabScreen';
import { useToast } from '@/hooks/use-toast';
import { useGameMode } from '@/hooks/use-game-mode';
import { 
  CharacterEquipment, 
  EquipmentItem,
  createInitialEquipment,
} from '@/lib/inventory/index';


const Index = () => {
  const [showWizard, setShowWizard] = useState(true);
  const [showHomeScreen, setShowHomeScreen] = useState(false);
  const [activeTab, setActiveTab] = useState<'skills' | 'gear' | 'feats' | 'stars' | 'scribe' | 'combat'>('skills');
  const [character, setCharacter] = useState<Character>({
    name: '',
    level: 1,
    abilities: allAbilities.map(a => ({ abilityId: a.id, currentTier: 0 as const })),
    equippedAbilities: [],
  });
  
  // XP System State
  const [currentXP, setCurrentXP] = useState(0);
  const [xpPreset, setXPPreset] = useState<XPPreset>('standard');
  const [pendingLevelUps, setPendingLevelUps] = useState(0);
  const [showLevelUpModal, setShowLevelUpModal] = useState(false);
  const [levelUpPointsToSpend, setLevelUpPointsToSpend] = useState(0);
  
  // Shared equipment state for constellation view
  const [equipment, setEquipment] = useState<CharacterEquipment>(() => createInitialEquipment());
  
  // Shared achievements state
  const [achievements, setAchievements] = useState<Achievement[]>(
    () => achievementCategories.map(a => ({ ...a }))
  );
  
  const { toast } = useToast();
  const { requiresOrganicLevelUp, requiresGearUnlocks, rerollsDisabled } = useGameMode();

  // Calculate unlocked abilities map for drawer
  const unlockedAbilities = useMemo(() => {
    const map = new Map<string, number>();
    character.abilities.forEach(ca => {
      if (ca.currentTier > 0) {
        map.set(ca.abilityId, ca.currentTier);
      }
    });
    return map;
  }, [character.abilities]);

  const totalPoints = getAbilityPointsForLevel(character.level);
  const spentPoints = getTotalPointsSpent(character.abilities);
  const remainingPoints = totalPoints - spentPoints;

  const handleBasicInfoComplete = (name: string, level: number) => {
    setCharacter(prev => ({
      ...prev,
      name,
      level,
    }));
    // Set XP to match level
    const xpForLevel = getXPForLevel(level, XP_PRESETS[xpPreset].multiplier);
    setCurrentXP(xpForLevel);
    setShowWizard(false);
  };

  const handleAddXP = (amount: number, source: string) => {
    const multiplier = XP_PRESETS[xpPreset].multiplier;
    
    // Milestone mode - manual level ups only
    if (multiplier === 0) {
      toast({
        title: "Milestone Mode",
        description: "XP tracking disabled. Use manual level up.",
      });
      return;
    }
    
    const newXP = currentXP + amount;
    setCurrentXP(newXP);
    
    // Check for level ups
    const levelsToGain = calculatePendingLevelUps(character.level, newXP, multiplier);
    
    if (levelsToGain > 0) {
      // Calculate points to spend (difference between new and old level points)
      const currentPoints = getAbilityPointsForLevel(character.level);
      const newPoints = getAbilityPointsForLevel(character.level + levelsToGain);
      const pointsGained = newPoints - currentPoints;
      
      setPendingLevelUps(levelsToGain);
      setLevelUpPointsToSpend(pointsGained);
      setShowLevelUpModal(true);
      
      toast({
        title: "⚡ LEVEL UP!",
        description: `${character.name} is ready to reach Level ${character.level + levelsToGain}!`,
        className: "border-primary bg-primary/10",
      });
    } else {
      toast({
        title: `+${amount} XP`,
        description: source,
      });
    }
  };

  const handleUpgradeAbility = (abilityId: string) => {
    if (remainingPoints <= 0 && !showLevelUpModal) return;

    setCharacter(prev => ({
      ...prev,
      abilities: prev.abilities.map(ca =>
        ca.abilityId === abilityId && ca.currentTier < 3
          ? { ...ca, currentTier: (ca.currentTier + 1) as 0 | 1 | 2 | 3 }
          : ca
      ),
    }));
  };

  const handleDowngradeAbility = (abilityId: string) => {
    setCharacter(prev => {
      // Remove from equipped if being fully removed
      const currentTier = prev.abilities.find(ca => ca.abilityId === abilityId)?.currentTier ?? 0;
      const newEquipped = currentTier === 1 
        ? prev.equippedAbilities.filter(id => id !== abilityId)
        : prev.equippedAbilities;
      
      return {
        ...prev,
        abilities: prev.abilities.map(ca =>
          ca.abilityId === abilityId && ca.currentTier > 0
            ? { ...ca, currentTier: (ca.currentTier - 1) as 0 | 1 | 2 | 3 }
            : ca
        ),
        equippedAbilities: newEquipped,
      };
    });
  };

  const handleConfirmLevelUp = () => {
    // Find the last upgraded ability to auto-equip
    const unlockedActiveAbilities = character.abilities
      .filter(ca => {
        const ability = allAbilities.find(a => a.id === ca.abilityId);
        return ca.currentTier > 0 && ability?.type === 'active';
      })
      .map(ca => ca.abilityId);
    
    const maxSlots = getActiveSlotsByLevel(character.level + pendingLevelUps);
    
    // Auto-equip newly unlocked abilities if there's room
    setCharacter(prev => {
      const newEquipped = [...prev.equippedAbilities];
      
      // Find abilities that are unlocked but not equipped
      const unequippedAbilities = unlockedActiveAbilities.filter(id => !newEquipped.includes(id));
      
      // Add to empty slots
      for (const abilityId of unequippedAbilities) {
        if (newEquipped.filter(Boolean).length < maxSlots) {
          const emptySlot = newEquipped.findIndex((slot, idx) => !slot && idx < maxSlots);
          if (emptySlot >= 0) {
            newEquipped[emptySlot] = abilityId;
          } else if (newEquipped.length < maxSlots) {
            newEquipped.push(abilityId);
          }
        }
      }
      
      return {
        ...prev,
        level: prev.level + pendingLevelUps,
        equippedAbilities: newEquipped.filter(Boolean),
      };
    });
    
    setPendingLevelUps(0);
    setLevelUpPointsToSpend(0);
    setShowLevelUpModal(false);
    
    toast({
      title: "Level Up Complete!",
      description: `${character.name} is now Level ${character.level + pendingLevelUps}!`,
    });
  };

  const handleResetAbilities = () => {
    setCharacter(prev => ({
      ...prev,
      abilities: prev.abilities.map(ca => ({ ...ca, currentTier: 0 as const })),
      equippedAbilities: [],
    }));
  };

  const handleEquipAbility = (slotIndex: number, abilityId: string) => {
    setCharacter(prev => {
      const newEquipped = [...prev.equippedAbilities];
      newEquipped[slotIndex] = abilityId;
      return { ...prev, equippedAbilities: newEquipped };
    });
  };

  const handleUnequipAbility = (slotIndex: number) => {
    setCharacter(prev => {
      const newEquipped = [...prev.equippedAbilities];
      newEquipped[slotIndex] = '';
      return { ...prev, equippedAbilities: newEquipped.filter(Boolean) };
    });
  };

  const handleExportJSON = () => {
    const exportData = {
      character: {
        name: character.name,
        level: character.level,
        currentXP,
        xpPreset,
      },
      abilities: {
        pointsSpent: {
          hunter: character.abilities
            .filter(ca => allAbilities.find(a => a.id === ca.abilityId)?.tree === 'hunter')
            .reduce((sum, ca) => sum + ca.currentTier, 0),
          warrior: character.abilities
            .filter(ca => allAbilities.find(a => a.id === ca.abilityId)?.tree === 'warrior')
            .reduce((sum, ca) => sum + ca.currentTier, 0),
          assassin: character.abilities
            .filter(ca => allAbilities.find(a => a.id === ca.abilityId)?.tree === 'assassin')
            .reduce((sum, ca) => sum + ca.currentTier, 0),
        },
        unlockedAbilities: character.abilities
          .filter(ca => ca.currentTier > 0)
          .map(ca => ({
            id: ca.abilityId,
            name: allAbilities.find(a => a.id === ca.abilityId)?.name,
            tier: ca.currentTier,
            tree: allAbilities.find(a => a.id === ca.abilityId)?.tree,
          })),
        equippedLoadout: character.equippedAbilities
          .filter(Boolean)
          .map(id => ({
            id,
            name: allAbilities.find(a => a.id === id)?.name,
          })),
      },
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${character.name || 'assassin'}-build.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleShortRest = () => {
    toast({
      title: "Short Rest Complete",
      description: "You've rested for 1 hour. Some abilities have been restored.",
    });
  };

  const handleLongRest = () => {
    toast({
      title: "Long Rest Complete", 
      description: "You've rested for 8 hours. All abilities and HP restored.",
    });
  };

  // Manual level up trigger (for milestone mode or testing)
  const handleManualLevelUp = () => {
    if (character.level >= 20) return;
    
    const currentPoints = getAbilityPointsForLevel(character.level);
    const newPoints = getAbilityPointsForLevel(character.level + 1);
    const pointsGained = newPoints - currentPoints;
    
    setPendingLevelUps(1);
    setLevelUpPointsToSpend(pointsGained);
    setShowLevelUpModal(true);
  };

  // Show wizard on first load
  if (showWizard) {
    return (
      <div className="min-h-screen bg-background">
        <WizardStepOne
          initialName={character.name}
          initialLevel={character.level}
          onComplete={handleBasicInfoComplete}
        />
      </div>
    );
  }

  // Full-screen Home overlay
  if (showHomeScreen) {
    return (
      <HomeScreen
        character={character}
        equipment={equipment}
        achievements={achievements}
        currentXP={currentXP}
        xpPreset={xpPreset}
        onBack={() => setShowWizard(true)}
        onNavigateToTab={(tab) => {
          setShowHomeScreen(false);
          if (tab === 'abilities') setActiveTab('skills');
          else if (tab === 'inventory') setActiveTab('gear');
          else if (tab === 'achievements') setActiveTab('feats');
          else if (tab === 'constellation') setActiveTab('stars');
        }}
        onShortRest={handleShortRest}
        onLongRest={handleLongRest}
        onAddXP={handleAddXP}
        onXPPresetChange={setXPPreset}
        onManualLevelUp={handleManualLevelUp}
        onReturnToBuilder={() => setShowHomeScreen(false)}
      />
    );
  }

  return (
    <PromptDrawerProvider
      character={character}
      unlockedAbilities={unlockedAbilities}
      enabled={!showLevelUpModal}
      currentXP={currentXP}
      xpPreset={xpPreset}
      onAddXP={handleAddXP}
      equipment={equipment}
    >
      <div className="min-h-screen bg-background">
      {/* Level Up Modal */}
      <LevelUpModal
        open={showLevelUpModal}
        onClose={() => setShowLevelUpModal(false)}
        character={character}
        newLevel={character.level + pendingLevelUps}
        pointsToSpend={levelUpPointsToSpend}
        onUpgradeAbility={handleUpgradeAbility}
        onDowngradeAbility={handleDowngradeAbility}
        onConfirmLevelUp={handleConfirmLevelUp}
      />

      {/* Character Header - Always visible */}
      <CharacterHeader character={character} currentXP={currentXP} />

      {/* Tab Navigation */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'skills' | 'gear' | 'feats' | 'stars' | 'scribe' | 'combat')} className="w-full">
        {/* Tab Navigation Bar */}
        <div className="sticky top-0 z-40 bg-gradient-to-b from-background via-background/98 to-background/90 backdrop-blur-md border-b border-red-900/30 px-4 py-3">
          {/* Decorative top line */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-red-500 to-transparent" />
          
          <div className="flex items-center gap-2 max-w-2xl mx-auto">
            {/* Home Button - Opens full-screen overlay */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHomeScreen(true)}
              className="gap-1 border border-red-900/40 hover:bg-red-600/20 hover:text-red-400 font-cinzel uppercase tracking-wider text-[9px] px-3"
            >
              <Home className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Home</span>
            </Button>

            {/* Main Tabs */}
            <TabsList className="flex-1 grid grid-cols-6 bg-black/40 border border-red-900/40 p-1 rounded-none relative overflow-hidden">
              {/* Corner accents */}
              <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-red-500/70" />
              <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-red-500/70" />
              <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-red-500/70" />
              <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-red-500/70" />
              
              <TabsTrigger 
                value="combat" 
                className="gap-1 data-[state=active]:bg-gradient-to-b data-[state=active]:from-red-600/40 data-[state=active]:to-red-900/30 data-[state=active]:text-red-300 data-[state=active]:border-b-2 data-[state=active]:border-red-400 rounded-none font-cinzel uppercase tracking-wider text-[9px] transition-all"
              >
                <Crosshair className="w-3.5 h-3.5" />
                <span>Combat</span>
              </TabsTrigger>
              <TabsTrigger 
                value="skills" 
                className="gap-1 data-[state=active]:bg-gradient-to-b data-[state=active]:from-red-600/30 data-[state=active]:to-red-900/20 data-[state=active]:text-red-400 data-[state=active]:border-b-2 data-[state=active]:border-red-500 rounded-none font-cinzel uppercase tracking-wider text-[9px] transition-all"
              >
                <Swords className="w-3.5 h-3.5" />
                <span>Skills</span>
              </TabsTrigger>
              <TabsTrigger 
                value="gear" 
                className="gap-1 data-[state=active]:bg-gradient-to-b data-[state=active]:from-amber-600/30 data-[state=active]:to-amber-900/20 data-[state=active]:text-amber-400 data-[state=active]:border-b-2 data-[state=active]:border-amber-500 rounded-none font-cinzel uppercase tracking-wider text-[9px] transition-all"
              >
                <Backpack className="w-3.5 h-3.5" />
                <span>Gear</span>
              </TabsTrigger>
              <TabsTrigger 
                value="feats" 
                className="gap-1 data-[state=active]:bg-gradient-to-b data-[state=active]:from-purple-600/30 data-[state=active]:to-purple-900/20 data-[state=active]:text-purple-400 data-[state=active]:border-b-2 data-[state=active]:border-purple-500 rounded-none font-cinzel uppercase tracking-wider text-[9px] transition-all"
              >
                <Trophy className="w-3.5 h-3.5" />
                <span>Feats</span>
              </TabsTrigger>
              <TabsTrigger 
                value="stars" 
                className="gap-1 data-[state=active]:bg-gradient-to-b data-[state=active]:from-cyan-600/30 data-[state=active]:to-cyan-900/20 data-[state=active]:text-cyan-400 data-[state=active]:border-b-2 data-[state=active]:border-cyan-500 rounded-none font-cinzel uppercase tracking-wider text-[9px] transition-all"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Stars</span>
              </TabsTrigger>
              <TabsTrigger 
                value="scribe" 
                className="gap-1 data-[state=active]:bg-gradient-to-b data-[state=active]:from-amber-600/30 data-[state=active]:to-amber-900/20 data-[state=active]:text-amber-400 data-[state=active]:border-b-2 data-[state=active]:border-amber-500 rounded-none font-cinzel uppercase tracking-wider text-[9px] transition-all"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Scribe</span>
              </TabsTrigger>
            </TabsList>

            {/* Settings Modal */}
            <SettingsModal 
              characterName={character.name} 
              onEditCharacter={() => setShowWizard(true)} 
            />
          </div>
          
          {/* Decorative bottom accent */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-20 h-[2px] bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />
        </div>

        {/* Skills Tab Content */}
        <TabsContent value="skills" className="mt-0 pb-4">
          <div className="container max-w-2xl mx-auto px-4 py-4">
            {/* XP Tracker */}
            <div className="mb-6 p-4 rounded-lg border border-primary/30 bg-gradient-to-b from-primary/5 to-transparent">
              <XPTracker
                currentLevel={character.level}
                currentXP={currentXP}
                achievements={achievements}
                onAddXP={handleAddXP}
              />
            </div>

            {/* Equipped Loadout */}
            <div className="mb-6 p-4 rounded-lg border border-border/50 bg-card/30">
              <EquippedLoadout
                character={character}
                onEquip={handleEquipAbility}
                onUnequip={handleUnequipAbility}
              />
            </div>

            {/* Manual Level Up Button */}
            {character.level < 20 && !requiresOrganicLevelUp && (
              <button
                onClick={handleManualLevelUp}
                className="w-full py-3 px-4 rounded-lg border-2 border-dashed border-primary/30 hover:border-primary/50 bg-primary/5 hover:bg-primary/10 transition-all flex items-center justify-center gap-2 group"
              >
                <ChevronUp className="w-5 h-5 text-primary group-hover:animate-bounce" />
                <span className="font-display text-sm text-primary">Trigger Level Up</span>
                <ChevronUp className="w-5 h-5 text-primary group-hover:animate-bounce" />
              </button>
            )}
            
            {/* Honest Mode indicator for organic level up */}
            {character.level < 20 && requiresOrganicLevelUp && (
              <div className="w-full py-3 px-4 rounded-lg border-2 border-dashed border-muted/40 bg-muted/5 flex items-center justify-center gap-2 opacity-60">
                <Lock className="w-4 h-4 text-muted-foreground" />
                <span className="font-display text-sm text-muted-foreground">Organic Leveling Mode</span>
              </div>
            )}

            {/* Info about hidden ability trees */}
            <div className="mt-6 p-4 rounded-lg bg-muted/20 border border-muted/30">
              <p className="text-xs text-muted-foreground text-center font-body">
                💡 Ability tree selection appears when you level up. 
                {requiresOrganicLevelUp 
                  ? ' In Honest Mode, levels are gained organically through XP.'
                  : ' Add XP to trigger a level up, or use the button above for milestone progression.'}
              </p>
            </div>
          </div>
        </TabsContent>

        {/* Gear Tab Content */}
        <TabsContent value="gear" className="mt-0">
          <InventoryScreen
            characterName={character.name}
            level={character.level}
            onBack={() => setActiveTab('skills')}
            equipment={equipment}
            onEquipmentChange={setEquipment}
          />
        </TabsContent>

        {/* Feats Tab Content */}
        <TabsContent value="feats" className="mt-0">
          <AchievementsScreen
            characterName={character.name}
            achievements={achievements}
            onAchievementsChange={setAchievements}
            onBack={() => setActiveTab('skills')}
            onAwardXP={handleAddXP}
          />
        </TabsContent>

        {/* Stars Tab Content */}
        <TabsContent value="stars" className="mt-0">
          <ConstellationScreen
            characterName={character.name}
            equippedItems={Object.values(equipment.slots).filter(Boolean) as EquipmentItem[]}
            onBack={() => setActiveTab('skills')}
          />
        </TabsContent>

        {/* Scribe Tab Content */}
        <TabsContent value="scribe" className="mt-0">
          <NarrativeForgeScreen
            characterName={character.name}
            onBack={() => setActiveTab('skills')}
          />
        </TabsContent>

        {/* Combat Tab Content */}
        <TabsContent value="combat" className="mt-0">
          <CombatTabScreen character={character} />
        </TabsContent>
      </Tabs>

      {/* Floating Action Wheel - visible on skills/feats tabs */}
      {(activeTab === 'skills' || activeTab === 'feats') && (
        <ActionWheelButton characterName={character.name} characterLevel={character.level} />
      )}
      </div>
    </PromptDrawerProvider>
  );
};

export default Index;
