import { useState, useEffect, useCallback, createContext, useContext, ReactNode, useMemo, useRef } from 'react';
import { getScopedItem } from '@/lib/scoped-storage';
import { useCharacterIdentity } from '@/hooks/use-character-identity';
import { isMomoEasterEgg } from '@/lib/easter-eggs';
import { loadState as loadGeraltState, ATTACKS as GERALT_ATTACKS } from '@/components/companion/geralt-data';
import { Gem, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { InfinityStoneDrawer } from './InfinityStoneDrawer';
import { AbilitiesDrawer } from './AbilitiesDrawer';
import { StatsDrawer } from './StatsDrawer';
import { ScribeDrawer } from './ScribeDrawer';
import { ActiveSetBonusDrawer } from './ActiveSetBonusDrawer';
import { CooldownDrawer } from './CooldownDrawer';
import { QuickActionsDrawer } from './QuickActionsDrawer';
import { OracleDrawer } from '@/components/oracle';
import { ConditionDrawer } from '@/components/conditions';
import { AIDMScreen } from '@/components/ai-dm';
import { StandalonePartyDMScreen } from '@/components/ai-dm/StandalonePartyDMScreen';
import { PersonalityTestWizard } from '@/components/ai-dm/PersonalityTestWizard';
import { PersonalityResultsScreen } from '@/components/ai-dm/PersonalityResultsScreen';
import { ReturnToSheetButton } from '@/components/ai-dm/ReturnToSheetButton';
import { ModeCharacterPicker } from '@/components/ai-dm/ModeCharacterPicker';
import { clearSheetReturn, getSheetReturn } from '@/lib/sheetReturn';
import { ensureBinding, getBoundSaveId, setBoundSaveId, type DMMode } from '@/lib/modeCharacterBinding';
import { usePersonalityGate } from '@/hooks/use-personality-gate';
import { Character } from '@/lib/types';
import { XPPreset, getXPForLevel } from '@/lib/xpSystem';
import { useXPProgression } from '@/hooks/use-xp-progression';
import { getXPSnapshot } from '@/lib/xpSystem';
import { CharacterEquipment } from '@/lib/inventory/types';
import { InventoryItem as ConsumableItem } from '@/lib/consumables/types';
import { LootItem } from '@/lib/loot/types';
import { CombatLogEntry } from '@/hooks/use-combat-log';
import { Enemy } from '@/lib/combat/targetTypes';
import { ActionEconomy } from '@/lib/combat/combatTypes';
import { useGameMode, shouldShowInfinityStones } from '@/hooks/use-game-mode';
import { useEquipmentStats } from '@/hooks/use-equipment-stats';
import { useCombatStats } from '@/hooks/use-combat-stats';
import { useCooldowns } from '@/hooks/use-cooldowns';
import { useConditions, UseConditionsReturn } from '@/hooks/use-conditions';
import { Personality, CharacterContext } from '@/components/oracle/types';
import { allAbilities } from '@/lib/abilities';
import { useAbilityCustomization } from '@/hooks/use-ability-customization';
import { getCustomizedAbilities } from '@/lib/abilityCustomization';
import { getSpellById } from '@/lib/magic/spells';
import { UseSpellcastingReturn } from '@/hooks/use-spellcasting';
import { UseWildShapeReturn } from '@/hooks/use-wild-shape';
import { AbilityName, BaseAbilityScores, AbilityScoreBreakdown } from '@/lib/abilityScores/types';

const DOMAIN_NAME_MAP: Record<string, string> = {
  life: 'Life', light: 'Light', war: 'War', knowledge: 'Knowledge',
  nature: 'Nature', tempest: 'Tempest', trickery: 'Trickery', death: 'Death',
};

interface PromptDrawerContextValue {
  openInfinityDrawer: () => void;
  openAbilitiesDrawer: () => void;
  openStatsDrawer: () => void;
  openScribeDrawer: () => void;
  openSetBonusDrawer: () => void;
  openCooldownDrawer: () => void;
  openOracleDrawer: () => void;
  openConditionsDrawer: () => void;
  openAddConditionSheet: () => void;
  openQuickActionsDrawer: () => void;
  openAIDMScreen: () => void;
  openPartyDMScreen: () => void;
  openPartyDMCampaignBuilder: () => void;
  openModeCharacterPicker: (mode: 'solo' | 'party' | 'empyrean') => void;
  closeAllDrawers: () => void;
  // Cooldown system exposure
  triggerCooldown: (abilityId: string) => void;
  isOnCooldown: (abilityId: string) => boolean;
  getRemainingTime: (abilityId: string) => number;
  formatRemainingTime: (seconds: number) => string;
  resetShortRestCooldowns: () => void;
  resetAllCooldowns: () => void;
  // Cooldown summary for Home Screen status indicators
  cooldownSummary: {
    readyCount: number;
    coolingCount: number;
  };
  // Conditions system exposure
  conditions: UseConditionsReturn;
  // Character context for AI DM (shared for Empyrean etc.)
  characterContext: CharacterContext;
  // Oracle quest extraction callback registration
  registerOracleQuestCallback: (cb: ((quests: Array<{ key: string; status: 'active' | 'completed' | 'failed'; notes?: string }>) => void) | null) => void;
}

const PromptDrawerContext = createContext<PromptDrawerContextValue | null>(null);

export function usePromptDrawers() {
  const context = useContext(PromptDrawerContext);
  if (!context) {
    throw new Error('usePromptDrawers must be used within PromptDrawerProvider');
  }
  return context;
}

interface PromptDrawerProviderProps {
  children: ReactNode;
  character: Character;
  unlockedAbilities: Map<string, number>;
  enabled?: boolean;
  // Stats drawer props
  currentXP?: number;
  /** Active cloud save id, for the AI DM per-mode character binding */
  activeCloudSaveId?: string | null;
  /** All the player's cloud saves, for the in-DM character picker */
  cloudSaves?: Array<{ id: string; save_name: string; character_name?: string; character_level?: number; updated_at: string }>;
  onRefreshCloudSaves?: () => void;
  /** Switch the active character. Resolves true on success. */
  onSwitchCharacterSave?: (saveId: string) => Promise<boolean>;
  xpPreset?: XPPreset;
  onAddXP?: (amount: number, source: string) => void;
  // Equipment for set bonus drawer
  equipment?: CharacterEquipment;
  // HP props for Oracle and Stats
  currentHP?: number;
  maxHP?: number;
  tempHP?: number;
  onHPChange?: (current: number, temp: number) => void;
  // Consumables for Oracle and Quick Actions
  consumables?: ConsumableItem[];
  onUseConsumable?: (consumableId: string) => boolean;
  // Prestige for Oracle
  prestigeLevel?: number;
  prestigeAbilities?: string[];
  // Spellcasting
  spellcasting?: UseSpellcastingReturn;
  // Channel Divinity (Cleric)
  channelDivinityInfo?: {
    current: number;
    max: number;
    clericLevel: number;
    domainName?: string;
    deityName?: string;
    options: Array<{ id: string; name: string; description: string; mechanicalEffect?: string; isDomain: boolean }>;
    useChannelDivinity: (optionName?: string) => boolean;
    restoreChannelDivinity: () => void;
  };
  // Wild Shape
  wildShape?: UseWildShapeReturn;
  // Wild Shape backgrounds
  onAssignWildShapeBackground?: (formId: string, file: File) => Promise<void>;
  onRemoveWildShapeBackground?: (formId: string) => void;
  hasWildShapeBackground?: (formId: string) => boolean;
  // Ability Scores
  baseScores?: BaseAbilityScores;
  getScoreBreakdown?: (ability: AbilityName) => AbilityScoreBreakdown;
  onIncrementScore?: (ability: AbilityName) => void;
  onDecrementScore?: (ability: AbilityName) => void;
  onRandomizeScores?: () => number[];
  onApplyScores?: (scores: BaseAbilityScores) => void;
  // Constitution modifier for HP calculation
  constitutionModifier?: number;
  // Loot for Oracle
  lootItems?: LootItem[];
  totalLootValue?: number;
  // Subclass for Oracle (e.g. Circle of the Moon, Life Domain)
  subclass?: string;
  // Combat context for Oracle tactical advice
  combatContext?: {
    isInCombat: boolean;
    roundNumber: number;
    isPlayerTurn: boolean;
    economy: ActionEconomy;
    currentTarget: Enemy | null;
    enemies: Enemy[];
    recentLogEntries: CombatLogEntry[];
  };
  // Party props for heal target picker
  partyMembers?: import('@/hooks/use-party-sync').PartyMember[];
  userId?: string;
  onSendHeal?: (targetUserId: string, actionData: { senderName?: string; itemName?: string; hpHealed?: number }) => Promise<void>;
  // Party buff sharing
  onShareBuffToParty?: (condition: import('@/lib/conditions').ActiveCondition, targetUserId: string) => void;
  // Party DM props
  partyId?: string | null;
  isPartyCreator?: boolean;
  // Party chat callback (opens fullscreen party chat from Party DM)
  onOpenPartyChat?: () => void;
  // Auto-sync callbacks for AI DM
  autoSyncCallbacks?: {
    onHPChange: (change: number, type: 'damage' | 'healing') => void;
    onHPSet?: (hp: number) => void;
    onUseConsumableByName?: (name: string, quantity?: number) => boolean;
    onAddXP: (amount: number, source: string) => void;
    onGoldChange: (netChange: number) => void;
    onConditionChange: (toAdd: string[], toRemove: string[]) => void;
    onRestOccurred: (type: 'short' | 'long') => void;
    getCurrentHP: () => number;
    getCurrentGold: () => number;
  };

  /** Manual level advance used by the solo DM character sheet */
  onManualLevelUp?: () => void;
  /** Accept an item awarded by the AI DM into the loot inventory */
  onAcceptDmItem?: (name: string, quantity: number, details?: { goldValue?: number; description?: string; rarity?: string; category?: string; effect?: string; dice?: string }) => void;
}

export function PromptDrawerProvider({
  children,
  character,
  unlockedAbilities,
  enabled = true,
  currentXP = 0,
  xpPreset = 'standard',
  onAddXP = () => {},
  onManualLevelUp,
  onAcceptDmItem,
  activeCloudSaveId,
  cloudSaves,
  onRefreshCloudSaves,
  onSwitchCharacterSave,
  equipment,
  currentHP,
  maxHP,
  tempHP = 0,
  onHPChange,
  consumables = [],
  onUseConsumable,
  prestigeLevel = 0,
  prestigeAbilities = [],
  spellcasting,
  channelDivinityInfo,
  wildShape,
  onAssignWildShapeBackground,
  onRemoveWildShapeBackground,
  hasWildShapeBackground,
  // Ability Scores
  baseScores,
  getScoreBreakdown,
  onIncrementScore,
  onDecrementScore,
  onRandomizeScores,
  onApplyScores,
  constitutionModifier = 0,
  lootItems = [],
  totalLootValue = 0,
  subclass,
  combatContext,
  partyMembers = [],
  userId,
  onSendHeal,
  onShareBuffToParty,
  partyId,
  isPartyCreator = false,
  onOpenPartyChat,
  autoSyncCallbacks,
}: PromptDrawerProviderProps) {
  const [infinityOpen, setInfinityOpen] = useState(false);
  const [abilitiesOpen, setAbilitiesOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [scribeOpen, setScribeOpen] = useState(false);
  const [setBonusOpen, setSetBonusOpen] = useState(false);
  const [cooldownOpen, setCooldownOpen] = useState(false);
  const [oracleOpen, setOracleOpen] = useState(false);
  const [conditionsOpen, setConditionsOpen] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [aiDMOpen, setAiDMOpen] = useState(false);
  const [partyDMOpen, setPartyDMOpen] = useState(false);
  const [partyDMBuilderAutoOpen, setPartyDMBuilderAutoOpen] = useState(false);

  // Which mode is currently resolving its bound character, if any.
  const [pendingMode, setPendingMode] = useState<DMMode | null>(null);
  const [pickerMode, setPickerMode] = useState<DMMode | null>(null);

  // Personality gate for Solo DM
  const personalityGate = usePersonalityGate({ userId });
  const { gender: identityGender, race: identityRace, backstory: identityBackstory, relationships: identityRelationships } = useCharacterIdentity();
  
  const [oraclePersonality, setOraclePersonality] = useState<Personality>('deadpool');
  
  // Game mode integration for Infinity Stones lock and cooldown enforcement
  const { infinityStonesLocked, isHonestMode, enforceCooldowns } = useGameMode();
  const isInfinityLocked = !shouldShowInfinityStones(character.level, infinityStonesLocked);
  
  // Calculate equipment stats for real-time display
  const defaultEquipment: CharacterEquipment = { slots: {} as any, inventory: [] };
  const equipmentStats = useEquipmentStats(equipment || defaultEquipment);
  
  // Ability modifiers for combat stats (AC, initiative, proficiency bonus)
  const abilityModifiers = useMemo(() => {
    if (!getScoreBreakdown) return undefined;
    return {
      strength: getScoreBreakdown('strength').modifier,
      dexterity: getScoreBreakdown('dexterity').modifier,
      constitution: getScoreBreakdown('constitution').modifier,
      intelligence: getScoreBreakdown('intelligence').modifier,
      wisdom: getScoreBreakdown('wisdom').modifier,
      charisma: getScoreBreakdown('charisma').modifier,
    };
  }, [getScoreBreakdown]);
  const combatStats = useCombatStats({ character, equipmentStats, abilityModifiers });
  
  // Cooldown system
  const cooldownSystem = useCooldowns({
    characterAbilities: character.abilities,
    isHonestMode,
    enforceCooldowns,
  });
  
  // Conditions system
  const conditionsSystem = useConditions();
  
  // Close all drawers when opening a new one
  const closeAllDrawers = useCallback(() => {
    setInfinityOpen(false);
    setAbilitiesOpen(false);
    setStatsOpen(false);
    setScribeOpen(false);
    setSetBonusOpen(false);
    setCooldownOpen(false);
    setOracleOpen(false);
    setConditionsOpen(false);
    setQuickActionsOpen(false);
    setAiDMOpen(false);
  }, []);

  // Open a DM mode after making sure its bound character is the active one.
  const openModeWithCharacter = useCallback(async (mode: DMMode, open: () => void) => {
    const target = ensureBinding(mode, activeCloudSaveId ?? null);
    // No binding possible (guest, or no cloud saves): behave exactly as before.
    if (!target || target === activeCloudSaveId || !onSwitchCharacterSave) {
      open();
      return;
    }

    setPendingMode(mode);
    try {
      const ok = await onSwitchCharacterSave(target);
      if (!ok) {
        // The remembered character is gone or unreadable: forget it so the next
        // open falls back to whoever is active instead of failing again.
        setBoundSaveId(mode, null);
        toast.error('Could not load this mode\u2019s character', {
          description: 'Opening with the current character instead.',
        });
      }
    } finally {
      setPendingMode(null);
      open();
    }
  }, [activeCloudSaveId, onSwitchCharacterSave]);

  // Any overlay can ask the app to jump to a main tab by dispatching
  // 'odyssey-navigate-tab' (see navigateToTab in SoloCharacterSheet.tsx).
  // Index.tsx handles the actual tab switch, but the full-screen DM overlays
  // live in this provider and would otherwise stay mounted on top of the new tab.
  useEffect(() => {
    const handleNavigateTab = () => {
      closeAllDrawers();
      setPartyDMOpen(false);
      setPartyDMBuilderAutoOpen(false);
    };
    window.addEventListener('odyssey-navigate-tab', handleNavigateTab);
    return () => window.removeEventListener('odyssey-navigate-tab', handleNavigateTab);
  }, [closeAllDrawers]);


  // Edge swipe detection
  useEffect(() => {
    if (!enabled) return;

    let startX = 0;
    let startY = 0;
    const EDGE_THRESHOLD = 30;
    const SWIPE_THRESHOLD = 60;

    const handleTouchStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const diffX = endX - startX;
      const diffY = Math.abs(endY - startY);
      
      if (diffY > Math.abs(diffX) * 0.5) return;

      // Left edge swipe right → open stats (first drawer)
      if (startX < EDGE_THRESHOLD && diffX > SWIPE_THRESHOLD) {
        closeAllDrawers();
        setStatsOpen(true);
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, closeAllDrawers, isInfinityLocked, character.level]);

  // Handle opening infinity drawer with lock check
  const handleOpenInfinityDrawer = useCallback(() => {
    if (isInfinityLocked) {
      toast.error(`RP Prompts locked until Level 20 (Current: ${character.level})`);
      return;
    }
    closeAllDrawers();
    setInfinityOpen(true);
  }, [isInfinityLocked, character.level, closeAllDrawers]);

  // Compute cooldown summary for status indicators
  const cooldownSummary = useMemo(() => {
    let readyCount = 0;
    let coolingCount = 0;
    
    cooldownSystem.cooldowns.forEach((cooldown) => {
      if (cooldown.isOnCooldown) {
        coolingCount++;
      } else if (cooldown.lastUsed) {
        // Only count as "ready" if it was previously triggered
        readyCount++;
      }
    });
    
    return { readyCount, coolingCount };
  }, [cooldownSystem.cooldowns]);

  // Listen for quick action removal events from DM screens
  useEffect(() => {
    const handleQuickActionRemove = (e: Event) => {
      const { category, name, slot } = (e as CustomEvent).detail as { category: string; name: string; slot?: string };
      
      if ((category === 'spell' || category === 'cantrip' || category === 'homebrew-spell') && spellcasting) {
        // Reverse-lookup spell name → ID
        const allPrepared = [...spellcasting.state.preparedSpells, ...spellcasting.state.knownSpells];
        const spellId = allPrepared.find(id => {
          const spell = getSpellById(id);
          return spell?.name === name || id === name;
        });
        if (spellId) {
          spellcasting.unprepareSpell(spellId);
        }
      }
      // Weapon/ability/consumable/prestige removal is handled by Index.tsx via the same event
    };
    
    window.addEventListener('dm-quick-action-remove', handleQuickActionRemove);
    return () => window.removeEventListener('dm-quick-action-remove', handleQuickActionRemove);
  }, [spellcasting]);

  // XP progression pace (multiplier-aware thresholds for the AI DM briefing)
  const { mode: xpProgressionMode, multiplier: xpMultiplier } = useXPProgression();

  // Homebrew abilities and player overrides live here, not in the base registry.
  const abilityCustomization = useAbilityCustomization();

  // Build full character context for AI DM (same logic as OracleDrawer)
  const aiDMCharacterContext = useMemo<CharacterContext>(() => {
    const hp = currentHP ?? character.level * 8 + 10;
    const hpMax = maxHP ?? character.level * 8 + 10;

    // Base abilities with player overrides applied, plus player-created homebrew.
    const resolvedAbilities = getCustomizedAbilities(allAbilities, abilityCustomization.state);
    const findAbility = (id: string) => resolvedAbilities.find(ab => ab.id === id);

    const abilitiesList = character.abilities
      .filter(a => a.currentTier > 0)
      .map(a => {
        const ability = findAbility(a.abilityId) as (ReturnType<typeof findAbility> & {
          isHomebrew?: boolean;
          isCustomized?: boolean;
          customCooldownMinutes?: number;
          attackType?: string;
          customDice?: Record<string, { count: number; die: number } | undefined>;
        }) | undefined;

        const tierEffect = ability?.tierEffects?.find(t => t.tier === a.currentTier);
        const tierDice = ability?.customDice?.[`tier${a.currentTier}`];

        return {
          name: ability?.name || a.abilityId,
          tier: a.currentTier,
          tree: ability?.tree || 'unknown',
          type: ability?.type,
          actionType: ability?.actionType,
          usageType: ability?.usageType,
          effect: tierEffect?.description,
          dice: tierDice ? `${tierDice.count}d${tierDice.die}` : undefined,
          cooldownMinutes: ability?.customCooldownMinutes,
          attackType: ability?.attackType,
          isHomebrew: ability?.isHomebrew === true ? true : undefined,
          isCustomized: ability?.isCustomized === true ? true : undefined,
        };
      });

    const equippedAbilitiesList = character.equippedAbilities
      .map(id => findAbility(id)?.name || id)
      .filter(Boolean) as string[];

    const equipmentList: Array<{ slot: string; name: string; rarity: string }> = [];
    if (equipment) {
      Object.entries(equipment.slots).forEach(([slot, item]) => {
        if (item) equipmentList.push({ slot, name: item.name, rarity: item.rarity });
      });
    }

    const consumablesList = consumables
      .filter(c => c.quantity > 0)
      .map(c => ({
        name: c.consumable.name, quantity: c.quantity, type: c.consumable.type,
      }));

    const activeCooldowns: Array<{ name: string; remainingSeconds: number }> = [];
    const readyCooldowns: string[] = [];
    if (cooldownSystem.cooldowns) {
      cooldownSystem.cooldowns.forEach((state, abilityId) => {
        const name = findAbility(abilityId)?.name || abilityId;
        const remaining = cooldownSystem.getRemainingTime(abilityId);
        if (remaining > 0) activeCooldowns.push({ name, remainingSeconds: remaining });
        else if (state.lastUsed) readyCooldowns.push(name);
      });
    }

    let spellcastingContext: CharacterContext['spellcasting'] = undefined;
    if (spellcasting?.state.path) {
      const { state, spellAttackBonus, spellSaveDC, totalSlotsRemaining } = spellcasting;

      // Homebrew spells exist only in this player's app, so the DM cannot look them
      // up. Ship the full stat block for every custom spell the character knows or
      // has prepared, deduplicated, capped so the prompt stays a sane size.
      // Highest spell slot level the character actually has, used to flag spells
      // that are known but not yet castable.
      const highestSlotLevel = Object.entries(state.spellSlots)
        .filter(([, s]) => s.max > 0)
        .reduce((hi, [lvl]) => Math.max(hi, parseInt(lvl, 10)), 0);
      const customSpellIds = Array.from(new Set([...state.preparedSpells, ...state.knownSpells]));
      const homebrewSpells = customSpellIds
        .map(id => getSpellById(id))
        .filter((s): s is NonNullable<typeof s> => !!s && (s as { isHomebrew?: boolean }).isHomebrew === true)
        .slice(0, 12)
        .map(s => ({
          name: s.name,
          level: s.level,
          school: s.school,
          castingTime: s.castingTime,
          range: s.range,
          duration: s.duration,
          concentration: s.concentration,
          ritual: s.ritual,
          description: s.description,
          higherLevels: s.higherLevels,
          attackType: s.attackType,
          saveStat: s.saveStat,
          damageType: s.damageType,
          damageFormula: s.damageFormula,
          healingFormula: s.healingFormula,
          verbal: s.components?.verbal ?? false,
          somatic: s.components?.somatic ?? false,
          material: s.components?.material,
          castable: s.level === 0 || s.level <= highestSlotLevel,
        }));

      spellcastingContext = {
        path: state.path,
        spellAttackBonus,
        spellSaveDC,
        totalSlotsRemaining,
        concentratingOn: state.concentratingOn ? getSpellById(state.concentratingOn)?.name || state.concentratingOn : null,
        preparedSpells: state.preparedSpells.map(id => getSpellById(id)?.name || id),
        slots: Object.entries(state.spellSlots).filter(([_, s]) => s.max > 0).map(([l, s]) => ({ level: parseInt(l), current: s.current, max: s.max })),
        pactSlots: state.pactSlots ? { current: state.pactSlots.current, max: state.pactSlots.max, level: state.pactSlots.level } : undefined,
        homebrewSpells: homebrewSpells.length > 0 ? homebrewSpells : undefined,
      };
    }

    // The DM already has getCurrentGold for applying changes, but has never been
    // told the balance. Reuse the same accessor so there is one source of truth.
    const goldAmount = autoSyncCallbacks?.getCurrentGold?.();

    const lootContext: CharacterContext['loot'] = lootItems.length > 0 ? {
      items: lootItems.map(item => ({ name: item.name, category: item.category, rarity: item.rarity, goldValue: item.goldValue, hasDiceMechanics: item.hasDiceMechanics })),
      totalValue: totalLootValue,
      usableCount: lootItems.filter(i => i.category === 'usable').length,
      diceMechanicsCount: lootItems.filter(i => i.hasDiceMechanics).length,
    } : undefined;

    let combatContextData: CharacterContext['combat'] = undefined;
    if (combatContext?.isInCombat) {
      combatContextData = {
        isInCombat: true,
        roundNumber: combatContext.roundNumber,
        isPlayerTurn: combatContext.isPlayerTurn,
        actionUsed: combatContext.economy.actionUsed,
        bonusActionUsed: combatContext.economy.bonusActionUsed,
        reactionUsed: combatContext.economy.reactionUsed,
        movementUsed: combatContext.economy.movementUsed,
        maxMovement: combatContext.economy.maxMovement,
        currentTarget: combatContext.currentTarget ? {
          name: combatContext.currentTarget.name, ac: combatContext.currentTarget.ac,
          currentHP: combatContext.currentTarget.currentHP, maxHP: combatContext.currentTarget.maxHP,
          conditions: combatContext.currentTarget.conditions || [], resistances: combatContext.currentTarget.resistances || [],
          vulnerabilities: combatContext.currentTarget.vulnerabilities || [], immunities: combatContext.currentTarget.immunities || [],
        } : null,
        enemies: combatContext.enemies.map(e => ({ name: e.name, currentHP: e.currentHP, maxHP: e.maxHP, isDefeated: e.currentHP <= 0, conditions: e.conditions || [] })),
        recentActions: combatContext.recentLogEntries.slice(0, 5).map(entry => ({
          actionType: entry.actionType, actionName: entry.actionName, timestamp: entry.timestamp.toISOString(),
          damage: entry.damage, wasHit: entry.roll ? entry.roll.total > 0 : undefined, wasCrit: entry.roll?.isCrit,
        })),
      };
    }

    // Map conditions from conditionsSystem
    const activeConditions = conditionsSystem.debuffs.map(c => ({
      name: c.name, remainingRounds: c.durationValue ?? 0, source: c.source, severity: c.severity || 'moderate', saveType: c.saveType,
    }));
    const activeBuffs = conditionsSystem.buffs.map(b => ({
      name: b.name, remainingMinutes: b.durationValue ?? 0, concentration: b.category === 'concentration',
    }));

    // Build ability scores context from breakdown
    const abilityScoresContext = getScoreBreakdown ? {
      strength: (() => { const b = getScoreBreakdown('strength'); return { base: b.base, modifier: b.modifier, final: b.total }; })(),
      dexterity: (() => { const b = getScoreBreakdown('dexterity'); return { base: b.base, modifier: b.modifier, final: b.total }; })(),
      constitution: (() => { const b = getScoreBreakdown('constitution'); return { base: b.base, modifier: b.modifier, final: b.total }; })(),
      intelligence: (() => { const b = getScoreBreakdown('intelligence'); return { base: b.base, modifier: b.modifier, final: b.total }; })(),
      wisdom: (() => { const b = getScoreBreakdown('wisdom'); return { base: b.base, modifier: b.modifier, final: b.total }; })(),
      charisma: (() => { const b = getScoreBreakdown('charisma'); return { base: b.base, modifier: b.modifier, final: b.total }; })(),
    } : undefined;

    // Read deity/domain from scoped storage
    let deity: string | undefined;
    let domain: string | undefined;
    try {
      deity = getScopedItem('dnd-cleric-deity') || undefined;
      const savedDomain = getScopedItem('dnd-cleric-domain');
      if (savedDomain) {
        domain = DOMAIN_NAME_MAP[savedDomain] || savedDomain.charAt(0).toUpperCase() + savedDomain.slice(1);
      }
    } catch {}

    // Read proficiencies/expertise from scoped storage (managed by DiceRollerScreen)
    let proficientSkills: string[] = [];
    let proficientSaves: string[] = [];
    let expertiseSkills: string[] = [];
    try {
      proficientSkills = JSON.parse(getScopedItem('odyssey-proficient-skills') || '[]');
      proficientSaves = JSON.parse(getScopedItem('odyssey-proficient-saves') || '[]');
      expertiseSkills = JSON.parse(getScopedItem('odyssey-expertise-skills') || '[]');
    } catch {}

    // Geralt companion context (momo only)
    let companionContext: CharacterContext['companion'] = undefined;
    if (isMomoEasterEgg(character.name)) {
      const gs = loadGeraltState(userId || 'default');
      companionContext = {
        name: 'Geralt',
        currentHP: gs.currentHP,
        maxHP: gs.maxHP,
        conditions: gs.conditions,
        mood: gs.mood,
        abilities: gs.abilities,
        attacks: GERALT_ATTACKS.map(a => ({ name: a.name, bonus: a.bonus, damage: a.damage, desc: a.desc })),
      };
    }

    // Build class identity
    const characterClass = character.primaryClass || 'rogue';
    const multiclassBreakdown: Record<string, number> | undefined =
      character.multiclassLevels && Object.keys(character.multiclassLevels).length > 0
        ? { [characterClass]: character.level, ...character.multiclassLevels }
        : undefined;

    // Progression snapshot from the shared XP calculator (single source of truth —
    // identical numbers to the character sheet and the DM header strip)
    const xpSnap = getXPSnapshot(character.level, currentXP, xpMultiplier);
    const isMilestone = xpSnap.mode === 'milestone';
    const progression: CharacterContext['progression'] = {
      mode: xpSnap.mode,
      currentXP: isMilestone ? undefined : xpSnap.totalXP,
      xpForNextLevel: isMilestone || xpSnap.isMaxLevel ? undefined : xpSnap.nextLevelXP,
      xpRemaining: isMilestone || xpSnap.isMaxLevel ? undefined : xpSnap.xpRemaining,
      xpLevelFloor: isMilestone ? undefined : xpSnap.levelFloor,
      xpIntoLevel: isMilestone ? undefined : xpSnap.xpIntoLevel,
      xpLevelSpan: isMilestone || xpSnap.isMaxLevel ? undefined : xpSnap.xpLevelSpan,
      pace: isMilestone ? undefined : `${xpProgressionMode} (${xpMultiplier}x XP table)`,
    };

    return {
      name: character.name, level: character.level, currentHP: hp, maxHP: hpMax,
      progression,
      gender: identityGender || undefined,
      race: identityRace || undefined,
      backstory: identityBackstory || undefined,
      relationships: identityRelationships.length > 0 ? identityRelationships.map(r => ({ name: r.name, disposition: r.disposition, notes: r.notes })) : undefined,
      characterClass,
      multiclassBreakdown,
      deity, domain,
      abilities: abilitiesList, equippedAbilities: equippedAbilitiesList, equipment: equipmentList,
      activeSetBonuses: [], consumables: consumablesList,
      cooldowns: { active: activeCooldowns, ready: readyCooldowns },
      prestigeLevel, prestigeAbilities, activeConditions, activeBuffs,
      spellcasting: spellcastingContext, loot: lootContext, combat: combatContextData,
      abilityScores: abilityScoresContext,
      defenses: {
        armorClass: combatStats.ac,
        tempHP: tempHP ?? 0,
        initiativeBonus: combatStats.initiativeBonus,
      },
      proficiencies: {
        bonus: combatStats.proficiencyBonus,
        skills: proficientSkills,
        saves: proficientSaves,
        expertise: expertiseSkills,
      },
      gold: typeof goldAmount === 'number' && Number.isFinite(goldAmount) ? goldAmount : undefined,
      companion: companionContext,
      wildShape: wildShape ? {
        isTransformed: wildShape.state.isTransformed,
        formName: wildShape.state.currentForm?.name ?? null,
        formHP: wildShape.state.formHP,
        formMaxHP: wildShape.state.formMaxHP,
        formAC: wildShape.state.currentForm?.ac ?? null,
        formCR: wildShape.state.currentForm?.cr ?? null,
        usesRemaining: wildShape.state.usesRemaining,
        maxUses: wildShape.state.maxUses,
      } : undefined,
    };
  }, [character, currentHP, maxHP, tempHP, currentXP, xpProgressionMode, xpMultiplier, abilityCustomization.state, autoSyncCallbacks, equipment, consumables, cooldownSystem.cooldowns, cooldownSystem.getRemainingTime,
      prestigeLevel, prestigeAbilities, spellcasting, lootItems, totalLootValue, combatContext, conditionsSystem.debuffs, conditionsSystem.buffs,
      getScoreBreakdown, identityGender, identityRace, identityBackstory, identityRelationships,
      combatStats.ac, combatStats.initiativeBonus, combatStats.proficiencyBonus,
      wildShape?.state.isTransformed, wildShape?.state.currentForm, wildShape?.state.formHP, wildShape?.state.formMaxHP, wildShape?.state.usesRemaining, wildShape?.state.maxUses]);

  const [oracleQuestCallback, setOracleQuestCallback] = useState<((quests: Array<{ key: string; status: 'active' | 'completed' | 'failed'; notes?: string }>) => void) | null>(null);

  const contextValue: PromptDrawerContextValue = {
    openInfinityDrawer: handleOpenInfinityDrawer,
    openAbilitiesDrawer: useCallback(() => { closeAllDrawers(); setAbilitiesOpen(true); }, [closeAllDrawers]),
    openStatsDrawer: useCallback(() => { closeAllDrawers(); setStatsOpen(true); }, [closeAllDrawers]),
    openScribeDrawer: useCallback(() => { closeAllDrawers(); setScribeOpen(true); }, [closeAllDrawers]),
    openSetBonusDrawer: useCallback(() => { closeAllDrawers(); setSetBonusOpen(true); }, [closeAllDrawers]),
    openCooldownDrawer: useCallback(() => { closeAllDrawers(); setCooldownOpen(true); }, [closeAllDrawers]),
    openOracleDrawer: useCallback(() => { closeAllDrawers(); setOracleOpen(true); }, [closeAllDrawers]),
    openConditionsDrawer: useCallback(() => { closeAllDrawers(); setConditionsOpen(true); }, [closeAllDrawers]),
    openAddConditionSheet: useCallback(() => { setConditionsOpen(true); }, []),
    openQuickActionsDrawer: useCallback(() => {
      // Close other drawers but preserve AI DM screen state
      setInfinityOpen(false);
      setAbilitiesOpen(false);
      setStatsOpen(false);
      setScribeOpen(false);
      setSetBonusOpen(false);
      setCooldownOpen(false);
      setOracleOpen(false);
      setConditionsOpen(false);
      setQuickActionsOpen(true);
    }, []),
    openAIDMScreen: useCallback(() => {
      // Opening the DM deliberately should land on the chat, not silently
      // reopen a character sheet the player walked away from earlier.
      clearSheetReturn();
      closeAllDrawers();
      void openModeWithCharacter('solo', () => setAiDMOpen(true));
    }, [closeAllDrawers, openModeWithCharacter]),
    openPartyDMScreen: useCallback(() => {
      closeAllDrawers();
      void openModeWithCharacter('party', () => setPartyDMOpen(true));
    }, [closeAllDrawers, openModeWithCharacter]),
    openPartyDMCampaignBuilder: useCallback(() => {
      closeAllDrawers();
      void openModeWithCharacter('party', () => { setPartyDMOpen(true); setPartyDMBuilderAutoOpen(true); });
    }, [closeAllDrawers, openModeWithCharacter]),
    openModeCharacterPicker: useCallback((mode: DMMode) => setPickerMode(mode), []),
    closeAllDrawers,
    // Cooldown system exposure
    triggerCooldown: cooldownSystem.triggerCooldown,
    isOnCooldown: cooldownSystem.isOnCooldown,
    getRemainingTime: cooldownSystem.getRemainingTime,
    formatRemainingTime: cooldownSystem.formatRemainingTime,
    resetShortRestCooldowns: cooldownSystem.resetShortRestCooldowns,
    resetAllCooldowns: cooldownSystem.resetAllCooldowns,
    // Cooldown summary for Home Screen
    cooldownSummary,
    // Conditions system exposure
    conditions: conditionsSystem,
    // Character context
    characterContext: aiDMCharacterContext,
    // Oracle quest extraction callback registration
    registerOracleQuestCallback: useCallback((cb: ((quests: Array<{ key: string; status: 'active' | 'completed' | 'failed'; notes?: string }>) => void) | null) => { setOracleQuestCallback(() => cb); }, []),
  };

  return (
    <PromptDrawerContext.Provider value={contextValue}>
      {children}

      {enabled && (
        <>

          {/* Drawer Components */}
          <InfinityStoneDrawer
            open={infinityOpen}
            onOpenChange={setInfinityOpen}
            characterName={character.name}
          />

          <AbilitiesDrawer
            open={abilitiesOpen}
            onOpenChange={setAbilitiesOpen}
            character={character}
            unlockedAbilities={unlockedAbilities}
          />

          <StatsDrawer
            open={statsOpen}
            onOpenChange={setStatsOpen}
            characterName={character.name}
            level={character.level}
            currentXP={currentXP}
            xpPreset={xpPreset}
            onAddXP={onAddXP}
            currentHP={currentHP}
            maxHP={maxHP}
            tempHP={tempHP}
            onHPChange={onHPChange}
            equipmentStats={equipment ? equipmentStats : undefined}
            constitutionModifier={constitutionModifier}
            prestigeLevel={prestigeLevel}
            baseScores={baseScores}
            getScoreBreakdown={getScoreBreakdown}
            onIncrementScore={onIncrementScore}
            onDecrementScore={onDecrementScore}
            onRandomizeScores={onRandomizeScores}
            onApplyScores={onApplyScores}
          />

          <ScribeDrawer
            open={scribeOpen}
            onOpenChange={setScribeOpen}
            characterName={character.name}
          />

          {equipment && (
            <ActiveSetBonusDrawer
              open={setBonusOpen}
              onOpenChange={setSetBonusOpen}
              equipment={equipment}
              characterName={character.name}
            />
          )}

          <CooldownDrawer
            open={cooldownOpen}
            onOpenChange={setCooldownOpen}
            cooldowns={cooldownSystem.cooldowns}
            sessionState={cooldownSystem.sessionState}
            settings={cooldownSystem.settings}
            isHonestMode={isHonestMode}
            enforceCooldowns={enforceCooldowns}
            onPause={cooldownSystem.pauseAllCooldowns}
            onResume={cooldownSystem.resumeAllCooldowns}
            onResetAll={cooldownSystem.resetAllCooldowns}
            onGenerateStats={cooldownSystem.generateSessionStats}
            getRemainingTime={cooldownSystem.getRemainingTime}
            getEffectiveCooldown={cooldownSystem.getEffectiveCooldown}
          />

          <OracleDrawer
            open={oracleOpen}
            onOpenChange={setOracleOpen}
            character={character}
            currentHP={currentHP ?? character.level * 8 + 10}
            maxHP={maxHP ?? character.level * 8 + 10}
            equipment={equipment}
            consumables={consumables}
            cooldowns={cooldownSystem.cooldowns}
            prestigeLevel={prestigeLevel}
            prestigeAbilities={prestigeAbilities}
            getRemainingTime={cooldownSystem.getRemainingTime}
            spellcasting={spellcasting}
            lootItems={lootItems}
            totalLootValue={totalLootValue}
            combatContext={combatContext}
            partyMembers={partyMembers}
            subclass={subclass}
            onQuestExtracted={oracleQuestCallback || undefined}
          />

          <ConditionDrawer
            open={conditionsOpen}
            onOpenChange={setConditionsOpen}
            conditions={conditionsSystem.conditions}
            debuffs={conditionsSystem.debuffs}
            buffs={conditionsSystem.buffs}
            concentration={conditionsSystem.concentration}
            hasConcentration={conditionsSystem.hasConcentration}
            concentrationSpell={conditionsSystem.concentrationSpell}
            activeCount={conditionsSystem.activeCount}
            isAtCapacity={conditionsSystem.isAtCapacity}
            isNearCapacity={conditionsSystem.isNearCapacity}
            undoBuffer={conditionsSystem.undoBuffer}
            onUndo={conditionsSystem.undoRemove}
            onAddCondition={conditionsSystem.addCondition}
            onRemoveCondition={conditionsSystem.removeCondition}
            onEndTurn={conditionsSystem.endTurn}
            onShortRest={conditionsSystem.shortRest}
            onLongRest={conditionsSystem.longRest}
            onBreakConcentration={conditionsSystem.breakConcentration}
            onClearAll={conditionsSystem.clearAll}
            shareTargets={onShareBuffToParty ? partyMembers
              .filter(m => m.user_id !== userId)
              .map(m => ({ user_id: m.user_id, character_name: m.character_name }))
              : undefined}
            onShareToParty={onShareBuffToParty}
          />

          <QuickActionsDrawer
            open={quickActionsOpen}
            onOpenChange={setQuickActionsOpen}
            character={character}
            equipment={equipment}
            cooldowns={{
              isOnCooldown: cooldownSystem.isOnCooldown,
              getRemainingTime: cooldownSystem.getRemainingTime,
              formatRemainingTime: cooldownSystem.formatRemainingTime,
              triggerCooldown: cooldownSystem.triggerCooldown,
            }}
            spellcasting={spellcasting ? {
              preparedSpells: spellcasting.state.preparedSpells,
              knownSpells: spellcasting.state.knownSpells,
              favoriteSpells: spellcasting.state.favoriteSpells,
              spellSlots: spellcasting.state.spellSlots as Record<number, { current: number; max: number }>,
              pactSlots: spellcasting.state.pactSlots ? {
                current: spellcasting.state.pactSlots.current,
                max: spellcasting.state.pactSlots.max,
                level: spellcasting.state.pactSlots.level,
              } : undefined,
              concentratingOn: spellcasting.state.concentratingOn,
              castSpell: spellcasting.castSpell,
              useSlot: spellcasting.useSlot,
              toggleFavorite: spellcasting.toggleFavorite,
            } : undefined}
            characterName={character.name}
            consumablesInventory={consumables}
            onUseConsumable={onUseConsumable}
            wildShape={wildShape}
            onAssignWildShapeBackground={onAssignWildShapeBackground}
            onRemoveWildShapeBackground={onRemoveWildShapeBackground}
            hasWildShapeBackground={hasWildShapeBackground}
            currentHP={currentHP}
            maxHP={maxHP}
            tempHP={tempHP}
            onHPChange={onHPChange}
            partyMembers={partyMembers}
            userId={userId}
            onSendHeal={onSendHeal}
            channelDivinity={channelDivinityInfo}
            hideAbilitiesAndItems={aiDMOpen}
          />

          {pendingMode && (
            <div className="fixed inset-0 z-[85] flex flex-col items-center justify-center gap-3 bg-black/80 backdrop-blur-sm">
              <div className="w-8 h-8 rounded-full border-2 border-amber-400/30 border-t-amber-400 animate-spin" />
              <p className="text-xs font-cinzel tracking-widest text-amber-200/80 uppercase">
                Loading {pendingMode} character
              </p>
            </div>
          )}

          <ModeCharacterPicker
            open={pickerMode !== null}
            onOpenChange={(o) => { if (!o) setPickerMode(null); }}
            mode={pickerMode ?? 'solo'}
            activeCloudSaveId={activeCloudSaveId ?? null}
            saves={cloudSaves ?? []}
            onRefresh={onRefreshCloudSaves}
            onSwitch={async (id) => (onSwitchCharacterSave ? onSwitchCharacterSave(id) : false)}
          />

          {/* AI Dungeon Master Full-Screen Overlay (Solo only) */}
          {aiDMOpen && (
            <AIDMScreen
              onBack={() => { setAiDMOpen(false); }}
              characterContext={aiDMCharacterContext}
              userId={userId}
              characterName={character.name}
              autoSyncCallbacks={autoSyncCallbacks}
              dmPersonaPrompt={personalityGate.profile?.dmSystemPrompt}
              dmPersonaName={personalityGate.profile?.dmPersonaName}
              onRetakePersonalityTest={personalityGate.retakeTest}
              wildShape={wildShape}
              currentXP={currentXP}
              onManualLevelUp={onManualLevelUp}
              onAcceptItem={onAcceptDmItem}
              onOpenCharacterPicker={() => setPickerMode('solo')}
              isMomoMoonDruid={isMomoEasterEgg(character.name) && character.primaryClass === 'druid' && subclass?.toLowerCase().includes('moon')}
            />
          )}

          {/* One-tap return to the DM character sheet after jumping to an app tab.
              Renders nothing unless a return is pending. */}
          <ReturnToSheetButton
            hidden={aiDMOpen || partyDMOpen}
            onReturn={() => {
              // Reopen the DM the sheet was actually opened from. Sending a party
              // player back into the solo screen shows them the wrong campaign.
              const origin = getSheetReturn()?.origin ?? 'solo';
              closeAllDrawers();
              if (origin === 'party') {
                void openModeWithCharacter('party', () => setPartyDMOpen(true));
                clearSheetReturn();
              } else {
                void openModeWithCharacter('solo', () => setAiDMOpen(true));
              }
            }}
          />



          {/* Personality Test Wizard */}
          {personalityGate.showWizard && userId && (
            <PersonalityTestWizard
              userId={userId}
              initialProgress={personalityGate.progress}
              onComplete={personalityGate.handleTestComplete}
              onClose={() => personalityGate.setShowWizard(false)}
            />
          )}

          {/* Personality Results Screen */}
          {personalityGate.showResults && personalityGate.pendingPersona && (
            <PersonalityResultsScreen
              persona={personalityGate.pendingPersona}
              onBegin={() => {
                personalityGate.handleBeginAdventure();
                closeAllDrawers();
                setAiDMOpen(true);
              }}
            />
          )}

          {/* Standalone Party DM Full-Screen Overlay */}
          {partyDMOpen && (
            <StandalonePartyDMScreen
              onBack={() => { setPartyDMOpen(false); setPartyDMBuilderAutoOpen(false); }}
              characterContext={aiDMCharacterContext}
              partyId={partyId ?? null}
              isPartyCreator={isPartyCreator}
              partyMembers={partyMembers}
              userId={userId ?? ''}
              characterName={character.name}
              onShowChat={onOpenPartyChat ? () => { setPartyDMOpen(false); setPartyDMBuilderAutoOpen(false); onOpenPartyChat(); } : undefined}
              autoSyncCallbacks={autoSyncCallbacks}
              currentXP={currentXP}
              onManualLevelUp={onManualLevelUp}
              onAcceptItem={onAcceptDmItem}
              onOpenCharacterPicker={() => setPickerMode('party')}
              wildShape={wildShape}
              isMomoMoonDruid={isMomoEasterEgg(character.name) && character.primaryClass === 'druid' && subclass?.toLowerCase().includes('moon')}
              autoOpenCampaignBuilder={partyDMBuilderAutoOpen}
            />
          )}
        </>
      )}
    </PromptDrawerContext.Provider>
  );
}
