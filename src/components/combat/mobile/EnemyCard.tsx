import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { 
  Enemy, 
  getHealthStatus, 
  formatCreatureTypeSize,
  EnemyCondition,
  DamageType,
} from '@/lib/combat/targetTypes';
import {
  CREATURE_TYPE_ICONS,
  ENEMY_CONDITION_INFO,
  DAMAGE_TYPE_LABELS,
} from '@/lib/combat/creatureTypes';
import {
  Target,
  Skull,
  Shield,
  Minus,
  Plus,
  X,
  Copy,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface EnemyCardProps {
  enemy: Enemy;
  isCurrentTarget: boolean;
  onSelect: () => void;
  onDealDamage: (amount: number, damageType?: DamageType) => void;
  onHeal: (amount: number) => void;
  onRemove: () => void;
  onUpdate: (updates: Partial<Enemy>) => void;
  onClone: () => void;
  onToggleCondition: (condition: EnemyCondition) => void;
}

export function EnemyCard({
  enemy,
  isCurrentTarget,
  onSelect,
  onDealDamage,
  onHeal,
  onRemove,
  onUpdate,
  onClone,
  onToggleCondition,
}: EnemyCardProps) {
  const [damageInput, setDamageInput] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  
  const healthStatus = getHealthStatus(enemy.currentHP, enemy.maxHP);
  const hpPercent = enemy.maxHP > 0 ? (enemy.currentHP / enemy.maxHP) * 100 : 0;
  const isDefeated = enemy.currentHP <= 0;
  const typeIcon = enemy.creatureType ? CREATURE_TYPE_ICONS[enemy.creatureType] : null;
  const typeSizeLabel = formatCreatureTypeSize(enemy.creatureType, enemy.size);

  const handleDamage = () => {
    const amount = parseInt(damageInput, 10);
    if (!isNaN(amount) && amount > 0) {
      onDealDamage(amount);
      setDamageInput('');
    }
  };

  const handleHeal = () => {
    const amount = parseInt(damageInput, 10);
    if (!isNaN(amount) && amount > 0) {
      onHeal(amount);
      setDamageInput('');
    }
  };

  const handleQuickDamage = (amount: number) => {
    onDealDamage(amount);
  };

  return (
    <div
      className={cn(
        "rounded-xl border transition-all",
        isDefeated 
          ? "bg-slate-900/50 border-slate-700/50 opacity-60"
          : isCurrentTarget
            ? "bg-red-500/10 border-red-500/50 ring-2 ring-red-500/30"
            : "bg-card border-muted/30 hover:border-muted/50"
      )}
    >
      {/* Main row - Tap to target */}
      <button
        onClick={onSelect}
        disabled={isDefeated}
        className="w-full p-3 flex items-center gap-3 text-left"
      >
        {/* Target indicator */}
        <div className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
          isDefeated 
            ? "bg-slate-700/50"
            : isCurrentTarget
              ? "bg-red-500/30"
              : "bg-muted/30"
        )}>
          {isDefeated ? (
            <Skull className="w-4 h-4 text-slate-500" />
          ) : isCurrentTarget ? (
            <Target className="w-4 h-4 text-red-400" />
          ) : typeIcon ? (
            <span className="text-sm">{typeIcon}</span>
          ) : (
            <div className="w-2 h-2 rounded-full bg-muted-foreground" />
          )}
        </div>

        {/* Enemy info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn(
              "font-semibold truncate",
              isDefeated && "line-through text-muted-foreground"
            )}>
              {enemy.name}
            </span>
            {isCurrentTarget && !isDefeated && (
              <span className="text-[10px] bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded-full shrink-0">
                TARGET
              </span>
            )}
          </div>
          
          {/* Type/Size label */}
          {typeSizeLabel && (
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {typeSizeLabel}
            </div>
          )}
          
          {/* HP Bar */}
          <div className="mt-1.5 flex items-center gap-2">
            <Progress 
              value={hpPercent} 
              className={cn(
                "h-2 flex-1",
                isDefeated 
                  ? "[&>div]:bg-slate-600"
                  : hpPercent <= 25 
                    ? "[&>div]:bg-red-500" 
                    : hpPercent <= 50 
                      ? "[&>div]:bg-orange-500"
                      : "[&>div]:bg-green-500"
              )}
            />
            <span className={cn(
              "text-xs font-mono shrink-0",
              healthStatus.color
            )}>
              {enemy.currentHP}/{enemy.maxHP}
            </span>
          </div>

          {/* Active conditions */}
          {enemy.conditions.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {enemy.conditions.map(condition => {
                const info = ENEMY_CONDITION_INFO[condition];
                return (
                  <span
                    key={condition}
                    className="text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded-full"
                    title={info.effect}
                  >
                    {info.emoji} {info.label}
                  </span>
                );
              })}
            </div>
          )}

          {/* Damage type modifiers - always visible if any exist */}
          {(enemy.resistances.length > 0 || enemy.vulnerabilities.length > 0 || enemy.immunities.length > 0) && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {enemy.immunities.map(i => (
                <span 
                  key={`i-${i}`} 
                  className="text-[9px] bg-zinc-600/40 text-zinc-300 px-1.5 py-0.5 rounded flex items-center gap-0.5 border border-zinc-500/30"
                  title={`Immune to ${DAMAGE_TYPE_LABELS[i].label} damage`}
                >
                  {DAMAGE_TYPE_LABELS[i].emoji}
                  <span className="font-semibold">IMM</span>
                </span>
              ))}
              {enemy.resistances.map(r => (
                <span 
                  key={`r-${r}`} 
                  className="text-[9px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded flex items-center gap-0.5 border border-blue-500/30"
                  title={`Resistant to ${DAMAGE_TYPE_LABELS[r].label} damage (½)`}
                >
                  {DAMAGE_TYPE_LABELS[r].emoji}
                  <span className="font-semibold">½</span>
                </span>
              ))}
              {enemy.vulnerabilities.map(v => (
                <span 
                  key={`v-${v}`} 
                  className="text-[9px] bg-orange-500/20 text-orange-300 px-1.5 py-0.5 rounded flex items-center gap-0.5 border border-orange-500/30"
                  title={`Vulnerable to ${DAMAGE_TYPE_LABELS[v].label} damage (×2)`}
                >
                  {DAMAGE_TYPE_LABELS[v].emoji}
                  <span className="font-semibold">×2</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* AC Badge */}
        <div className="flex items-center gap-1 px-2 py-1 bg-muted/30 rounded-lg shrink-0">
          <Shield className="w-3 h-3 text-muted-foreground" />
          <span className="text-sm font-mono">{enemy.ac}</span>
        </div>
      </button>

      {/* Expanded damage controls (only for current target and non-defeated) */}
      {isCurrentTarget && !isDefeated && (
        <div className="px-3 pb-3 space-y-2 border-t border-muted/20 pt-2">
          {/* Quick damage buttons */}
          <div className="flex gap-1.5">
            {[5, 10, 15, 20].map(amount => (
              <Button
                key={amount}
                variant="ghost"
                size="sm"
                onClick={() => handleQuickDamage(amount)}
                className="flex-1 h-9 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30"
              >
                -{amount}
              </Button>
            ))}
          </div>
          
          {/* Custom damage input */}
          <div className="flex gap-2">
            <Input
              type="number"
              min="1"
              value={damageInput}
              onChange={(e) => setDamageInput(e.target.value)}
              placeholder="Custom"
              className="h-9 text-center font-mono bg-black/30"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDamage}
              disabled={!damageInput}
              className="h-9 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40"
            >
              <Minus className="w-4 h-4 mr-1" />
              Dmg
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleHeal}
              disabled={!damageInput}
              className="h-9 bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/40"
            >
              <Plus className="w-4 h-4 mr-1" />
              Heal
            </Button>
          </div>

          {/* Detailed resistances/vulnerabilities section in expanded controls */}
          {(enemy.resistances.length > 0 || enemy.vulnerabilities.length > 0 || enemy.immunities.length > 0) && (
            <div className="bg-muted/10 rounded-lg p-2 space-y-1.5">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Damage Modifiers
              </div>
              <div className="flex flex-wrap gap-1.5">
                {enemy.immunities.map(i => (
                  <span 
                    key={`i-${i}`} 
                    className="text-[10px] bg-zinc-600/40 text-zinc-200 px-2 py-1 rounded flex items-center gap-1 border border-zinc-500/40"
                  >
                    {DAMAGE_TYPE_LABELS[i].emoji} {DAMAGE_TYPE_LABELS[i].label}
                    <span className="font-bold text-zinc-400">IMMUNE</span>
                  </span>
                ))}
                {enemy.resistances.map(r => (
                  <span 
                    key={`r-${r}`} 
                    className="text-[10px] bg-blue-500/20 text-blue-200 px-2 py-1 rounded flex items-center gap-1 border border-blue-500/40"
                  >
                    {DAMAGE_TYPE_LABELS[r].emoji} {DAMAGE_TYPE_LABELS[r].label}
                    <span className="font-bold text-blue-400">½</span>
                  </span>
                ))}
                {enemy.vulnerabilities.map(v => (
                  <span 
                    key={`v-${v}`} 
                    className="text-[10px] bg-orange-500/20 text-orange-200 px-2 py-1 rounded flex items-center gap-1 border border-orange-500/40"
                  >
                    {DAMAGE_TYPE_LABELS[v].emoji} {DAMAGE_TYPE_LABELS[v].label}
                    <span className="font-bold text-orange-400">×2</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Expand details toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDetails(!showDetails)}
            className="w-full h-7 text-xs text-muted-foreground"
          >
            {showDetails ? (
              <>
                <ChevronUp className="w-3 h-3 mr-1" />
                Hide Details
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3 mr-1" />
                Conditions & More
              </>
            )}
          </Button>

          {/* Expanded details */}
          {showDetails && (
            <div className="space-y-2 pt-1">
              {/* Condition toggles */}
              <div className="space-y-1">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Toggle Conditions
                </div>
                <div className="flex flex-wrap gap-1">
                  {(['prone', 'frightened', 'poisoned', 'stunned', 'blinded', 'restrained', 'grappled', 'paralyzed'] as EnemyCondition[]).map(condition => {
                    const info = ENEMY_CONDITION_INFO[condition];
                    const isActive = enemy.conditions.includes(condition);
                    return (
                      <button
                        key={condition}
                        onClick={() => onToggleCondition(condition)}
                        className={cn(
                          "text-[10px] px-2 py-1 rounded-full border transition-all",
                          isActive
                            ? "bg-purple-500/30 border-purple-500/50 text-purple-200"
                            : "bg-muted/20 border-muted/30 text-muted-foreground hover:border-muted/50"
                        )}
                      >
                        {info.emoji} {info.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              
              {/* Notes display */}
              {enemy.notes && (
                <p className="text-[11px] text-muted-foreground italic px-1">
                  📝 {enemy.notes}
                </p>
              )}
              
              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClone}
                  className="flex-1 h-8 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Clone
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onRemove}
                  className="flex-1 h-8 text-xs text-muted-foreground hover:text-destructive"
                >
                  <X className="w-3 h-3 mr-1" />
                  Remove
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Defeated state */}
      {isDefeated && (
        <div className="px-3 pb-2 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-mono">💀 DEFEATED</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="h-7 text-xs text-muted-foreground hover:text-destructive"
          >
            <X className="w-3 h-3 mr-1" />
            Remove
          </Button>
        </div>
      )}
    </div>
  );
}
