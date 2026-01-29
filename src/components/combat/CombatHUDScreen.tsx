import { useState } from 'react';
import { Character, Ability, getActiveSlotsByLevel } from '@/lib/types';
import { allAbilities } from '@/lib/abilities';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DiceRollModal } from '@/components/character/DiceRollModal';
import { rollDice, getAbilityDice, DiceRoll, DieType } from '@/lib/diceRoller';
import { generateRPPrompt } from '@/lib/rpPromptGenerator';
import { 
  Crosshair, Target, Shield, Sword, Zap, Heart, 
  Dices, Activity, Skull, Eye, Flame, Ghost,
  ChevronRight, Hexagon, CircleDot, Gauge
} from 'lucide-react';
import './CombatHUDStyles.css';

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
  
  // Base proficiency bonus by level
  const proficiencyBonus = Math.ceil(character.level / 4) + 1;
  
  // Check for passive ability bonuses
  character.abilities.forEach(ca => {
    if (ca.currentTier === 0) return;
    const ability = allAbilities.find(a => a.id === ca.abilityId);
    if (!ability || ability.type !== 'passive') return;
    
    // Archery Master
    if (ability.id === 'archery_master') {
      if (ca.currentTier >= 1) attackBonus += 1;
      if (ca.currentTier >= 2) { attackBonus += 1; damageBonus += 1; }
      if (ca.currentTier >= 3) damageBonus += 1;
    }
    
    // Weapon Master
    if (ability.id === 'weapon_master') {
      if (ca.currentTier >= 1) attackBonus += 1;
      if (ca.currentTier >= 2) { attackBonus += 1; damageBonus += 1; }
      if (ca.currentTier >= 3) damageBonus += 1;
    }
    
    // Warrior's Resilience
    if (ability.id === 'warriors_resilience') {
      if (ca.currentTier >= 1) acBonus += 1;
      if (ca.currentTier >= 2) acBonus += 1;
    }
    
    // Sixth Sense
    if (ability.id === 'sixth_sense') {
      if (ca.currentTier >= 1) initiativeBonus += 2;
      if (ca.currentTier >= 2) initiativeBonus += 3;
    }
  });
  
  return {
    attackBonus: attackBonus + proficiencyBonus,
    damageBonus,
    acBonus: 10 + acBonus, // Base AC
    initiativeBonus,
    saveDC: 8 + proficiencyBonus,
  };
}

// D20 action types
type CombatAction = 'attack' | 'skill' | 'save' | 'initiative' | 'damage';

interface CombatHUDScreenProps {
  character: Character;
}

