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
  X,
  Copy,
  Check
} from 'lucide-react';

interface MobileWeaponCardProps {
  weapon: WeaponAttack;
  level: number;
  attackBonus: number;
  damageBonus: number;
  conditions: string[];
  hasPoisonedWeapon: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onRoll: (
    rollType: 'normal' | 'sneak' | 'assassinate',
    weapon: WeaponAttack,
    rollResult: DiceRoll,
    damageBreakdown: string
  ) => void;
  customImage?: string | null;
}

export function MobileWeaponCard({
  weapon,
  level,
  attackBonus,
  damageBonus,
  conditions,
  hasPoisonedWeapon,
  isExpanded,
  onToggleExpand,
  onRoll,
  customImage,
}: MobileWeaponCardProps) {
  const [applyCritical, setApplyCritical] = useState(false);
  const [copied, setCopied] = useState(false);

  const totalAttackBonus = attackBonus + weapon.attackBonus;
  const sneakAttackDice = getSneakAttackDice(level);
  const sneakEligibility = isSneakAttackEligible(conditions, weapon);
  const assassinateAvailable = isAssassinateAvailable(conditions);

  const baseDamage = weapon.damage;
  const damageModifier = damageBonus > 0 ? `+${damageBonus}` : '';

  const handleRoll = (type: 'normal' | 'sneak' | 'assassinate') => {
    const hasAdvantage = conditions.includes('advantage') || conditions.includes('hidden');
    const hasDisadvantage = conditions.includes('disadvantage');
    
    let rollCount = 1;
    if (hasAdvantage && !hasDisadvantage) rollCount = 2;
    else if (hasDisadvantage && !hasAdvantage) rollCount = 2;

    const roll = rollDice('d20', rollCount, totalAttackBonus);

    let damage = baseDamage;
    if (damageBonus > 0) damage += `+${damageBonus}`;
    
    if (type === 'sneak' || type === 'assassinate') {
      damage += `+${sneakAttackDice}`;
    }
    
    if (hasPoisonedWeapon) {
      damage += '+2d6 poison';
    }

    const isCrit = type === 'assassinate' || applyCritical;
    if (isCrit) {
      damage = `(${damage}) x2 dice [CRIT]`;
    }

    onRoll(type, weapon, roll, damage);
  };

  const copyRollInfo = async () => {
    const text = `${weapon.name}: d20+${totalAttackBonus} to hit | ${baseDamage}${damageModifier} damage`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Collapsed card - using div with onClick instead of button to not interfere with touch scrolling
  if (!isExpanded) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onToggleExpand}
        onKeyDown={(e) => e.key === 'Enter' && onToggleExpand()}
        className="w-full p-4 bg-card border border-muted/30 rounded-xl flex items-center justify-between active:scale-[0.99] transition-transform cursor-pointer touch-manipulation"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center overflow-hidden">
            {customImage ? (
              <img src={customImage} alt={weapon.name} className="w-full h-full object-cover" />
            ) : (
              <Sword className="w-5 h-5 text-red-400" />
            )}
          </div>
          <div className="text-left">
            <div className="font-semibold">{weapon.name}</div>
            <div className="text-xs text-muted-foreground font-mono">
              +{totalAttackBonus} | {baseDamage}{damageModifier}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {sneakEligibility.eligible && (
            <span className="px-2 py-1 bg-green-500/20 text-green-300 rounded-full text-[10px] font-mono">
              +SNEAK
            </span>
          )}
          <ChevronDown className="w-5 h-5 text-muted-foreground" />
        </div>
      </div>
    );
  }

  // Expanded card
  return (
    <div className="bg-card border border-red-500/50 rounded-xl overflow-hidden">
      <div className="p-4 flex items-center justify-between border-b border-muted/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center overflow-hidden">
            {customImage ? (
              <img src={customImage} alt={weapon.name} className="w-full h-full object-cover" />
            ) : (
              <Sword className="w-5 h-5 text-red-400" />
            )}
          </div>
          <div>
            <div className="font-semibold">{weapon.name}</div>
            <div className="flex gap-1 mt-1">
              {weapon.properties.map(prop => (
                <span key={prop} className="px-1.5 py-0.5 bg-muted/30 rounded text-[10px]">
                  {prop}
                </span>
              ))}
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleExpand}
          className="h-10 w-10"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Action Buttons - Full Width Touch Targets */}
      <div className="p-4 space-y-3">
        {/* Normal Attack */}
        <Button
          onClick={() => handleRoll('normal')}
          variant="ghost"
          className="w-full h-14 flex items-center justify-between px-4 border border-muted/40 hover:bg-muted/20"
        >
          <div className="flex items-center gap-3">
            <Crosshair className="w-5 h-5 text-red-400" />
            <span>Normal Attack</span>
          </div>
          <span className="font-mono text-sm text-muted-foreground">
            d20+{totalAttackBonus} | {baseDamage}{damageModifier}
          </span>
        </Button>

        {/* Sneak Attack */}
        <Button
          onClick={() => handleRoll('sneak')}
          disabled={!sneakEligibility.eligible}
          variant="ghost"
          className={cn(
            "w-full h-14 flex items-center justify-between px-4 border",
            sneakEligibility.eligible
              ? "border-green-500/50 bg-green-500/10 hover:bg-green-500/20 text-green-300"
              : "border-muted/30 opacity-50"
          )}
        >
          <div className="flex items-center gap-3">
            <Target className="w-5 h-5" />
            <span>+ Sneak Attack</span>
          </div>
          <span className="font-mono text-sm">
            {sneakEligibility.eligible 
              ? `+${sneakAttackDice}` 
              : sneakEligibility.reason}
          </span>
        </Button>

        {/* Assassinate - Only when available */}
        {assassinateAvailable && (
          <Button
            onClick={() => handleRoll('assassinate')}
            className="w-full h-16 flex flex-col items-center justify-center gap-1 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 border border-red-400/50"
          >
            <div className="flex items-center gap-2">
              <Skull className="w-5 h-5" />
              <span className="font-cinzel text-lg tracking-wide">ASSASSINATE</span>
              <Skull className="w-5 h-5" />
            </div>
            <span className="text-[11px] opacity-80 font-mono">
              Auto-Crit • {baseDamage}+{sneakAttackDice} x2
            </span>
          </Button>
        )}

        {/* Damage Builder */}
        <div className="p-3 bg-black/30 rounded-lg border border-muted/20">
          <div className="text-[10px] text-muted-foreground font-mono mb-2">
            DAMAGE BUILDER
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="px-2 py-1 bg-amber-500/20 text-amber-300 rounded-lg text-sm">
              Base: {baseDamage}{damageModifier}
            </span>
            {sneakEligibility.eligible && (
              <span className="px-2 py-1 bg-green-500/20 text-green-300 rounded-lg text-sm">
                Sneak: +{sneakAttackDice}
              </span>
            )}
            {hasPoisonedWeapon && (
              <span className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded-lg text-sm">
                Poison: +2d6
              </span>
            )}
          </div>
          
          {/* Critical Toggle */}
          <label className="flex items-center gap-2 mt-3 cursor-pointer">
            <Checkbox
              checked={applyCritical}
              onCheckedChange={(v) => setApplyCritical(v as boolean)}
              className="h-5 w-5"
            />
            <span className="text-sm">Apply Critical (2x dice)</span>
          </label>
        </div>

        {/* Copy Button */}
        <Button
          onClick={copyRollInfo}
          variant="outline"
          className="w-full h-12 border-muted/40"
        >
          {copied ? (
            <Check className="w-4 h-4 mr-2" />
          ) : (
            <Copy className="w-4 h-4 mr-2" />
          )}
          {copied ? 'Copied!' : 'Roll & Copy to Clipboard'}
        </Button>
      </div>
    </div>
  );
}
