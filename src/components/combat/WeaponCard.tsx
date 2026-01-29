import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  WeaponAttack, 
  getSneakAttackDice, 
  isSneakAttackEligible,
  isAssassinateAvailable 
} from '@/lib/combat/combatTypes';
import { rollDice, DiceRoll } from '@/lib/diceRoller';
import { 
  Sword, 
  ChevronDown, 
  Crosshair, 
  Skull, 
  Target,
  Dices,
  Sparkles
} from 'lucide-react';
import '../combat/CombatHUDStyles.css';

interface WeaponCardProps {
  weapon: WeaponAttack;
  level: number;
  attackBonus: number;
  damageBonus: number;
  conditions: string[];
  hasPoisonedWeapon: boolean;
  onRoll: (
    rollType: 'normal' | 'sneak' | 'assassinate',
    weapon: WeaponAttack,
    rollResult: DiceRoll,
    damageBreakdown: string
  ) => void;
}

export function WeaponCard({
  weapon,
  level,
  attackBonus,
  damageBonus,
  conditions,
  hasPoisonedWeapon,
  onRoll,
}: WeaponCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [applyCritical, setApplyCritical] = useState(false);

  const totalAttackBonus = attackBonus + weapon.attackBonus;
  const sneakAttackDice = getSneakAttackDice(level);
  const sneakEligibility = isSneakAttackEligible(conditions, weapon);
  const assassinateAvailable = isAssassinateAvailable(conditions);

  // Calculate damage components
  const baseDamage = weapon.damage;
  const damageModifier = damageBonus > 0 ? `+${damageBonus}` : '';
  const poisonDamage = hasPoisonedWeapon ? '2d6' : '';

  const handleRoll = (type: 'normal' | 'sneak' | 'assassinate') => {
    const hasAdvantage = conditions.includes('advantage') || conditions.includes('hidden');
    const hasDisadvantage = conditions.includes('disadvantage');
    
    // Determine roll type
    let rollCount = 1;
    let rollNote = '';
    if (hasAdvantage && !hasDisadvantage) {
      rollCount = 2;
      rollNote = ' (advantage)';
    } else if (hasDisadvantage && !hasAdvantage) {
      rollCount = 2;
      rollNote = ' (disadvantage)';
    }

    const roll = rollDice('d20', rollCount, totalAttackBonus);

    // Build damage string
    let damage = baseDamage;
    if (damageBonus > 0) damage += `+${damageBonus}`;
    
    if (type === 'sneak' || type === 'assassinate') {
      damage += `+${sneakAttackDice}`;
    }
    
    if (hasPoisonedWeapon) {
      damage += '+2d6 poison';
    }

    // Critical doubles dice
    const isCrit = type === 'assassinate' || applyCritical;
    if (isCrit) {
      damage = `(${damage}) x2 dice [CRIT]`;
    }

    onRoll(type, weapon, roll, damage);
  };

  return (
    <div className={cn(
      "border rounded transition-all",
      expanded 
        ? "bg-black/40 border-red-500/50" 
        : "bg-black/20 border-muted/30 hover:border-red-500/30"
    )}>
      {/* Header - Always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3"
      >
        <div className="flex items-center gap-2">
          <Sword className="w-4 h-4 text-red-400" />
          <span className="font-semibold text-sm">{weapon.name}</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-green-400 font-mono">+{totalAttackBonus}</span>
          <span className="text-amber-400 font-mono">{baseDamage}{damageModifier}</span>
          <ChevronDown className={cn(
            "w-4 h-4 text-muted-foreground transition-transform",
            expanded && "rotate-180"
          )} />
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-muted/20 pt-3">
          {/* Weapon properties */}
          <div className="flex flex-wrap gap-1">
            {weapon.properties.map(prop => (
              <span 
                key={prop}
                className="px-1.5 py-0.5 bg-muted/30 rounded text-[10px] text-muted-foreground"
              >
                {prop}
              </span>
            ))}
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleRoll('normal')}
              className="h-auto py-2 flex flex-col gap-1 border border-muted/40 hover:bg-muted/20"
            >
              <div className="flex items-center gap-1">
                <Crosshair className="w-3.5 h-3.5 text-red-400" />
                <span className="text-xs">Normal Attack</span>
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">
                d20+{totalAttackBonus} | {baseDamage}{damageModifier}
              </span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleRoll('sneak')}
              disabled={!sneakEligibility.eligible}
              className={cn(
                "h-auto py-2 flex flex-col gap-1 border",
                sneakEligibility.eligible
                  ? "border-green-500/50 bg-green-500/10 hover:bg-green-500/20 text-green-300"
                  : "border-muted/30 opacity-50"
              )}
            >
              <div className="flex items-center gap-1">
                <Target className="w-3.5 h-3.5" />
                <span className="text-xs">+ Sneak Attack</span>
              </div>
              <span className="text-[10px] font-mono">
                {sneakEligibility.eligible 
                  ? `+${sneakAttackDice}` 
                  : sneakEligibility.reason}
              </span>
            </Button>
          </div>

          {/* Assassinate button - only when conditions met */}
          {assassinateAvailable && (
            <Button
              onClick={() => handleRoll('assassinate')}
              className="w-full h-auto py-2 flex flex-col gap-1 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 border border-red-400/50"
            >
              <div className="flex items-center gap-2">
                <Skull className="w-4 h-4" />
                <span className="font-cinzel text-sm tracking-wide">ASSASSINATE</span>
                <Skull className="w-4 h-4" />
              </div>
              <span className="text-[10px] opacity-80 font-mono">
                Auto-Crit • {baseDamage}+{sneakAttackDice} x2
              </span>
            </Button>
          )}

          {/* Damage breakdown */}
          <div className="p-2 bg-black/30 rounded border border-muted/20">
            <div className="text-[10px] text-muted-foreground font-mono mb-1">
              DAMAGE BUILDER
            </div>
            <div className="flex flex-wrap items-center gap-1 text-xs">
              <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 rounded">
                Base: {baseDamage}{damageModifier}
              </span>
              {sneakEligibility.eligible && (
                <span className="px-1.5 py-0.5 bg-green-500/20 text-green-300 rounded">
                  Sneak: +{sneakAttackDice}
                </span>
              )}
              {hasPoisonedWeapon && (
                <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded">
                  Poison: +2d6
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer">
                <Checkbox
                  checked={applyCritical}
                  onCheckedChange={(checked) => setApplyCritical(checked as boolean)}
                  className="h-3 w-3"
                />
                Apply Critical (2x dice)
              </label>
            </div>
          </div>

          {/* Sneak Attack Requirements */}
          <div className="p-2 bg-green-500/5 rounded border border-green-500/20">
            <div className="flex items-center gap-1 text-[10px] text-green-400 font-mono mb-1">
              <Sparkles className="w-3 h-3" />
              SNEAK ATTACK REQUIREMENTS
            </div>
            <div className="grid grid-cols-2 gap-1 text-[10px]">
              <RequirementCheck 
                label="Have Advantage OR" 
                met={conditions.includes('advantage') || conditions.includes('hidden')} 
              />
              <RequirementCheck 
                label="Ally within 5ft" 
                met={conditions.includes('allyAdjacent')} 
              />
              <RequirementCheck 
                label="No Disadvantage" 
                met={!conditions.includes('disadvantage')} 
              />
              <RequirementCheck 
                label="Finesse/Ranged" 
                met={weapon.isFinesse || weapon.isRanged} 
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RequirementCheck({ label, met }: { label: string; met: boolean }) {
  return (
    <div className={cn(
      "flex items-center gap-1",
      met ? "text-green-400" : "text-red-400/60"
    )}>
      <span>{met ? '✓' : '✗'}</span>
      <span>{label}</span>
    </div>
  );
}
