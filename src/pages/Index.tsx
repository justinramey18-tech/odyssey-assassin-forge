import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { loadTimezone, TIMEZONE_CHANGE_EVENT } from '@/lib/timezone-storage';
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
import { 
  CharacterWizard, 
  WizardState,
  applyWizardState,
  applyQuickStart,
  WizardStateSetters,
} from '@/components/wizard';
import { CharacterHeader } from '@/components/character/CharacterHeader';
import { EquippedLoadout } from '@/components/character/EquippedLoadout';
import { ActionWheelButton } from '@/components/character/ActionWheelButton';
import { XPTracker } from '@/components/character/XPTracker';
import { InventoryScreen } from '@/components/inventory/InventoryScreen';
import { AchievementsScreen } from '@/components/achievements/AchievementsScreen';
import { ConstellationScreen } from '@/components/constellation/ConstellationScreen';
import { HomeScreen } from '@/components/home/HomeScreen';
import { IntroSplashScreen } from '@/components/home/IntroSplashScreen';
import { IncomingHealOverlay } from '@/components/party/IncomingHealNotification';
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
import { convertConditionsToPromptFormat, convertSetBonusesToPromptFormat } from '@/lib/combat/promptContext';
import { BackgroundWrapper } from '@/components/ui/BackgroundWrapper';
import { useCategoryNavigation } from '@/hooks/use-category-navigation';
import { useToast } from '@/hooks/use-toast';
import { useGameMode } from '@/hooks/use-game-mode';
import { usePrestige } from '@/hooks/use-prestige';
import { useEquipmentStats } from '@/hooks/use-equipment-stats';
import { useAbilityScores } from '@/hooks/use-ability-scores';
import { loadAutoSave, SaveData, serializeConsumables } from '@/hooks/use-auto-save';
import { useAutoCloudSync } from '@/hooks/use-auto-cloud-sync';
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
import { getConcentrationCheckDC } from '@/lib/magic/calculations';
import { 
  CharacterEquipment, 
  EquipmentItem,
  createInitialEquipment,
} from '@/lib/inventory/index';
import { MagicScreen, ClassSpellcastingScreen } from '@/components/magic';
import { getSpellById } from '@/lib/magic/spells/index';
import { ShopScreen } from '@/components/shop';
import { LootScreen } from '@/components/loot';
import { generateLootUsePrompt } from '@/lib/loot/prompts';
import { useShop } from '@/hooks/use-shop';
import { useLoot } from '@/hooks/use-loot';
import { ParsedShopItem } from '@/lib/shop/types';
import { useSpellcasting } from '@/hooks/use-spellcasting';
import { useClassSpellcasting } from '@/hooks/use-class-spellcasting';
import { adaptClassSpellcastingForCombat } from '@/hooks/use-combat-spellcasting-adapter';
import { BASE_CHANNEL_DIVINITY_OPTIONS } from '@/lib/magic/channelDivinity';
import { getDomainChannelDivinity, getDomainById, ClericDomain } from '@/lib/classes/clericDomains';
import { Consumable } from '@/lib/consumables/types';
import { EquipmentItem as ShopEquipmentItem } from '@/lib/inventory/types';
import { useCustomBackground } from '@/hooks/use-custom-background';
import { useWildShapeBackgrounds } from '@/hooks/use-wild-shape-backgrounds';
import { useActionEconomy } from '@/hooks/use-action-economy';
import { useConditions } from '@/hooks/use-conditions';
import { useTargets } from '@/hooks/use-targets';
import { useCombatLog } from '@/hooks/use-combat-log';
import { useInitiative } from '@/hooks/use-initiative';
import { useCombatStats } from '@/hooks/use-combat-stats';
import { useWildShape } from '@/hooks/use-wild-shape';
import { DruidCircle } from '@/lib/classes/druidCircles';
import { useSpellCustomization } from '@/hooks/use-spell-customization';
import { usePartySync } from '@/hooks/use-party-sync';
import { useAbilityCustomization } from '@/hooks/use-ability-customization';
import { useAbilityImages } from '@/hooks/use-ability-images';
import { homebrewToAbility } from '@/lib/abilityCustomization/utils';
import { useAuth } from '@/hooks/use-auth';
import { usePlayMode } from '@/hooks/use-play-mode';

