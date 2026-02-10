import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Character, Ability } from '@/lib/types';
import { allAbilities } from '@/lib/abilities';
import { cn } from '@/lib/utils';
import { 
  ActionEconomy, 
  ActiveEffect,
  TurnAction,
  WeaponAttack,
  COMBAT_CONDITIONS,
  DEFAULT_WEAPONS,
  getSneakAttackDice,
} from '@/lib/combat/combatTypes';
import { ActiveConditionInfo, SetBonusInfo, TargetPromptInfo, formatTargetForPrompt } from '@/lib/combat/promptContext';
import { loadCombatSettings, COMBAT_SETTINGS_CHANGE_EVENT, CombatSettings } from '@/lib/combat/combatSettings';
import { ExecutedAttack } from '@/lib/combat/attackQueue';
import { generateMultiAttackPrompt, generateQueuedAttackPrompt } from '@/lib/combat/attackQueuePrompts';
import { DiceRoll, rollDice, getAbilityDice, isCriticalHit, isCriticalMiss, inferRollMode } from '@/lib/diceRoller';
import { generateRPPrompt } from '@/lib/rpPromptGenerator';
import { DiceRollModal } from '@/components/character/DiceRollModal';
import { useGameMode } from '@/hooks/use-game-mode';
import { useCooldowns } from '@/hooks/use-cooldowns';
import { useCombatStats } from '@/hooks/use-combat-stats';
import { useAbilityCustomization } from '@/hooks/use-ability-customization';
import { useAttackQueue } from '@/hooks/use-attack-queue';
import { applyOverrides, homebrewToAbility } from '@/lib/abilityCustomization/utils';
import { COOLDOWN_CONFIGS, calculateEffectiveCooldown } from '@/lib/cooldowns/config';
import { isLegacyAbilityId, resolveLegacyAbility } from '@/lib/prestigeTree/abilityConverter';

// Mobile components
import { CombatBottomNav, CombatTab } from './CombatBottomNav';
import { CombatTopBar } from './CombatTopBar';
import { SituationStrip } from './SituationStrip';
import { ActionEconomyBar } from './ActionEconomyBar';
import { MobileWeaponCard } from './MobileWeaponCard';
import { OffhandAttackCard } from './OffhandAttackCard';
import { CombatFAB } from './CombatFAB';
import { TurnSummaryPanel } from './TurnSummaryPanel';
import { CombatLogPanel } from './CombatLogPanel';
import { SmartPromptSheet } from './SmartPromptSheet';
import { MobileAbilityList } from './MobileAbilityList';
import { EnhancedMobileAbilityList } from './EnhancedMobileAbilityList';
import { CombatAbilityCard } from './CombatAbilityCard';
import { MobileItemsGrid } from './MobileItemsGrid';
import { MobileSpellList } from './MobileSpellList';
import { MobileReactionsList } from './MobileReactionsList';
import { QuickCastPanel } from './QuickCastPanel';
import { TurnWizardPanel } from './TurnWizardPanel';
import { TargetTrackerPanel } from './TargetTrackerPanel';
import { AttackQueuePanel } from './AttackQueuePanel';
import { InitiativeTracker } from './InitiativeTracker';
import { CombatDiceRoller } from './CombatDiceRoller';
import { DeathSavesTracker } from '@/components/character/DeathSavesTracker';
import { EdgeDrawer } from '@/components/drawers/EdgeDrawer';
import { PartyPanel } from '@/components/party/PartyPanel';
import { HealTargetPicker } from '@/components/party/HealTargetPicker';
import { Users } from 'lucide-react';
import { useCombatLog } from '@/hooks/use-combat-log';
import { useTargets } from '@/hooks/use-targets';
import { useInitiative } from '@/hooks/use-initiative';
import { UseSpellcastingReturn } from '@/hooks/use-spellcasting';
import { getSpellById } from '@/lib/magic/spells';
import { usePromptDrawers } from '@/components/drawers';
import { CharacterEquipment, EquipmentSlotType } from '@/lib/inventory/types';
import { getEquippedWeapons, convertToWeaponAttack } from '@/lib/combat/weaponConverter';
import { Reaction, DEFAULT_REACTIONS, REACTIONS_STORAGE_KEY } from '@/lib/combat/reactions';
import { useEquipmentImages } from '@/hooks/use-equipment-images';
import { useAbilityImages } from '@/hooks/use-ability-images';
import { AggregatedStats } from '@/hooks/use-equipment-stats';
import { BaseAbilityScores } from '@/lib/abilityScores/types';
import { UseActionEconomyReturn } from '@/hooks/use-action-economy';

// Section order for vertical scroll layout
const SECTION_ORDER: CombatTab[] = ['combat', 'actions', 'spells', 'items', 'log'];

// Section header config matching bottom nav colors
const SECTION_HEADERS: Record<CombatTab, { label: string; icon: string; color: string }> = {
  combat: { label: 'COMBAT', icon: '🎯', color: 'text-red-400 border-red-500/40' },
  actions: { label: 'ACTIONS', icon: '⚡', color: 'text-amber-400 border-amber-500/40' },
  spells: { label: 'MAGIC', icon: '✨', color: 'text-indigo-400 border-indigo-500/40' },
  items: { label: 'ITEMS', icon: '🎒', color: 'text-green-400 border-green-500/40' },
  log: { label: 'LOG', icon: '📜', color: 'text-primary border-primary/40' },
};

interface MobileCombatLayoutProps {
  character: Character;
  spellcasting?: UseSpellcastingReturn;
  equipment?: CharacterEquipment;
  onNavigateToConsumables?: () => void;
  // New synced props
  equipmentStats?: AggregatedStats;
  abilityModifiers?: BaseAbilityScores;
  // HP state
  currentHP?: number;
  maxHP?: number;
  tempHP?: number;
  // Action economy (synced from Index.tsx)
  actionEconomyState?: UseActionEconomyReturn;
  // Global D&D conditions (from useConditions)
  globalConditions?: ActiveConditionInfo[];
  // Set bonuses (from equipment stats)
  activeSetBonuses?: SetBonusInfo[];
  // Concentration spell (from spellcasting)
  concentrationSpell?: string | null;
  // Loot items with dice mechanics (from useLoot)
  lootItemsWithDice?: import('@/lib/loot/types').LootItem[];
  onUseLootItem?: (item: import('@/lib/loot/types').LootItem) => void;
  // Death saves state
  deathSaves?: { successes: number; failures: number };
  onDeathSavesChange?: (saves: { successes: number; failures: number }) => void;
  onRegainHP?: (amount: number) => void;
  onHPChange?: (current: number, max: number, temp: number) => void;
  // Party props
  partySync?: import('@/hooks/use-party-sync').UsePartySyncReturn;
  isAuthenticated?: boolean;
  userId?: string;
  characterName?: string;
}

