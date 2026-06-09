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
import { usePersonalityGate } from '@/hooks/use-personality-gate';
import { Character } from '@/lib/types';
import { XPPreset } from '@/lib/xpSystem';
import { CharacterEquipment } from '@/lib/inventory/types';
import { InventoryItem as ConsumableItem } from '@/lib/consumables/types';
import { LootItem } from '@/lib/loot/types';
import { CombatLogEntry } from '@/hooks/use-combat-log';
import { Enemy } from '@/lib/combat/targetTypes';
import { ActionEconomy } from '@/lib/combat/combatTypes';
import { useGameMode, shouldShowInfinityStones } from '@/hooks/use-game-mode';
import { useEquipmentStats } from '@/hooks/use-equipment-stats';
import { useCooldowns } from '@/hooks/use-cooldowns';
import { useConditions, UseConditionsReturn } from '@/hooks/use-conditions';
import { Personality, CharacterContext } from '@/components/oracle/types';
import { allAbilities } from '@/lib/abilities';
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
    onAddXP: (amount: number, source: string) => void;
    onGoldChange: (netChange: number) => void;
    onConditionChange: (toAdd: string[], toRemove: string[]) => void;
    onRestOccurred: (type: 'short' | 'long') => void;
    getCurrentHP: () => number;
    getCurrentGold: () => number;
  };
}

export function PromptDrawerProvider({
  children,
  character,
  unlockedAbilities,
  enabled = true,
  currentXP = 0,
  xpPreset = 'standard',
  onAddXP = () => {},
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

  // Build full character context for AI DM (same logic as OracleDrawer)
  const aiDMCharacterContext = useMemo<CharacterContext>(() => {
    const hp = currentHP ?? character.level * 8 + 10;
    const hpMax = maxHP ?? character.level * 8 + 10;

    const abilitiesList = character.abilities
      .filter(a => a.currentTier > 0)
      .map(a => {
        const ability = allAbilities.find(ab => ab.id === a.abilityId);
        return { name: ability?.name || a.abilityId, tier: a.currentTier, tree: ability?.tree || 'unknown' };
      });

    const equippedAbilitiesList = character.equippedAbilities
      .map(id => allAbilities.find(a => a.id === id)?.name || id)
      .filter(Boolean) as string[];

    const equipmentList: Array<{ slot: string; name: string; rarity: string }> = [];
    if (equipment) {
      Object.entries(equipment.slots).forEach(([slot, item]) => {
        if (item) equipmentList.push({ slot, name: item.name, rarity: item.rarity });
      });
    }

    const consumablesList = consumables.map(c => ({
      name: c.consumable.name, quantity: c.quantity, type: c.consumable.type,
    }));

    const activeCooldowns: Array<{ name: string; remainingSeconds: number }> = [];
    const readyCooldowns: string[] = [];
    if (cooldownSystem.cooldowns) {
      cooldownSystem.cooldowns.forEach((state, abilityId) => {
        const ability = allAbilities.find(a => a.id === abilityId);
        const name = ability?.name || abilityId;
        const remaining = cooldownSystem.getRemainingTime(abilityId);
        if (remaining > 0) activeCooldowns.push({ name, remainingSeconds: remaining });
        else if (state.lastUsed) readyCooldowns.push(name);
      });
    }

    let spellcastingContext: CharacterContext['spellcasting'] = undefined;
    if (spellcasting?.state.path) {
      const { state, spellAttackBonus, spellSaveDC, totalSlotsRemaining } = spellcasting;
      spellcastingContext = {
        path: state.path,
        spellAttackBonus,
        spellSaveDC,
        totalSlotsRemaining,
        concentratingOn: state.concentratingOn ? getSpellById(state.concentratingOn)?.name || state.concentratingOn : null,
        preparedSpells: state.preparedSpells.map(id => getSpellById(id)?.name || id),
        slots: Object.entries(state.spellSlots).filter(([_, s]) => s.max > 0).map(([l, s]) => ({ level: parseInt(l), current: s.current, max: s.max })),
        pactSlots: state.pactSlots ? { current: state.pactSlots.current, max: state.pactSlots.max, level: state.pactSlots.level } : undefined,
      };
    }

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

    return {
      name: character.name, level: character.level, currentHP: hp, maxHP: hpMax,
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
  }, [character, currentHP, maxHP, equipment, consumables, cooldownSystem.cooldowns, cooldownSystem.getRemainingTime,
      prestigeLevel, prestigeAbilities, spellcasting, lootItems, totalLootValue, combatContext, conditionsSystem.debuffs, conditionsSystem.buffs,
      getScoreBreakdown, identityGender, identityRace, identityBackstory, identityRelationships,
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
      closeAllDrawers(); setAiDMOpen(true);
    }, [closeAllDrawers]),
    openPartyDMScreen: useCallback(() => { closeAllDrawers(); setPartyDMOpen(true); }, [closeAllDrawers]),
    openPartyDMCampaignBuilder: useCallback(() => { closeAllDrawers(); setPartyDMOpen(true); setPartyDMBuilderAutoOpen(true); }, [closeAllDrawers]),
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
              isMomoMoonDruid={isMomoEasterEgg(character.name) && character.primaryClass === 'druid' && subclass?.toLowerCase().includes('moon')}
            />
          )}

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
