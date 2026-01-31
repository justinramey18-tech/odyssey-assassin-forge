import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import { IntroSplashScreen } from '@/components/home/IntroSplashScreen';
import { NarrativeForgeScreen } from '@/components/scribe/NarrativeForgeScreen';
import { ChronicleSyncScreen } from '@/components/chronicle';
import { PromptDrawerProvider } from '@/components/drawers';
import { OnboardingProvider } from '@/components/onboarding';
import { AbilitiesScreen } from '@/components/abilities';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Swords, Backpack, Trophy, Sparkles, Home, BookOpen, ChevronUp, Crosshair, Lock, Cloud } from 'lucide-react';
import skillsBackgroundImage from '@/assets/skills-background-deadpool.jpg';
import builderBackground from '@/assets/builder-background.jpg';
import { SettingsModal } from '@/components/settings/SettingsModal';
import { CloudSaveModal } from '@/components/settings/CloudSaveModal';
import { AssassinHeader } from '@/components/navigation/AssassinHeader';
import { CombatTabScreen } from '@/components/combat/CombatTabScreen';
import { BackgroundWrapper } from '@/components/ui/BackgroundWrapper';
import { useToast } from '@/hooks/use-toast';
import { useGameMode } from '@/hooks/use-game-mode';
import { usePrestige } from '@/hooks/use-prestige';
import { useEquipmentStats } from '@/hooks/use-equipment-stats';
import { useAutoSave, loadAutoSave, SaveData, serializeConsumables } from '@/hooks/use-auto-save';
import { useConsumables } from '@/hooks/use-consumables';
import { ConsumablesInventoryWidget, AddConsumableDrawer } from '@/components/consumables';
import { getConsumableById } from '@/lib/consumables';
import { ApprovedChanges } from '@/lib/chronicleSync/types';
import { PrestigePointCounter, PrestigeLevelUpModal } from '@/components/prestige';
import { PrestigeTreeScreen } from '@/components/prestigeTree';
import { usePrestigeTree } from '@/hooks/use-prestige-tree';
import { resetAllAppData } from '@/lib/resetApp';
import { 
  CharacterEquipment, 
  EquipmentItem,
  createInitialEquipment,
} from '@/lib/inventory/index';