export function CombatHUDScreen({ character }: CombatHUDScreenProps) {
  const [showDiceModal, setShowDiceModal] = useState(false);
  const [currentRoll, setCurrentRoll] = useState<DiceRoll | null>(null);
  const [currentRPPrompt, setCurrentRPPrompt] = useState('');
  const [activeAbility, setActiveAbility] = useState<Ability | null>(null);
  const [activeTier, setActiveTier] = useState<1 | 2 | 3>(1);
  const [lastAction, setLastAction] = useState<string>('SYSTEMS READY');
  
  const modifiers = calculateModifiers(character);
  const totalSlots = getActiveSlotsByLevel(character.level);
  
  // Get equipped abilities
  const equippedAbilities = character.equippedAbilities
    .filter(Boolean)
    .map(id => allAbilities.find(a => a.id === id))
    .filter(Boolean) as Ability[];

  // Handle ability activation
  const handleUseAbility = (ability: Ability) => {
    const charAbility = character.abilities.find(ca => ca.abilityId === ability.id);
    const tier = (charAbility?.currentTier || 1) as 1 | 2 | 3;
    
    const { die, count } = getAbilityDice(tier);
    const roll = rollDice(die, count);
    const prompt = generateRPPrompt(ability, tier, roll, character.name);
    
    setActiveAbility(ability);
    setActiveTier(tier);
    setCurrentRoll(roll);
    setCurrentRPPrompt(prompt);
    setShowDiceModal(true);
    setLastAction(`${ability.name.toUpperCase()} ACTIVATED`);
  };

  // Handle generic combat rolls
  const handleCombatRoll = (action: CombatAction, modifier: number = 0) => {
    let die: DieType = 'd20';
    let count = 1;
    let actionName = '';
    
    switch (action) {
      case 'attack':
        actionName = 'ATTACK ROLL';
        modifier = modifiers.attackBonus;
        break;
      case 'skill':
        actionName = 'SKILL CHECK';
        break;
      case 'save':
        actionName = 'SAVING THROW';
        break;
      case 'initiative':
        actionName = 'INITIATIVE';
        modifier = modifiers.initiativeBonus;
        break;
      case 'damage':
        die = 'd8';
        actionName = 'DAMAGE ROLL';
        modifier = modifiers.damageBonus;
        break;
    }
    
    const roll = rollDice(die, count, modifier);
    const isCrit = roll.rolls[0] === 20;
    const isFumble = roll.rolls[0] === 1;
    
    const prompt = `## ${actionName}

**Character:** ${character.name || 'The Merc'}
**Roll:** ${count}${die}${modifier >= 0 ? '+' : ''}${modifier} = **${roll.total}**
${isCrit ? '\n🎯 **NATURAL 20! CRITICAL SUCCESS!**\n*"Maximum effort!"*' : ''}
${isFumble ? '\n💀 **NATURAL 1! CRITICAL FAIL!**\n*"Well, that happened..."*' : ''}

---

### Result
${isCrit ? 'Describe an exceptional success with dramatic flair. The action succeeds beyond expectations.' :
  isFumble ? 'Something goes comedically wrong. Describe the mishap in true Deadpool fashion.' :
  roll.total >= 15 ? 'Strong success. The action is executed with skill and confidence.' :
  roll.total >= 10 ? 'Moderate success. The action works, but nothing fancy.' :
  'The action struggles. Describe a partial success or complication.'}

*"${getDeadpoolQuip(action, roll.total, isCrit, isFumble)}"*`;

    setActiveAbility(null);
    setActiveTier(1);
    setCurrentRoll(roll);
    setCurrentRPPrompt(prompt);
    setShowDiceModal(true);
    setLastAction(actionName);
  };

  const handleReroll = () => {
    if (activeAbility) {
      const { die, count } = getAbilityDice(activeTier);
      const roll = rollDice(die, count);
      const prompt = generateRPPrompt(activeAbility, activeTier, roll, character.name);
      setCurrentRoll(roll);
      setCurrentRPPrompt(prompt);
    }
  };

  const treeColors = {
    hunter: 'hsl(var(--hunter-glow))',
    warrior: 'hsl(var(--warrior-glow))',
    assassin: 'hsl(var(--assassin-glow))',
  };

  return (
    <div className="combat-hud min-h-[calc(100vh-200px)] relative overflow-hidden">
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
        <div className="text-[10px] font-mono text-muted-foreground">
          MERC COMBAT SYSTEM v4.20
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Character Stats HUD Panel */}
        <div className="hud-panel">
          <div className="hud-panel-header">
            <Hexagon className="w-4 h-4" />
            <span>VITAL STATS</span>
            <div className="flex-1 h-px bg-gradient-to-r from-red-500/50 to-transparent ml-2" />
          </div>
          
          <div className="grid grid-cols-4 gap-2 mt-3">
            <StatDisplay
              icon={<Shield className="w-4 h-4" />}
              label="AC"
              value={modifiers.acBonus}
              color="cyan"
            />
            <StatDisplay
              icon={<Sword className="w-4 h-4" />}
              label="ATK"
              value={`+${modifiers.attackBonus}`}
              color="red"
            />
            <StatDisplay
              icon={<Zap className="w-4 h-4" />}
              label="DMG"
              value={modifiers.damageBonus > 0 ? `+${modifiers.damageBonus}` : '0'}
              color="amber"
            />
            <StatDisplay
              icon={<Gauge className="w-4 h-4" />}
              label="INIT"
              value={modifiers.initiativeBonus > 0 ? `+${modifiers.initiativeBonus}` : '0'}
              color="green"
            />
          </div>
          
          <div className="mt-3 pt-3 border-t border-red-500/20">
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground font-mono">PROFICIENCY</span>
              <span className="text-red-400 font-bold font-mono">+{Math.ceil(character.level / 4) + 1}</span>
            </div>
            <div className="flex justify-between items-center text-xs mt-1">
              <span className="text-muted-foreground font-mono">SAVE DC</span>
              <span className="text-red-400 font-bold font-mono">{modifiers.saveDC}</span>
            </div>
          </div>
        </div>

        {/* Quick Combat Actions */}
        <div className="hud-panel">
          <div className="hud-panel-header">
            <Dices className="w-4 h-4" />
            <span>COMBAT ACTIONS</span>
            <div className="flex-1 h-px bg-gradient-to-r from-red-500/50 to-transparent ml-2" />
          </div>
          
          <div className="grid grid-cols-2 gap-2 mt-3">
            <CombatActionButton
              icon={<Crosshair className="w-5 h-5" />}
              label="Attack"
              sublabel={`+${modifiers.attackBonus}`}
              onClick={() => handleCombatRoll('attack')}
            />
            <CombatActionButton
              icon={<Target className="w-5 h-5" />}
              label="Damage"
              sublabel="1d8"
              onClick={() => handleCombatRoll('damage')}
            />
            <CombatActionButton
              icon={<Eye className="w-5 h-5" />}
              label="Skill Check"
              sublabel="d20"
              onClick={() => handleCombatRoll('skill')}
            />
            <CombatActionButton
              icon={<Shield className="w-5 h-5" />}
              label="Save"
              sublabel="d20"
              onClick={() => handleCombatRoll('save')}
            />
          </div>
          
          <Button
            className="w-full mt-2 hud-button-primary"
            onClick={() => handleCombatRoll('initiative')}
          >
            <Activity className="w-4 h-4 mr-2" />
            ROLL INITIATIVE
            <span className="ml-auto text-xs opacity-70">+{modifiers.initiativeBonus}</span>
          </Button>
        </div>

        {/* Ability Loadout HUD */}
        <div className="hud-panel">
          <div className="hud-panel-header">
            <Flame className="w-4 h-4" />
            <span>ACTIVE LOADOUT</span>
            <span className="ml-auto text-[10px] text-muted-foreground font-mono">
              {equippedAbilities.length}/{totalSlots} SLOTS
            </span>
          </div>
          
          <div className="space-y-2 mt-3">
            {equippedAbilities.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-sm font-mono">
                NO ABILITIES EQUIPPED
                <div className="text-[10px] mt-1 text-red-400">
                  "Maybe try the Skills tab, genius."
                </div>
              </div>
            ) : (
              equippedAbilities.map((ability, index) => {
                const charAbility = character.abilities.find(ca => ca.abilityId === ability.id);
                const tier = charAbility?.currentTier || 1;
                const { die, count } = getAbilityDice(tier as 1 | 2 | 3);
                
                return (
                  <button
                    key={ability.id}
                    onClick={() => handleUseAbility(ability)}
                    className="ability-hud-button group"
                    style={{ '--tree-color': treeColors[ability.tree] } as React.CSSProperties}
                  >
                    <div className="ability-hud-index">{index + 1}</div>
                    <div className="flex-1 text-left">
                      <div className="text-sm font-semibold text-foreground group-hover:text-red-400 transition-colors">
                        {ability.name}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono uppercase">
                        {ability.actionType.replace('_', ' ')} • {ability.usageType.replace('_', ' ')}
                      </div>
                    </div>
                    <div className="ability-hud-dice">
                      <Dices className="w-3 h-3" />
                      <span>{count}{die}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Passive Abilities Display */}
        <div className="hud-panel hud-panel-secondary">
          <div className="hud-panel-header">
            <Ghost className="w-4 h-4" />
            <span>PASSIVE SYSTEMS</span>
          </div>
          
          <div className="mt-3 space-y-1">
            {character.abilities
              .filter(ca => {
                if (ca.currentTier === 0) return false;
                const ability = allAbilities.find(a => a.id === ca.abilityId);
                return ability?.type === 'passive';
              })
              .map(ca => {
                const ability = allAbilities.find(a => a.id === ca.abilityId)!;
                return (
                  <div key={ability.id} className="passive-hud-item">
                    <CircleDot className="w-3 h-3" style={{ color: treeColors[ability.tree] }} />
                    <span className="flex-1">{ability.name}</span>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      T{ca.currentTier}
                    </span>
                  </div>
                );
              })}
            {character.abilities.filter(ca => {
              const ability = allAbilities.find(a => a.id === ca.abilityId);
              return ca.currentTier > 0 && ability?.type === 'passive';
            }).length === 0 && (
              <div className="text-[10px] text-muted-foreground font-mono text-center py-2">
                NO PASSIVE ABILITIES ACTIVE
              </div>
            )}
          </div>
        </div>

        {/* Deadpool flavor footer */}
        <div className="text-center text-[10px] text-muted-foreground font-mono mt-4 opacity-70">
          "I'm touching myself tonight... to these stats."
        </div>
      </div>

      {/* Dice Roll Modal */}
      {currentRoll && (
        <DiceRollModal
          ability={activeAbility || undefined}
          tier={activeTier}
          roll={currentRoll}
          rpPrompt={currentRPPrompt}
          open={showDiceModal}
          onOpenChange={setShowDiceModal}
          onReroll={activeAbility ? handleReroll : undefined}
        />
      )}
    </div>
  );
}

// Stat display component
function StatDisplay({ 
  icon, 
  label, 
  value, 
  color 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: string | number; 
  color: 'cyan' | 'red' | 'amber' | 'green';
}) {
  const colorClasses = {
    cyan: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/5',
    red: 'text-red-400 border-red-500/30 bg-red-500/5',
    amber: 'text-amber-400 border-amber-500/30 bg-amber-500/5',
    green: 'text-green-400 border-green-500/30 bg-green-500/5',
  };
  
  return (
    <div className={cn('stat-hud-display', colorClasses[color])}>
      <div className="stat-hud-icon">{icon}</div>
      <div className="stat-hud-value">{value}</div>
      <div className="stat-hud-label">{label}</div>
    </div>
  );
}

// Combat action button component
function CombatActionButton({ 
  icon, 
  label, 
  sublabel, 
  onClick 
}: { 
  icon: React.ReactNode; 
  label: string; 
  sublabel: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="combat-action-button group">
      <div className="combat-action-icon">{icon}</div>
      <div className="combat-action-text">
        <span className="combat-action-label">{label}</span>
        <span className="combat-action-sublabel">{sublabel}</span>
      </div>
    </button>
  );
}

// Deadpool quips for combat rolls
function getDeadpoolQuip(action: CombatAction, total: number, isCrit: boolean, isFumble: boolean): string {
  if (isCrit) {
    const critQuips = [
      "Maximum effort!",
      "I'm the best at what I do, and what I do is roll dice!",
      "Did you see that?! Somebody better be taking notes!",
      "Chimichangas for everyone!",
      "That's what peak performance looks like, folks.",
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
    ];
    return fumbleQuips[Math.floor(Math.random() * fumbleQuips.length)];
  }
  
  if (total >= 15) {
    return "Now THAT's what I'm talking about!";
  } else if (total >= 10) {
    return "Good enough for government work.";
  } else {
    return "We don't talk about this one.";
  }
}
