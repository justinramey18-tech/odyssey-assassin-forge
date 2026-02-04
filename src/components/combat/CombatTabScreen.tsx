import { useState, useCallback, useMemo } from 'react';
import { Character, Ability, getActiveSlotsByLevel } from '@/lib/types';
import { allAbilities } from '@/lib/abilities';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { SituationPanel } from './SituationPanel';
import { ActionEconomyTracker } from './ActionEconomyTracker';
import { AbilityTabs } from './AbilityTabs';
import { RollBuilderPanel } from './RollBuilderPanel';
import { QuickReferenceSidebar } from './QuickReferenceSidebar';
import { DiceRollModal } from '@/components/character/DiceRollModal';
import { MobileCombatLayout } from './mobile/MobileCombatLayout';
import { BackgroundWrapper } from '@/components/ui/BackgroundWrapper';
import { useCombatStats } from '@/hooks/use-combat-stats';
import { 
  ActionEconomy, 
  ActiveEffect,
  TurnAction,
  WeaponAttack,
  COMBAT_CONDITIONS,
  DEFAULT_WEAPONS,
} from '@/lib/combat/combatTypes';
import { DiceRoll } from '@/lib/diceRoller';
import { Activity, Skull } from 'lucide-react';
import './CombatHUDStyles.css';
import './mobile/MobileCombatStyles.css';
import { useGameMode } from '@/hooks/use-game-mode';
import combatBackground from '@/assets/combat-background.jpg';
import { UseSpellcastingReturn } from '@/hooks/use-spellcasting';
import { CharacterEquipment } from '@/lib/inventory/types';
import { getEquippedWeapons } from '@/lib/combat/weaponConverter';
import { AggregatedStats } from '@/hooks/use-equipment-stats';
import { BaseAbilityScores } from '@/lib/abilityScores/types';

interface CombatTabScreenProps {
  character: Character;
  prestigePoints?: number;
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
}