// Stable empty object to prevent re-renders from `character.multiclassLevels ?? {}`
const EMPTY_MULTICLASS_LEVELS: Record<string, never> = {};

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
  const [settingsInitialTab, setSettingsInitialTab] = useState<'game' | 'setup' | 'character' | 'tools' | undefined>(undefined);
  const [showCloudSaveModal, setShowCloudSaveModal] = useState(false);
  const [lastCloudSyncTime, setLastCloudSyncTime] = useState<string | null>(null);
  const [isSwitchingCharacter, setIsSwitchingCharacter] = useState(false);
  const [character, setCharacter] = useState<Character>({
    name: '',
    level: 1,
    abilities: allAbilities.map(a => ({ abilityId: a.id, currentTier: 0 as const })),
    equippedAbilities: [],
  });
  
  // XP System State
  const [currentXP, setCurrentXP] = useState(0);
  const [xpPreset, setXPPreset] = useState<XPPreset>('standard');
  
  // Inspiration State (D&D 5e)
  const [hasInspiration, setHasInspiration] = useState(() => {
    const stored = localStorage.getItem('odyssey-inspiration');
    return stored === 'true';
  });
  
  // Persist inspiration to localStorage
  useEffect(() => {
    localStorage.setItem('odyssey-inspiration', hasInspiration.toString());
  }, [hasInspiration]);
  
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
  const activeTab = categoryNav.activeSubTab as 'skills' | 'abilities' | 'gear' | 'feats' | 'stars' | 'scribe' | 'combat' | 'consumables' | 'chronicle' | 'legacy' | 'arcana' | 'shop' | 'loot';
  
  // Handler to navigate to consumables tab from combat items
  const handleNavigateToConsumables = useCallback(() => {
    categoryNav.navigateToSubTab('consumables', 'inventory');
  }, [categoryNav]);
  
  // Spellcasting system - moved after abilityScores for dependency
  // (see definition after abilityScores below)
  
  // Shop system
  const shop = useShop();
  
  // Loot system
  const loot = useLoot();
  
  // Custom home background
  const customBackground = useCustomBackground();
  
  // Wild shape per-form background images
  const wildShapeBgs = useWildShapeBackgrounds();
  
  // Action economy (combat turn tracking with persistence)
  const actionEconomy = useActionEconomy();
  
  // Target/Enemy tracker (combat)
  const targets = useTargets();
  
  // Combat log (action history for AI synthesis)
  const combatLog = useCombatLog();
  
  // Ref to hold conditions.endTurn - populated after conditions hook is created
  const conditionsEndTurnRef = useRef<() => { expired: string[]; tickedDown: string[] }>(() => ({ expired: [], tickedDown: [] }));
  
  // Initiative tracker (depends on targets.enemies)
  // Wire up round tracking: when a new round starts, tick down conditions
  // When player's turn starts, reset action economy
  const initiative = useInitiative(targets.enemies, {
    onRoundAdvance: useCallback((newRound: number) => {
      console.log(`[Initiative] Round ${newRound} started - ticking conditions`);
      const result = conditionsEndTurnRef.current();
      
      // Check if round notifications are enabled
      const combatSettings = JSON.parse(localStorage.getItem('odyssey-combat-settings') || '{}');
      const showNotifications = combatSettings.showRoundNotifications !== false; // Default to true
      
      if (!showNotifications) {
        return; // Skip notifications if disabled
      }
      
      // Show round advance toast with condition changes
      if (result && (result.expired.length > 0 || result.tickedDown.length > 0)) {
        const parts: string[] = [];
        if (result.tickedDown.length > 0) {
          parts.push(`⏳ ${result.tickedDown.join(', ')}`);
        }
        if (result.expired.length > 0) {
          parts.push(`💀 Expired: ${result.expired.join(', ')}`);
        }
        // Use setTimeout to ensure toast hook is available
        setTimeout(() => {
          import('@/hooks/use-toast').then(({ toast }) => {
            toast({
              title: `⚔️ Round ${newRound}`,
              description: parts.join(' | '),
              duration: 4000,
            });
          });
        }, 0);
      } else {
        // Show simple round advance notification
        setTimeout(() => {
          import('@/hooks/use-toast').then(({ toast }) => {
            toast({
              title: `⚔️ Round ${newRound}`,
              description: 'New round begins',
              duration: 2000,
            });
          });
        }, 0);
      }
    }, []),
    onPlayerTurnStart: useCallback(() => {
      console.log('[Initiative] Player turn started - resetting action economy');
      actionEconomy.resetTurn();
    }, [actionEconomy]),
  });
  
  // Build combat context for Oracle tactical awareness
  const combatContext = useMemo(() => {
    const isInCombat = initiative.combatStarted || targets.enemies.length > 0;
    return {
      isInCombat,
      roundNumber: initiative.roundNumber,
      isPlayerTurn: initiative.isPlayerTurn,
      economy: actionEconomy.economy,
      currentTarget: targets.currentTarget,
      enemies: targets.enemies,
      recentLogEntries: combatLog.entries.slice(0, 5),
    };
  }, [
    initiative.combatStarted,
    initiative.roundNumber,
    initiative.isPlayerTurn,
    actionEconomy.economy,
    targets.currentTarget,
    targets.enemies,
    combatLog.entries,
  ]);
  
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
  
  // Combat stats (includes initiative with DEX + ability bonuses like Sixth Sense)
  const combatStats = useCombatStats({
    character,
    equipmentStats: aggregatedStats,
    abilityModifiers: abilityScores.finalModifiers,
  });
  
  // Calculate max HP dynamically based on level, constitution, and prestige
  const calculatedMaxHP = useMemo(() => {
    const conMod = scoreToModifier(abilityScores.finalScores.constitution);
    return calculateMaxHP(character.level, conMod, prestigeData.prestigeLevel);
  }, [character.level, abilityScores.finalScores.constitution, prestigeData.prestigeLevel]);
  
  // Determine if character is using Rogue class (legacy Magic Path system)
  const isRogueClass = (character.primaryClass ?? 'rogue') === 'rogue';

  const { requiresOrganicLevelUp, requiresGearUnlocks, rerollsDisabled, infinityStonesLocked, enforceWildShapeDuration } = useGameMode();

  // Wild Shape - lifted to app level for cross-tab sync
  const druidCircle = useMemo<DruidCircle | null>(() => {
    try {
      const saved = localStorage.getItem('dnd-druid-circle');
      return saved as DruidCircle | null;
    } catch { return null; }
  }, []);
  const isDruidClass = (character.primaryClass ?? 'rogue') === 'druid';
  const wildShape = useWildShape(
    isDruidClass ? character.level : 0,
    isDruidClass ? druidCircle : null,
    enforceWildShapeDuration
  );

  // Effective HP/AC values that auto-switch between beast and character stats
  const effectiveCurrentHP = wildShape.state.isTransformed ? wildShape.state.formHP : hpState.current;
  const effectiveMaxHP = wildShape.state.isTransformed ? wildShape.state.formMaxHP : hpState.max;
  const effectiveTempHP = wildShape.state.isTransformed ? 0 : hpState.temp;
  const effectiveAC = wildShape.state.isTransformed && wildShape.state.currentForm
    ? wildShape.state.currentForm.ac
    : aggregatedStats.totalAC;
  
  // Spellcasting system for Rogue (Magic Paths - uses ability scores for auto-calculation)
  const spellcasting = useSpellcasting(character.level, character.name, {
    abilityScores: {
      intelligence: abilityScores.finalScores.intelligence,
      wisdom: abilityScores.finalScores.wisdom,
      charisma: abilityScores.finalScores.charisma,
    },
  });
  
  // Class-based spellcasting for non-Rogue classes (Wizard, Sorcerer, etc.)
  const classSpellcasting = useClassSpellcasting(
    character.primaryClass ?? 'wizard',
    character.level,
    character.multiclassLevels ?? EMPTY_MULTICLASS_LEVELS,
    character.name,
    {
      abilityScores: {
        intelligence: abilityScores.finalScores.intelligence,
        wisdom: abilityScores.finalScores.wisdom,
        charisma: abilityScores.finalScores.charisma,
      },
    }
  );
  
  // Adapt class spellcasting for combat tab (so prepared spells auto-populate)
  const combatSpellcasting = useMemo(() => {
    if (isRogueClass) return spellcasting;
    return adaptClassSpellcastingForCombat(classSpellcasting, character.primaryClass ?? 'wizard');
  }, [isRogueClass, spellcasting, classSpellcasting, character.primaryClass]);

  // Channel Divinity info for Quick Actions drawer
  const channelDivinityInfo = useMemo(() => {
    if (isRogueClass || character.primaryClass !== 'cleric' || !classSpellcasting.hasChannelDivinity) return undefined;
    const clericLevel = character.level;
    // Read domain from localStorage (same key as ClassSpellcastingScreen)
    let domainOptions: Array<{ id: string; name: string; description: string; mechanicalEffect?: string; isDomain: boolean }> = [];
    let domainName: string | undefined;
    let deityName: string | undefined;
    try {
      const savedDomain = localStorage.getItem('dnd-cleric-domain') as ClericDomain | null;
      if (savedDomain) {
        const domainConfig = getDomainById(savedDomain);
        domainName = domainConfig?.name;
        domainOptions = getDomainChannelDivinity(savedDomain, clericLevel).map(opt => ({
          id: opt.id,
          name: opt.name,
          description: opt.description,
          mechanicalEffect: opt.mechanicalEffect,
          isDomain: true,
        }));
      }
      deityName = localStorage.getItem('dnd-cleric-deity') || undefined;
    } catch {}
    const baseOptions = BASE_CHANNEL_DIVINITY_OPTIONS
      .filter(opt => clericLevel >= opt.unlockedAtLevel)
      .map(opt => ({ id: opt.id, name: opt.name, description: opt.description, isDomain: false }));
    return {
      current: classSpellcasting.channelDivinityCurrent,
      max: classSpellcasting.channelDivinityMax,
      clericLevel,
      domainName,
      deityName,
      options: [...baseOptions, ...domainOptions],
      useChannelDivinity: classSpellcasting.useChannelDivinity,
      restoreChannelDivinity: classSpellcasting.restoreChannelDivinity,
    };
  }, [isRogueClass, character.primaryClass, character.level, classSpellcasting.hasChannelDivinity, classSpellcasting.channelDivinityCurrent, classSpellcasting.channelDivinityMax, classSpellcasting.useChannelDivinity, classSpellcasting.restoreChannelDivinity]);

  // Using refs to avoid stale closure issues in callbacks
  const spellcastingRef = useRef(spellcasting);
  spellcastingRef.current = spellcasting;
  
  const abilityScoresRef = useRef(abilityScores);
  abilityScoresRef.current = abilityScores;
  
  const combatStatsRef = useRef(combatStats);
  combatStatsRef.current = combatStats;
  
  const conditions = useConditions({
    onConcentrationBroken: useCallback((_spellName: string, _reason?: string) => {
      // Sync with spellcasting's concentration state
      spellcastingRef.current.breakConcentration();
    }, []),
  });
  
  // Wire up the conditions ref for initiative round tracking
  conditionsEndTurnRef.current = conditions.endTurn;
  
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

  // Spell Customization (homebrew spells)
  const spellCustomization = useSpellCustomization();

  // Ability Customization (homebrew abilities)
  const abilityCustomization = useAbilityCustomization();
  const { images: abilityImages } = useAbilityImages();

  // Ability image thumbnails for party broadcast (small compressed versions)
  const [abilityImageThumbs, setAbilityImageThumbs] = useState<Record<string, string>>({});
  const lastAbilityImagesRef = useRef<string>('');
  useEffect(() => {
    const key = JSON.stringify(abilityImages);
    if (key === lastAbilityImagesRef.current) return;
    lastAbilityImagesRef.current = key;
    const ids = Object.keys(abilityImages);
    if (ids.length === 0) { setAbilityImageThumbs({}); return; }
    import('@/lib/utils/image-resize').then(({ resizeImageToThumbnail }) => {
      Promise.all(ids.map(id =>
        resizeImageToThumbnail(abilityImages[id], 32, 0.5)
          .then(thumb => ({ id, thumb }))
          .catch(() => null)
      )).then(results => {
        const thumbs: Record<string, string> = {};
        results.forEach(r => { if (r) thumbs[r.id] = r.thumb; });
        setAbilityImageThumbs(thumbs);
      });
    });
  }, [abilityImages]);

  // Auth & Party system
  const { user, isAuthenticated } = useAuth();
  const partySync = usePartySync();
  const { playMode, setPlayMode, isSoloMode, isPartyMode } = usePlayMode();

  // HP change handler with localStorage persistence, concentration check, and Wild Shape routing
  const handleHPChange = useCallback((current: number, max: number, temp: number) => {
    // If transformed, route damage through Wild Shape
    if (wildShape.state.isTransformed) {
      const previousFormHP = wildShape.state.formHP;
      const damageTaken = previousFormHP - current;
      
      if (damageTaken > 0) {
        const result = wildShape.takeDamage(damageTaken);
        if (result.reverted && result.overflow > 0) {
          // Overflow damage applies to real character HP
          const newCharHP = Math.max(0, hpState.current - result.overflow);
          const newState = { current: newCharHP, max: hpState.max, temp: hpState.temp };
          setHpState(newState);
          localStorage.setItem('odyssey-hp-state', JSON.stringify(newState));
        }
      } else if (damageTaken < 0) {
        // Healing in beast form
        wildShape.heal(Math.abs(damageTaken));
      }
      return;
    }

    const previousTotal = hpState.current + hpState.temp;
    const newTotal = current + temp;
    const damageTaken = previousTotal - newTotal;
    
    const newState = { current, max, temp };
    setHpState(newState);
    localStorage.setItem('odyssey-hp-state', JSON.stringify(newState));
    
    // Reset death saves when regaining HP from 0
    if (current > 0 && deathSaves.successes + deathSaves.failures > 0) {
      setDeathSaves({ successes: 0, failures: 0 });
      localStorage.setItem('odyssey-death-saves', JSON.stringify({ successes: 0, failures: 0 }));
    }
    
    // Trigger concentration check if damage was taken while concentrating
    if (damageTaken > 0 && spellcastingRef.current.state.concentratingOn) {
      const dc = getConcentrationCheckDC(damageTaken);
      const conMod = abilityScoresRef.current?.finalModifiers?.constitution ?? 0;
      const profBonus = combatStatsRef.current?.proficiencyBonus ?? 2;
      const totalBonus = conMod + profBonus;
      const spellName = spellcastingRef.current.state.concentratingOn;
      
      // Generate AI DM prompt for concentration save
      const prompt = `🔮 **CONCENTRATION CHECK**

${character.name} takes **${damageTaken} damage** while concentrating on **${spellName}**!

**Constitution Saving Throw Required**
- DC: **${dc}** (half damage or 10, whichever is higher)
- Modifier: +${totalBonus} (CON ${conMod >= 0 ? '+' + conMod : conMod} + Proficiency +${profBonus})

*Roll a d20 + ${totalBonus} against DC ${dc} to maintain concentration.*
${dc > 15 ? '\n⚠️ High DC! This will be a tough save.' : ''}`;
      
      // Copy prompt to clipboard
      navigator.clipboard.writeText(prompt).catch(() => {});
      
      toast({
        title: `🔮 Concentration Check Required!`,
        description: (
          <div className="space-y-1">
            <p className="text-sm">{damageTaken} damage while concentrating on <span className="font-semibold text-primary">{spellName}</span></p>
            <p className="text-xs text-muted-foreground">DC {dc} Constitution save (d20 + {totalBonus})</p>
            <p className="text-xs text-primary/80 mt-1">✓ AI prompt copied to clipboard</p>
          </div>
        ),
        className: 'border-primary bg-primary/10',
        duration: 8000,
      });
    }
   }, [deathSaves, hpState, character.name, toast, wildShape]);

  // Track whether initial HP sync has completed to suppress load-time toasts
  const hasInitialHPSynced = useRef(false);

  // Auto-update max HP when calculation changes (level up, CON change, prestige)
  useEffect(() => {
    if (calculatedMaxHP !== hpState.max) {
      const hpDiff = calculatedMaxHP - hpState.max;
      const newCurrent = hpDiff > 0 
        ? Math.min(calculatedMaxHP, hpState.current + hpDiff)
        : Math.min(calculatedMaxHP, hpState.current);
      
      const newState = { 
        current: newCurrent, 
        max: calculatedMaxHP, 
        temp: hpState.temp 
      };
      setHpState(newState);
      localStorage.setItem('odyssey-hp-state', JSON.stringify(newState));
      
      // Show toast for significant changes, but NOT on initial app load
      if (hasInitialHPSynced.current && hpState.max > 8 && hpDiff !== 0) {
        toast({
          title: hpDiff > 0 ? "❤️ Max HP Increased!" : "💔 Max HP Decreased",
          description: `Max HP: ${hpState.max} → ${calculatedMaxHP} (${hpDiff > 0 ? '+' : ''}${hpDiff})`,
          className: hpDiff > 0 ? "border-emerald-500 bg-emerald-500/10" : "border-rose-500 bg-rose-500/10",
        });
      }
    }
    // Delay marking initial sync complete to handle React strict mode double-invocation
    if (!hasInitialHPSynced.current) {
      const t = setTimeout(() => { hasInitialHPSynced.current = true; }, 500);
      return () => clearTimeout(t);
    }
  }, [calculatedMaxHP, hpState.max, hpState.current, hpState.temp, toast]);
  // Wire party incoming heal callback (only in party mode)
  useEffect(() => {
    if (isSoloMode) return;
    partySync.onIncomingHeal.current = (hpHealed: number, _senderName: string, _source: string) => {
      const newHP = Math.min(hpState.max, hpState.current + hpHealed);
      handleHPChange(newHP, hpState.max, hpState.temp);
    };
  }, [partySync, hpState, handleHPChange, isSoloMode]);

  // Auto-apply incoming party buffs as conditions (only in party mode)
  useEffect(() => {
    if (isSoloMode) return;
    if (partySync.incomingBuffs.length === 0) return;

    partySync.incomingBuffs.forEach((buff, index) => {
      const category = buff.category || 'buff';
      conditions.addCondition({
        conditionId: buff.conditionName.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
        name: buff.conditionName,
        category,
        severity: 'minor',
        durationType: buff.durationType as 'rounds' | 'minutes' | 'hours' | 'save_ends' | 'indefinite',
        durationValue: buff.duration,
        source: `${buff.casterName} (Party)`,
        spellLevel: buff.spellLevel,
      });
      partySync.clearIncomingBuff(index);
    });
  }, [partySync.incomingBuffs, isSoloMode]);

  // Build quick actions summary for party broadcast
  const quickActionsSummary = useMemo(() => {
    // Weapons from equipment
    const weaponSlotKeys: Array<'primary_weapon' | 'secondary_weapon' | 'ranged_weapon'> = ['primary_weapon', 'secondary_weapon', 'ranged_weapon'];
    const weapons = weaponSlotKeys
      .map(slot => equipment.slots[slot])
      .filter(Boolean)
      .map(item => ({
        name: item!.name,
        damage: item!.stats.damage || '—',
        damageType: (item!.properties?.find(p => p.toLowerCase().includes('slashing') || p.toLowerCase().includes('piercing') || p.toLowerCase().includes('bludgeoning')) || 'Physical'),
      }));

    // Equipped abilities (including homebrew) + auto-populated invested homebrew
    const seenAbilityIds = new Set<string>();
    const resolveAbilityForBroadcast = (id: string) => {
      if (!id || seenAbilityIds.has(id)) return null;
      seenAbilityIds.add(id);
      if (id.startsWith('homebrew_')) {
        const homebrew = abilityCustomization.state.homebrewAbilities.find(h => h.id === id);
        if (!homebrew) return null;
        const converted = homebrewToAbility(homebrew);
        const tier = character.abilities.find(ca => ca.abilityId === id)?.currentTier ?? 0;
        return {
          name: converted.name,
          tree: converted.tree,
          tier,
          actionType: converted.type === 'active' ? 'Action' : 'Passive',
          image: abilityImageThumbs[id] || undefined,
        };
      }
      const ability = allAbilities.find(a => a.id === id);
      const tier = character.abilities.find(ca => ca.abilityId === id)?.currentTier ?? 0;
      return ability ? {
        name: ability.name,
        tree: ability.tree,
        tier,
        actionType: ability.type === 'active' ? 'Action' : 'Passive',
        image: abilityImageThumbs[id] || undefined,
      } : null;
    };

    // From loadout
    const abilitiesFromLoadout = character.equippedAbilities.filter(Boolean).map(resolveAbilityForBroadcast).filter(Boolean);
    // Auto-populate invested homebrew not already in loadout
    const abilitiesFromHomebrew = character.abilities
      .filter(a => a.abilityId.startsWith('homebrew_') && a.currentTier > 0)
      .map(a => resolveAbilityForBroadcast(a.abilityId))
      .filter(Boolean);
    const abilities = [...abilitiesFromLoadout, ...abilitiesFromHomebrew] as { name: string; tree: string; tier: number; actionType: string }[];

    // Spells & cantrips from class spellcasting
    let spells: { name: string; level: number; school: string; concentration: boolean }[] = [];
    let cantrips: { name: string; school: string }[] = [];
    
    if (!isRogueClass && classSpellcasting.state.preparedSpells) {
      spells = classSpellcasting.state.preparedSpells
        .map((id: string) => {
          const spell = getSpellById(id);
          if (!spell || spell.level === 0) return null;
          return {
            name: spell.name,
            level: spell.level,
            school: spell.school || 'Unknown',
            concentration: spell.concentration || false,
          };
        })
        .filter(Boolean) as typeof spells;

      // Cantrips are level 0 prepared/known spells
      const allKnown = [...(classSpellcasting.state.knownSpells || []), ...(classSpellcasting.state.preparedSpells || [])];
      const uniqueIds = [...new Set(allKnown)];
      cantrips = uniqueIds
        .map((id: string) => {
          const spell = getSpellById(id);
          if (!spell || spell.level !== 0) return null;
          return { name: spell.name, school: spell.school || 'Unknown' };
        })
        .filter(Boolean) as typeof cantrips;
    }

    // Consumables
    const consumables = consumablesInventory
      .filter(item => item.quantity > 0)
      .slice(0, 10) // Limit to keep payload small
      .map(item => ({
        name: item.consumable.name,
        quantity: item.quantity,
        effect: item.consumable.effect,
      }));

    return { weapons, abilities, spells, cantrips, consumables };
  }, [equipment.slots, character.equippedAbilities, character.abilities, isRogueClass, classSpellcasting.state.preparedSpells, classSpellcasting.state.knownSpells, consumablesInventory, abilityCustomization.state.homebrewAbilities, abilityImageThumbs]);

  // Profile image thumbnail (state so broadcasts re-trigger when ready)
  const [profileImageThumb, setProfileImageThumb] = useState<string | null>(null);
  const lastBgRef = useRef<string | null>(null);

  // Timezone state (re-triggers broadcast when user changes timezone in settings)
  const [userTimezone, setUserTimezone] = useState(() => loadTimezone());
  useEffect(() => {
    const handleTzChange = (e: Event) => {
      setUserTimezone((e as CustomEvent<string>).detail);
    };
    window.addEventListener(TIMEZONE_CHANGE_EVENT, handleTzChange);
    return () => window.removeEventListener(TIMEZONE_CHANGE_EVENT, handleTzChange);
  }, []);

  useEffect(() => {
    const bg = customBackground.customBackground;
    if (bg === lastBgRef.current) return;
    lastBgRef.current = bg;
    
    if (!bg) {
      setProfileImageThumb(null);
      return;
    }

    import('@/lib/utils/image-resize').then(({ resizeImageToThumbnail }) => {
      resizeImageToThumbnail(bg, 64, 0.6).then(thumb => {
        setProfileImageThumb(thumb);
      }).catch(() => {
        setProfileImageThumb(null);
      });
    });
  }, [customBackground.customBackground]);

  // Broadcast status to party every time relevant state changes
  useEffect(() => {
    if (!partySync.party.partyId || isSoloMode) return;
    partySync.broadcastStatus({
      currentHP: effectiveCurrentHP,
      maxHP: effectiveMaxHP,
      tempHP: effectiveTempHP,
      ac: effectiveAC,
      conditions: conditions.conditions.map(c => c.name),
      level: character.level,
      className: character.primaryClass,
      quickActions: quickActionsSummary,
      profileImage: profileImageThumb,
      timezone: userTimezone,
    });
  }, [partySync, effectiveCurrentHP, effectiveMaxHP, effectiveTempHP, effectiveAC, conditions.conditions, character.level, character.primaryClass, quickActionsSummary, profileImageThumb, userTimezone]);

  // Legacy spentPoints for compatibility
  const spentPoints = getTotalPointsSpent(character.abilities);

  // Data for auto-save (comprehensive character backup for cloud persistence)
  const saveData = useMemo(() => {
    // Load proficiencies/expertise from localStorage (they're managed by DiceRollerScreen)
    const proficientSkills = JSON.parse(localStorage.getItem('odyssey-proficient-skills') || '[]');
    const proficientSaves = JSON.parse(localStorage.getItem('odyssey-proficient-saves') || '[]');
    const expertiseSkills = JSON.parse(localStorage.getItem('odyssey-expertise-skills') || '[]');
    const combatSettings = JSON.parse(localStorage.getItem('odyssey-combat-settings') || '{}');
    // Load cooldown state from localStorage
    const cooldownState = JSON.parse(localStorage.getItem('odyssey-cooldown-state') || 'null');
    
    return {
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
      hpState: {
        current: hpState.current,
        max: hpState.max,
        temp: hpState.temp,
      },
      deathSaves,
      // Spellcasting state (magic path, slots, spells)
      spellcasting: spellcasting.state,
      // Active spell effects (duration tracking)
      activeSpells: spellcasting.activeSpells,
      // Prestige skill tree progress (Drizzt's Legacy)
      prestigeTree: prestigeTree.progress,
      // Shop gold balance
      shopGold: shop.currentGold,
      // Loot items and sold history
      loot: {
        items: loot.lootItems,
        soldHistory: loot.soldHistory,
      },
      // Proficiencies (skills and saves)
      proficiencies: {
        skills: proficientSkills,
        saves: proficientSaves,
      },
      // Expertise skills (double proficiency)
      expertise: expertiseSkills,
      // D&D Inspiration
      inspiration: hasInspiration,
      // Combat settings (feat toggles)
      combatSettings,
      // Conditions state (buffs/debuffs/concentration)
      conditions: {
        conditions: conditions.conditions,
        recentConditions: conditions.recentConditions,
      },
      // Cooldown state (ability timers and session)
      cooldownState: cooldownState,
      // Party association (persists across sessions)
      partyId: partySync.party.partyId,
      // Custom home background URL (cloud storage)
      backgroundUrl: customBackground.backgroundUrl,
    };
  }, [
    character, equipment, achievements, consumablesInventory, 
    currentXP, xpPreset, prestigeData, abilityScores.baseScores, 
    hpState, deathSaves, spellcasting.state, spellcasting.activeSpells,
    prestigeTree.progress, shop.currentGold, loot.lootItems, loot.soldHistory, 
    hasInspiration, conditions.conditions, conditions.recentConditions,
    partySync.party.partyId, customBackground.backgroundUrl
  ]);

  // Auto-save locally AND to cloud when authenticated (only when not in wizard)
  const autoSync = useAutoCloudSync(saveData, !showWizard);
  
  // Update lastCloudSyncTime from auto-sync
  useEffect(() => {
    if (autoSync.lastCloudSyncTime && autoSync.lastCloudSyncTime !== lastCloudSyncTime) {
      setLastCloudSyncTime(autoSync.lastCloudSyncTime);
    }
  }, [autoSync.lastCloudSyncTime, lastCloudSyncTime]);

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

  // Handle loading cloud save - RESTORES ALL CHARACTER STATE
  const handleLoadCloudSave = useCallback(async (data: SaveData) => {
    console.log('[CloudSave] Loading character:', data.character.name);
    setIsSwitchingCharacter(true);
    
    // CRITICAL: Save current character to cloud BEFORE switching
    // This preserves background URL, party association, and all state for the current character
    try {
      await autoSync.syncNow();
      console.log('[CloudSave] Saved current character before switching');
    } catch (e) {
      console.warn('[CloudSave] Pre-switch save failed:', e);
    }
    
    // 1. Core character data
    setCharacter(data.character);
    setEquipment(data.equipment);
    setAchievements(data.achievements);
    
    // 2. XP system
    setCurrentXP(data.xp.currentXP);
    setXPPreset(data.xp.xpPreset as XPPreset);
    
    // 3. Prestige data - update localStorage AND state via hook
    if (data.prestige) {
      const prestigeState = {
        prestigeLevel: data.prestige.prestigeLevel ?? 0,
        prestigeXP: data.prestige.prestigeXP ?? 0,
        totalPrestigePoints: data.prestige.totalPrestigePoints ?? 0,
      };
      localStorage.setItem('odyssey-prestige-data', JSON.stringify(prestigeState));
      setPrestigeData(prestigeState);
      
      // Update prestige tree spent state to recalculate from loaded abilities
      const treeSpent = (data.character.abilities || []).reduce((sum: number, ca: CharacterAbility) => {
        // Only count prestige tree abilities
        if (ca.abilityId.startsWith('prestige_')) {
          const ability = getPrestigeAbilityById(ca.abilityId);
          return sum + (ability?.prestigeCost ?? 0);
        }
        return sum;
      }, 0);
      setPrestigeTreeSpentState(treeSpent);
      console.log('[CloudSave] Loaded prestige:', prestigeState);
    }
    
    // 4. Consumables - update localStorage (hook will sync on next render)
    if (data.consumables && Array.isArray(data.consumables)) {
      localStorage.setItem('odyssey-consumables-inventory', JSON.stringify(data.consumables));
      console.log('[CloudSave] Loaded consumables:', data.consumables.length, 'items');
    }
    
    // 5. Ability scores - use hook's applyScores method
    if (data.abilityScores) {
      abilityScores.applyScores(data.abilityScores);
      console.log('[CloudSave] Loaded ability scores');
    }
    
    // 6. Restore HP state from saved data (or calculate max if not saved)
    if (data.hpState) {
      // Restore exact HP state from cloud save
      setHpState(data.hpState);
      localStorage.setItem('odyssey-hp-state', JSON.stringify(data.hpState));
      console.log('[CloudSave] Restored HP:', data.hpState.current, '/', data.hpState.max, 'temp:', data.hpState.temp);
    } else if (data.abilityScores) {
      // Fallback: Calculate max HP if HP state wasn't saved (legacy saves)
      const loadedConMod = scoreToModifier(data.abilityScores.constitution);
      const loadedPrestigeLevel = data.prestige?.prestigeLevel ?? 0;
      const newMaxHP = calculateMaxHP(data.character.level, loadedConMod, loadedPrestigeLevel);
      const newHPState = { current: newMaxHP, max: newMaxHP, temp: 0 };
      setHpState(newHPState);
      localStorage.setItem('odyssey-hp-state', JSON.stringify(newHPState));
      console.log('[CloudSave] HP not in save, reset to max:', newMaxHP);
    }
    
    // 7. Restore death saves from saved data (or reset if not saved)
    if (data.deathSaves) {
      setDeathSaves(data.deathSaves);
      localStorage.setItem('odyssey-death-saves', JSON.stringify(data.deathSaves));
      console.log('[CloudSave] Restored death saves:', data.deathSaves);
    } else {
      setDeathSaves({ successes: 0, failures: 0 });
      localStorage.setItem('odyssey-death-saves', JSON.stringify({ successes: 0, failures: 0 }));
    }
    
    // 8. Restore spellcasting state (magic path, slots, spells)
    if (data.spellcasting) {
      localStorage.setItem('odyssey-spellcasting', JSON.stringify(data.spellcasting));
      console.log('[CloudSave] Restored spellcasting:', data.spellcasting.path);
    }
    
    // 9. Restore prestige tree progress (Drizzt's Legacy)
    if (data.prestigeTree) {
      localStorage.setItem('odyssey-prestige-tree', JSON.stringify(data.prestigeTree));
      console.log('[CloudSave] Restored prestige tree:', data.prestigeTree.unlockedAbilities?.length, 'abilities');
    }
    
    // 10. Restore shop gold balance
    if (data.shopGold !== undefined) {
      const shopState = JSON.parse(localStorage.getItem('odyssey-shop') || '{"currentGold":0,"items":[],"purchaseHistory":[]}');
      shopState.currentGold = data.shopGold;
      localStorage.setItem('odyssey-shop', JSON.stringify(shopState));
      console.log('[CloudSave] Restored shop gold:', data.shopGold);
    }
    
    // 11. Restore loot items and sold history
    if (data.loot) {
      localStorage.setItem('odyssey-loot', JSON.stringify(data.loot));
      console.log('[CloudSave] Restored loot:', data.loot.items?.length, 'items');
    }
    
    // 12. Restore proficiencies (skills and saves)
    if (data.proficiencies) {
      localStorage.setItem('odyssey-proficient-skills', JSON.stringify(data.proficiencies.skills || []));
      localStorage.setItem('odyssey-proficient-saves', JSON.stringify(data.proficiencies.saves || []));
      console.log('[CloudSave] Restored proficiencies');
    }
    
    // 13. Restore expertise skills
    if (data.expertise) {
      localStorage.setItem('odyssey-expertise-skills', JSON.stringify(data.expertise));
      console.log('[CloudSave] Restored expertise:', data.expertise.length, 'skills');
    }
    
    // 14. Restore inspiration
    if (data.inspiration !== undefined) {
      setHasInspiration(data.inspiration);
      localStorage.setItem('odyssey-inspiration', data.inspiration.toString());
      console.log('[CloudSave] Restored inspiration:', data.inspiration);
    }
    
    // 15. Restore combat settings (feat toggles)
    if (data.combatSettings) {
      localStorage.setItem('odyssey-combat-settings', JSON.stringify(data.combatSettings));
      console.log('[CloudSave] Restored combat settings');
    }
    
    // 16. Restore active spell effects (duration tracking)
    if (data.activeSpells) {
      localStorage.setItem('odyssey-active-spells', JSON.stringify(data.activeSpells));
      console.log('[CloudSave] Restored active spells:', data.activeSpells.length, 'effects');
    }
    
    // 17. Restore conditions state (buffs/debuffs/concentration)
    if (data.conditions) {
      localStorage.setItem('odyssey-conditions-state', JSON.stringify(data.conditions));
      console.log('[CloudSave] Restored conditions:', data.conditions.conditions?.length, 'active');
    }
    
    // 18. Restore cooldown state (ability timers and session)
    if (data.cooldownState) {
      localStorage.setItem('odyssey-cooldown-state', JSON.stringify(data.cooldownState));
      console.log('[CloudSave] Restored cooldown state');
    }
    
    // 19. Restore party association
    // Always disconnect locally first to ensure clean slate for the new character
    partySync.disconnectLocally();
    console.log('[CloudSave] Disconnected locally — clean slate for new character');

    // Store the loaded character's partyId so the on-mount effect knows which party to reconnect to
    // (the page reloads after load, so in-memory reconnect won't persist — this localStorage flag
    // tells the mount effect which party is valid for the active character)
    if (data.partyId) {
      localStorage.setItem('odyssey-active-party-id', data.partyId);
      console.log('[CloudSave] Set active party ID for reconnect after reload:', data.partyId);
    } else {
      localStorage.removeItem('odyssey-active-party-id');
      console.log('[CloudSave] No party for this character — cleared active party ID');
    }
    
    // 20. Restore custom background from cloud URL
    if (data.backgroundUrl) {
      customBackground.setBackgroundFromUrl(data.backgroundUrl);
      console.log('[CloudSave] Restored background from cloud URL');
    } else {
      customBackground.clearCustomBackground();
    }
    
    // Track when this was loaded from cloud
    setLastCloudSyncTime(data.savedAt);
    
    // Exit wizard if showing
    setShowWizard(false);
    
    // Force a page reload to ensure all localStorage-dependent hooks reinitialize
    // This is the most reliable way to ensure all state is synchronized
    toast({
      title: "✅ Character Loaded!",
      description: `${data.character.name} (Level ${data.character.level}) loaded from cloud`,
      className: "border-primary bg-primary/10",
    });
    
    // Small delay to allow toast to show, then reload to sync all hooks
    setTimeout(() => {
      window.location.reload();
    }, 500);
  }, [abilityScores.applyScores, setPrestigeData, toast, partySync, customBackground, autoSync]);

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

  // Build setters object for apply-wizard-state utility
  const wizardSetters: WizardStateSetters = useMemo(() => ({
    setCharacter,
    setCurrentXP,
    setXPPreset,
    setEquipment,
    handleHPChange,
    abilityScores: {
      applyScores: abilityScores.applyScores,
    },
    spellcasting: {
      selectPath: spellcasting.selectPath,
    },
    toast,
  }), [abilityScores.applyScores, spellcasting.selectPath, toast, handleHPChange]);

  // Full wizard completion handler - uses utility for state application
  const handleWizardComplete = useCallback((wizardState: WizardState) => {
    const result = applyWizardState(wizardState, wizardSetters);
    
    if (result.success) {
      console.log('[Wizard] Character created:', result.appliedChanges);
      setShowWizard(false);
    } else {
      console.error('[Wizard] Creation failed:', result.errors);
    }
  }, [wizardSetters]);
  
  // Quick start handler - uses utility for simplified state application
  const handleQuickStart = useCallback((wizardState: WizardState) => {
    const result = applyQuickStart(wizardState, {
      setCharacter,
      setCurrentXP,
      setXPPreset,
      abilityScores: {
        applyScores: abilityScores.applyScores,
      },
      handleHPChange,
      toast,
    });
    
    if (result.success) {
      console.log('[QuickStart] Character created:', result.appliedChanges);
      setShowWizard(false);
    } else {
      console.error('[QuickStart] Creation failed:', result.errors);
    }
  }, [abilityScores.applyScores, handleHPChange, toast]);

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

    // Check if this is a homebrew ability
    const isHomebrew = abilityId.startsWith('homebrew_');
    
    // Get ability data - check homebrew first, then base abilities
    const homebrewAbility = isHomebrew 
      ? JSON.parse(localStorage.getItem('odyssey-ability-customization') || '{}')?.homebrewAbilities?.find((h: any) => h.id === abilityId)
      : null;
    const ability = homebrewAbility || allAbilities.find(a => a.id === abilityId);
    if (!ability) return;

    // Check if ability exists in character state, if not add it (for homebrew)
    const existingAbility = character.abilities.find(ca => ca.abilityId === abilityId);
    const currentTier = existingAbility?.currentTier ?? 0;
    if (currentTier >= 3) return;

    // Check prerequisite (for both base and homebrew)
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

    // Perform upgrade - add to abilities array if homebrew not yet tracked
    setCharacter(prev => {
      const abilityExists = prev.abilities.some(ca => ca.abilityId === abilityId);
      
      if (!abilityExists && isHomebrew) {
        // Add homebrew ability to tracking and set to tier 1
        return {
          ...prev,
          abilities: [...prev.abilities, { abilityId, currentTier: 1 as 0 | 1 | 2 | 3 }],
        };
      }
      
      // Normal upgrade path
      return {
        ...prev,
        abilities: prev.abilities.map(ca =>
          ca.abilityId === abilityId && ca.currentTier < 3
            ? { ...ca, currentTier: (ca.currentTier + 1) as 0 | 1 | 2 | 3 }
            : ca
        ),
      };
    });

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
    
    // Restore pact slots (legacy spellcasting)
    spellcasting.onShortRest();
    
    // Restore class spellcasting short rest resources (pact slots, channel divinity, natural recovery)
    if (!isRogueClass) {
      classSpellcasting.onShortRest();
    }
    
    // Wild Shape rest (revert and restore uses)
    wildShape.onShortRest();
    
    // Dispatch event for cooldown system (lives in child components)
    window.dispatchEvent(new CustomEvent('odyssey-rest', { detail: { type: 'short' } }));
    
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
    
    // Restore all spell slots (legacy spellcasting)
    spellcasting.onLongRest();
    
    // Restore class spellcasting resources (slots, sorcery points, channel divinity, natural recovery)
    if (!isRogueClass) {
      classSpellcasting.onLongRest();
    }
    
    // Wild Shape rest (revert and restore uses)
    wildShape.onLongRest();
    
    // Reset death saves on long rest
    setDeathSaves({ successes: 0, failures: 0 });
    localStorage.setItem('odyssey-death-saves', JSON.stringify({ successes: 0, failures: 0 }));
    
    // Dispatch event for cooldown system (lives in child components)
    window.dispatchEvent(new CustomEvent('odyssey-rest', { detail: { type: 'long' } }));
    
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

  // Auto-sync callbacks for AI DM
  const autoSyncCallbacks = useMemo(() => ({
    onHPChange: handleChronicleHP,
    onAddXP: handleAddXP,
    onGoldChange: handleChronicleGold,
    onConditionChange: handleChronicleConditions,
    onRestOccurred: handleChronicleRest,
    getCurrentHP: () => hpState.current,
    getCurrentGold: () => shop.currentGold,
  }), [handleChronicleHP, handleAddXP, handleChronicleGold, handleChronicleConditions, handleChronicleRest, hpState.current, shop.currentGold]);


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

  // New Character Handler - saves current character to cloud, then resets to wizard
  const handleNewCharacter = useCallback(() => {
    try {
      // Trigger a cloud save of current data before resetting
      if (character.name) {
        autoSync.syncNow().catch(e => console.warn('[NewCharacter] Cloud save failed:', e));
      }
      
      // Reset all React state to defaults
      setCharacter({
        name: '',
        level: 1,
        abilities: allAbilities.map(a => ({ abilityId: a.id, currentTier: 0 as const })),
        equippedAbilities: [],
      });
      setCurrentXP(0);
      setXPPreset('standard');
      setEquipment(createInitialEquipment());
      setAchievements(achievementCategories.map(a => ({ ...a })));
      setPrestigeData({ prestigeLevel: 0, prestigeXP: 0, totalPrestigePoints: 0 });
      setPrestigeTreeSpentState(0);
      prestigeTree.resetTree();
      setHpState({ current: 8, max: 8, temp: 0 });
      shop.resetShop();
      loot.resetLoot();

      // Clear localStorage for fresh wizard
      resetAllAppData();
      localStorage.removeItem('odyssey-prestige-tree');
      
      // Show wizard
      setShowHomeScreen(false);
      setShowWizard(true);

      toast({
        title: "✨ New Character",
        description: "Previous character saved. Create your new hero!",
        className: "border-primary bg-primary/10",
        duration: 3000,
      });
    } catch (error) {
      console.error('[NewCharacter] Failed:', error);
      toast({
        title: "Error",
        description: "Could not start new character. Try again.",
        variant: "destructive",
      });
    }
  }, [autoSync, allAbilities, toast, prestigeTree, shop, loot]);

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

      // Reset Loot
      loot.resetLoot();
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

  // Fullscreen loading overlay while switching characters
  if (isSwitchingCharacter) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm">
        <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full mb-4" />
        <p className="text-lg font-cinzel text-foreground/80 animate-pulse">Switching Character…</p>
      </div>
    );
  }

  // Show wizard on first load
  if (showWizard) {
    return (
      <>
        <CharacterWizard
          onComplete={handleWizardComplete}
          onQuickStart={handleQuickStart}
          onLoadCloud={() => setShowCloudSaveModal(true)}
        />
        {/* Cloud Save Modal - available during wizard */}
        <CloudSaveModal
          open={showCloudSaveModal}
          onOpenChange={setShowCloudSaveModal}
          currentData={saveData}
          onLoadSave={handleLoadCloudSave}
        />
      </>
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
        currentHP={effectiveCurrentHP}
        maxHP={effectiveMaxHP}
        tempHP={effectiveTempHP}
        onHPChange={(current, temp) => handleHPChange(current, wildShape.state.isTransformed ? effectiveMaxHP : hpState.max, temp)}
        consumables={consumablesInventory}
        onUseConsumable={useConsumableItem}
        prestigeLevel={prestigeData.prestigeLevel}
        prestigeAbilities={prestigeTree.progress.unlockedAbilities}
        spellcasting={combatSpellcasting}
        channelDivinityInfo={channelDivinityInfo}
        wildShape={isDruidClass ? wildShape : undefined}
        onAssignWildShapeBackground={wildShapeBgs.assignBackground}
        onRemoveWildShapeBackground={wildShapeBgs.removeBackground}
        hasWildShapeBackground={wildShapeBgs.hasBackground}
        baseScores={abilityScores.baseScores}
        getScoreBreakdown={abilityScores.getScoreBreakdown}
        onIncrementScore={abilityScores.incrementScore}
        onDecrementScore={abilityScores.decrementScore}
        onRandomizeScores={abilityScores.randomizeScores}
        onApplyScores={abilityScores.applyScores}
        constitutionModifier={abilityScores.finalModifiers.constitution}
        lootItems={loot.lootItems}
        totalLootValue={loot.totalLootValue}
        combatContext={combatContext}
        partyMembers={isPartyMode ? partySync.party.members : []}
        userId={user?.id}
        onSendHeal={isPartyMode ? partySync.sendHealAction : undefined}
        onShareBuffToParty={isPartyMode && partySync.party.partyId ? (condition, targetUserId) => {
          partySync.shareBuff({
            conditionName: condition.name,
            duration: condition.durationValue,
            durationType: condition.durationType,
            source: condition.source || condition.name,
            casterName: character.name,
            spellLevel: condition.spellLevel,
            category: condition.category as 'buff' | 'concentration' | 'debuff',
            targetUserId,
          });
        } : undefined}
        partyId={isPartyMode ? partySync.party.partyId : null}
        isPartyCreator={isPartyMode ? partySync.party.isCreator : false}
        autoSyncCallbacks={autoSyncCallbacks}
      >
        {isPartyMode && (
          <IncomingHealOverlay
            pendingHeals={partySync.pendingHeals}
            onAccept={partySync.acceptHeal}
            onReject={partySync.rejectHeal}
          />
        )}
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
          currentHP={effectiveCurrentHP}
          maxHP={effectiveMaxHP}
          tempHP={effectiveTempHP}
          shopItems={shop.shopItems}
          initiativeModifier={combatStats.initiativeBonus}
          isWildShape={wildShape.state.isTransformed}
          wildShapeFormName={wildShape.state.currentForm?.name}
          wildShapeSpeed={wildShape.state.currentForm?.speed}
          wildShapeAbilities={wildShape.state.currentForm?.specialAbilities}
          wildShapeUsesRemaining={wildShape.state.usesRemaining}
          wildShapeMaxUses={wildShape.state.maxUses}
          wildShapeTransformedAt={wildShape.state.transformedAt}
          wildShapeDurationMinutes={wildShape.state.transformDurationMinutes}
          wildShapeFormCR={wildShape.state.currentForm?.cr}
          wildShapeFormHP={wildShape.state.formHP}
          wildShapeFormMaxHP={wildShape.state.formMaxHP}
          wildShapeFormAC={wildShape.state.currentForm?.ac}
          onDismissWildShape={() => wildShape.revert()}
          wildShapeBackground={wildShapeBgs.getActiveBackground(wildShape.state.currentForm?.id)}
          customBackground={customBackground.customBackground}
          onCustomBackgroundUpload={(file: File) => customBackground.handleImageUpload(file, user?.id)}
          onCustomBackgroundClear={customBackground.clearCustomBackground}
          prestigeData={prestigeData}
          lastCloudSyncTime={autoSync.lastCloudSyncTime || lastCloudSyncTime}
          isCloudSyncing={autoSync.isSyncing}
          onCloudSyncClick={() => setShowCloudSaveModal(true)}
          onQuickSave={autoSync.syncNow}
          onLoadSave={handleLoadCloudSave}
          partySync={isPartyMode ? partySync : undefined}
          isAuthenticated={!!user}
          userId={user?.id}
          playMode={playMode}
          onPlayModeChange={setPlayMode}
        />
        
        {/* Settings Modal */}
        <SettingsModal 
          characterName={character.name} 
          onEditCharacter={() => setShowWizard(true)}
          onNewCharacter={handleNewCharacter}
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
          partySync={partySync}
          isAuthenticated={isAuthenticated}
          userId={user?.id}
          currentHP={effectiveCurrentHP}
          maxHP={effectiveMaxHP}
          tempHP={effectiveTempHP}
          ac={effectiveAC}
          characterLevel={character.level}
          playMode={playMode}
          onPlayModeChange={setPlayMode}
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
        currentHP={effectiveCurrentHP}
        maxHP={effectiveMaxHP}
        tempHP={effectiveTempHP}
        onHPChange={(current, temp) => handleHPChange(current, wildShape.state.isTransformed ? effectiveMaxHP : hpState.max, temp)}
      consumables={consumablesInventory}
      onUseConsumable={useConsumableItem}
      prestigeLevel={prestigeData.prestigeLevel}
      prestigeAbilities={prestigeTree.progress.unlockedAbilities}
      spellcasting={combatSpellcasting}
      channelDivinityInfo={channelDivinityInfo}
      wildShape={isDruidClass ? wildShape : undefined}
      onAssignWildShapeBackground={wildShapeBgs.assignBackground}
      onRemoveWildShapeBackground={wildShapeBgs.removeBackground}
      hasWildShapeBackground={wildShapeBgs.hasBackground}
      baseScores={abilityScores.baseScores}
      getScoreBreakdown={abilityScores.getScoreBreakdown}
      onIncrementScore={abilityScores.incrementScore}
      onDecrementScore={abilityScores.decrementScore}
      onRandomizeScores={abilityScores.randomizeScores}
      onApplyScores={abilityScores.applyScores}
        constitutionModifier={abilityScores.finalModifiers.constitution}
        lootItems={loot.lootItems}
        totalLootValue={loot.totalLootValue}
        combatContext={combatContext}
        partyMembers={isPartyMode ? partySync.party.members : []}
        userId={user?.id}
        onSendHeal={isPartyMode ? partySync.sendHealAction : undefined}
        onShareBuffToParty={isPartyMode && partySync.party.partyId ? (condition, targetUserId) => {
          partySync.shareBuff({
            conditionName: condition.name,
            duration: condition.durationValue,
            durationType: condition.durationType,
            source: condition.source || condition.name,
            casterName: character.name,
            spellLevel: condition.spellLevel,
            category: condition.category as 'buff' | 'concentration' | 'debuff',
            targetUserId,
          });
        } : undefined}
        partyId={isPartyMode ? partySync.party.partyId : null}
        isPartyCreator={isPartyMode ? partySync.party.isCreator : false}
        autoSyncCallbacks={autoSyncCallbacks}
      >
      {isPartyMode && (
        <IncomingHealOverlay
          pendingHeals={partySync.pendingHeals}
          onAccept={partySync.acceptHeal}
          onReject={partySync.rejectHeal}
        />
      )}
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
        currentHP={effectiveCurrentHP}
        maxHP={effectiveMaxHP}
        tempHP={effectiveTempHP}
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
          currentCharacterName={character.name}
          currentCharacterLevel={character.level}
          onLoadSave={handleLoadCloudSave}
          onCloudClick={() => setShowCloudSaveModal(true)}
        />

        {/* Content Area - Conditional Rendering Based on Active Sub-Tab */}
        <div className="flex-1">
          {/* FIGHTING CATEGORY */}
          {/* Combat Sub-Tab */}
          {activeTab === 'combat' && (
            <CombatTabScreen 
              character={character} 
              prestigePoints={prestigeData.totalPrestigePoints}
              spellcasting={combatSpellcasting}
              equipment={equipment}
              onNavigateToConsumables={handleNavigateToConsumables}
              equipmentStats={aggregatedStats}
              abilityModifiers={abilityScores.finalModifiers}
              currentHP={effectiveCurrentHP}
              maxHP={effectiveMaxHP}
              tempHP={effectiveTempHP}
              actionEconomyState={actionEconomy}
              globalConditions={convertConditionsToPromptFormat(conditions.conditions)}
              activeSetBonuses={convertSetBonusesToPromptFormat(aggregatedStats.activeSetBonuses)}
              concentrationSpell={combatSpellcasting.state.concentratingOn}
              lootItemsWithDice={loot.itemsWithDiceMechanics}
              onUseLootItem={(item) => {
                // Generate and copy AI prompt for loot use
                const prompt = generateLootUsePrompt(item, {
                  characterName: character.name,
                  currentHP: hpState.current,
                  maxHP: hpState.max,
                  conditions: convertConditionsToPromptFormat(conditions.conditions),
                  activeSetBonus: convertSetBonusesToPromptFormat(aggregatedStats.activeSetBonuses)[0],
                  storyContext: item.sourceText,
                });
                navigator.clipboard.writeText(prompt);
                
                // Log to combat log
                combatLog.addEntry({
                  actionType: 'item',
                  actionName: `Use ${item.name}`,
                  prompt,
                });
                
                toast({
                  title: `⚡ Using ${item.name}`,
                  description: "AI DM prompt copied to clipboard",
                  className: "border-cyan-500/50 bg-cyan-500/10",
                });
              }}
              deathSaves={deathSaves}
              onDeathSavesChange={handleDeathSavesChange}
              onRegainHP={(amount) => {
                // Regain HP from death saves (nat 20)
                handleHPChange(Math.min(amount, hpState.max), hpState.max, hpState.temp);
              }}
              onHPChange={handleHPChange}
              partySync={partySync}
              isAuthenticated={isAuthenticated}
              userId={user?.id}
              characterName={character.name}
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
                    unlockedPrestigeAbilities={prestigeTree.progress.unlockedAbilities}
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

          {/* Arcana Sub-Tab - Conditional rendering based on class */}
          {activeTab === 'arcana' && (
            <BackgroundWrapper 
              imagePath={builderBackground} 
              overlayOpacity={70} 
              tintColor="indigo" 
              tintOpacity={15}
              className="min-h-[calc(100vh-10vh)]"
            >
              {isRogueClass ? (
                // Rogue: Use legacy Magic Path system
                <MagicScreen
                  characterLevel={character.level}
                  characterName={character.name}
                  spellcasting={spellcasting}
                  conModifier={abilityScores.getScoreBreakdown('constitution').modifier}
                  proficiencyBonus={spellcasting.state.proficiencyBonus}
                  isProficientInConSaves={false}
                  onChangeClass={(classId) => {
                    setCharacter(prev => ({ ...prev, primaryClass: classId }));
                  }}
                />
              ) : (
                // Non-Rogue: Use class-based spellcasting (Wizard, Sorcerer, etc.)
                <ClassSpellcastingScreen
                  primaryClass={character.primaryClass ?? 'wizard'}
                  characterLevel={character.level}
                  characterName={character.name}
                  spellcasting={classSpellcasting}
                  conModifier={abilityScores.getScoreBreakdown('constitution').modifier}
                  proficiencyBonus={classSpellcasting.state.proficiencyBonus}
                  isProficientInConSaves={false}
                  onChangeClass={(classId) => {
                    setCharacter(prev => ({ ...prev, primaryClass: classId }));
                  }}
                  wildShapeInstance={wildShape}
                  onAssignWildShapeBackground={wildShapeBgs.assignBackground}
                  onRemoveWildShapeBackground={wildShapeBgs.removeBackground}
                  hasWildShapeBackground={wildShapeBgs.hasBackground}
                  homebrewSpells={spellCustomization.homebrewSpells}
                  onAddHomebrewSpell={(spell) => {
                    spellCustomization.addSpell(spell);
                    // Auto-learn homebrew spells so they appear in combat/quick-actions
                    classSpellcasting.learnSpell(spell.id);
                  }}
                  onUpdateHomebrewSpell={spellCustomization.updateSpell}
                  onRemoveHomebrewSpell={(id) => {
                    spellCustomization.removeSpell(id);
                    // Also forget from class spellcasting
                    classSpellcasting.forgetSpell(id);
                  }}
                />
              )}
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

          {/* Loot Sub-Tab */}
          {activeTab === 'loot' && (
            <LootScreen
              lootItems={loot.lootItems}
              soldHistory={loot.soldHistory}
              onAddLoot={loot.addLootItems}
              onDeleteLoot={loot.deleteLootItem}
              onSellLoot={loot.sellLootItem}
              onAddGold={shop.addGold}
              characterName={character.name}
              currentHP={hpState.current}
              maxHP={hpState.max}
              conditions={convertConditionsToPromptFormat(conditions.conditions)}
              activeSetBonus={convertSetBonusesToPromptFormat(aggregatedStats.activeSetBonuses)[0]}
              totalLootValue={loot.totalLootValue}
              onShareToParty={partySync.party.partyId ? (item) => {
                partySync.shareLoot({
                  added_by_name: character.name,
                  item_name: item.name,
                  item_description: item.description,
                  rarity: item.rarity,
                  gold_value: item.goldValue,
                });
              } : undefined}
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
              currentTempHP={hpState.temp}
              currentInspiration={hasInspiration}
              activeConditions={[]}
              deathSaves={deathSaves}
              spellSlots={spellcasting.state.spellSlots}
              playerInitiative={initiative.playerInitiative}
              currentRound={initiative.roundNumber}
              onApplyChanges={handleApplyChronicleChanges}
              onApplyGold={handleChronicleGold}
              onApplyHP={handleChronicleHP}
              onApplyConditions={handleChronicleConditions}
              onApplyRest={handleChronicleRest}
              onApplyDeathSaves={handleDeathSavesChange}
              onRegainHP={(amount) => {
                handleHPChange(Math.min(hpState.current + amount, hpState.max), hpState.max, hpState.temp);
              }}
              onApplySpellSlots={(slotsToExpend) => {
                // Expend slots by level - each entry is [level, count]
                Object.entries(slotsToExpend).forEach(([levelStr, count]) => {
                  const level = Number(levelStr);
                  for (let i = 0; i < count; i++) {
                    spellcasting.useSlot(level);
                  }
                });
                toast({
                  title: "Spell Slots Applied",
                  description: Object.entries(slotsToExpend)
                    .map(([l, c]) => `${c}× Level ${l}`)
                    .join(', ') + ' expended',
                });
              }}
              onApplyTempHP={(amount) => {
                // Temp HP doesn't stack - take the higher value
                const newTempHP = Math.max(hpState.temp, amount);
                handleHPChange(hpState.current, hpState.max, newTempHP);
                toast({
                  title: "🛡️ Temporary HP Applied",
                  description: newTempHP > hpState.temp 
                    ? `+${amount} temp HP (now ${newTempHP} total)`
                    : `Kept existing ${hpState.temp} temp HP (higher than ${amount})`,
                });
              }}
              onApplyInspiration={(newState) => {
                setHasInspiration(newState);
                toast({
                  title: newState ? "⭐ Inspiration Gained!" : "⭐ Inspiration Used",
                  description: newState 
                    ? "You have inspiration! Use it to gain advantage on a roll."
                    : "Inspiration spent - make that roll count!",
                });
              }}
              onApplyPlayerInitiative={(value) => {
                initiative.setPlayerInitiative(value);
                toast({
                  title: "⚔️ Initiative Set",
                  description: `Your initiative: ${value}`,
                });
              }}
              onApplyEnemyInitiative={(enemyId, value) => {
                targets.updateEnemy(enemyId, { initiative: value });
                const enemy = targets.enemies.find(e => e.id === enemyId);
                toast({
                  title: "⚔️ Enemy Initiative Set",
                  description: `${enemy?.name || 'Enemy'}: ${value}`,
                });
              }}
              onApplyRoundNumber={(round) => {
                initiative.setRoundNumber(round);
                toast({
                  title: "🔄 Combat Round Updated",
                  description: `Now on Round ${round}`,
                });
              }}
              existingEnemies={targets.enemies}
              onAddEnemies={targets.importEnemies}
              onUpdateEnemy={targets.updateEnemy}
              onClearDefeated={targets.clearDefeated}
              onRefreshEnemies={targets.refreshFromStorage}
              onApplyEnemyDamage={targets.dealDamage}
              onApplyEnemyHealing={targets.healEnemy}
              onToggleEnemyCondition={targets.toggleCondition}
              onDefeatEnemy={(id) => targets.updateEnemy(id, { currentHP: 0 })}
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
          onNewCharacter={handleNewCharacter}
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
          partySync={partySync}
          isAuthenticated={isAuthenticated}
          userId={user?.id}
          currentHP={effectiveCurrentHP}
          maxHP={effectiveMaxHP}
          tempHP={effectiveTempHP}
          ac={effectiveAC}
          characterLevel={character.level}
          playMode={playMode}
          onPlayModeChange={setPlayMode}
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
