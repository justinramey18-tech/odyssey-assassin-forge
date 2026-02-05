import { useState, useCallback, useMemo } from 'react';
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
import { ActiveConditionInfo, SetBonusInfo } from '@/lib/combat/promptContext';
import { DiceRoll, rollDice, getAbilityDice } from '@/lib/diceRoller';
import { generateRPPrompt } from '@/lib/rpPromptGenerator';
import { DiceRollModal } from '@/components/character/DiceRollModal';
import { useSwipe } from '@/hooks/use-swipe';
import { useGameMode } from '@/hooks/use-game-mode';
import { useCooldowns } from '@/hooks/use-cooldowns';
import { useCombatStats } from '@/hooks/use-combat-stats';
import { COOLDOWN_CONFIGS, calculateEffectiveCooldown } from '@/lib/cooldowns/config';

// Mobile components
import { CombatBottomNav, CombatTab, SubTabPills, CombatSubTab, ActionsSubTab } from './CombatBottomNav';
import { CombatTopBar } from './CombatTopBar';
import { SituationStrip } from './SituationStrip';
import { InlineActionEconomy } from './InlineActionEconomy';
import { QuickSituationChips } from './QuickSituationChips';
import { TurnGuidanceHint } from './TurnGuidanceHint';
import { MobileWeaponCard } from './MobileWeaponCard';
import { CombatFAB } from './CombatFAB';
import { TurnSummaryPanel } from './TurnSummaryPanel';
import { CombatLogPanel } from './CombatLogPanel';
import { SmartPromptSheet } from './SmartPromptSheet';
import { MobileAbilityList } from './MobileAbilityList';
import { EnhancedMobileAbilityList } from './EnhancedMobileAbilityList';
import { MobileItemsGrid } from './MobileItemsGrid';
import { MobileSpellList } from './MobileSpellList';
import { MobileReactionsList } from './MobileReactionsList';
import { QuickCastPanel } from './QuickCastPanel';
import { useCombatLog } from '@/hooks/use-combat-log';
import { UseSpellcastingReturn } from '@/hooks/use-spellcasting';
import { usePromptDrawers } from '@/components/drawers';
import { CharacterEquipment, EquipmentSlotType } from '@/lib/inventory/types';
import { getEquippedWeapons, convertToWeaponAttack } from '@/lib/combat/weaponConverter';
import { Reaction, DEFAULT_REACTIONS, REACTIONS_STORAGE_KEY } from '@/lib/combat/reactions';
import { useEquipmentImages } from '@/hooks/use-equipment-images';
import { useAbilityImages } from '@/hooks/use-ability-images';
import { AggregatedStats } from '@/hooks/use-equipment-stats';
import { BaseAbilityScores } from '@/lib/abilityScores/types';
import { UseActionEconomyReturn } from '@/hooks/use-action-economy';