export function CombatTabScreen({ 
  character, 
  prestigePoints = 0, 
  spellcasting, 
  equipment, 
  onNavigateToConsumables,
  equipmentStats,
  abilityModifiers,
  currentHP,
  maxHP,
  tempHP,
}: CombatTabScreenProps) {
  const isMobile = useIsMobile();
  const { rerollsDisabled } = useGameMode();
  
  // Use unified combat stats hook
  const combatStats = useCombatStats({
    character,
    equipmentStats,
    abilityModifiers,
  });

  // All hooks must be called before any conditional returns
  // Situation state
  const [conditions, setConditions] = useState<string[]>([]);
  const [activeEffects, setActiveEffects] = useState<ActiveEffect[]>([]);
  
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
  
  // Current roll display
  const [currentRoll, setCurrentRoll] = useState<{
    name: string;
    conditions: string[];
    rollFormula: string;
    damageFormula: string;
  } | null>(null);
  
  // Dice modal state
  const [showDiceModal, setShowDiceModal] = useState(false);
  const [diceRoll, setDiceRoll] = useState<DiceRoll | null>(null);
  const [dicePrompt, setDicePrompt] = useState('');
  const [activeAbility, setActiveAbility] = useState<Ability | null>(null);
  const [activeTier, setActiveTier] = useState<1 | 2 | 3>(1);
  
  // Last action for status bar
  const [lastAction, setLastAction] = useState('SYSTEMS READY');
  
  // Count abilities by action type for economy tracker
  const unlockedAbilities = character.abilities
    .filter(ca => ca.currentTier > 0)
    .map(ca => allAbilities.find(a => a.id === ca.abilityId))
    .filter(Boolean) as Ability[];
  
  const actionCount = unlockedAbilities.filter(a => a.actionType === 'action').length;
  const bonusCount = unlockedAbilities.filter(a => a.actionType === 'bonus_action').length;
  const reactionCount = unlockedAbilities.filter(a => a.actionType === 'reaction').length;
  
  // Get condition labels for display
  const activeConditionLabels = conditions.map(c => 
    COMBAT_CONDITIONS.find(cc => cc.id === c)?.label || c
  );
  
  // Handle adding action to turn summary
  const handleAddToTurn = useCallback((
    actionType: 'action' | 'bonus' | 'reaction',
    description: string,
    roll?: string
  ) => {
    // Update economy
    setActionEconomy(prev => ({
      ...prev,
      actionUsed: actionType === 'action' ? true : prev.actionUsed,
      bonusActionUsed: actionType === 'bonus' ? true : prev.bonusActionUsed,
      reactionUsed: actionType === 'reaction' ? true : prev.reactionUsed,
    }));
    
    // Add to turn actions
    setTurnActions(prev => [
      ...prev.filter(a => a.type !== actionType), // Replace same type
      { type: actionType, description, roll }
    ]);
  }, []);
  
  // Handle ability use
  const handleAbilityUse = useCallback((
    ability: Ability,
    tier: 1 | 2 | 3,
    roll: DiceRoll,
    prompt: string
  ) => {
    setActiveAbility(ability);
    setActiveTier(tier);
    setDiceRoll(roll);
    setDicePrompt(prompt);
    setShowDiceModal(true);
    setLastAction(`${ability.name.toUpperCase()} ACTIVATED`);
  }, []);
  
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
    
    const rollFormula = roll.rolls.length > 1 
      ? `2d20kh1+${combatStats.attackBonus}` 
      : `1d20+${combatStats.attackBonus}`;
    
    setCurrentRoll({
      name: rollName,
      conditions: activeConditionLabels,
      rollFormula,
      damageFormula: damage,
    });
    
    setDiceRoll(roll);
    setDicePrompt(generateWeaponPrompt(rollType, weapon, roll, damage, character.name));
    setActiveAbility(null);
    setShowDiceModal(true);
    setLastAction(`${rollName.toUpperCase()} ROLL`);
    
    // Add to turn summary
    handleAddToTurn('action', `${weapon.name} attack${rollType !== 'normal' ? ` (${rollType})` : ''}`, rollFormula);
  }, [combatStats.attackBonus, activeConditionLabels, character.name, handleAddToTurn]);
  
  // Clear turn
  const handleClearTurn = useCallback(() => {
    setTurnActions([]);
    setActionEconomy({
      actionUsed: false,
      bonusActionUsed: false,
      reactionUsed: false,
      movementUsed: 0,
      maxMovement: 30,
    });
    setCurrentRoll(null);
    setLastAction('TURN RESET');
  }, []);
  
  // Remove specific action
  const handleRemoveAction = useCallback((index: number) => {
    const action = turnActions[index];
    setTurnActions(prev => prev.filter((_, i) => i !== index));
    
    // Restore economy
    if (action) {
      setActionEconomy(prev => ({
        ...prev,
        actionUsed: action.type === 'action' ? false : prev.actionUsed,
        bonusActionUsed: action.type === 'bonus' ? false : prev.bonusActionUsed,
        reactionUsed: action.type === 'reaction' ? false : prev.reactionUsed,
      }));
    }
  }, [turnActions]);
  
  // Convert equipped weapons from gear - use fallback to default weapons if none equipped
  const equippedWeapons = useMemo(() => {
    if (!equipment) return DEFAULT_WEAPONS;
    const weapons = getEquippedWeapons(equipment.slots);
    return weapons.length > 0 ? weapons : DEFAULT_WEAPONS;
  }, [equipment]);

  // Use mobile layout for smaller screens
  if (isMobile) {
    return (
      <MobileCombatLayout 
        character={character} 
        spellcasting={spellcasting} 
        equipment={equipment} 
        onNavigateToConsumables={onNavigateToConsumables}
        equipmentStats={equipmentStats}
        abilityModifiers={abilityModifiers}
        currentHP={currentHP}
        maxHP={maxHP}
        tempHP={tempHP}
      />
    );
  }
  return (
    <BackgroundWrapper 
      imagePath={combatBackground} 
      overlayOpacity={70} 
      tintColor="red" 
      tintOpacity={30}
      className="combat-hud min-h-[calc(100vh-200px)]"
    >
      {/* Scan lines overlay */}
      <div className="hud-scanlines" />
      
      {/* Corner brackets */}
      <div className="hud-corner hud-corner-tl" />
      <div className="hud-corner hud-corner-tr" />
      <div className="hud-corner hud-corner-bl" />
      <div className="hud-corner hud-corner-br" />
      
      {/* Status bar */}
      <div className="hud-status-bar">
        <div className="flex items-center gap-2">
          <Activity className="w-3 h-3 text-red-500 animate-pulse" />
          <span className="text-[10px] font-mono text-red-400">{lastAction}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-muted-foreground">
            AC {combatStats.ac} | ATK +{combatStats.attackBonus} | DMG +{combatStats.damageBonus}
          </span>
          <Skull className="w-3 h-3 text-red-500" />
        </div>
      </div>

      <div className="flex h-[calc(100vh-260px)]">
        {/* Main content area */}
        <div className="flex-1 p-3 space-y-3 overflow-auto">
          {/* Section 1: Situation Configuration */}
          <SituationPanel
            conditions={conditions}
            onConditionsChange={setConditions}
            activeEffects={activeEffects}
            onActiveEffectsChange={setActiveEffects}
          />
          
          {/* Section 2: Action Economy Tracker */}
          <ActionEconomyTracker
            economy={actionEconomy}
            onEconomyChange={setActionEconomy}
            actionCount={actionCount}
            bonusCount={bonusCount}
            reactionCount={reactionCount}
          />
          
          {/* Section 3: Main Ability Display */}
          <AbilityTabs
            character={character}
            conditions={conditions}
            attackBonus={combatStats.attackBonus}
            damageBonus={combatStats.damageBonus}
            equippedWeapons={equippedWeapons}
            onAbilityUse={handleAbilityUse}
            onWeaponRoll={handleWeaponRoll}
            onAddToTurn={handleAddToTurn}
          />
        </div>
        
        {/* Section 5: Quick Reference Sidebar */}
        <div className="p-3 border-l border-red-900/30">
          <QuickReferenceSidebar conditions={conditions} />
        </div>
      </div>
      
      {/* Section 4: Roll Builder & Output Panel (Fixed footer) */}
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-background via-background/98 to-transparent border-t border-red-900/30">
        <RollBuilderPanel
          currentRoll={currentRoll}
          turnActions={turnActions}
          onClearTurn={handleClearTurn}
          onRemoveAction={handleRemoveAction}
        />
      </div>
      
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
    </BackgroundWrapper>
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
  
  let quip = getDeadpoolQuip(rollType, roll.total, isCrit, isFumble);
  
  return `## ${title}

**Character:** ${characterName || 'The Merc'}
**Weapon:** ${weapon.name}
**Roll:** ${hasAdvantage ? '2d20kh1' : '1d20'}+${roll.modifier} = [${roll.rolls.join(', ')}] = **${roll.total}**
${isCrit ? '\n🎯 **NATURAL 20! CRITICAL HIT!**' : ''}
${isFumble ? '\n💀 **NATURAL 1! CRITICAL MISS!**' : ''}

**Damage on Hit:** ${damage}

---

### Narration Guide
${rollType === 'assassinate' 
  ? 'Describe a devastating strike from the shadows. The target never saw it coming. The damage is automatically maximized - this is a killing blow.' 
  : rollType === 'sneak' 
    ? 'Describe a precise strike exploiting a momentary weakness or distraction. The extra damage represents finding a vital point.'
    : 'Describe the attack based on the roll result.'}

${isCrit ? '**CRITICAL:** Double all damage dice. Describe something exceptionally brutal.' : ''}

*"${quip}"*`;
}

