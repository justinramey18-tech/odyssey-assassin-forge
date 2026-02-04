import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
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
import { InventoryScreen } from '@/components/inventory/InventoryScreen';
import { AchievementsScreen } from '@/components/achievements/AchievementsScreen';
import { ConstellationScreen } from '@/components/constellation/ConstellationScreen';
import { HomeScreen } from '@/components/home/HomeScreen';
import { IntroSplashScreen } from '@/components/home/IntroSplashScreen';
import { NarrativeForgeScreen } from '@/components/scribe/NarrativeForgeScreen';
import { ChronicleSyncScreen } from '@/components/chronicle';
import { PromptDrawerProvider } from '@/components/drawers';

import { AbilitiesScreen } from '@/components/abilities';
import { ChevronUp, Lock } from 'lucide-react';
import skillsBackgroundImage from '@/assets/skills-background-deadpool.jpg';
import builderBackground from '@/assets/builder-background.jpg';
import { SettingsModal } from '@/components/settings/SettingsModal';
import { CloudSaveModal } from '@/components/settings/CloudSaveModal';
import { AssassinHeader, SubTabStrip, MainCategory, getTabToCategoryMapping } from '@/components/navigation';
import { CombatTabScreen } from '@/components/combat/CombatTabScreen';
import { convertConditionsToPromptFormat } from '@/lib/combat/promptContext';
import { BackgroundWrapper } from '@/components/ui/BackgroundWrapper';
import { useCategoryNavigation } from '@/hooks/use-category-navigation';
import { useToast } from '@/hooks/use-toast';
import { useGameMode } from '@/hooks/use-game-mode';
import { usePrestige } from '@/hooks/use-prestige';
import { useEquipmentStats } from '@/hooks/use-equipment-stats';
import { useAbilityScores } from '@/hooks/use-ability-scores';
import { useAutoSave, loadAutoSave, SaveData, serializeConsumables } from '@/hooks/use-auto-save';
import { useConsumables } from '@/hooks/use-consumables';
import { ConsumablesInventoryWidget, AddConsumableDrawer } from '@/components/consumables';
import { getConsumableById } from '@/lib/consumables';
import { ApprovedChanges } from '@/lib/chronicleSync/types';
import { PrestigeTreeScreen } from '@/components/prestigeTree';
import { usePrestigeTree } from '@/hooks/use-prestige-tree';
import { getPrestigeAbilityById } from '@/lib/prestigeTree/abilities';
import { resetAllAppData, repairXPData } from '@/lib/resetApp';
import { calculateMaxHP } from '@/lib/hpCalculation';
import { scoreToModifier } from '@/lib/abilityScores/types';
import { 
  CharacterEquipment, 
  EquipmentItem,
  createInitialEquipment,
} from '@/lib/inventory/index';
import { MagicScreen } from '@/components/magic';
import { ShopScreen } from '@/components/shop';
import { useShop } from '@/hooks/use-shop';
import { ParsedShopItem } from '@/lib/shop/types';
import { useSpellcasting } from '@/hooks/use-spellcasting';
import { Consumable } from '@/lib/consumables/types';
import { EquipmentItem as ShopEquipmentItem } from '@/lib/inventory/types';
import { useCustomBackground } from '@/hooks/use-custom-background';
import { useActionEconomy } from '@/hooks/use-action-economy';
import { useConditions } from '@/hooks/use-conditions';
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
  const [settingsInitialTab, setSettingsInitialTab] = useState<'game' | 'setup' | 'faq' | 'character' | 'tools' | undefined>(undefined);
  const [showCloudSaveModal, setShowCloudSaveModal] = useState(false);
  const [character, setCharacter] = useState<Character>({
    name: '',
    level: 1,
    abilities: allAbilities.map(a => ({ abilityId: a.id, currentTier: 0 as const })),
    equippedAbilities: [],
  });
  
  // XP System State
  const [currentXP, setCurrentXP] = useState(0);
  const [xpPreset, setXPPreset] = useState<XPPreset>('standard');
  
  // Prestige System State - simplified (no separate spending/respec)
  const { 
    prestigeData, 
    isMaxLevel, 
    isPrestigeActive,
    nextPrestigeXPRequired,
    awardPrestigeXP,
    setPrestigeData,
  } = usePrestige(character.level);
  
  // Calculate unified ability points
  const totalAbilityPoints = useMemo(() => {
    const basePoints = getAbilityPointsForLevel(character.level);
    const prestigePoints = prestigeData.totalPrestigePoints;
    return basePoints + prestigePoints;
  }, [character.level, prestigeData.totalPrestigePoints]);
  
  // Track prestige tree spending with reactive state (initialized from localStorage)
  const [prestigeTreeSpentState, setPrestigeTreeSpentState] = useState(() => {
    const stored = localStorage.getItem('odyssey-prestige-tree');
    if (stored) {
      try {
        const progress = JSON.parse(stored);
        return (progress.unlockedAbilities || []).reduce((sum: number, abilityId: string) => {
          const ability = getPrestigeAbilityById(abilityId);
          return sum + (ability?.prestigeCost ?? 0);
        }, 0);
      } catch { return 0; }
    }
    return 0;
  });

  // Callback to update spent state when prestige tree points are spent
  const handlePrestigeTreePointsSpent = useCallback((cost: number) => {
    setPrestigeTreeSpentState(prev => prev + cost);
  }, []);

  // Calculate total spent points (base + prestige tree)
  const spentAbilityPoints = useMemo(() => {
    const baseSpent = getTotalPointsSpent(character.abilities);
    return baseSpent + prestigeTreeSpentState;
  }, [character.abilities, prestigeTreeSpentState]);

  // Available points with guard clause to prevent negative values
  const availableAbilityPoints = Math.max(0, totalAbilityPoints - spentAbilityPoints);
  
  // Single prestige tree hook instance with callback connected
  const prestigeTree = usePrestigeTree(
    character.abilities, 
    prestigeData, 
    availableAbilityPoints,
    handlePrestigeTreePointsSpent,
    character.level
  );
  
  // Category navigation system
  const categoryNav = useCategoryNavigation({
    isLegacyUnlocked: prestigeTree.isLegacyUnlocked,
    onSettingsClick: () => setShowSettingsModal(true),
    onCloudClick: () => setShowCloudSaveModal(true),
  });
  
  // Derived active tab for backward compatibility
  const activeTab = categoryNav.activeSubTab as 'skills' | 'abilities' | 'gear' | 'feats' | 'stars' | 'scribe' | 'combat' | 'consumables' | 'chronicle' | 'legacy' | 'arcana' | 'shop';
  
  // Handler to navigate to consumables tab from combat items
  const handleNavigateToConsumables = useCallback(() => {
    categoryNav.navigateToSubTab('consumables', 'inventory');
  }, [categoryNav]);
  
  // Spellcasting system - moved after abilityScores for dependency
  // (see definition after abilityScores below)
  
  // Shop system
  const shop = useShop();
  
  // Custom home background
  const customBackground = useCustomBackground();
  
  // Action economy (combat turn tracking with persistence)
  const actionEconomy = useActionEconomy();
  
  // Shared equipment state for constellation view
  const [equipment, setEquipment] = useState<CharacterEquipment>(() => createInitialEquipment());
  
  // HP State Management (persisted to localStorage)
  // Note: max HP is now calculated dynamically, but we still store it for persistence
  const [hpState, setHpState] = useState<{ current: number; max: number; temp: number }>(() => {
    const stored = localStorage.getItem('odyssey-hp-state');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return parsed;
      } catch {
        return { current: 8, max: 8, temp: 0 };
      }
    }
    return { current: 8, max: 8, temp: 0 };
  });

  // Death Saves State (persisted to localStorage)
  const [deathSaves, setDeathSaves] = useState<{ successes: number; failures: number }>(() => {
    const stored = localStorage.getItem('odyssey-death-saves');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return { successes: 0, failures: 0 };
      }
    }
    return { successes: 0, failures: 0 };
  });

  // HP change handler with localStorage persistence
  const handleHPChange = useCallback((current: number, max: number, temp: number) => {
    const newState = { current, max, temp };
    setHpState(newState);
    localStorage.setItem('odyssey-hp-state', JSON.stringify(newState));
    
    // Reset death saves when regaining HP from 0
    if (current > 0 && deathSaves.successes + deathSaves.failures > 0) {
      setDeathSaves({ successes: 0, failures: 0 });
      localStorage.setItem('odyssey-death-saves', JSON.stringify({ successes: 0, failures: 0 }));
    }
  }, [deathSaves]);

  // Death saves change handler with localStorage persistence
  const handleDeathSavesChange = useCallback((saves: { successes: number; failures: number }) => {
    setDeathSaves(saves);
    localStorage.setItem('odyssey-death-saves', JSON.stringify(saves));
  }, []);

  // Aggregated equipment stats for GM guide
  const aggregatedStats = useEquipmentStats(equipment);
  
  // Ability Scores system (centralized stat management with gear sync)
  const abilityScores = useAbilityScores({
    equipmentStats: aggregatedStats,
  });
  
  // Calculate max HP dynamically based on level, constitution, and prestige
  const calculatedMaxHP = useMemo(() => {
    const conMod = scoreToModifier(abilityScores.finalScores.constitution);
    return calculateMaxHP(character.level, conMod, prestigeData.prestigeLevel);
  }, [character.level, abilityScores.finalScores.constitution, prestigeData.prestigeLevel]);
  
  // Spellcasting system (uses ability scores for auto-calculation)
  const spellcasting = useSpellcasting(character.level, character.name, {
    abilityScores: {
      intelligence: abilityScores.finalScores.intelligence,
      wisdom: abilityScores.finalScores.wisdom,
      charisma: abilityScores.finalScores.charisma,
    },
  });
  
  // Conditions system with concentration sync to spellcasting
  // Using a ref pattern to avoid stale closure issues
  const spellcastingRef = useRef(spellcasting);
  spellcastingRef.current = spellcasting;
  
  const conditions = useConditions({
    onConcentrationBroken: useCallback((_spellName: string, _reason?: string) => {
      // Sync with spellcasting's concentration state
      spellcastingRef.current.breakConcentration();
    }, []),
  });
  
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
  
  // Auto-update max HP when calculation changes (level up, CON change, prestige)
  useEffect(() => {
    if (calculatedMaxHP !== hpState.max) {
      const hpDiff = calculatedMaxHP - hpState.max;
      // When max HP increases, also increase current HP by the same amount
      // (e.g., leveling up should give you more HP immediately)
      const newCurrent = hpDiff > 0 
        ? Math.min(calculatedMaxHP, hpState.current + hpDiff)
        : Math.min(calculatedMaxHP, hpState.current); // Cap at new max if it decreased
      
      const newState = { 
        current: newCurrent, 
        max: calculatedMaxHP, 
        temp: hpState.temp 
      };
      setHpState(newState);
      localStorage.setItem('odyssey-hp-state', JSON.stringify(newState));
      
      // Show toast for significant changes (not on initial load)
      if (hpState.max > 8 && hpDiff !== 0) {
        toast({
          title: hpDiff > 0 ? "❤️ Max HP Increased!" : "💔 Max HP Decreased",
          description: `Max HP: ${hpState.max} → ${calculatedMaxHP} (${hpDiff > 0 ? '+' : ''}${hpDiff})`,
          className: hpDiff > 0 ? "border-emerald-500 bg-emerald-500/10" : "border-rose-500 bg-rose-500/10",
        });
      }
    }
  }, [calculatedMaxHP, hpState.max, hpState.current, hpState.temp, toast]);

  // Legacy spentPoints for compatibility
  const spentPoints = getTotalPointsSpent(character.abilities);

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
    },
    abilityScores: abilityScores.baseScores,
  }), [character, equipment, achievements, consumablesInventory, currentXP, xpPreset, prestigeData, abilityScores.baseScores]);

  // Auto-save (only when not in wizard)
  useAutoSave(saveData, !showWizard);

  // Load auto-save on mount with XP repair
  useEffect(() => {
    const saved = loadAutoSave();
    if (saved && saved.character.name) {
      setCharacter(saved.character);
      setEquipment(saved.equipment);
      setAchievements(saved.achievements);
      
      // Repair XP if corrupted (below minimum for level)
      const multiplier = XP_PRESETS[saved.xp.xpPreset as XPPreset]?.multiplier ?? 1.0;
      const repairedXP = repairXPData(saved.character.level, saved.xp.currentXP, multiplier);
      setCurrentXP(repairedXP);
      
      setXPPreset(saved.xp.xpPreset as XPPreset);
      setShowWizard(false);
      console.log('[AutoSave] Loaded character:', saved.character.name, repairedXP !== saved.xp.currentXP ? '(XP repaired)' : '');
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

  const handleBasicInfoComplete = (name: string, level: number, constitution: number) => {
    setCharacter(prev => ({
      ...prev,
      name,
      level,
    }));
    // Set XP to match level
    const xpForLevel = getXPForLevel(level, XP_PRESETS[xpPreset].multiplier);
    setCurrentXP(xpForLevel);
    
    // Apply the constitution score from wizard
    abilityScores.applyScores({
      ...abilityScores.baseScores,
      constitution,
    });
    
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
        // Toast instead of modal
        toast({
          title: "🌟 Prestige Level Up!",
          description: `Reached Prestige Level ${result.newLevel}. +${result.pointsAwarded} Ability Point${result.pointsAwarded && result.pointsAwarded > 1 ? 's' : ''} earned.`,
          className: "border-amber-500 bg-amber-500/10",
        });
        
        // Milestone toast every 10 levels
        if (result.newLevel && result.newLevel % 10 === 0) {
          toast({
            title: `🏆 Prestige Milestone: Level ${result.newLevel}!`,
            description: "You are becoming a legend...",
            className: "border-purple-500 bg-purple-500/10",
          });
        }
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
    
    // Check for level ups - auto-level immediately (no modal)
    const levelsToGain = calculatePendingLevelUps(character.level, newXP, multiplier);
    
    if (levelsToGain > 0) {
      const newLevel = character.level + levelsToGain;
      const xpAfterLevelUp = newXP - getXPForLevel(newLevel - 1, multiplier);
      
      // Auto-equip newly unlocked abilities
      const unlockedActiveAbilities = character.abilities
        .filter(ca => {
          const ability = allAbilities.find(a => a.id === ca.abilityId);
          return ca.currentTier > 0 && ability?.type === 'active';
        })
        .map(ca => ca.abilityId);
      
      const maxSlots = getActiveSlotsByLevel(newLevel, prestigeData.totalPrestigePoints);
      
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
          level: newLevel,
          equippedAbilities: newEquipped.filter(Boolean),
        };
      });
      
      setCurrentXP(Math.max(0, xpAfterLevelUp));
      
      toast({
        title: "⚡ Level Up!",
        description: `${character.name} is now Level ${newLevel}!`,
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
    // Simple unified check
    if (availableAbilityPoints <= 0) {
      toast({
        title: "No Points Available",
        description: "Level up or earn prestige levels to get more ability points.",
        variant: "destructive",
      });
      return;
    }

    // Check ability-specific requirements
    const ability = allAbilities.find(a => a.id === abilityId);
    if (!ability) return;

    const currentTier = character.abilities.find(ca => ca.abilityId === abilityId)?.currentTier ?? 0;
    if (currentTier >= 3) return;

    // Check prerequisite
    if (ability.prerequisite) {
      const prereqTier = character.abilities.find(
        ca => ca.abilityId === ability.prerequisite!.abilityId
      )?.currentTier ?? 0;
      if (prereqTier < ability.prerequisite.tier) {
        toast({
          title: "Prerequisite Not Met",
          description: `Requires ${ability.prerequisite.abilityId} at tier ${ability.prerequisite.tier}`,
          variant: "destructive",
        });
        return;
      }
    }

    // Perform upgrade
    setCharacter(prev => ({
      ...prev,
      abilities: prev.abilities.map(ca =>
        ca.abilityId === abilityId && ca.currentTier < 3
          ? { ...ca, currentTier: (ca.currentTier + 1) as 0 | 1 | 2 | 3 }
          : ca
      ),
    }));

    toast({
      title: "✨ Ability Upgraded",
      description: `${ability.name} upgraded to tier ${currentTier + 1}`,
      duration: 2000,
    });
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
    // Short rest restores 25% of max HP (rounded up), capped at max
    const healAmount = Math.ceil(hpState.max * 0.25);
    const newCurrentHP = Math.min(hpState.max, hpState.current + healAmount);
    const actualHealed = newCurrentHP - hpState.current;
    
    setHpState(prev => ({ ...prev, current: newCurrentHP }));
    
    // Reset action economy (combat would have ended for short rest)
    actionEconomy.onShortRest();
    
    // Clear short-rest conditions
    conditions.shortRest();
    
    // Restore pact slots
    spellcasting.onShortRest();
    
    toast({
      title: "☕ Short Rest Complete",
      description: actualHealed > 0 
        ? `You've rested for 1 hour. Restored ${actualHealed} HP. Some abilities refreshed.`
        : "You've rested for 1 hour. HP already full. Some abilities refreshed.",
      className: "border-amber-500/30 bg-amber-500/10",
    });
  };

  const handleLongRest = () => {
    // Long rest fully restores HP and clears temp HP
    const wasFullHP = hpState.current === hpState.max;
    
    setHpState(prev => ({ 
      ...prev, 
      current: prev.max,
      temp: 0 // Temp HP doesn't persist through long rest
    }));
    
    // Reset action economy
    actionEconomy.onLongRest();
    
    // Clear long-rest conditions
    conditions.longRest();
    
    // Restore all spell slots
    spellcasting.onLongRest();
    
    toast({
      title: "🌙 Long Rest Complete", 
      description: wasFullHP
        ? "You've rested for 8 hours. All abilities restored."
        : `You've rested for 8 hours. HP fully restored to ${hpState.max}. All abilities refreshed.`,
      className: "border-indigo-500/30 bg-indigo-500/10",
    });
  };

  // Chronicle auto-apply handlers
  const handleChronicleGold = useCallback((netChange: number) => {
    shop.addGold(netChange);
    toast({
      title: netChange > 0 ? "💰 Gold Added" : "💸 Gold Spent",
      description: `${netChange > 0 ? '+' : ''}${netChange} GP applied from session log.`,
      className: "border-yellow-500/30 bg-yellow-500/10",
    });
  }, [shop, toast]);

  const handleChronicleHP = useCallback((change: number, type: 'damage' | 'healing') => {
    const newHP = type === 'damage' 
      ? Math.max(0, hpState.current + change) 
      : Math.min(hpState.max, hpState.current + change);
    handleHPChange(newHP, hpState.max, hpState.temp);
    toast({
      title: type === 'damage' ? "💔 Damage Applied" : "💚 Healing Applied",
      description: `${Math.abs(change)} HP ${type === 'damage' ? 'damage taken' : 'restored'}.`,
    });
  }, [hpState, handleHPChange, toast]);

  const handleChronicleConditions = useCallback((toAdd: string[], toRemove: string[]) => {
    // Conditions are currently display-only, just show toast
    if (toAdd.length > 0 || toRemove.length > 0) {
      toast({
        title: "⚡ Conditions Updated",
        description: `Added: ${toAdd.join(', ') || 'none'} | Removed: ${toRemove.join(', ') || 'none'}`,
      });
    }
  }, [toast]);

  const handleChronicleRest = useCallback((type: 'short' | 'long') => {
    if (type === 'long') {
      handleLongRest();
    } else {
      handleShortRest();
    }
  }, [handleShortRest, handleLongRest]);

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

    // Apply gold changes
    if (changes.gold && changes.gold.length > 0) {
      changes.gold.forEach(goldChange => {
        if (goldChange.action === 'gained') {
          shop.addGold(goldChange.amount);
        } else {
          shop.spendGold(goldChange.amount);
        }
      });
      const netGold = changes.gold.reduce((sum, g) => 
        sum + (g.action === 'gained' ? g.amount : -g.amount), 0
      );
      if (netGold !== 0) {
        toast({
          title: netGold > 0 ? "💰 Gold Gained!" : "💸 Gold Spent",
          description: `${netGold > 0 ? '+' : ''}${netGold} GP`,
          className: "border-amber-500 bg-amber-500/10",
        });
      }
    }

    // Apply shop items
    if (changes.shopItems && changes.shopItems.length > 0) {
      shop.addShopItems(changes.shopItems);
      toast({
        title: "🏪 Shop Updated!",
        description: `${changes.shopItems.length} item(s) added to shop.`,
        className: "border-yellow-500 bg-yellow-500/10",
      });
    }

    // Level-up from chronicle - auto-level (no modal)
    if (changes.levelUp && changes.levelUp.newLevel > character.level) {
      const newLevel = changes.levelUp.newLevel;
      setCharacter(prev => ({
        ...prev,
        level: newLevel,
      }));
      
      toast({
        title: "⚡ Level Up!",
        description: `${character.name} is now Level ${newLevel}!`,
        className: "border-primary bg-primary/10",
      });
    }

    toast({
      title: "Chronicle Sync Complete!",
      description: `Applied ${changes.totalApplied} changes successfully.`,
      className: "border-blue-500 bg-blue-500/10",
    });
  };

  // Handle shop purchases - routes items to correct inventory
  const handleShopPurchase = useCallback((itemId: string) => {
    const result = shop.purchaseItem(itemId);
    
    if (!result.success) {
      toast({
        title: "Purchase Failed",
        description: result.error,
        variant: "destructive",
      });
      return result;
    }
    
    // Route converted item to appropriate inventory
    if (result.destinationType === 'consumable' && result.convertedItem) {
      addConsumableItem(result.convertedItem as Consumable, 1);
      toast({
        title: "Item Purchased!",
        description: `${result.itemName} added to Consumables. Remaining: ${result.remainingGold} GP`,
        className: "border-yellow-500 bg-yellow-500/10",
      });
    } else if (result.destinationType === 'equipment' && result.convertedItem) {
      setEquipment(prev => ({
        ...prev,
        inventory: [...prev.inventory, result.convertedItem as ShopEquipmentItem],
      }));
      toast({
        title: "Item Purchased!",
        description: `${result.itemName} added to Gear inventory. Remaining: ${result.remainingGold} GP`,
        className: "border-yellow-500 bg-yellow-500/10",
      });
    } else {
      // Miscellaneous - just show success
      toast({
        title: "Item Purchased!",
        description: `Acquired item. Remaining: ${result.remainingGold} GP`,
      });
    }
    
    return result;
  }, [shop, addConsumableItem, setEquipment, toast]);

  // Manual level up trigger (for milestone mode or testing)
  const handleManualLevelUp = () => {
    if (character.level >= 20) return;
    
    const newLevel = character.level + 1;
    
    setCharacter(prev => ({
      ...prev,
      level: newLevel,
    }));
    
    toast({
      title: "⚡ Level Up!",
      description: `${character.name} is now Level ${newLevel}!`,
      className: "border-primary bg-primary/10",
    });
  };

  // App Reset Handler - clears all state and localStorage
  const handleResetApp = () => {
    try {
      // 1. Reset all React state FIRST (prevents hooks reading stale data)
      
      // Reset character to default
      setCharacter({
        name: '',
        level: 1,
        abilities: allAbilities.map(a => ({ abilityId: a.id, currentTier: 0 as const })),
        equippedAbilities: [],
      });

      // Reset XP
      setCurrentXP(0);
      setXPPreset('standard');

      // Reset equipment (factory returns new object each call)
      setEquipment(createInitialEquipment());

      // Reset achievements (shallow copy is sufficient)
      setAchievements(achievementCategories.map(a => ({ ...a })));

      // Reset prestige data
      setPrestigeData({
        prestigeLevel: 0,
        prestigeXP: 0,
        totalPrestigePoints: 0,
      });

      // Reset Legacy (Prestige Tree) via hook and state
      setPrestigeTreeSpentState(0);
      prestigeTree.resetTree();

      // Reset HP to level 1 defaults
      const defaultHP = { current: 8, max: 8, temp: 0 };
      setHpState(defaultHP);
      localStorage.removeItem('odyssey-hp-state');

      // Reset Shop
      shop.resetShop();

      // 2. Reset UI state
      categoryNav.navigateToSubTab('skills');
      setShowHomeScreen(false);
      setShowWizard(true);

      // 3. Clear all localStorage (after state reset to prevent race conditions)
      resetAllAppData();
      
      // Also clear prestige tree localStorage explicitly
      localStorage.removeItem('odyssey-prestige-tree');
      
      // Ensure intro splash flag is also cleared for true first-launch experience
      localStorage.removeItem('odyssey-intro-seen');

      // 4. Success feedback
      toast({
        title: "🔄 App Reset Complete",
        description: "All data cleared. Create a new character to begin.",
        className: "border-blue-500 bg-blue-500/10",
        duration: 4000,
      });

    } catch (error) {
      console.error('[AppReset] Reset failed:', error);
      toast({
        title: "Reset Failed",
        description: "An error occurred. Please refresh the page and try again.",
        variant: "destructive",
      });
    }
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

  // Intro splash screen - shows once
  if (showHomeScreen && showIntroSplash) {
    return (
      <IntroSplashScreen 
        onBegin={() => {
          localStorage.setItem('odyssey-intro-seen', 'true');
          setShowIntroSplash(false);
        }}
      />
    );
  }

  // Full-screen Home overlay
  if (showHomeScreen) {
    return (
      <PromptDrawerProvider
        character={character}
        unlockedAbilities={unlockedAbilities}
        enabled={true}
        currentXP={currentXP}
        xpPreset={xpPreset}
        onAddXP={handleAddXP}
        equipment={equipment}
        currentHP={hpState.current}
        maxHP={hpState.max}
        tempHP={hpState.temp}
        onHPChange={(current, temp) => handleHPChange(current, hpState.max, temp)}
        consumables={consumablesInventory}
        prestigeLevel={prestigeData.prestigeLevel}
        prestigeAbilities={prestigeTree.progress.unlockedAbilities}
        spellcasting={spellcasting}
        baseScores={abilityScores.baseScores}
        getScoreBreakdown={abilityScores.getScoreBreakdown}
        onIncrementScore={abilityScores.incrementScore}
        onDecrementScore={abilityScores.decrementScore}
        onRandomizeScores={abilityScores.randomizeScores}
        onApplyScores={abilityScores.applyScores}
        constitutionModifier={abilityScores.finalModifiers.constitution}
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
            const mapping = getTabToCategoryMapping(tab as any);
            categoryNav.setMainCategory(mapping.category);
            categoryNav.navigateToSubTab(mapping.subTab);
          }}
          onShortRest={handleShortRest}
          onLongRest={handleLongRest}
          onAddXP={handleAddXP}
          onXPPresetChange={setXPPreset}
          onManualLevelUp={handleManualLevelUp}
          onReturnToBuilder={() => setShowHomeScreen(false)}
          onOpenSettings={() => {
            setSettingsInitialTab(undefined);
            setShowSettingsModal(true);
          }}
          onOpenFAQ={() => {
            setSettingsInitialTab('faq');
            setShowSettingsModal(true);
          }}
          currentHP={hpState.current}
          maxHP={hpState.max}
          tempHP={hpState.temp}
          shopItems={shop.shopItems}
          initiativeModifier={abilityScores.finalModifiers.dexterity}
          customBackground={customBackground.customBackground}
          onCustomBackgroundUpload={customBackground.handleImageUpload}
          onCustomBackgroundClear={customBackground.clearCustomBackground}
          prestigeData={prestigeData}
        />
        
        {/* Settings Modal */}
        <SettingsModal 
          characterName={character.name} 
          onEditCharacter={() => setShowWizard(true)}
          open={showSettingsModal}
          onOpenChange={(open) => {
            setShowSettingsModal(open);
            if (!open) setSettingsInitialTab(undefined);
          }}
          initialTab={settingsInitialTab}
          prestigeData={{
            totalPrestigePoints: prestigeData.totalPrestigePoints,
            prestigeLevel: prestigeData.prestigeLevel,
          }}
          onResetComplete={handleResetApp}
        />
      </PromptDrawerProvider>
    );
  }

  return (
    <PromptDrawerProvider
      character={character}
      unlockedAbilities={unlockedAbilities}
      enabled={true}
      currentXP={currentXP}
      xpPreset={xpPreset}
      onAddXP={handleAddXP}
      equipment={equipment}
      currentHP={hpState.current}
      maxHP={hpState.max}
      tempHP={hpState.temp}
      onHPChange={(current, temp) => handleHPChange(current, hpState.max, temp)}
      consumables={consumablesInventory}
      prestigeLevel={prestigeData.prestigeLevel}
      prestigeAbilities={prestigeTree.progress.unlockedAbilities}
      spellcasting={spellcasting}
      baseScores={abilityScores.baseScores}
      getScoreBreakdown={abilityScores.getScoreBreakdown}
      onIncrementScore={abilityScores.incrementScore}
      onDecrementScore={abilityScores.decrementScore}
      onRandomizeScores={abilityScores.randomizeScores}
      onApplyScores={abilityScores.applyScores}
      constitutionModifier={abilityScores.finalModifiers.constitution}
    >
      <div className="min-h-screen relative">
      {/* Builder Background Image - fixed behind everything */}
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat -z-10"
        style={{ backgroundImage: `url(${builderBackground})` }}
      />
      {/* 60% transparent tint overlay - allows background to show through UI */}
      <div className="fixed inset-0 bg-background/60 -z-10" />

      {/* Character Header - Always visible */}
      <CharacterHeader 
        character={character} 
        currentXP={currentXP} 
        prestigeData={prestigeData}
        availableAbilityPoints={availableAbilityPoints}
        currentHP={hpState.current}
        maxHP={hpState.max}
        tempHP={hpState.temp}
        deathSaves={deathSaves}
        onHPChange={handleHPChange}
        onDeathSavesChange={handleDeathSavesChange}
      />

      {/* Category-based Navigation */}
      <div className="w-full flex flex-col">
        {/* Assassin's Creed Styled Header Navigation - 4 Main Tabs with Dropdowns */}
        <AssassinHeader 
          onHomeClick={() => setShowHomeScreen(true)}
          activeCategory={categoryNav.mainCategory}
          activeSubTab={categoryNav.activeSubTab}
          onCategoryChange={(category) => {
            if (category === 'home') {
              setShowHomeScreen(true);
            } else {
              categoryNav.setMainCategory(category);
            }
          }}
          onSubTabChange={categoryNav.navigateToSubTab}
          isLegacyUnlocked={prestigeTree.isLegacyUnlocked}
        />

        {/* Content Area - Conditional Rendering Based on Active Sub-Tab */}
        <div className="flex-1">
          {/* FIGHTING CATEGORY */}
          {/* Combat Sub-Tab */}
          {activeTab === 'combat' && (
            <CombatTabScreen 
              character={character} 
              prestigePoints={prestigeData.totalPrestigePoints}
              spellcasting={spellcasting}
              equipment={equipment}
              onNavigateToConsumables={handleNavigateToConsumables}
              equipmentStats={aggregatedStats}
              abilityModifiers={abilityScores.finalModifiers}
              currentHP={hpState.current}
              maxHP={hpState.max}
              tempHP={hpState.temp}
              actionEconomyState={actionEconomy}
              globalConditions={convertConditionsToPromptFormat(conditions.conditions)}
            />
          )}

          {/* Skills Sub-Tab */}
          {activeTab === 'skills' && (
            <BackgroundWrapper 
              imagePath={skillsBackgroundImage} 
              overlayOpacity={65} 
              tintColor="purple" 
              tintOpacity={20}
              backgroundSize="contain"
              className="min-h-[calc(100vh-10vh)]"
            >
              <div className="container max-w-2xl mx-auto px-4 py-4 relative z-10">
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

                {/* Info about ability spending */}
                <div className="mt-6 p-4 rounded-lg bg-muted/20 border border-muted/30">
                  <p className="text-xs text-muted-foreground text-center font-body">
                    💡 Go to the <strong>Abilities</strong> tab to spend your {availableAbilityPoints} available ability points.
                    {requiresOrganicLevelUp 
                      ? ' In Honest Mode, levels are gained organically through XP.'
                      : ' Add XP to level up, or use the button above for milestone progression.'}
                  </p>
                </div>
              </div>
            </BackgroundWrapper>
          )}

          {/* Abilities Sub-Tab */}
          {activeTab === 'abilities' && (
            <AbilitiesScreen
              character={character}
              availablePoints={availableAbilityPoints}
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
              onBack={() => categoryNav.navigateToSubTab('combat')}
            />
          )}

          {/* Arcana Sub-Tab */}
          {activeTab === 'arcana' && (
            <BackgroundWrapper 
              imagePath={builderBackground} 
              overlayOpacity={70} 
              tintColor="indigo" 
              tintOpacity={15}
              className="min-h-[calc(100vh-10vh)]"
            >
              <MagicScreen
                characterLevel={character.level}
                characterName={character.name}
                spellcasting={spellcasting}
                conModifier={abilityScores.getScoreBreakdown('constitution').modifier}
                proficiencyBonus={spellcasting.state.proficiencyBonus}
                isProficientInConSaves={false}
              />
            </BackgroundWrapper>
          )}

          {/* Legacy Sub-Tab - Drizzt's Legacy Prestige Tree */}
          {activeTab === 'legacy' && (
            <PrestigeTreeScreen
              prestigeTree={prestigeTree}
              prestigeLevel={prestigeData.prestigeLevel}
              availableAbilityPoints={availableAbilityPoints}
            />
          )}

          {/* INVENTORY CATEGORY */}
          {/* Consumables Sub-Tab */}
          {activeTab === 'consumables' && (
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
          )}

          {/* Shop Sub-Tab */}
          {activeTab === 'shop' && (
            <ShopScreen
              currentGold={shop.currentGold}
              shopItems={shop.shopItems}
              purchaseHistory={shop.purchaseHistory}
              onPurchase={handleShopPurchase}
              onRemoveItem={shop.removeShopItem}
              onAddItem={(item) => shop.addShopItems([item])}
              onAdjustGold={shop.addGold}
              onSetGold={shop.setGold}
              onClearShop={shop.clearShop}
            />
          )}

          {/* Gear Sub-Tab */}
          {activeTab === 'gear' && (
            <InventoryScreen
              characterName={character.name}
              level={character.level}
              equipment={equipment}
              onEquipmentChange={setEquipment}
              achievements={achievements}
            />
          )}

          {/* Stars Sub-Tab */}
          {activeTab === 'stars' && (
            <ConstellationScreen
              characterName={character.name}
              equippedItems={Object.values(equipment.slots).filter(Boolean) as EquipmentItem[]}
              achievements={achievements}
            />
          )}

          {/* Feats Sub-Tab */}
          {activeTab === 'feats' && (
            <AchievementsScreen
              characterName={character.name}
              achievements={achievements}
              onAchievementsChange={setAchievements}
              onAwardXP={handleAddXP}
            />
          )}

          {/* UTILITY CATEGORY */}
          {/* Scribe Sub-Tab */}
          {activeTab === 'scribe' && (
            <NarrativeForgeScreen
              characterName={character.name}
              onBack={() => categoryNav.navigateToSubTab('scribe')}
            />
          )}

          {/* Chronicle Sub-Tab */}
          {activeTab === 'chronicle' && (
            <ChronicleSyncScreen
              characterName={character.name}
              characterLevel={character.level}
              currentGold={shop.currentGold}
              currentHP={hpState.current}
              maxHP={hpState.max}
              activeConditions={[]}
              onApplyChanges={handleApplyChronicleChanges}
              onApplyGold={handleChronicleGold}
              onApplyHP={handleChronicleHP}
              onApplyConditions={handleChronicleConditions}
              onApplyRest={handleChronicleRest}
              onBack={() => categoryNav.navigateToSubTab('scribe')}
            />
          )}
        </div>

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
          onOpenChange={(open) => {
            setShowSettingsModal(open);
            if (!open) setSettingsInitialTab(undefined);
          }}
          initialTab={settingsInitialTab}
          prestigeData={{
            totalPrestigePoints: prestigeData.totalPrestigePoints,
            prestigeLevel: prestigeData.prestigeLevel,
          }}
          onResetComplete={handleResetApp}
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
      </div>

      {/* Floating Action Wheel - visible on skills/feats tabs */}
      {(activeTab === 'skills' || activeTab === 'feats') && (
        <ActionWheelButton characterName={character.name} characterLevel={character.level} />
      )}
      </div>
    </PromptDrawerProvider>
  );
};

export default Index;
