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
import { CombatBottomNav, CombatTab } from './CombatBottomNav';
import { CombatTopBar } from './CombatTopBar';
import { SituationStrip } from './SituationStrip';
import { ActionEconomyBar } from './ActionEconomyBar';
import { MobileWeaponCard } from './MobileWeaponCard';
import { CombatFAB } from './CombatFAB';
import { TurnSummaryPanel } from './TurnSummaryPanel';
import { MobileAbilityList } from './MobileAbilityList';
import { EnhancedMobileAbilityList } from './EnhancedMobileAbilityList';
import { MobileItemsGrid } from './MobileItemsGrid';
import { MobileSpellList } from './MobileSpellList';
import { MobileReactionsList } from './MobileReactionsList';
import { QuickCastPanel } from './QuickCastPanel';
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

// Tab order for swipe navigation
const TAB_ORDER: CombatTab[] = ['attacks', 'stealth', 'abilities', 'reactions', 'spells', 'items', 'summary'];

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
}: MobileCombatLayoutProps) {
  // Navigation state
  const [activeTab, setActiveTab] = useState<CombatTab>('attacks');
  const [round, setRound] = useState(1);
  const [isYourTurn, setIsYourTurn] = useState(true);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null);
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
      // Reset animation after it completes
      setTimeout(() => setSlideDirection(null), 300);
    }
  }, [activeTab]);
  
  const handleSwipeRight = useCallback(() => {
    const currentIndex = TAB_ORDER.indexOf(activeTab);
    if (currentIndex > 0) {
      setSlideDirection('right');
      setActiveTab(TAB_ORDER[currentIndex - 1]);
      // Reset animation after it completes
      setTimeout(() => setSlideDirection(null), 300);
    }
  }, [activeTab]);
  
  const { handlers: swipeHandlers, swiping, swipeOffset } = useSwipe(
    handleSwipeLeft,
    handleSwipeRight,
    { threshold: 60, velocityThreshold: 0.4 }
  );
  
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
    
    // Trigger cooldown
    cooldownSystem.triggerCooldown(ability.id);
    
    const actionType = ability.actionType === 'bonus_action' ? 'bonus' : 
                       ability.actionType === 'reaction' ? 'reaction' : 'action';
    handleAddToTurn(actionType, ability.name, `${count}${die}`);
  }, [character.name, handleAddToTurn, cooldownSystem]);
  
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
    
    const actionType = ability.actionType === 'bonus_action' ? 'bonus' : 
                       ability.actionType === 'reaction' ? 'reaction' : 'action';
    const { die, count } = getAbilityDice(ability.tier);
    handleAddToTurn(actionType, `${ability.name} (${combinedDamage})`, `${count}${die}`);
  }, [handleAddToTurn]);
  
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
    
    setDiceRoll(roll);
    setDicePrompt(generateWeaponPrompt(rollType, weapon, roll, damage, character.name));
    setActiveAbility(null);
    setShowDiceModal(true);
    setLastAction(`${rollName.toUpperCase()} ROLL`);
    
    handleAddToTurn('action', `${weapon.name} attack${rollType !== 'normal' ? ` (${rollType})` : ''}`);
  }, [character.name, handleAddToTurn]);
  
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
  
  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'attacks':
        return (
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 pb-24 space-y-3">
              {/* Quick Cast Panel - Magic Integration */}
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
              <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-xl">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono text-green-400">SNEAK ATTACK</span>
                  <span className="text-lg font-bold text-green-300">{sneakAttackDice}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Once per turn with advantage OR ally within 5ft (no disadvantage)
                </p>
              </div>
              
              {/* Weapon Cards - From Equipped Gear */}
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
          </div>
        );
      
      case 'stealth':
        return (
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
        );
      
      case 'abilities':
        return (
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
        );
      
      case 'reactions':
        return (
          <MobileReactionsList
            reactionUsed={actionEconomy.reactionUsed}
            onUseReaction={(reaction) => {
              // Mark reaction as used
              setActionEconomy(prev => ({ ...prev, reactionUsed: true }));
              setLastAction(`⚡ ${reaction.name.toUpperCase()}`);
              handleAddToTurn('reaction', reaction.name);
            }}
          />
        );
      
      case 'spells':
        return spellcasting ? (
          <MobileSpellList
            spellcasting={spellcasting}
            characterName={character.name}
            onCast={(result) => {
              if (result.success) {
                setLastAction(`${result.spellName.toUpperCase()} CAST`);
                handleAddToTurn('action', `Cast ${result.spellName}`);
              }
            }}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-16 px-4">
            <p className="text-muted-foreground">Spellcasting not available</p>
          </div>
        );
      
      case 'items':
        return (
          <MobileItemsGrid
            onAddToTurn={handleAddToTurn}
            onRemoveFromTurn={handleRemoveActionByDescription}
            onNavigateToConsumables={onNavigateToConsumables}
          />
        );
      
      case 'summary':
        return (
          <TurnSummaryPanel
            turnActions={turnActions}
            movementUsed={actionEconomy.movementUsed}
            maxMovement={actionEconomy.maxMovement}
            onRemoveAction={handleRemoveAction}
            onClearTurn={handleResetTurn}
            onSetMovement={(desc) => {
              if (actionEconomyState) {
                actionEconomyState.addTurnAction({ type: 'movement', description: desc });
              } else {
                setLocalTurnActions(prev => [
                  ...prev.filter(a => a.type !== 'movement'),
                  { type: 'movement', description: desc }
                ]);
              }
            }}
          />
        );
    }
  };
  
  return (
    <div className="min-h-screen bg-background">
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
      
      {/* Main Content Area */}
      <main className="pt-[88px]">
        
        {/* Situation Strip */}
        <SituationStrip
          conditions={conditions}
          onConditionsChange={setConditions}
          isCollapsed={situationCollapsed}
          onCollapsedChange={setSituationCollapsed}
        />
        
        {/* Action Economy Bar */}
        <ActionEconomyBar
          economy={actionEconomy}
          onEconomyChange={setActionEconomy}
          actionCount={actionCount}
          bonusCount={bonusCount}
          reactionCount={reactionCount}
        />
        
        {/* Tab Content - Swipeable */}
        <div 
          {...swipeHandlers}
          className="overflow-auto touch-pan-y"
          style={{ 
            touchAction: 'pan-y pinch-zoom',
          }}
        >
          <div 
            className={cn(
              "transition-transform duration-300 ease-out",
              slideDirection === 'left' && "animate-slide-in-from-right",
              slideDirection === 'right' && "animate-slide-in-from-left"
            )}
            style={{
              transform: swiping ? `translateX(${swipeOffset}px)` : undefined,
              transition: swiping ? 'none' : undefined,
            }}
          >
            {renderTabContent()}
          </div>
        </div>
      </main>
      
      {/* Bottom Navigation */}
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
