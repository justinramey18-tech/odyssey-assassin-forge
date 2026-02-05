import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { WeaponAttack, getSneakAttackDice, isSneakAttackEligible } from '@/lib/combat/combatTypes';
import { rollDice, DiceRoll } from '@/lib/diceRoller';
import { 
  Swords, 
  Zap, 
  ChevronDown, 
  ChevronUp,
  Copy,
  Check,
  AlertCircle,
} from 'lucide-react';

interface OffhandAttackCardProps {
  secondaryWeapon: WeaponAttack;
  primaryWeapon: WeaponAttack | null;
  level: number;
  attackBonus: number;
  /** For Two-Weapon Fighting style - add ability mod to offhand damage */
  hasTwoWeaponFightingStyle?: boolean;
  /** For Dual Wielder feat - allows non-Light weapons */
  hasDualWielderFeat?: boolean;
  damageBonus: number;
  conditions: string[];
  hasPoisonedWeapon: boolean;
  bonusActionUsed: boolean;
  onRoll: (
    weapon: WeaponAttack,
    rollResult: DiceRoll,
    damageBreakdown: string,
    isOffhand: true
  ) => void;
  onUseBonus: () => void;
  customImage?: string | null;
}

/**
 * Checks if two-weapon fighting is legal:
 * - Both weapons must have the "Light" property
 * - OR character has Dual Wielder feat (bypasses Light requirement for one-handed melee)
 */
function canUseOffhand(
  primary: WeaponAttack | null, 
  secondary: WeaponAttack,
  hasDualWielderFeat: boolean = false
): {
  allowed: boolean;
  reason: string;
} {
  if (!primary) {
    return { allowed: false, reason: 'Need primary weapon attack first' };
  }
  
  // Dual Wielder feat bypasses the Light requirement
  if (hasDualWielderFeat) {
    // Check both weapons are one-handed melee (not two-handed or ranged)
    const primaryIsTwoHanded = primary.properties.some(p => 
      p.toLowerCase().includes('two-handed') || p.toLowerCase().includes('heavy')
    );
    const secondaryIsTwoHanded = secondary.properties.some(p => 
      p.toLowerCase().includes('two-handed') || p.toLowerCase().includes('heavy')
    );
    
    if (primaryIsTwoHanded) {
      return { allowed: false, reason: 'Primary weapon is two-handed' };
    }
    if (secondaryIsTwoHanded) {
      return { allowed: false, reason: 'Offhand weapon is two-handed' };
    }
    
    return { allowed: true, reason: 'Dual Wielder feat active (+1 AC)' };
  }
  
  // Standard two-weapon fighting: both need Light
  const secondaryIsLight = secondary.properties.some(p => 
    p.toLowerCase().includes('light')
  );
  const primaryIsLight = primary.properties.some(p => 
    p.toLowerCase().includes('light')
  );
  
  if (!primaryIsLight) {
    return { allowed: false, reason: 'Primary weapon needs Light property' };
  }
  
  if (!secondaryIsLight) {
    return { allowed: false, reason: 'Offhand weapon needs Light property' };
  }
  
  return { allowed: true, reason: 'Two-Weapon Fighting eligible' };
}

