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
import { DiceRoll, rollDice, getAbilityDice } from '@/lib/diceRoller';
import { generateRPPrompt } from '@/lib/rpPromptGenerator';
import { DiceRollModal } from '@/components/character/DiceRollModal';
import { useSwipe } from '@/hooks/use-swipe';
import { useGameMode } from '@/hooks/use-game-mode';

// Mobile components
import { CombatBottomNav, CombatTab } from './CombatBottomNav';
import { CombatTopBar } from './CombatTopBar';
import { SituationStrip } from './SituationStrip';
import { ActionEconomyBar } from './ActionEconomyBar';
import { MobileWeaponCard } from './MobileWeaponCard';
import { CombatFAB } from './CombatFAB';
import { TurnSummaryPanel } from './TurnSummaryPanel';
import { MobileAbilityList } from './MobileAbilityList';
import { MobileItemsGrid } from './MobileItemsGrid';
import { MobileSpellList } from './MobileSpellList';
import { ConditionStrip } from '@/components/conditions';
import { UseSpellcastingReturn } from '@/hooks/use-spellcasting';
import { usePromptDrawers } from '@/components/drawers';

// Tab order for swipe navigation
const TAB_ORDER: CombatTab[] = ['attacks', 'stealth', 'abilities', 'spells', 'items', 'summary'];

// Combat modifier calculations
interface CombatModifiers {
  attackBonus: number;
  damageBonus: number;
  acBonus: number;
  initiativeBonus: number;
  saveDC: number;
}

function calculateModifiers(character: Character): CombatModifiers {
  let attackBonus = 0;
  let damageBonus = 0;
  let acBonus = 0;
  let initiativeBonus = 0;
  
  const proficiencyBonus = Math.ceil(character.level / 4) + 1;
  
  character.abilities.forEach(ca => {
    if (ca.currentTier === 0) return;
    const ability = allAbilities.find(a => a.id === ca.abilityId);
    if (!ability || ability.type !== 'passive') return;
    
    if (ability.id === 'archery_master') {
      if (ca.currentTier >= 1) attackBonus += 1;
      if (ca.currentTier >= 2) { attackBonus += 1; damageBonus += 1; }
      if (ca.currentTier >= 3) damageBonus += 1;
    }
    
    if (ability.id === 'weapon_master') {
      if (ca.currentTier >= 1) attackBonus += 1;
      if (ca.currentTier >= 2) { attackBonus += 1; damageBonus += 1; }
      if (ca.currentTier >= 3) damageBonus += 1;
    }
    
    if (ability.id === 'warriors_resilience') {
      if (ca.currentTier >= 1) acBonus += 1;
      if (ca.currentTier >= 2) acBonus += 1;
    }
    
    if (ability.id === 'sixth_sense') {
      if (ca.currentTier >= 1) initiativeBonus += 2;
      if (ca.currentTier >= 2) initiativeBonus += 3;
    }
  });
  
  return {
    attackBonus: attackBonus + proficiencyBonus,
    damageBonus,
    acBonus: 10 + acBonus,
    initiativeBonus,
    saveDC: 8 + proficiencyBonus,
  };
}

interface MobileCombatLayoutProps {
  character: Character;
  spellcasting?: UseSpellcastingReturn;
}

