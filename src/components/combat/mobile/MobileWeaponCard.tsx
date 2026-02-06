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
import { Enemy } from '@/lib/combat/targetTypes';
import { rollDice, DiceRoll } from '@/lib/diceRoller';
import { 
  Sword, 
  ChevronDown, 
  Crosshair, 
  Skull, 
  Target,
  X,
  Copy,
  Check,
  ListPlus,
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
  // Attack Queue props
  enemies?: Enemy[];
  selectedTargetId?: string | null;
  onQueueAttack?: (
    weapon: WeaponAttack,
    rollType: 'normal' | 'sneak' | 'assassinate',
    targetId: string | null,
    targetName: string | null
  ) => void;
  queueMode?: boolean;
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
  enemies = [],
  selectedTargetId = null,
  onQueueAttack,
  queueMode = false,
}: MobileWeaponCardProps) {
  const [applyCritical, setApplyCritical] = useState(false);
  const [copied, setCopied] = useState(false);
  const [localTargetId, setLocalTargetId] = useState<string | null>(selectedTargetId);
  const [showQueueSuccess, setShowQueueSuccess] = useState(false);

  const totalAttackBonus = attackBonus + weapon.attackBonus;
  const sneakAttackDice = getSneakAttackDice(level);
  const sneakEligibility = isSneakAttackEligible(conditions, weapon);
  const assassinateAvailable = isAssassinateAvailable(conditions);

  const baseDamage = weapon.damage;
  const damageModifier = damageBonus > 0 ? `+${damageBonus}` : '';
  
  // Get the selected enemy for target name
  const activeEnemies = enemies.filter(e => e.currentHP > 0);
  const selectedEnemy = activeEnemies.find(e => e.id === localTargetId);

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
  
  const handleQueue = (type: 'normal' | 'sneak' | 'assassinate') => {
    if (!onQueueAttack) return;
    
    onQueueAttack(weapon, type, localTargetId, selectedEnemy?.name || null);
    
    // Visual feedback
    setShowQueueSuccess(true);
    setTimeout(() => setShowQueueSuccess(false), 1000);
  };

  const copyRollInfo = async () => {
    const text = `${weapon.name}: d20+${totalAttackBonus} to hit | ${baseDamage}${damageModifier} damage`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Collapsed card
  if (!isExpanded) {
    return (
      <button
        onClick={onToggleExpand}
        className="w-full p-4 bg-card border border-muted/30 rounded-xl flex items-center justify-between active:scale-[0.99] transition-transform"
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
      </button>
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
        {/* Target Selector (when enemies exist) */}
        {activeEnemies.length > 0 && (
          <div className="p-2 bg-muted/10 border border-muted/20 rounded-lg">
            <div className="text-[10px] text-muted-foreground font-mono mb-2">🎯 TARGET</div>
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => setLocalTargetId(null)}
                className={cn(
                  "px-2 py-1 rounded-full text-xs font-mono transition-all",
                  localTargetId === null
                    ? "bg-muted/50 text-foreground ring-1 ring-muted"
                    : "bg-muted/20 text-muted-foreground hover:bg-muted/30"
                )}
              >
                Any
              </button>
              {activeEnemies.map(enemy => (
                <button
                  key={enemy.id}
                  onClick={() => setLocalTargetId(enemy.id)}
                  className={cn(
                    "px-2 py-1 rounded-full text-xs font-mono transition-all flex items-center gap-1",
                    localTargetId === enemy.id
                      ? "bg-destructive/30 text-destructive-foreground ring-1 ring-destructive/50"
                      : "bg-muted/20 text-muted-foreground hover:bg-muted/30"
                  )}
                >
                  <Target className="w-3 h-3" />
                  {enemy.name}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {/* Queue Success Indicator */}
        {showQueueSuccess && (
          <div className="p-2 bg-green-500/20 border border-green-500/30 rounded-lg text-center">
            <span className="text-xs text-green-300 font-mono">✓ Added to queue!</span>
          </div>
        )}
        
        {/* Normal Attack */}
        <div className="flex gap-2">
          <Button
            onClick={() => handleRoll('normal')}
            variant="ghost"
            className="flex-1 h-14 flex items-center justify-between px-4 border border-muted/40 hover:bg-muted/20"
          >
            <div className="flex items-center gap-3">
              <Crosshair className="w-5 h-5 text-destructive" />
              <span>Attack</span>
            </div>
            <span className="font-mono text-sm text-muted-foreground">
              d20+{totalAttackBonus}
            </span>
          </Button>
          {onQueueAttack && (
            <Button
              onClick={() => handleQueue('normal')}
              variant="outline"
              className="h-14 px-3 border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
              title="Add to queue"
            >
              <ListPlus className="w-5 h-5" />
            </Button>
          )}
        </div>

        {/* Sneak Attack */}
        <div className="flex gap-2">
          <Button
            onClick={() => handleRoll('sneak')}
            disabled={!sneakEligibility.eligible}
            variant="ghost"
            className={cn(
              "flex-1 h-14 flex items-center justify-between px-4 border",
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
          {onQueueAttack && sneakEligibility.eligible && (
            <Button
              onClick={() => handleQueue('sneak')}
              variant="outline"
              className="h-14 px-3 border-green-500/40 text-green-400 hover:bg-green-500/10"
              title="Queue sneak attack"
            >
              <ListPlus className="w-5 h-5" />
            </Button>
          )}
        </div>

        {/* Assassinate - Only when available */}
        {assassinateAvailable && (
          <div className="flex gap-2">
            <Button
              onClick={() => handleRoll('assassinate')}
              className="flex-1 h-16 flex flex-col items-center justify-center gap-1 bg-gradient-to-r from-destructive to-destructive/80 hover:from-destructive/90 hover:to-destructive/70 border border-destructive/50"
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
            {onQueueAttack && (
              <Button
                onClick={() => handleQueue('assassinate')}
                variant="outline"
                className="h-16 px-3 border-destructive/40 text-destructive hover:bg-destructive/10"
                title="Queue assassinate"
              >
                <ListPlus className="w-5 h-5" />
              </Button>
            )}
          </div>
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
          {copied ? 'Copied!' : 'Copy Roll Info'}
        </Button>
      </div>
    </div>
  );
}