const Index = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Check for reset parameter on mount
  useEffect(() => {
    if (searchParams.get('reset') === 'true') {
      console.log('[AppReset] Reset parameter detected, clearing all data...');
      resetAllAppData();
      // Remove the reset parameter and reload
      setSearchParams({});
      window.location.reload();
    }
  }, [searchParams, setSearchParams]);

  const [showWizard, setShowWizard] = useState(true);
  const [showIntroSplash, setShowIntroSplash] = useState(() => {
    // Show intro splash only if user hasn't seen it before
    return !localStorage.getItem('odyssey-intro-seen');
  });
  const [showHomeScreen, setShowHomeScreen] = useState(true); // Home is default after wizard
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showCloudSaveModal, setShowCloudSaveModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'skills' | 'abilities' | 'gear' | 'feats' | 'stars' | 'scribe' | 'combat' | 'consumables' | 'chronicle' | 'legacy'>('skills');
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
  
  // Prestige System State
  const { 
    prestigeData, 
    isMaxLevel, 
    isPrestigeActive,
    nextPrestigeXPRequired,
    awardPrestigeXP,
    spendPrestigePoint,
    resetPrestigePoints,
    setPrestigeData,
  } = usePrestige(character.level);
  
  // Prestige Tree (Drizzt's Legacy) hook - pass character level for game mode unlock logic
  // Connect to main prestige system via spendPrestigePoint callback
  const prestigeTree = usePrestigeTree(
    character.abilities, 
    prestigeData, 
    (cost: number) => spendPrestigePoint(cost),
    character.level
  );
  
  const [showPrestigeLevelUp, setShowPrestigeLevelUp] = useState(false);
  const [prestigeLevelUpData, setPrestigeLevelUpData] = useState<{ level: number; points: number } | null>(null);
  const [showPrestigeSpendModal, setShowPrestigeSpendModal] = useState(false);
  
  // Shared equipment state for constellation view
  const [equipment, setEquipment] = useState<CharacterEquipment>(() => createInitialEquipment());
  
  // Aggregated equipment stats for GM guide
  const aggregatedStats = useEquipmentStats(equipment);
  
  // Shared achievements state
  const [achievements, setAchievements] = useState<Achievement[]>(
    () => achievementCategories.map(a => ({ ...a }))
  );
  
  // Consumables inventory
  const { 
    inventory: consumablesInventory, 
    useItem: useConsumableItem, 
    setItemQuantity: setConsumableQuantity,
    getItemCount: getConsumableCount,
    addItem: addConsumableItem 
  } = useConsumables();
  
  const { toast } = useToast();
  const { requiresOrganicLevelUp, requiresGearUnlocks, rerollsDisabled, infinityStonesLocked } = useGameMode();

  // Data for auto-save
  const saveData = useMemo(() => ({
    character,
    equipment,
    achievements,
    consumables: serializeConsumables(consumablesInventory),
    xp: {
      currentXP,
      xpPreset,
    },
    prestige: {
      prestigeXP: prestigeData.prestigeXP,
      prestigeLevel: prestigeData.prestigeLevel,
      totalPrestigePoints: prestigeData.totalPrestigePoints,
      spentPrestigePoints: prestigeData.spentPrestigePoints,
    },
  }), [character, equipment, achievements, consumablesInventory, currentXP, xpPreset, prestigeData]);

  // Auto-save (only when not in wizard)
  useAutoSave(saveData, !showWizard);

  // Load auto-save on mount
  useEffect(() => {
    const saved = loadAutoSave();
    if (saved && saved.character.name) {
      setCharacter(saved.character);
      setEquipment(saved.equipment);
      setAchievements(saved.achievements);
      setCurrentXP(saved.xp.currentXP);
      setXPPreset(saved.xp.xpPreset as XPPreset);
      setShowWizard(false);
      console.log('[AutoSave] Loaded character:', saved.character.name);
    }
  }, []);

  // Handle loading cloud save
  const handleLoadCloudSave = (data: SaveData) => {
    setCharacter(data.character);
    setEquipment(data.equipment);
    setAchievements(data.achievements);
    setCurrentXP(data.xp.currentXP);
    setXPPreset(data.xp.xpPreset as XPPreset);
    // Note: Prestige data is managed by usePrestige hook via localStorage
    setShowWizard(false);
  };

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
    
    // If at max level, route XP to prestige system
    if (isMaxLevel) {
      const result = awardPrestigeXP(amount);
      
      if (result.type === 'prestige_levelup') {
        setPrestigeLevelUpData({ 
          level: result.newLevel!, 
          points: result.pointsAwarded! 
        });
        setShowPrestigeLevelUp(true);
        
        toast({
          title: "★ PRESTIGE LEVEL UP!",
          description: `You've reached Prestige ${result.newLevel}! +${result.pointsAwarded} ability point!`,
          className: "border-amber-500 bg-amber-500/10",
        });
      } else {
        toast({
          title: `+${amount} Prestige XP`,
          description: source,
        });
      }
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
    
    const maxSlots = getActiveSlotsByLevel(character.level + pendingLevelUps, prestigeData.totalPrestigePoints);
    
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

  // Chronicle Sync change handler
  const handleApplyChronicleChanges = (changes: ApprovedChanges) => {
    // Create undo snapshot before applying changes
    const snapshot = {
      currentXP,
      characterLevel: character.level,
      achievements: achievements.map(a => ({ 
        id: a.id, 
        currentValue: a.currentValue, 
        claimedMilestones: a.claimedMilestones 
      })),
      consumablesInventory: consumablesInventory.map(item => ({
        consumableId: item.consumable.id,
        quantity: item.quantity,
      })),
      timestamp: Date.now(),
      changesApplied: changes.totalApplied,
    };
    localStorage.setItem('odyssey-chronicle-undo', JSON.stringify(snapshot));

    // Apply XP changes
    if (changes.xp.length > 0) {
      const totalXP = changes.xp.reduce((sum, xp) => sum + xp.amount, 0);
      handleAddXP(totalXP, 'Chronicle Sync import');
    }

    // Apply achievement increments
    changes.achievements.forEach(trigger => {
      setAchievements(prev => prev.map(a => 
        a.id === trigger.achievementId 
          ? { ...a, currentValue: Math.min(a.maxValue, a.currentValue + trigger.increment) }
          : a
      ));
    });

    // Apply item acquisitions
    changes.items.filter(i => i.action === 'acquired' && i.consumableId).forEach(item => {
      const consumable = getConsumableById(item.consumableId!);
      if (consumable) {
        addConsumableItem(consumable, item.quantity);
      }
    });

    // Apply item consumptions (useConsumableItem returns false if insufficient)
    changes.items.filter(i => i.action === 'consumed' && i.consumableId).forEach(item => {
      const success = useConsumableItem(item.consumableId!, item.quantity);
      if (!success) {
        toast({
          title: "Insufficient Inventory",
          description: `Couldn't consume ${item.quantity}x ${item.name} - not enough in inventory`,
          variant: "destructive",
        });
      }
    });

    // Level-up triggers existing modal flow
    if (changes.levelUp && changes.levelUp.newLevel > character.level) {
      const levelsToGain = changes.levelUp.newLevel - character.level;
      const currentPoints = getAbilityPointsForLevel(character.level);
      const newPoints = getAbilityPointsForLevel(changes.levelUp.newLevel);
      const pointsGained = newPoints - currentPoints;

      setPendingLevelUps(levelsToGain);
      setLevelUpPointsToSpend(pointsGained);
      setShowLevelUpModal(true);
    }

    toast({
      title: "Chronicle Sync Complete!",
      description: `Applied ${changes.totalApplied} changes successfully.`,
      className: "border-blue-500 bg-blue-500/10",
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

  // Intro splash screen - shows once after tutorial completion
  if (showHomeScreen && showIntroSplash) {
    return (
      <OnboardingProvider
        totalPointsSpent={spentPoints}
        characterName={character.name}
        onForceNavigate={(tab) => { 
          // Skip the intro splash when onboarding navigates
          localStorage.setItem('odyssey-intro-seen', 'true');
          setShowIntroSplash(false);
          setShowHomeScreen(false); 
          setActiveTab(tab as typeof activeTab); 
        }}
      >
        <IntroSplashScreen 
          onBegin={() => {
            localStorage.setItem('odyssey-intro-seen', 'true');
            setShowIntroSplash(false);
          }}
        />
      </OnboardingProvider>
    );
  }

  // Full-screen Home overlay
  if (showHomeScreen) {
    return (
      <OnboardingProvider
        totalPointsSpent={spentPoints}
        characterName={character.name}
        onForceNavigate={(tab) => { 
          setShowHomeScreen(false); 
          setActiveTab(tab as typeof activeTab); 
        }}
      >
        <PromptDrawerProvider
          character={character}
          unlockedAbilities={unlockedAbilities}
          enabled={true}
          currentXP={currentXP}
          xpPreset={xpPreset}
          onAddXP={handleAddXP}
          equipment={equipment}
        >
          <HomeScreen 
            character={character}
            equipment={equipment}
            achievements={achievements}
            currentXP={currentXP}
            xpPreset={xpPreset}
            onBack={() => setShowWizard(true)}
            onNavigateToTab={(tab) => {
              setShowHomeScreen(false);
              setActiveTab(tab as typeof activeTab);
            }}
            onShortRest={handleShortRest}
            onLongRest={handleLongRest}
            onAddXP={handleAddXP}
            onXPPresetChange={setXPPreset}
            onManualLevelUp={handleManualLevelUp}
            onReturnToBuilder={() => setShowHomeScreen(false)}
            onOpenSettings={() => setShowSettingsModal(true)}
          />
          
          {/* Settings Modal */}
          <SettingsModal 
            characterName={character.name} 
            onEditCharacter={() => setShowWizard(true)}
            open={showSettingsModal}
            onOpenChange={setShowSettingsModal}
            prestigeData={prestigeData}
            onPrestigeRespec={resetPrestigePoints}
          />
        </PromptDrawerProvider>
      </OnboardingProvider>
    );
  }

  return (
    <OnboardingProvider
      totalPointsSpent={spentPoints}
      characterName={character.name}
      onForceNavigate={(tab) => { 
        setShowHomeScreen(false); 
        setActiveTab(tab as typeof activeTab); 
      }}
    >
    <PromptDrawerProvider
      character={character}
      unlockedAbilities={unlockedAbilities}
      enabled={!showLevelUpModal}
      currentXP={currentXP}
      xpPreset={xpPreset}
      onAddXP={handleAddXP}
      equipment={equipment}
    >
      <div className="min-h-screen relative">
      {/* Builder Background Image - fixed behind everything */}
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat -z-10"
        style={{ backgroundImage: `url(${builderBackground})` }}
      />
      {/* 60% transparent tint overlay - allows background to show through UI */}
      <div className="fixed inset-0 bg-background/60 -z-10" />
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

      {/* Prestige Point Spending Modal */}
      <LevelUpModal
        open={showPrestigeSpendModal}
        onClose={() => setShowPrestigeSpendModal(false)}
        character={character}
        newLevel={character.level}
        pointsToSpend={prestigeData.availablePrestigePoints}
        onUpgradeAbility={handleUpgradeAbility}
        onDowngradeAbility={handleDowngradeAbility}
        onConfirmLevelUp={() => setShowPrestigeSpendModal(false)}
        isPrestigeMode={true}
        prestigeLevel={prestigeData.prestigeLevel}
        onSpendPrestigePoint={spendPrestigePoint}
      />

      {/* Prestige Level Up Modal */}
      {prestigeLevelUpData && (
        <PrestigeLevelUpModal
          open={showPrestigeLevelUp}
          prestigeLevel={prestigeLevelUpData.level}
          pointsAwarded={prestigeLevelUpData.points}
          onClose={() => {
            setShowPrestigeLevelUp(false);
            setPrestigeLevelUpData(null);
          }}
        />
      )}

      {/* Character Header - Always visible */}
      <CharacterHeader 
        character={character} 
        currentXP={currentXP} 
        prestigeData={prestigeData}
      />

      {/* Tab Navigation */}
      <Tabs value={activeTab} onValueChange={(v) => {
        // Handle special tabs that trigger actions instead of navigation
        if (v === 'home') {
          setShowHomeScreen(true);
          return;
        }
        setActiveTab(v as 'skills' | 'abilities' | 'gear' | 'feats' | 'stars' | 'scribe' | 'combat' | 'consumables' | 'chronicle' | 'legacy');
      }} className="w-full flex flex-col">
        {/* Assassin's Creed Styled Header Navigation */}
        <AssassinHeader 
          onHomeClick={() => setShowHomeScreen(true)}
          onSettingsClick={() => setShowSettingsModal(true)}
          onCloudSaveClick={() => setShowCloudSaveModal(true)}
          isLegacyUnlocked={prestigeTree.isLegacyUnlocked}
          legacyProgress={prestigeTree.unlockProgress}
        />
        
        {/* Cloud Save Modal */}
        <CloudSaveModal
          open={showCloudSaveModal}
          onOpenChange={setShowCloudSaveModal}
          currentData={saveData}
          onLoadSave={handleLoadCloudSave}
        />
        
        {/* Settings Modal - Controlled */}
        <SettingsModal 
          characterName={character.name} 
          onEditCharacter={() => setShowWizard(true)}
          open={showSettingsModal}
          onOpenChange={setShowSettingsModal}
          prestigeData={prestigeData}
          onPrestigeRespec={resetPrestigePoints}
          character={character}
          abilities={allAbilities}
          unlockedAbilities={unlockedAbilities}
          equippedGear={equipment.slots}
          prestigeLevel={prestigeData.prestigeLevel > 0 ? prestigeData.prestigeLevel : undefined}
          aggregatedStats={{
            totalAC: aggregatedStats.totalAC,
            totalAttackBonus: aggregatedStats.totalAttackBonus,
            damage: aggregatedStats.damage,
            strength: aggregatedStats.strength,
            dexterity: aggregatedStats.dexterity,
            constitution: aggregatedStats.constitution,
            intelligence: aggregatedStats.intelligence,
            wisdom: aggregatedStats.wisdom,
            charisma: aggregatedStats.charisma,
          }}
        />

        {/* Skills Tab Content */}
        <TabsContent value="skills" className="mt-0 pb-4">
          <BackgroundWrapper 
            imagePath={skillsBackgroundImage} 
            overlayOpacity={65} 
            tintColor="purple" 
            tintOpacity={20}
            backgroundSize="contain"
            className="min-h-[calc(100vh-10vh)]"
          >
          {/* Content */}
          <div className="container max-w-2xl mx-auto px-4 py-4 relative z-10">
            {/* Prestige Point Counter - show at max level with prestige points */}
            {isPrestigeActive && prestigeData.totalPrestigePoints > 0 && (
              <PrestigePointCounter
                available={prestigeData.availablePrestigePoints}
                total={prestigeData.totalPrestigePoints}
                spent={prestigeData.spentPrestigePoints}
                className="mb-6"
                onSpendPoints={() => setShowPrestigeSpendModal(true)}
              />
            )}

            {/* XP Tracker */}
            <div className="mb-6 p-4 rounded-lg border border-primary/30 bg-gradient-to-b from-primary/5 to-transparent">
              <XPTracker
                currentLevel={character.level}
                currentXP={currentXP}
                achievements={achievements}
                onAddXP={handleAddXP}
                prestigeData={prestigeData}
                nextPrestigeXPRequired={nextPrestigeXPRequired}
              />
            </div>

            {/* Equipped Loadout */}
            <div className="mb-6 p-4 rounded-lg border border-border/50 bg-card/30">
              <EquippedLoadout
                character={character}
                prestigePoints={prestigeData.totalPrestigePoints}
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
          </BackgroundWrapper>
        </TabsContent>

        {/* Abilities Tab Content */}
        <TabsContent value="abilities" className="mt-0">
          <AbilitiesScreen
            character={character}
            availablePoints={remainingPoints}
            prestigePoints={prestigeData.totalPrestigePoints}
            onUpgradeAbility={handleUpgradeAbility}
            onDowngradeAbility={handleDowngradeAbility}
            onEquipAbility={(id, slot) => {
              setCharacter(prev => {
                const newEquipped = [...prev.equippedAbilities];
                newEquipped[slot] = id;
                return { ...prev, equippedAbilities: newEquipped };
              });
            }}
            onBack={() => setActiveTab('skills')}
          />
        </TabsContent>

        {/* Gear Tab Content */}
        <TabsContent value="gear" className="mt-0">
          <InventoryScreen
            characterName={character.name}
            level={character.level}
            onBack={() => setActiveTab('skills')}
            equipment={equipment}
            onEquipmentChange={setEquipment}
            achievements={achievements}
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
            achievements={achievements}
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
          <CombatTabScreen character={character} prestigePoints={prestigeData.totalPrestigePoints} />
        </TabsContent>

        {/* Consumables Tab Content */}
        <TabsContent value="consumables" className="mt-0">
          <BackgroundWrapper 
            imagePath={builderBackground} 
            overlayOpacity={70} 
            tintColor="green" 
            tintOpacity={15}
            className="min-h-[calc(100vh-10vh)]"
          >
            <div className="container max-w-4xl mx-auto px-4 py-6">
              <div className="flex items-center justify-between mb-6">
                <h1 className="font-cinzel text-2xl text-foreground">
                  Consumables Inventory
                </h1>
                <AddConsumableDrawer 
                  onAddItem={addConsumableItem}
                  getItemCount={getConsumableCount}
                />
              </div>
              <ConsumablesInventoryWidget 
                inventory={consumablesInventory}
                characterName={character.name}
                onUseItem={(id) => useConsumableItem(id)}
                onAdjustQuantity={(id, delta) => {
                  const currentQty = getConsumableCount(id);
                  setConsumableQuantity(id, currentQty + delta);
                }}
              />
            </div>
          </BackgroundWrapper>
        </TabsContent>

        {/* Chronicle Tab Content */}
        <TabsContent value="chronicle" className="mt-0">
          <ChronicleSyncScreen
            characterName={character.name}
            characterLevel={character.level}
            onApplyChanges={handleApplyChronicleChanges}
            onBack={() => setActiveTab('skills')}
          />
        </TabsContent>

        {/* Legacy Tab Content - Drizzt's Legacy Prestige Tree */}
        <TabsContent value="legacy" className="mt-0">
          <PrestigeTreeScreen
            prestigeTree={prestigeTree}
            prestigeLevel={prestigeData.prestigeLevel}
            onPrestigePointSpent={(cost) => {
              // Deduct from main prestige point pool
              for (let i = 0; i < cost; i++) {
                spendPrestigePoint();
              }
            }}
          />
        </TabsContent>
      </Tabs>

      {/* Floating Action Wheel - visible on skills/feats tabs */}
      {(activeTab === 'skills' || activeTab === 'feats') && (
        <ActionWheelButton characterName={character.name} characterLevel={character.level} />
      )}
      </div>
    </PromptDrawerProvider>
    </OnboardingProvider>
  );
};

export default Index;