export function MobileCombatLayout({ 
  character, 
  spellcasting, 
  equipment, 
  onNavigateToConsumables,
  equipmentStats,
  abilityModifiers,
  currentHP,
  maxHP,
  tempHP,
  actionEconomyState,
  globalConditions = [],
  activeSetBonuses = [],
  concentrationSpell,
  lootItemsWithDice = [],
  onUseLootItem,
  deathSaves,
  onDeathSavesChange,
  onRegainHP,
  onHPChange,
  partySync,
  isAuthenticated = false,
  userId,
  characterName,
}: MobileCombatLayoutProps) {
  // Navigation state
  const [activeTab, setActiveTab] = useState<CombatTab>('combat');
  const [showPartyDrawer, setShowPartyDrawer] = useState(false);
  const [actionsFilter, setActionsFilter] = useState<'all' | 'action' | 'bonus_action' | 'reaction'>('all');
  const [pendingHealSpell, setPendingHealSpell] = useState<{ spellName: string; amount: number } | null>(null);
  const [round, setRound] = useState(1);
  const [isYourTurn, setIsYourTurn] = useState(true);
  const { rerollsDisabled, isHonestMode, enforceCooldowns } = useGameMode();
  
  // Section refs for scroll-to navigation
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const combatRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const spellsRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<HTMLDivElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  
  const sectionRefs: Record<CombatTab, React.RefObject<HTMLDivElement>> = {
    combat: combatRef,
    actions: actionsRef,
    spells: spellsRef,
    items: itemsRef,
    log: logRef,
  };
  
  // Use unified combat stats hook
  const combatStats = useCombatStats({
    character,
    equipmentStats,
    abilityModifiers,
  });
  
  // Access drawer context (optional - may not be in PromptDrawerProvider)
  let drawerContext: ReturnType<typeof usePromptDrawers> | null = null;
  try {
    drawerContext = usePromptDrawers();
  } catch {
    // Not inside PromptDrawerProvider - drawer functions won't be available
  }
  
  // Equipment custom images for weapon cards
  const { images: equipmentImages } = useEquipmentImages();
  
  // Ability custom images for ability cards
  const { images: abilityImages } = useAbilityImages();
  
  // Combat log for AI DM prompts
  const combatLog = useCombatLog();
  
  // Target/Enemy Tracker for combat
  const targetTracker = useTargets();
  const [targetTrackerCollapsed, setTargetTrackerCollapsed] = useState(true);
  
  // Attack Queue system
  const attackQueue = useAttackQueue(targetTracker.enemies);
  
  // Initiative tracking
  const initiativeTracker = useInitiative(targetTracker.enemies);
  const [initiativeCollapsed, setInitiativeCollapsed] = useState(true);
  
  // Cooldown system integration
  const cooldownSystem = useCooldowns({
    characterAbilities: character.abilities,
    isHonestMode,
    enforceCooldowns,
  });
  
  // Combat settings (Two-Weapon Fighting style, etc.)
  const [combatSettings, setCombatSettings] = useState<CombatSettings>(() => loadCombatSettings());
  
  // Listen for combat settings changes
  useEffect(() => {
    const handleChange = (e: Event) => {
      const customEvent = e as CustomEvent<CombatSettings>;
      setCombatSettings(customEvent.detail);
    };
    window.addEventListener(COMBAT_SETTINGS_CHANGE_EVENT, handleChange);
    return () => window.removeEventListener(COMBAT_SETTINGS_CHANGE_EVENT, handleChange);
  }, []);
  
  // Handle tab click: scroll to section
  const handleTabChange = useCallback((tab: CombatTab) => {
    setActiveTab(tab);
    const ref = sectionRefs[tab];
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [sectionRefs]);
  
  // IntersectionObserver to auto-highlight active tab on scroll
  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    const refEntries = Object.entries(sectionRefs) as [CombatTab, React.RefObject<HTMLDivElement>][];
    
    refEntries.forEach(([tab, ref]) => {
      if (!ref.current) return;
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              setActiveTab(tab);
            }
          });
        },
        { threshold: 0.15, rootMargin: '-80px 0px -60% 0px' }
      );
      observer.observe(ref.current);
      observers.push(observer);
    });
    
    return () => observers.forEach(o => o.disconnect());
  }, [sectionRefs]);
  
  // Situation state
  const [conditions, setConditions] = useState<string[]>([]);
  const [situationCollapsed, setSituationCollapsed] = useState(true);
  
  // Action economy state (use prop if provided, otherwise fallback to local state)
  const [localActionEconomy, setLocalActionEconomy] = useState<ActionEconomy>({
    actionUsed: false,
    bonusActionUsed: false,
    reactionUsed: false,
    movementUsed: 0,
    maxMovement: 30,
  });
  const [localTurnActions, setLocalTurnActions] = useState<TurnAction[]>([]);
  
  // Use synced action economy from props if available
  const actionEconomy = actionEconomyState?.economy ?? localActionEconomy;
  const setActionEconomy = actionEconomyState?.setEconomy ?? setLocalActionEconomy;
  const turnActions = actionEconomyState?.turnActions ?? localTurnActions;
  
  // Expanded weapon card (accordion behavior)
  const [expandedWeaponId, setExpandedWeaponId] = useState<string | null>(null);
  
  // Dice modal state
  const [showDiceModal, setShowDiceModal] = useState(false);
  const [diceRoll, setDiceRoll] = useState<DiceRoll | null>(null);
  const [dicePrompt, setDicePrompt] = useState('');
  const [activeAbility, setActiveAbility] = useState<Ability | null>(null);
  const [activeTier, setActiveTier] = useState<1 | 2 | 3>(1);
  
  // UI state
  const [lastAction, setLastAction] = useState('SYSTEMS READY');
  const [showSmartPromptSheet, setShowSmartPromptSheet] = useState(false);
  
  // Ability customization hook
  const abilityCustomization = useAbilityCustomization();
  
  // Count abilities by type - apply customizations + include homebrew abilities
  const unlockedAbilities = useMemo(() => {
    // Get base abilities with customizations
    const baseAbilities = character.abilities
      .filter(ca => ca.currentTier > 0)
      .map(ca => {
        // Check if it's a homebrew ability
        if (ca.abilityId.startsWith('homebrew_')) {
          const homebrew = abilityCustomization.state.homebrewAbilities.find(h => h.id === ca.abilityId);
          if (!homebrew) return null;
          return {
            ...homebrewToAbility(homebrew),
            tier: ca.currentTier as 1 | 2 | 3,
          };
        }
        
        // Base ability with overrides
        const baseAbility = allAbilities.find(a => a.id === ca.abilityId);
        if (!baseAbility) return null;
        const override = abilityCustomization.getOverride(ca.abilityId);
        const customized = applyOverrides(baseAbility, override);
        return {
          ...customized,
          tier: ca.currentTier as 1 | 2 | 3,
        };
      })
      .filter(Boolean) as (Ability & { tier: 1 | 2 | 3; isCustomized?: boolean; isHomebrew?: boolean })[];
    
    // Include equipped legacy abilities
    const legacyAbilities = character.equippedAbilities
      .filter(id => isLegacyAbilityId(id))
      .map(id => {
        const ability = resolveLegacyAbility(id);
        if (!ability) return null;
        return { ...ability, tier: 1 as const, isLegacy: true };
      })
      .filter(Boolean) as (Ability & { tier: 1 | 2 | 3; isLegacy?: boolean })[];

    return [...baseAbilities, ...legacyAbilities];
  }, [character.abilities, character.equippedAbilities, abilityCustomization.state.overrides, abilityCustomization.state.homebrewAbilities]);
  
  const stealthAbilities = unlockedAbilities.filter(a => 
    a.tree === 'assassin' || 
    a.id.includes('shadow') || 
    a.id.includes('vanish') ||
    a.id.includes('hide')
  );
  
  const specialAbilities = unlockedAbilities.filter(a => 
    a.type === 'active' && !stealthAbilities.includes(a)
  );
  
  const actionCount = unlockedAbilities.filter(a => a.actionType === 'action').length;
  const bonusCount = unlockedAbilities.filter(a => a.actionType === 'bonus_action').length;
  const reactionCount = unlockedAbilities.filter(a => a.actionType === 'reaction').length;
  
  const sneakAttackDice = getSneakAttackDice(character.level);
  const hasPoisonedWeapon = conditions.includes('poisonedWeapon');
  
  // Convert equipped weapons from gear - use fallback to default weapons if none equipped
  const equippedWeapons = useMemo(() => {
    if (!equipment) return DEFAULT_WEAPONS;
    const weapons = getEquippedWeapons(equipment.slots);
    return weapons.length > 0 ? weapons : DEFAULT_WEAPONS;
  }, [equipment]);
  
  // Create weapons map for ability synergy (Hunter→Ranged, Warrior→Primary, Assassin→Secondary)
  const weaponsMap = useMemo(() => {
    if (!equipment) {
      return {
        primary: DEFAULT_WEAPONS.find(w => w.id === 'shortsword') ?? null,
        secondary: DEFAULT_WEAPONS.find(w => w.id === 'dagger') ?? null,
        ranged: DEFAULT_WEAPONS.find(w => w.id === 'shortbow') ?? null,
      };
    }
    
    return {
      primary: equipment.slots.primary_weapon 
        ? convertToWeaponAttack(equipment.slots.primary_weapon) 
        : null,
      secondary: equipment.slots.secondary_weapon 
        ? convertToWeaponAttack(equipment.slots.secondary_weapon) 
        : null,
      ranged: equipment.slots.ranged_weapon 
        ? convertToWeaponAttack(equipment.slots.ranged_weapon) 
        : null,
    };
  }, [equipment]);
  
  // Build cooldown state map for abilities
  // IMPORTANT: Depend on cooldownSystem.cooldowns to react to real-time cooldown ticks
  const cooldownStateMap = useMemo(() => {
    const map = new Map<string, { isOnCooldown: boolean; remaining: number; total: number }>();
    
    unlockedAbilities.forEach(ability => {
      const config = COOLDOWN_CONFIGS[ability.id];
      if (config && !config.isPassive) {
        const isOnCooldown = cooldownSystem.isOnCooldown(ability.id);
        const remaining = cooldownSystem.getRemainingTime(ability.id);
        const total = cooldownSystem.getEffectiveCooldown(ability.id);
        map.set(ability.id, { isOnCooldown, remaining, total });
      }
    });
    
    return map;
  }, [unlockedAbilities, cooldownSystem.cooldowns, cooldownSystem.isOnCooldown, cooldownSystem.getRemainingTime, cooldownSystem.getEffectiveCooldown]);
  
  // Build cooling abilities list for Action Economy bar warnings
  const coolingAbilitiesForBar = useMemo(() => {
    const cooling: Array<{
      abilityId: string;
      name: string;
      remaining: number;
      actionType: 'action' | 'bonus_action' | 'reaction';
    }> = [];
    
    unlockedAbilities.forEach(ability => {
      const cdState = cooldownStateMap.get(ability.id);
      // Only include non-passive abilities that are cooling
      const actionType = ability.actionType || 'action';
      if (cdState?.isOnCooldown && cdState.remaining > 0 && actionType !== 'passive') {
        cooling.push({
          abilityId: ability.id,
          name: ability.name,
          remaining: cdState.remaining,
          actionType: actionType as 'action' | 'bonus_action' | 'reaction',
        });
      }
    });
    
    return cooling;
  }, [unlockedAbilities, cooldownStateMap]);
  
  // Add action to turn summary
  const handleAddToTurn = useCallback((
    actionType: 'action' | 'bonus' | 'reaction',
    description: string,
    roll?: string
  ) => {
    // Use synced action economy if available
    if (actionEconomyState) {
      actionEconomyState.addTurnAction({ type: actionType, description, roll });
    } else {
      setActionEconomy(prev => ({
        ...prev,
        actionUsed: actionType === 'action' ? true : prev.actionUsed,
        bonusActionUsed: actionType === 'bonus' ? true : prev.bonusActionUsed,
        reactionUsed: actionType === 'reaction' ? true : prev.reactionUsed,
      }));
      
      setLocalTurnActions(prev => [
        ...prev.filter(a => a.type !== actionType),
        { type: actionType, description, roll }
      ]);
    }
  }, [actionEconomyState, setActionEconomy]);
  
  // Handle ability use (legacy for stealth tab)
  const handleAbilityUse = useCallback((
    ability: Ability & { tier: 1 | 2 | 3 }
  ) => {
    const { die, count } = getAbilityDice(ability.tier);
    const roll = rollDice(die, count);
    const prompt = generateRPPrompt(ability, ability.tier, roll, character.name);
    
    setActiveAbility(ability);
    setActiveTier(ability.tier);
    setDiceRoll(roll);
    setDicePrompt(prompt);
    setShowDiceModal(true);
    setLastAction(`${ability.name.toUpperCase()} ACTIVATED`);
    
    // Log to combat log
    const logRollMode = inferRollMode(roll.rolls, roll.total, roll.modifier);
    combatLog.addEntry({
      actionType: 'ability',
      actionName: ability.name,
      prompt,
      roll: {
        total: roll.total,
        rolls: roll.rolls,
        modifier: roll.modifier,
        isCrit: isCriticalHit(roll.rolls, logRollMode, roll.die),
        isFumble: isCriticalMiss(roll.rolls, logRollMode, roll.die),
      },
      damage: `${count}${die}`,
    });
    
    // Trigger cooldown
    cooldownSystem.triggerCooldown(ability.id);
    
    const actionType = ability.actionType === 'bonus_action' ? 'bonus' : 
                       ability.actionType === 'reaction' ? 'reaction' : 'action';
    handleAddToTurn(actionType, ability.name, `${count}${die}`);
  }, [character.name, handleAddToTurn, cooldownSystem, combatLog]);
  
  // Handle enhanced ability use (with weapon synergy + combined damage)
  const handleEnhancedAbilityUse = useCallback((
    ability: Ability & { tier: 1 | 2 | 3 },
    roll: DiceRoll,
    prompt: string,
    combinedDamage: string
  ) => {
    setActiveAbility(ability);
    setActiveTier(ability.tier);
    setDiceRoll(roll);
    setDicePrompt(prompt);
    setShowDiceModal(true);
    setLastAction(`${ability.name.toUpperCase()} + ${combinedDamage}`);
    
    // Log to combat log
    const enhancedRollMode = inferRollMode(roll.rolls, roll.total, roll.modifier);
    combatLog.addEntry({
      actionType: 'ability',
      actionName: `${ability.name} + Weapon`,
      prompt,
      roll: {
        total: roll.total,
        rolls: roll.rolls,
        modifier: roll.modifier,
        isCrit: isCriticalHit(roll.rolls, enhancedRollMode, roll.die),
        isFumble: isCriticalMiss(roll.rolls, enhancedRollMode, roll.die),
      },
      damage: combinedDamage,
    });
    
    const actionType = ability.actionType === 'bonus_action' ? 'bonus' : 
                       ability.actionType === 'reaction' ? 'reaction' : 'action';
    const { die, count } = getAbilityDice(ability.tier);
    handleAddToTurn(actionType, `${ability.name} (${combinedDamage})`, `${count}${die}`);
  }, [handleAddToTurn, combatLog]);
  
  // Handle weapon roll
  const handleWeaponRoll = useCallback((
    rollType: 'normal' | 'sneak' | 'assassinate',
    weapon: WeaponAttack,
    roll: DiceRoll,
    damage: string
  ) => {
    const rollName = rollType === 'assassinate' 
      ? `ASSASSINATE (${weapon.name})` 
      : rollType === 'sneak' 
        ? `${weapon.name} + Sneak Attack`
        : weapon.name;
    
    // Include current target in prompt
    const currentTargetForPrompt = targetTracker.getTargetForPrompt();
    const prompt = generateWeaponPrompt(rollType, weapon, roll, damage, character.name, currentTargetForPrompt);
    
    // Add target name to action if available
    const targetSuffix = currentTargetForPrompt ? ` vs. ${currentTargetForPrompt.name}` : '';
    
    setDiceRoll(roll);
    setDicePrompt(prompt);
    setActiveAbility(null);
    setShowDiceModal(true);
    setLastAction(`${rollName.toUpperCase()} ROLL`);
    
    // Log to combat log (include target name)
    const weaponRollMode = inferRollMode(roll.rolls, roll.total, roll.modifier);
    combatLog.addEntry({
      actionType: 'weapon',
      actionName: `${rollName}${targetSuffix}`,
      prompt,
      roll: {
        total: roll.total,
        rolls: roll.rolls,
        modifier: roll.modifier,
        isCrit: isCriticalHit(roll.rolls, weaponRollMode, roll.die),
        isFumble: isCriticalMiss(roll.rolls, weaponRollMode, roll.die),
      },
      damage,
    });
    
    handleAddToTurn('action', `${weapon.name} attack${rollType !== 'normal' ? ` (${rollType})` : ''}${targetSuffix}`);
  }, [character.name, handleAddToTurn, combatLog, targetTracker]);

  // Handle offhand attack (bonus action with secondary weapon)
  const handleOffhandRoll = useCallback((
    weapon: WeaponAttack,
    roll: DiceRoll,
    damage: string,
    isOffhand: true
  ) => {
    const rollName = `Offhand (${weapon.name})`;
    
    // Include current target in prompt
    const currentTargetForPrompt = targetTracker.getTargetForPrompt();
    const prompt = generateWeaponPrompt('normal', weapon, roll, damage, character.name, currentTargetForPrompt, true);
    
    // Add target name to action if available
    const targetSuffix = currentTargetForPrompt ? ` vs. ${currentTargetForPrompt.name}` : '';
    
    setDiceRoll(roll);
    setDicePrompt(prompt);
    setActiveAbility(null);
    setShowDiceModal(true);
    setLastAction(`OFFHAND ATTACK`);
    
    // Log to combat log
    const offhandRollMode = inferRollMode(roll.rolls, roll.total, roll.modifier);
    combatLog.addEntry({
      actionType: 'weapon',
      actionName: `${rollName}${targetSuffix}`,
      prompt,
      roll: {
        total: roll.total,
        rolls: roll.rolls,
        modifier: roll.modifier,
        isCrit: isCriticalHit(roll.rolls, offhandRollMode, roll.die),
        isFumble: isCriticalMiss(roll.rolls, offhandRollMode, roll.die),
      },
      damage,
    });
    
    handleAddToTurn('bonus', `Offhand attack${targetSuffix}`);
  }, [character.name, handleAddToTurn, combatLog, targetTracker]);
  
  // Handle queueing an attack
  const handleQueueAttack = useCallback((
    weapon: WeaponAttack,
    rollType: 'normal' | 'sneak' | 'assassinate',
    targetId: string | null,
    targetName: string | null,
    isOffhand = false
  ) => {
    attackQueue.addToQueue(weapon, rollType, targetId, targetName, isOffhand);
  }, [attackQueue]);
  
  // Execute all queued attacks
  const handleExecuteQueue = useCallback(() => {
    if (attackQueue.isEmpty) return;
    
    const hasAdvantage = conditions.includes('advantage') || conditions.includes('hidden');
    const hasDisadvantage = conditions.includes('disadvantage');
    
    let rollCount = 1;
    if (hasAdvantage && !hasDisadvantage) rollCount = 2;
    else if (hasDisadvantage && !hasAdvantage) rollCount = 2;
    
    const executedAttacks: ExecutedAttack[] = [];
    
    // Roll all attacks in the queue
    for (const queuedAttack of attackQueue.sortedQueue) {
      const totalAttackBonus = combatStats.attackBonus + queuedAttack.weapon.attackBonus;
      const roll = rollDice('d20', rollCount, totalAttackBonus);
      
      let damage = queuedAttack.weapon.damage;
      if (!queuedAttack.isOffhand || combatSettings.hasTwoWeaponFightingStyle) {
        if (combatStats.damageBonus > 0) damage += `+${combatStats.damageBonus}`;
      }
      
      if (queuedAttack.rollType === 'sneak' || queuedAttack.rollType === 'assassinate') {
        damage += `+${getSneakAttackDice(character.level)}`;
      }
      
      if (hasPoisonedWeapon) {
        damage += '+2d6 poison';
      }
      
      if (queuedAttack.rollType === 'assassinate') {
        damage = `(${damage}) x2 dice [CRIT]`;
      }
      
      // Get target info if available
      const targetInfo = queuedAttack.targetId 
        ? targetTracker.enemies.find(e => e.id === queuedAttack.targetId)
        : null;
      
      const executed: ExecutedAttack = {
        ...queuedAttack,
        roll,
        damageBreakdown: damage,
        attackBonus: totalAttackBonus,
        targetInfo: targetInfo ? {
          name: targetInfo.name,
          ac: targetInfo.ac,
          currentHP: targetInfo.currentHP,
          maxHP: targetInfo.maxHP,
          notes: targetInfo.notes,
          creatureType: targetInfo.creatureType,
          size: targetInfo.size,
          conditions: targetInfo.conditions,
          resistances: targetInfo.resistances,
          vulnerabilities: targetInfo.vulnerabilities,
          immunities: targetInfo.immunities,
        } : null,
      };
      
      executedAttacks.push(executed);
      
      // Log each attack to combat log
      const rollMode = inferRollMode(roll.rolls, roll.total, roll.modifier);
      const singlePrompt = generateQueuedAttackPrompt(executed, character.name);
      combatLog.addEntry({
        actionType: 'weapon',
        actionName: `${queuedAttack.weapon.name}${queuedAttack.targetName ? ` → ${queuedAttack.targetName}` : ''}`,
        prompt: singlePrompt,
        roll: {
          total: roll.total,
          rolls: roll.rolls,
          modifier: roll.modifier,
          isCrit: isCriticalHit(roll.rolls, rollMode, roll.die),
          isFumble: isCriticalMiss(roll.rolls, rollMode, roll.die),
        },
        damage,
      });
      
      // Add to turn summary
      const actionType = queuedAttack.isOffhand ? 'bonus' : 'action';
      handleAddToTurn(actionType, `${queuedAttack.weapon.name}${queuedAttack.targetName ? ` vs. ${queuedAttack.targetName}` : ''}`);
    }
    
    // Generate combined prompt and show modal
    const combinedPrompt = generateMultiAttackPrompt(executedAttacks, character.name);
    setDiceRoll(executedAttacks[executedAttacks.length - 1].roll);
    setDicePrompt(combinedPrompt);
    setActiveAbility(null);
    setShowDiceModal(true);
    setLastAction(`${executedAttacks.length} ATTACKS EXECUTED`);
    
    // Clear the queue
    attackQueue.clearQueue();
  }, [attackQueue, conditions, combatStats, combatSettings.hasTwoWeaponFightingStyle, character.level, character.name, hasPoisonedWeapon, targetTracker.enemies, combatLog, handleAddToTurn]);
  
  // Reset turn
  const handleResetTurn = useCallback(() => {
    if (actionEconomyState) {
      actionEconomyState.resetTurn();
    } else {
      setLocalTurnActions([]);
      setActionEconomy({
        actionUsed: false,
        bonusActionUsed: false,
        reactionUsed: false,
        movementUsed: 0,
        maxMovement: 30,
      });
    }
    setLastAction('TURN RESET');
  }, [actionEconomyState, setActionEconomy]);
  
  // Remove action
  const handleRemoveAction = useCallback((index: number) => {
    if (actionEconomyState) {
      actionEconomyState.removeTurnAction(index);
    } else {
      const action = turnActions[index];
      setLocalTurnActions(prev => prev.filter((_, i) => i !== index));
      
      if (action) {
        setActionEconomy(prev => ({
          ...prev,
          actionUsed: action.type === 'action' ? false : prev.actionUsed,
          bonusActionUsed: action.type === 'bonus' ? false : prev.bonusActionUsed,
          reactionUsed: action.type === 'reaction' ? false : prev.reactionUsed,
        }));
      }
    }
  }, [actionEconomyState, turnActions, setActionEconomy]);
  
  // Remove action by description (for undo from items)
  const handleRemoveActionByDescription = useCallback((description: string) => {
    if (actionEconomyState) {
      const index = turnActions.findIndex(a => a.description === description);
      if (index !== -1) {
        actionEconomyState.removeTurnAction(index);
      }
    } else {
      setLocalTurnActions(prev => {
        const index = prev.findIndex(a => a.description === description);
        if (index === -1) return prev;
        
        const action = prev[index];
        
        // Update action economy
        setActionEconomy(prevEcon => ({
          ...prevEcon,
          actionUsed: action.type === 'action' ? false : prevEcon.actionUsed,
          bonusActionUsed: action.type === 'bonus' ? false : prevEcon.bonusActionUsed,
          reactionUsed: action.type === 'reaction' ? false : prevEcon.reactionUsed,
        }));
        
        return prev.filter((_, i) => i !== index);
      });
    }
  }, [actionEconomyState, turnActions, setActionEconomy]);
  
  // FAB actions
  const handleQuickRoll = () => {
    const roll = rollDice('d20', 1);
    setDiceRoll(roll);
    setDicePrompt('Quick d20 roll');
    setActiveAbility(null);
    setShowDiceModal(true);
  };
  
  const handleQuickAttack = () => {
    const weapon = DEFAULT_WEAPONS[0];
    const roll = rollDice('d20', 1, combatStats.attackBonus);
    handleWeaponRoll('normal', weapon, roll, weapon.damage);
  };
  
  const handleQuickHide = () => {
    const roll = rollDice('d20', 1, 11); // Stealth +11
    setDiceRoll(roll);
    setDicePrompt('Stealth Check to Hide');
    setActiveAbility(null);
    setShowDiceModal(true);
    handleAddToTurn('bonus', 'Hide (Stealth +11)');
  };
  
  const handleCopySummary = async () => {
    const summary = turnActions.map(a => 
      `${a.type.toUpperCase()}: ${a.description}${a.roll ? ` (${a.roll})` : ''}`
    ).join('\n');
    await navigator.clipboard.writeText(summary);
    setLastAction('SUMMARY COPIED');
  };
  
  // Helper: render section header divider
  const renderSectionHeader = (tab: CombatTab) => {
    const config = SECTION_HEADERS[tab];
    return (
      <div className={cn(
        "flex items-center gap-2 px-4 py-3 border-t",
        config.color
      )}>
        <span className="text-sm">{config.icon}</span>
        <span className="text-xs font-mono tracking-widest">{config.label}</span>
        <div className={cn("flex-1 h-px", config.color.replace('text-', 'bg-').replace(' border-', ' '))} />
      </div>
    );
  };

  // Helper: roll healing from a spell's healingFormula
  const rollHealingFormula = useCallback((formula: string): number => {
    if (!formula) return 0;
    const mod = 3; // default spellcasting modifier
    const resolved = formula.replace(/mod/gi, String(mod));
    const diceMatch = resolved.match(/(\d+)d(\d+)(?:\s*\+\s*(\d+))?/);
    if (diceMatch) {
      const count = parseInt(diceMatch[1]);
      const sides = parseInt(diceMatch[2]);
      const bonus = parseInt(diceMatch[3] || '0');
      let total = bonus;
      for (let i = 0; i < count; i++) total += Math.floor(Math.random() * sides) + 1;
      return Math.max(1, total);
    }
    const plain = parseInt(resolved);
    return isNaN(plain) ? 0 : plain;
  }, []);

  // Check if a cast spell is a healing spell and intercept for party targeting
  const handleSpellCastResult = useCallback((spellName: string) => {
    // Look up spell to check for healingFormula
    const allSpellIds = spellcasting?.state.preparedSpells ?? [];
    const spell = allSpellIds.map(id => getSpellById(id)).find(s => s?.name === spellName);
    if (spell?.healingFormula && onHPChange && currentHP !== undefined && maxHP !== undefined) {
      const healAmount = rollHealingFormula(spell.healingFormula);
      const otherMembers = (partySync?.party.members ?? []).filter(m => m.user_id !== userId);
      if (otherMembers.length > 0 && partySync?.sendHealAction && userId) {
        setPendingHealSpell({ spellName, amount: healAmount });
        return; // Don't apply yet
      }
      // Solo: auto-apply
      const newHP = Math.min(maxHP, currentHP + healAmount);
      onHPChange(newHP, maxHP, tempHP ?? 0);
    }
  }, [spellcasting, onHPChange, currentHP, maxHP, tempHP, partySync, userId, rollHealingFormula]);

  // Render combat section content (inline, not wrapped in overflow containers)
  const renderCombatContent = () => (
    <div className="p-4 space-y-4">
      {currentHP === 0 && deathSaves && onDeathSavesChange && onRegainHP && (
        <DeathSavesTracker
          deathSaves={deathSaves}
          onDeathSavesChange={onDeathSavesChange}
          onRegainHP={onRegainHP}
        />
      )}
      {spellcasting && spellcasting.state.path && (
        <QuickCastPanel
          spellcasting={spellcasting}
          characterName={character.name}
          characterLevel={character.level}
          onCast={(result) => {
            if (result.success) {
              handleAddToTurn('action', `Cast ${result.spellName}`);
              setLastAction(`${result.spellName.toUpperCase()} CAST`);
              handleSpellCastResult(result.spellName);
            }
          }}
        />
      )}
      <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-xl">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-mono text-green-400">SNEAK ATTACK</span>
          <span className="text-lg font-bold text-green-300">{sneakAttackDice}</span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Once per turn with advantage OR ally within 5ft (no disadvantage)
        </p>
      </div>
      <AttackQueuePanel
        queue={attackQueue.sortedQueue}
        enemies={targetTracker.enemies}
        actionEconomy={attackQueue.actionEconomy}
        onRemove={attackQueue.removeFromQueue}
        onReorder={attackQueue.reorderAttack}
        onUpdateTarget={attackQueue.updateAttackTarget}
        onExecute={handleExecuteQueue}
        onClear={attackQueue.clearQueue}
      />
      <div className="space-y-3">
        <h3 className="text-xs font-mono text-destructive uppercase tracking-wide">⚔️ Weapons</h3>
        {equippedWeapons.map(weapon => (
          <MobileWeaponCard
            key={weapon.id}
            weapon={weapon}
            level={character.level}
            attackBonus={combatStats.attackBonus}
            damageBonus={combatStats.damageBonus}
            conditions={conditions}
            hasPoisonedWeapon={hasPoisonedWeapon}
            isExpanded={expandedWeaponId === weapon.id}
            onToggleExpand={() => setExpandedWeaponId(
              expandedWeaponId === weapon.id ? null : weapon.id
            )}
            onRoll={handleWeaponRoll}
            customImage={weapon.slotType ? equipmentImages[weapon.slotType] : undefined}
            enemies={targetTracker.enemies}
            selectedTargetId={attackQueue.defaultTargetId}
            onQueueAttack={handleQueueAttack}
          />
        ))}
        {equippedWeapons.length === 0 && (
          <div className="text-center py-4 text-muted-foreground">
            <p className="text-sm">No weapons equipped</p>
          </div>
        )}
      </div>
      {weaponsMap.secondary && (
        <OffhandAttackCard
          secondaryWeapon={weaponsMap.secondary}
          primaryWeapon={weaponsMap.primary}
          level={character.level}
          attackBonus={combatStats.attackBonus}
          hasTwoWeaponFightingStyle={combatSettings.hasTwoWeaponFightingStyle}
          hasDualWielderFeat={combatSettings.hasDualWielderFeat}
          damageBonus={combatStats.damageBonus}
          conditions={conditions}
          hasPoisonedWeapon={hasPoisonedWeapon}
          bonusActionUsed={actionEconomy.bonusActionUsed}
          onRoll={handleOffhandRoll}
          onUseBonus={() => actionEconomyState?.useBonus?.() ?? setActionEconomy({...actionEconomy, bonusActionUsed: true})}
          customImage={equipmentImages.secondary_weapon}
        />
      )}
      {stealthAbilities.length > 0 && (
        <div className="space-y-3 pt-2 border-t border-muted/20">
          <h3 className="text-xs font-mono text-purple-400 uppercase tracking-wide">🌙 Stealth & Assassin</h3>
          {stealthAbilities.map(ability => {
            const cdState = cooldownStateMap.get(ability.id);
            return (
              <div key={ability.id}>
                <CombatAbilityCard
                  ability={ability}
                  characterName={character.name}
                  weapons={weaponsMap}
                  cooldownState={cdState ? {
                    isOnCooldown: cdState.isOnCooldown,
                    remaining: cdState.remaining,
                    total: cdState.total,
                  } : undefined}
                  customImage={abilityImages[ability.id]}
                  activeConditions={globalConditions}
                  activeSetBonuses={activeSetBonuses}
                  concentrationSpell={concentrationSpell}
                  currentTarget={targetTracker.getTargetForPrompt()}
                  onUse={handleEnhancedAbilityUse}
                  onTriggerCooldown={cooldownSystem.triggerCooldown}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // Render actions section content
  const renderActionsContent = () => {
    const filteredAbilities = actionsFilter === 'all' 
      ? [...specialAbilities, ...unlockedAbilities.filter(a => a.actionType === 'reaction')]
      : actionsFilter === 'reaction'
        ? unlockedAbilities.filter(a => a.actionType === 'reaction')
        : specialAbilities.filter(a => a.actionType === actionsFilter);
    
    return (
      <div className="p-4 space-y-4">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(['all', 'action', 'bonus_action', 'reaction'] as const).map(filter => (
            <button
              key={filter}
              onClick={() => setActionsFilter(filter)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-mono whitespace-nowrap transition-all active:scale-95",
                actionsFilter === filter
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/50"
                  : "bg-muted/20 text-muted-foreground border border-muted/30"
              )}
            >
              {filter === 'all' ? 'All' : 
               filter === 'action' ? '⚔️ Action' : 
               filter === 'bonus_action' ? '⚡ Bonus' : 
               '🛡️ Reaction'}
            </button>
          ))}
        </div>
        {actionsFilter === 'reaction' && actionEconomy.reactionUsed && (
          <div className="p-2 bg-red-500/10 border border-red-500/30 rounded-lg text-center">
            <span className="text-xs text-red-400 font-mono">⚠️ REACTION USED THIS ROUND</span>
          </div>
        )}
        {filteredAbilities.length > 0 ? (
          <div className="space-y-3">
            {filteredAbilities.map(ability => {
              const cdState = cooldownStateMap.get(ability.id);
              const isReaction = ability.actionType === 'reaction';
              return (
                <div key={ability.id} className={cn(
                  isReaction && "border-l-2 border-cyan-500 pl-2"
                )}>
                  <CombatAbilityCard
                    ability={ability}
                    characterName={character.name}
                    weapons={weaponsMap}
                    cooldownState={cdState ? {
                      isOnCooldown: cdState.isOnCooldown,
                      remaining: cdState.remaining,
                      total: cdState.total,
                    } : undefined}
                    customImage={abilityImages[ability.id]}
                    activeConditions={globalConditions}
                    activeSetBonuses={activeSetBonuses}
                    concentrationSpell={concentrationSpell}
                    currentTarget={targetTracker.getTargetForPrompt()}
                    onUse={(ability, roll, prompt, combinedDamage) => {
                      handleEnhancedAbilityUse(ability, roll, prompt, combinedDamage);
                      if (ability.actionType === 'reaction') {
                        setActionEconomy(prev => ({ ...prev, reactionUsed: true }));
                      }
                    }}
                    onTriggerCooldown={cooldownSystem.triggerCooldown}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>No {actionsFilter === 'all' ? 'abilities' : actionsFilter.replace('_', ' ') + 's'} unlocked</p>
          </div>
        )}
        {(actionsFilter === 'all' || actionsFilter === 'reaction') && (
          <div className="pt-2 border-t border-muted/20">
            <MobileReactionsList
              reactionUsed={actionEconomy.reactionUsed}
              onUseReaction={(reaction) => {
                setActionEconomy(prev => ({ ...prev, reactionUsed: true }));
                setLastAction(`⚡ ${reaction.name.toUpperCase()}`);
                handleAddToTurn('reaction', reaction.name);
                combatLog.addEntry({
                  actionType: 'reaction',
                  actionName: reaction.name,
                  prompt: reaction.dmPrompt || `## ⚡ REACTION: ${reaction.name.toUpperCase()}\n\n**Character:** ${character.name}\n**Trigger:** ${reaction.trigger}\n\n### Effect\n${reaction.effect}\n\n---\n\n*Narrate how ${character.name} instinctively responds with ${reaction.name}.*`,
                });
              }}
            />
          </div>
        )}
      </div>
    );
  };

  // Render spells section content
  const renderSpellsContent = () => {
    if (!spellcasting) {
      return (
        <div className="flex flex-col items-center justify-center text-center py-16 px-4">
          <p className="text-muted-foreground">Spellcasting not available</p>
        </div>
      );
    }
    return (
      <MobileSpellList
        spellcasting={spellcasting}
        characterName={character.name}
        onCast={(result) => {
          if (result.success) {
            setLastAction(`${result.spellName.toUpperCase()} CAST`);
            handleAddToTurn('action', `Cast ${result.spellName}`);
            combatLog.addEntry({
              actionType: 'spell',
              actionName: result.spellName,
              prompt: `## 🔮 SPELL CAST: ${result.spellName.toUpperCase()}\n\n**Character:** ${character.name}\n\n---\n\n*Narrate ${character.name} casting ${result.spellName}.*`,
            });
            handleSpellCastResult(result.spellName);
          }
        }}
      />
    );
  };

  // Render items section content
  const renderItemsContent = () => {
    const activeSetForItems = activeSetBonuses.length > 0 ? {
      name: activeSetBonuses[0].name,
      effect: activeSetBonuses[0].effect,
    } : undefined;
    const concentrationForItems = concentrationSpell ? {
      name: concentrationSpell,
      level: undefined,
    } : undefined;
    
    return (
      <MobileItemsGrid
        onAddToTurn={handleAddToTurn}
        onRemoveFromTurn={handleRemoveActionByDescription}
        onNavigateToConsumables={onNavigateToConsumables}
        globalConditions={globalConditions}
        activeSetBonus={activeSetForItems}
        concentrationSpell={concentrationForItems}
        lootItemsWithDice={lootItemsWithDice}
        onUseLootItem={onUseLootItem}
        characterName={character.name}
        onLogEntry={(entry) => combatLog.addEntry(entry)}
        onRemoveLogEntry={(actionName) => {
          const match = combatLog.entries.find(e => e.actionType === 'item' && e.actionName === actionName);
          if (match) combatLog.removeEntry(match.id);
        }}
        currentHP={currentHP}
        maxHP={maxHP}
        tempHP={tempHP}
        onHPChange={onHPChange}
        partyMembers={partySync?.party.members}
        userId={userId}
        onSendHeal={partySync?.sendHealAction}
      />
    );
  };

  // Render log section content
  const renderLogContent = () => (
    <CombatLogPanel
      entries={combatLog.entries}
      onClearLog={combatLog.clearLog}
      onRemoveEntry={combatLog.removeEntry}
      onSmartPrompt={() => setShowSmartPromptSheet(true)}
    />
  );
  
  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar with HP and Stats */}
      <CombatTopBar
        round={initiativeTracker.combatStarted ? initiativeTracker.roundNumber : round}
        isYourTurn={initiativeTracker.combatStarted ? initiativeTracker.isPlayerTurn : isYourTurn}
        lastAction={lastAction}
        onResetTurn={handleResetTurn}
        onMenuOpen={() => {}}
        onSettingsOpen={() => {}}
        onPartyOpen={() => setShowPartyDrawer(true)}
        partyMemberCount={partySync?.party.members.length ?? 0}
        currentHP={currentHP}
        maxHP={maxHP}
        tempHP={tempHP}
        ac={combatStats.ac}
        attackBonus={combatStats.attackBonus}
      />
      
      {/* Main Content Area */}
      <main className="pt-[88px]">
        
        {/* Situation Strip */}
        <SituationStrip
          conditions={conditions}
          onConditionsChange={setConditions}
          isCollapsed={situationCollapsed}
          onCollapsedChange={setSituationCollapsed}
        />
        
        {/* Compact Dice Roller Widget */}
        <CombatDiceRoller
          onShareToParty={partySync?.party.partyId ? (label, expression, result, details) => {
            partySync?.shareRoll(label, expression, result, details, characterName || 'Unknown');
          } : undefined}
        />
        
        {/* Target/Enemy Tracker */}
        <TargetTrackerPanel
          targets={targetTracker}
          isCollapsed={targetTrackerCollapsed}
          onCollapsedChange={setTargetTrackerCollapsed}
          onMarkTarget={partySync?.party.partyId ? (enemy) => {
            const hpPercent = enemy.maxHP > 0 ? (enemy.currentHP / enemy.maxHP) * 100 : 0;
            partySync?.broadcastFocusTarget({
              name: enemy.name,
              ac: enemy.ac,
              hpPercent,
              resistances: enemy.resistances,
              vulnerabilities: enemy.vulnerabilities,
              immunities: enemy.immunities,
              markedBy: characterName || 'Unknown',
            });
          } : undefined}
        />
        
        {/* Initiative Tracker */}
        <InitiativeTracker
          initiative={initiativeTracker}
          enemies={targetTracker.enemies}
          onUpdateEnemyInitiative={(id, initiative) => {
            targetTracker.updateEnemy(id, { initiative });
          }}
          dexModifier={abilityModifiers?.dexterity ?? 0}
          isCollapsed={initiativeCollapsed}
          onCollapsedChange={setInitiativeCollapsed}
          onBroadcastInitiative={partySync?.party.partyId ? (order, round) => {
            partySync?.broadcastInitiative(order, round, characterName || 'Unknown');
          } : undefined}
          onClearInitiative={partySync?.party.partyId ? () => {
            partySync?.clearInitiative();
          } : undefined}
        />
        
        {/* Action Economy Bar */}
        <ActionEconomyBar
          economy={actionEconomy}
          onEconomyChange={setActionEconomy}
          actionCount={actionCount}
          bonusCount={bonusCount}
          reactionCount={reactionCount}
          round={initiativeTracker.combatStarted ? initiativeTracker.roundNumber : round}
          coolingAbilities={coolingAbilitiesForBar}
          onEndTurn={() => {
            // End turn: reset economy, advance to next turn in initiative
            handleResetTurn();
            if (initiativeTracker.combatStarted) {
              initiativeTracker.nextTurn();
            } else {
              setRound(prev => prev + 1);
            }
            setLastAction('TURN ENDED');
          }}
          onEndTurnWithSynthesis={() => {
            // End turn with AI synthesis: open the smart prompt sheet
            handleResetTurn();
            if (initiativeTracker.combatStarted) {
              initiativeTracker.nextTurn();
            } else {
              setRound(prev => prev + 1);
            }
            setLastAction('TURN SYNCED');
            setShowSmartPromptSheet(true);
          }}
        />
        
        {/* Turn Wizard - Smart Suggestions */}
        <TurnWizardPanel
          economy={actionEconomy}
          conditions={conditions}
          unlockedAbilities={unlockedAbilities}
          cooldownState={cooldownStateMap}
          hasWeapons={equippedWeapons.length > 0}
          currentHP={currentHP}
          maxHP={maxHP}
          sneakAttackAvailable={conditions.includes('ally_adjacent')}
          onSuggestAttack={() => {
            handleTabChange('combat');
            setLastAction('WIZARD: ATTACK');
          }}
          onSuggestHide={() => {
            handleTabChange('combat');
            handleQuickHide();
          }}
          onSuggestAbility={(ability) => {
            handleTabChange('actions');
            setLastAction(`WIZARD: ${ability.name.toUpperCase()}`);
          }}
        />
        
        {/* All Sections - Continuous Vertical Scroll */}
        <div ref={scrollContainerRef}>
          {/* COMBAT Section */}
          <div ref={combatRef} id="section-combat">
            {renderSectionHeader('combat')}
            {renderCombatContent()}
          </div>
          
          {/* ACTIONS Section */}
          <div ref={actionsRef} id="section-actions">
            {renderSectionHeader('actions')}
            {renderActionsContent()}
          </div>
          
          {/* MAGIC Section */}
          <div ref={spellsRef} id="section-spells">
            {renderSectionHeader('spells')}
            {renderSpellsContent()}
          </div>
          
          {/* ITEMS Section */}
          <div ref={itemsRef} id="section-items">
            {renderSectionHeader('items')}
            {renderItemsContent()}
          </div>
          
          {/* LOG Section */}
          <div ref={logRef} id="section-log" className="pb-24">
            {renderSectionHeader('log')}
            {renderLogContent()}
          </div>
        </div>
      </main>
      
      {/* Bottom Navigation */}
      <CombatBottomNav
        activeTab={activeTab}
        onTabChange={handleTabChange}
        abilityCounts={{
          combat: equippedWeapons.length + stealthAbilities.length,
          actions: specialAbilities.length + unlockedAbilities.filter(a => a.actionType === 'reaction').length,
          spells: spellcasting?.state.preparedSpells.length ?? 0,
          items: 4,
          log: combatLog.entryCount,
        }}
      />
      
      {/* Dice Roll Modal */}
      {diceRoll && (
        <DiceRollModal
          ability={activeAbility || undefined}
          tier={activeTier}
          roll={diceRoll}
          rpPrompt={dicePrompt}
          open={showDiceModal}
          onOpenChange={setShowDiceModal}
          rerollDisabled={rerollsDisabled}
        />
      )}
      
      {/* AI Smart Prompt Sheet */}
      <SmartPromptSheet
        open={showSmartPromptSheet}
        onOpenChange={setShowSmartPromptSheet}
        entries={combatLog.entries}
        characterName={character.name}
      />

      {/* Party Drawer */}
      {partySync && (
        <EdgeDrawer
          side="right"
          open={showPartyDrawer}
          onOpenChange={setShowPartyDrawer}
          title="Party"
          icon={<Users className="w-4 h-4" />}
          accentColor="#10b981"
        >
          <PartyPanel
            partySync={partySync}
            characterName={characterName || character.name}
            currentStatus={{
              currentHP,
              maxHP,
              tempHP,
              ac: combatStats.ac,
              level: character.level,
              className: character.primaryClass,
            }}
            isAuthenticated={isAuthenticated}
            userId={userId}
          />
        </EdgeDrawer>
      )}

      {/* Heal Target Picker for spell healing */}
      <HealTargetPicker
        open={!!pendingHealSpell}
        onOpenChange={(open) => { if (!open) setPendingHealSpell(null); }}
        selfName={characterName || character.name}
        partyMembers={partySync?.party.members ?? []}
        currentUserId={userId || ''}
        healDescription={pendingHealSpell ? `${pendingHealSpell.spellName} — ${pendingHealSpell.amount} HP` : ''}
        onSelectSelf={() => {
          if (onHPChange && currentHP !== undefined && maxHP !== undefined && pendingHealSpell) {
            const newHP = Math.min(maxHP, currentHP + pendingHealSpell.amount);
            onHPChange(newHP, maxHP, tempHP ?? 0);
          }
          setPendingHealSpell(null);
        }}
        onSelectMember={(member) => {
          if (partySync?.sendHealAction && pendingHealSpell) {
            partySync.sendHealAction(member.user_id, {
              senderName: characterName || character.name,
              itemName: pendingHealSpell.spellName,
              hpHealed: pendingHealSpell.amount,
            });
          }
          setPendingHealSpell(null);
        }}
      />
    </div>
  );
}

// Generate weapon attack RP prompt
function generateWeaponPrompt(
  rollType: 'normal' | 'sneak' | 'assassinate',
  weapon: WeaponAttack,
  roll: DiceRoll,
  damage: string,
  characterName: string,
  target?: TargetPromptInfo | null,
  isOffhand?: boolean
): string {
  const isCrit = roll.rolls.includes(20);
  const isFumble = roll.rolls.includes(1);
  const hasAdvantage = roll.rolls.length > 1;
  
  let title = isOffhand
    ? '⚡ OFFHAND ATTACK'
    : rollType === 'assassinate' 
      ? '💀 ASSASSINATION ATTEMPT' 
      : rollType === 'sneak' 
        ? '🗡️ SNEAK ATTACK'
        : '⚔️ ATTACK';
  
  const quips = isOffhand
    ? [
        "Left hand doesn't know what the right hand is doing... but both are stabbing!",
        "Dual wielding: because one sword is for amateurs.",
        "Two weapons, twice the pain!",
        "Ambidextrous AND dangerous!",
      ]
    : [
        "Maximum effort!",
        "Nailed it. Add it to my highlight reel.",
        "Did you see that?!",
        "Chimichangas for everyone!",
      ];
  const quip = quips[Math.floor(Math.random() * quips.length)];
  
  // Format target section if target is provided
  const targetSection = target ? formatTargetForPrompt(target) : '';
  
  const offhandNote = isOffhand ? '\n**Note:** Offhand attack (bonus action) - no ability modifier to damage unless you have the Two-Weapon Fighting style.\n' : '';
  
  return `## ${title}

**Character:** ${characterName || 'The Merc'}
**Weapon:** ${weapon.name}${isOffhand ? ' (Offhand)' : ''}
**Roll:** ${hasAdvantage ? '2d20kh1' : '1d20'}+${roll.modifier} = [${roll.rolls.join(', ')}] = **${roll.total}**
${isCrit ? '\n🎯 **NATURAL 20! CRITICAL HIT!**' : ''}
${isFumble ? '\n💀 **NATURAL 1! CRITICAL MISS!**' : ''}
${targetSection ? `\n${targetSection}\n` : ''}
**Damage on Hit:** ${damage}${offhandNote}
*"${quip}"*`;
}