// Tab order for swipe navigation (consolidated 5 tabs)
const TAB_ORDER: CombatTab[] = ['combat', 'actions', 'spells', 'items', 'log'];

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
}: MobileCombatLayoutProps) {
  // Navigation state
  const [activeTab, setActiveTab] = useState<CombatTab>('combat');
  const [combatSubTab, setCombatSubTab] = useState<CombatSubTab>('attacks');
  const [actionsSubTab, setActionsSubTab] = useState<ActionsSubTab>('abilities');
  const [round, setRound] = useState(1);
  const [isYourTurn, setIsYourTurn] = useState(true);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const { rerollsDisabled, isHonestMode, enforceCooldowns } = useGameMode();
  
  // Use unified combat stats hook
  const combatStats = useCombatStats({
    character,
    equipmentStats,
    abilityModifiers,
  });
  
  // Access drawer context
  const drawerContext = usePromptDrawers();
  
  // Equipment custom images for weapon cards
  const { images: equipmentImages } = useEquipmentImages();
  
  // Ability custom images for ability cards
  const { images: abilityImages } = useAbilityImages();
  
  // Combat log for AI DM prompts
  const combatLog = useCombatLog();
  
  // Cooldown system integration
  const cooldownSystem = useCooldowns({
    characterAbilities: character.abilities,
    isHonestMode,
    enforceCooldowns,
  });
  
  // Swipe navigation handlers
  const handleSwipeLeft = useCallback(() => {
    const currentIndex = TAB_ORDER.indexOf(activeTab);
    if (currentIndex < TAB_ORDER.length - 1) {
      setSlideDirection('left');
      setActiveTab(TAB_ORDER[currentIndex + 1]);
      setTimeout(() => setSlideDirection(null), 300);
    }
  }, [activeTab]);
  
  const handleSwipeRight = useCallback(() => {
    const currentIndex = TAB_ORDER.indexOf(activeTab);
    if (currentIndex > 0) {
      setSlideDirection('right');
      setActiveTab(TAB_ORDER[currentIndex - 1]);
      setTimeout(() => setSlideDirection(null), 300);
    }
  }, [activeTab]);
  
  const { handlers: swipeHandlers, swiping, swipeOffset } = useSwipe(
    handleSwipeLeft,
    handleSwipeRight,
    { threshold: 60, velocityThreshold: 0.4 }
  );
  
  // Situation state - extracted for quick chips
  const [conditions, setConditions] = useState<string[]>([]);
  const [situationCollapsed, setSituationCollapsed] = useState(true);
  
  // Quick chip state (derived from conditions)
  const isHidden = conditions.includes('hidden');
  const hasAdvantage = conditions.includes('advantage');
  const nearAlly = conditions.includes('nearAlly');
  
  const toggleQuickCondition = useCallback((conditionId: string) => {
    setConditions(prev => 
      prev.includes(conditionId) 
        ? prev.filter(c => c !== conditionId)
        : [...prev, conditionId]
    );
  }, []);
  
  // Sneak attack eligibility
  const sneakAttackEligible = hasAdvantage || nearAlly || isHidden;
  
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
  
  // Count abilities by type
  const unlockedAbilities = character.abilities
    .filter(ca => ca.currentTier > 0)
    .map(ca => ({
      ...allAbilities.find(a => a.id === ca.abilityId)!,
      tier: ca.currentTier as 1 | 2 | 3,
    }))
    .filter(Boolean);
  
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
  }, [unlockedAbilities, cooldownSystem]);
  
  // Add action to turn summary
  const handleAddToTurn = useCallback((
    actionType: 'action' | 'bonus' | 'reaction',
    description: string,
    roll?: string
  ) => {
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
    
    combatLog.addEntry({
      actionType: 'ability',
      actionName: ability.name,
      prompt,
      roll: {
        total: roll.total,
        rolls: roll.rolls,
        modifier: roll.modifier,
        isCrit: roll.rolls.includes(20),
        isFumble: roll.rolls.includes(1),
      },
      damage: `${count}${die}`,
    });
    
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
    
    combatLog.addEntry({
      actionType: 'ability',
      actionName: `${ability.name} + Weapon`,
      prompt,
      roll: {
        total: roll.total,
        rolls: roll.rolls,
        modifier: roll.modifier,
        isCrit: roll.rolls.includes(20),
        isFumble: roll.rolls.includes(1),
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
    
    const prompt = generateWeaponPrompt(rollType, weapon, roll, damage, character.name);
    
    setDiceRoll(roll);
    setDicePrompt(prompt);
    setActiveAbility(null);
    setShowDiceModal(true);
    setLastAction(`${rollName.toUpperCase()} ROLL`);
    
    combatLog.addEntry({
      actionType: 'weapon',
      actionName: rollName,
      prompt,
      roll: {
        total: roll.total,
        rolls: roll.rolls,
        modifier: roll.modifier,
        isCrit: roll.rolls.includes(20),
        isFumble: roll.rolls.includes(1),
      },
      damage,
    });
    
    handleAddToTurn('action', `${weapon.name} attack${rollType !== 'normal' ? ` (${rollType})` : ''}`);
  }, [character.name, handleAddToTurn, combatLog]);
  
  // Reset turn / End turn
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

  // End turn with round advancement
  const handleEndTurn = useCallback(() => {
    handleResetTurn();
    setRound(prev => prev + 1);
    setLastAction(`ROUND ${round + 1} STARTED`);
    if (navigator.vibrate) navigator.vibrate(30);
  }, [handleResetTurn, round]);

  // End turn with AI synthesis
  const handleEndTurnWithSynthesis = useCallback(() => {
    setShowSmartPromptSheet(true);
    handleEndTurn();
  }, [handleEndTurn]);
  
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
  
  // Handle tab navigation from guidance
  const handleNavigateToTab = useCallback((tab: string) => {
    if (tab === 'attacks' || tab === 'stealth') {
      setActiveTab('combat');
      setCombatSubTab(tab as CombatSubTab);
    } else if (tab === 'abilities' || tab === 'reactions') {
      setActiveTab('actions');
      setActionsSubTab(tab as ActionsSubTab);
    } else if (tab === 'spells' || tab === 'items' || tab === 'log') {
      setActiveTab(tab as CombatTab);
    }
  }, []);
  
  // Render tab content with sub-tabs
  const renderTabContent = () => {
    switch (activeTab) {
      case 'combat':
        return (
          <div className="flex-1 overflow-y-auto overscroll-contain combat-scroll-container">
            {/* Sub-tab pills */}
            <SubTabPills<CombatSubTab>
              tabs={[
                { id: 'attacks', label: 'Attacks' },
                { id: 'stealth', label: 'Stealth' },
              ]}
              activeTab={combatSubTab}
              onTabChange={setCombatSubTab}
            />
            
            {combatSubTab === 'attacks' ? (
              <div className="p-4 space-y-3">
                {/* Quick Cast Panel */}
                {spellcasting && spellcasting.state.path && (
                  <QuickCastPanel
                    spellcasting={spellcasting}
                    characterName={character.name}
                    characterLevel={character.level}
                    onCast={(result) => {
                      if (result.success) {
                        handleAddToTurn('action', `Cast ${result.spellName}`);
                        setLastAction(`${result.spellName.toUpperCase()} CAST`);
                      }
                    }}
                  />
                )}
                
                {/* Sneak Attack Status */}
                <div className={cn(
                  "p-3 rounded-xl border",
                  sneakAttackEligible 
                    ? "bg-green-500/20 border-green-500/40" 
                    : "bg-muted/10 border-muted/20"
                )}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={cn(
                      "text-xs font-mono",
                      sneakAttackEligible ? "text-green-400" : "text-muted-foreground"
                    )}>
                      SNEAK ATTACK {sneakAttackEligible ? '✓' : '○'}
                    </span>
                    <span className={cn(
                      "text-lg font-bold",
                      sneakAttackEligible ? "text-green-300" : "text-muted-foreground"
                    )}>
                      {sneakAttackDice}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {sneakAttackEligible 
                      ? 'Eligible! Advantage, ally nearby, or hidden.'
                      : 'Need advantage OR ally within 5ft (no disadvantage)'}
                  </p>
                </div>
                
                {/* Weapon Cards */}
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
                  />
                ))}
                {equippedWeapons.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="text-sm">No weapons equipped</p>
                    <p className="text-[10px] text-red-400 mt-1 italic">
                      "Maybe equip something in the Gear tab, genius."
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <EnhancedMobileAbilityList
                abilities={stealthAbilities}
                characterName={character.name}
                weapons={weaponsMap}
                cooldownState={cooldownStateMap}
                abilityImages={abilityImages}
                activeConditions={globalConditions}
                activeSetBonuses={activeSetBonuses}
                concentrationSpell={concentrationSpell}
                onUseAbility={handleEnhancedAbilityUse}
                onTriggerCooldown={cooldownSystem.triggerCooldown}
                emptyMessage="No stealth abilities unlocked"
              />
            )}
          </div>
        );
      
      case 'actions':
        return (
          <div className="flex-1 overflow-y-auto overscroll-contain combat-scroll-container">
            {/* Sub-tab pills */}
            <SubTabPills<ActionsSubTab>
              tabs={[
                { id: 'abilities', label: 'Abilities' },
                { id: 'reactions', label: 'Reactions' },
              ]}
              activeTab={actionsSubTab}
              onTabChange={setActionsSubTab}
            />
            
            {actionsSubTab === 'abilities' ? (
              <EnhancedMobileAbilityList
                abilities={specialAbilities}
                characterName={character.name}
                weapons={weaponsMap}
                cooldownState={cooldownStateMap}
                abilityImages={abilityImages}
                activeConditions={globalConditions}
                activeSetBonuses={activeSetBonuses}
                concentrationSpell={concentrationSpell}
                onUseAbility={handleEnhancedAbilityUse}
                onTriggerCooldown={cooldownSystem.triggerCooldown}
                emptyMessage="No special abilities unlocked"
                showFilters
              />
            ) : (
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
            )}
          </div>
        );
      
      case 'spells':
        return spellcasting ? (
          <div className="flex-1 overflow-y-auto overscroll-contain combat-scroll-container">
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
                }
              }}
            />
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-16 px-4">
            <p className="text-muted-foreground">Spellcasting not available</p>
          </div>
        );
      
      case 'items':
        const activeSetForItems = activeSetBonuses.length > 0 ? {
          name: activeSetBonuses[0].name,
          effect: activeSetBonuses[0].effect,
        } : undefined;
        
        const concentrationForItems = concentrationSpell ? {
          name: concentrationSpell,
          level: undefined,
        } : undefined;
        
        return (
          <div className="flex-1 overflow-y-auto overscroll-contain combat-scroll-container">
            <MobileItemsGrid
              onAddToTurn={handleAddToTurn}
              onRemoveFromTurn={handleRemoveActionByDescription}
              onNavigateToConsumables={onNavigateToConsumables}
              globalConditions={globalConditions}
              activeSetBonus={activeSetForItems}
              concentrationSpell={concentrationForItems}
              lootItemsWithDice={lootItemsWithDice}
              onUseLootItem={onUseLootItem}
            />
          </div>
        );
      
      case 'log':
        return (
          <div className="flex-1 overflow-y-auto overscroll-contain combat-scroll-container">
            <CombatLogPanel
              entries={combatLog.entries}
              onClearLog={combatLog.clearLog}
              onRemoveEntry={combatLog.removeEntry}
              onSmartPrompt={() => setShowSmartPromptSheet(true)}
            />
          </div>
        );
    }
  };
  
  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Top Bar with HP and Stats */}
      <CombatTopBar
        round={round}
        isYourTurn={isYourTurn}
        lastAction={lastAction}
        onResetTurn={handleResetTurn}
        onMenuOpen={() => {}}
        onSettingsOpen={() => {}}
        currentHP={currentHP}
        maxHP={maxHP}
        tempHP={tempHP}
        ac={combatStats.ac}
        attackBonus={combatStats.attackBonus}
      />
      
      {/* Main Content Area - Single scrollable container for everything below header */}
      <main 
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain pt-[120px] pb-40"
        style={{ 
          touchAction: 'pan-y pinch-zoom',
          WebkitOverflowScrolling: 'touch',
        }}
        onScroll={(e) => {
          setIsScrolling(true);
          clearTimeout((window as any).scrollTimeout);
          (window as any).scrollTimeout = setTimeout(() => setIsScrolling(false), 150);
        }}
      >
        {/* Inline Action Economy (below header, above situation chips) */}
        <InlineActionEconomy
          economy={actionEconomy}
          onEconomyChange={setActionEconomy}
          round={round}
          onEndTurn={handleEndTurn}
          onEndTurnWithSynthesis={handleEndTurnWithSynthesis}
        />
        
        {/* Quick Situation Chips (below action economy) */}
        <QuickSituationChips
          isHidden={isHidden}
          hasAdvantage={hasAdvantage}
          nearAlly={nearAlly}
          onToggleHidden={() => toggleQuickCondition('hidden')}
          onToggleAdvantage={() => toggleQuickCondition('advantage')}
          onToggleNearAlly={() => toggleQuickCondition('nearAlly')}
          onExpandSituationStrip={() => setSituationCollapsed(false)}
          sneakAttackEligible={sneakAttackEligible}
        />
        
        {/* Expandable Situation Strip (full panel) */}
        {!situationCollapsed && (
          <SituationStrip
            conditions={conditions}
            onConditionsChange={setConditions}
            isCollapsed={situationCollapsed}
            onCollapsedChange={setSituationCollapsed}
          />
        )}
        
        {/* Tab Content with swipe animation - swipe handlers only on this inner div */}
        <div 
          {...swipeHandlers}
          className={cn(
            "transition-transform duration-300 ease-out min-h-[50vh]",
            slideDirection === 'left' && "animate-slide-in-from-right",
            slideDirection === 'right' && "animate-slide-in-from-left"
          )}
          style={{
            transform: swiping ? `translateX(${swipeOffset}px)` : undefined,
            transition: swiping ? 'none' : undefined,
            touchAction: 'pan-y pan-x',
          }}
        >
          {renderTabContent()}
        </div>
      </main>
      
      {/* Smart Turn Guidance */}
      <TurnGuidanceHint
        economy={actionEconomy}
        unlockedAbilities={unlockedAbilities}
        isHidden={isHidden}
        hasAdvantage={hasAdvantage}
        nearAlly={nearAlly}
        cooldownStateMap={cooldownStateMap}
        onNavigateToTab={handleNavigateToTab}
      />
      
      {/* Bottom Navigation (5 consolidated tabs) */}
      <CombatBottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        abilityCounts={{
          attacks: equippedWeapons.length,
          stealth: stealthAbilities.length,
          abilities: specialAbilities.length,
          reactions: (() => {
            try {
              const saved = localStorage.getItem(REACTIONS_STORAGE_KEY);
              const reactions: Reaction[] = saved ? JSON.parse(saved) : DEFAULT_REACTIONS;
              return reactions.filter(r => r.isEnabled).length;
            } catch {
              return DEFAULT_REACTIONS.filter(r => r.isEnabled).length;
            }
          })(),
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
    </div>
  );
}