export function OffhandAttackCard({
  secondaryWeapon,
  primaryWeapon,
  level,
  attackBonus,
  hasTwoWeaponFightingStyle = false,
  hasDualWielderFeat = false,
  damageBonus,
  conditions,
  hasPoisonedWeapon,
  bonusActionUsed,
  onRoll,
  onUseBonus,
  customImage,
}: OffhandAttackCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [applyCritical, setApplyCritical] = useState(false);
  const [copied, setCopied] = useState(false);

  const eligibility = canUseOffhand(primaryWeapon, secondaryWeapon, hasDualWielderFeat);
  const sneakAttackDice = getSneakAttackDice(level);
  const sneakEligibility = isSneakAttackEligible(conditions, secondaryWeapon);
  
  // Offhand attack doesn't add ability modifier to damage unless you have Fighting Style
  const offhandDamageBonus = hasTwoWeaponFightingStyle ? damageBonus : 0;
  const totalAttackBonus = attackBonus + secondaryWeapon.attackBonus;
  const baseDamage = secondaryWeapon.damage;
  const damageModifier = offhandDamageBonus > 0 ? `+${offhandDamageBonus}` : '';

  const handleOffhandAttack = (includeSneak: boolean = false) => {
    if (bonusActionUsed || !eligibility.allowed) return;

    const hasAdvantage = conditions.includes('advantage') || conditions.includes('hidden');
    const hasDisadvantage = conditions.includes('disadvantage');
    
    let rollCount = 1;
    if (hasAdvantage && !hasDisadvantage) rollCount = 2;
    else if (hasDisadvantage && !hasAdvantage) rollCount = 2;

    const roll = rollDice('d20', rollCount, totalAttackBonus);

    let damage = baseDamage;
    if (offhandDamageBonus > 0) damage += `+${offhandDamageBonus}`;
    
    // Note: Sneak Attack can only be used once per turn, but player may choose offhand
    if (includeSneak && sneakEligibility.eligible) {
      damage += `+${sneakAttackDice}`;
    }
    
    if (hasPoisonedWeapon) {
      damage += '+2d6 poison';
    }

    if (applyCritical) {
      damage = `(${damage}) x2 dice [CRIT]`;
    }

    onUseBonus();
    onRoll(secondaryWeapon, roll, damage, true);
  };

  const copyRollInfo = async () => {
    const text = `Offhand ${secondaryWeapon.name}: d20+${totalAttackBonus} to hit | ${baseDamage}${damageModifier} damage (no ability mod)`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isDisabled = bonusActionUsed || !eligibility.allowed;

  // Collapsed state
  if (!isExpanded) {
    return (
      <button
        onClick={() => !isDisabled && setIsExpanded(true)}
        disabled={isDisabled}
        className={cn(
          "w-full p-4 rounded-xl flex items-center justify-between transition-all",
          isDisabled
            ? "bg-muted/20 border border-muted/20 opacity-50 cursor-not-allowed"
            : "bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 hover:border-amber-500/50 active:scale-[0.99]"
        )}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center overflow-hidden">
            {customImage ? (
              <img src={customImage} alt={secondaryWeapon.name} className="w-full h-full object-cover" />
            ) : (
              <Swords className="w-5 h-5 text-amber-400" />
            )}
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Offhand Attack</span>
              <Badge variant="outline" className="text-[10px] bg-amber-500/20 text-amber-300 border-amber-500/30">
                <Zap className="w-2.5 h-2.5 mr-1" />
                BONUS
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              {secondaryWeapon.name} • {baseDamage}{!hasTwoWeaponFightingStyle && ' (no mod)'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {bonusActionUsed && (
            <Badge variant="secondary" className="text-[10px]">Used</Badge>
          )}
          {!eligibility.allowed && !bonusActionUsed && (
            <AlertCircle className="w-4 h-4 text-muted-foreground" />
          )}
          <ChevronDown className="w-5 h-5 text-muted-foreground" />
        </div>
      </button>
    );
  }

  // Expanded state
  return (
    <div className="bg-gradient-to-b from-amber-500/10 to-orange-500/5 border border-amber-500/40 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b border-amber-500/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center overflow-hidden">
            {customImage ? (
              <img src={customImage} alt={secondaryWeapon.name} className="w-full h-full object-cover" />
            ) : (
              <Swords className="w-5 h-5 text-amber-400" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">Offhand Attack</span>
              <Badge variant="outline" className="text-[10px] bg-amber-500/20 text-amber-300 border-amber-500/30">
                <Zap className="w-2.5 h-2.5 mr-1" />
                BONUS ACTION
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              {secondaryWeapon.name} • +{totalAttackBonus} to hit
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsExpanded(false)}
          className="h-10 w-10"
        >
          <ChevronUp className="w-5 h-5" />
        </Button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Eligibility Warning */}
        {!eligibility.allowed && (
          <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-destructive" />
            <span className="text-sm text-destructive">{eligibility.reason}</span>
          </div>
        )}

        {/* Two-Weapon Fighting Info */}
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <div className="text-[10px] text-amber-400 font-mono mb-1">TWO-WEAPON FIGHTING</div>
          <p className="text-xs text-muted-foreground">
            When you Attack with a light melee weapon, you can use a bonus action to attack with a different light weapon in your other hand.
            {!hasTwoWeaponFightingStyle && (
              <span className="text-amber-300"> You don't add your ability modifier to the damage.</span>
            )}
          </p>
        </div>

        {/* Attack Button */}
        <Button
          onClick={() => handleOffhandAttack(false)}
          disabled={isDisabled}
          className={cn(
            "w-full h-14 flex items-center justify-between px-4",
            "bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500"
          )}
        >
          <div className="flex items-center gap-3">
            <Swords className="w-5 h-5" />
            <span>Offhand Attack</span>
          </div>
          <span className="font-mono text-sm">
            d20+{totalAttackBonus} | {baseDamage}{damageModifier}
          </span>
        </Button>

        {/* Sneak Attack option (once per turn) */}
        {sneakEligibility.eligible && (
          <Button
            onClick={() => handleOffhandAttack(true)}
            disabled={isDisabled}
            variant="ghost"
            className="w-full h-14 flex items-center justify-between px-4 border border-green-500/50 bg-green-500/10 hover:bg-green-500/20 text-green-300"
          >
            <div className="flex items-center gap-3">
              <Swords className="w-5 h-5" />
              <span>+ Sneak Attack</span>
            </div>
            <span className="font-mono text-sm">
              +{sneakAttackDice}
            </span>
          </Button>
        )}

        {/* Damage Builder */}
        <div className="p-3 bg-black/30 rounded-lg border border-muted/20">
          <div className="text-[10px] text-muted-foreground font-mono mb-2">
            OFFHAND DAMAGE
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="px-2 py-1 bg-amber-500/20 text-amber-300 rounded-lg text-sm">
              Base: {baseDamage}{damageModifier}
            </span>
            {!hasTwoWeaponFightingStyle && (
              <span className="px-2 py-1 bg-muted/30 text-muted-foreground rounded-lg text-sm">
                No ability mod
              </span>
            )}
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
          className="w-full h-10 border-muted/40"
        >
          {copied ? (
            <Check className="w-4 h-4 mr-2" />
          ) : (
            <Copy className="w-4 h-4 mr-2" />
          )}
          {copied ? 'Copied!' : 'Copy Roll Info'}
        </Button>
      </div>
    </div>
  );
}