export function MobileCombatLayout({ character, spellcasting }: MobileCombatLayoutProps) {
  // Navigation state
  const [activeTab, setActiveTab] = useState<CombatTab>('attacks');
  const [round, setRound] = useState(1);
  const [isYourTurn, setIsYourTurn] = useState(true);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null);
  const { rerollsDisabled } = useGameMode();
  
  // Access drawer context for opening conditions panel and shared condition system
  const drawerContext = usePromptDrawers();
  
  // Use the shared condition system from the drawer provider
  const conditionSystem = drawerContext.conditionSystem;
  
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
  const [situationCollapsed, setSituationCollapsed] = useState(false);
  
  // Action economy state
  const [actionEconomy, setActionEconomy] = useState<ActionEconomy>({
    actionUsed: false,
    bonusActionUsed: false,
    reactionUsed: false,
    movementUsed: 0,
    maxMovement: 30,
  });
  
  // Turn actions for summary
  const [turnActions, setTurnActions] = useState<TurnAction[]>([]);
  
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
  
  const modifiers = calculateModifiers(character);
  
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
  
  // Add action to turn summary
  const handleAddToTurn = useCallback((
    actionType: 'action' | 'bonus' | 'reaction',
    description: string,
    roll?: string
  ) => {
    setActionEconomy(prev => ({
      ...prev,
      actionUsed: actionType === 'action' ? true : prev.actionUsed,
      bonusActionUsed: actionType === 'bonus' ? true : prev.bonusActionUsed,
      reactionUsed: actionType === 'reaction' ? true : prev.reactionUsed,
    }));
    
    setTurnActions(prev => [
      ...prev.filter(a => a.type !== actionType),
      { type: actionType, description, roll }
    ]);
  }, []);
  
  // Handle ability use
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
    
    const actionType = ability.actionType === 'bonus_action' ? 'bonus' : 
                       ability.actionType === 'reaction' ? 'reaction' : 'action';
    handleAddToTurn(actionType, ability.name, `${count}${die}`);
  }, [character.name, handleAddToTurn]);
  
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
    setTurnActions([]);
    setActionEconomy({
      actionUsed: false,
      bonusActionUsed: false,
      reactionUsed: false,
      movementUsed: 0,
      maxMovement: 30,
    });
    setLastAction('TURN RESET');
  }, []);
  
  // Remove action
  const handleRemoveAction = useCallback((index: number) => {
    const action = turnActions[index];
    setTurnActions(prev => prev.filter((_, i) => i !== index));
    
    if (action) {
      setActionEconomy(prev => ({
        ...prev,
        actionUsed: action.type === 'action' ? false : prev.actionUsed,
        bonusActionUsed: action.type === 'bonus' ? false : prev.bonusActionUsed,
        reactionUsed: action.type === 'reaction' ? false : prev.reactionUsed,
      }));
    }
  }, [turnActions]);
  
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
    const roll = rollDice('d20', 1, modifiers.attackBonus);
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
          <div className="p-4 pb-24 space-y-3">
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
            
            {/* Weapon Cards */}
            {DEFAULT_WEAPONS.map(weapon => (
              <MobileWeaponCard
                key={weapon.id}
                weapon={weapon}
                level={character.level}
                attackBonus={modifiers.attackBonus}
                damageBonus={modifiers.damageBonus}
                conditions={conditions}
                hasPoisonedWeapon={hasPoisonedWeapon}
                isExpanded={expandedWeaponId === weapon.id}
                onToggleExpand={() => setExpandedWeaponId(
                  expandedWeaponId === weapon.id ? null : weapon.id
                )}
                onRoll={handleWeaponRoll}
              />
            ))}
          </div>
        );
      
      case 'stealth':
        return (
          <MobileAbilityList
            abilities={stealthAbilities}
            onUseAbility={handleAbilityUse}
            emptyMessage="No stealth abilities unlocked"
          />
        );
      
      case 'abilities':
        return (
          <MobileAbilityList
            abilities={specialAbilities}
            onUseAbility={handleAbilityUse}
            emptyMessage="No special abilities unlocked"
            showFilters
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
              setTurnActions(prev => [
                ...prev.filter(a => a.type !== 'movement'),
                { type: 'movement', description: desc }
              ]);
            }}
          />
        );
    }
  };
  
  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <CombatTopBar
        round={round}
        isYourTurn={isYourTurn}
        lastAction={lastAction}
        onResetTurn={handleResetTurn}
        onMenuOpen={() => {}}
        onSettingsOpen={() => {}}
      />
      
      {/* Main Content Area */}
      <main className="pt-16">
        {/* Condition Strip (if any active) - tap to open full panel */}
        {conditionSystem.allActive.length > 0 ? (
          <button
            onClick={() => drawerContext?.openConditionsDrawer()}
            className="w-full text-left"
          >
            <ConditionStrip
              conditions={conditionSystem.allActive}
              onRemove={(id) => conditionSystem.removeCondition(id)}
              onTap={() => drawerContext?.openConditionsDrawer()}
            />
          </button>
        ) : (
          /* Quick add button when no conditions */
          <button
            onClick={() => drawerContext?.openConditionsDrawer()}
            className="w-full flex items-center justify-center gap-2 py-2 bg-black/20 border-b border-white/10 text-muted-foreground text-xs hover:bg-black/30 transition-colors"
          >
            <span className="text-amber-400">+</span>
            <span>Tap to add conditions</span>
          </button>
        )}
        
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
      
      {/* FAB */}
      <CombatFAB
        activeTab={activeTab}
        onQuickRoll={handleQuickRoll}
        onQuickAttack={handleQuickAttack}
        onQuickHide={handleQuickHide}
        onCopySummary={handleCopySummary}
      />
      
      {/* Bottom Navigation */}
      <CombatBottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        abilityCounts={{
          attacks: DEFAULT_WEAPONS.length,
          stealth: stealthAbilities.length,
          abilities: specialAbilities.length,
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