// Deadpool quips
function getDeadpoolQuip(rollType: string, total: number, isCrit: boolean, isFumble: boolean): string {
  if (isCrit) {
    const critQuips = [
      "Maximum effort!",
      "I'm touching myself tonight!",
      "Did you see that?! Somebody better be taking notes!",
      "Chimichangas for everyone!",
      "That's what peak performance looks like, folks.",
      "Insert slow-mo here. You're welcome, audience.",
    ];
    return critQuips[Math.floor(Math.random() * critQuips.length)];
  }
  
  if (isFumble) {
    const fumbleQuips = [
      "Well, that's coming out of my budget.",
      "Fourth wall? Meet the floor.",
      "I've made a huge mistake.",
      "This is fine. Everything is fine.",
      "Plot armor, don't fail me now!",
      "I blame the writers for this one.",
    ];
    return fumbleQuips[Math.floor(Math.random() * fumbleQuips.length)];
  }
  
  if (rollType === 'assassinate') {
    const assassinQuips = [
      "Surprise, motherf—",
      "Nobody expects the Spanish Inquisition. Or me. Mostly me.",
      "And THAT'S why they call me an assassin.",
      "Target eliminated. Time for tacos.",
    ];
    return assassinQuips[Math.floor(Math.random() * assassinQuips.length)];
  }
  
  if (total >= 18) {
    return "Nailed it. Add it to my highlight reel.";
  } else if (total >= 12) {
    return "Good enough for government work.";
  } else {
    return "At least I'm pretty...";
  }
}