// Generate weapon attack RP prompt
function generateWeaponPrompt(
  rollType: 'normal' | 'sneak' | 'assassinate',
  weapon: WeaponAttack,
  roll: DiceRoll,
  damage: string,
  characterName: string
): string {
  const isCrit = roll.rolls.includes(20);
  const isFumble = roll.rolls.includes(1);
  const hasAdvantage = roll.rolls.length > 1;
  
  let title = rollType === 'assassinate' 
    ? '💀 ASSASSINATION ATTEMPT' 
    : rollType === 'sneak' 
      ? '🗡️ SNEAK ATTACK'
      : '⚔️ ATTACK';
  
  const quips = [
    "Maximum effort!",
    "Nailed it. Add it to my highlight reel.",
    "Did you see that?!",
    "Chimichangas for everyone!",
  ];
  const quip = quips[Math.floor(Math.random() * quips.length)];
  
  return `## ${title}

**Character:** ${characterName || 'The Merc'}
**Weapon:** ${weapon.name}
**Roll:** ${hasAdvantage ? '2d20kh1' : '1d20'}+${roll.modifier} = [${roll.rolls.join(', ')}] = **${roll.total}**
${isCrit ? '\n🎯 **NATURAL 20! CRITICAL HIT!**' : ''}
${isFumble ? '\n💀 **NATURAL 1! CRITICAL MISS!**' : ''}

**Damage on Hit:** ${damage}

*"${quip}"*`;
}
