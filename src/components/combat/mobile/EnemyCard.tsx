import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Enemy, getHealthStatus } from '@/lib/combat/targetTypes';
import {
  Target,
  Skull,
  Shield,
  Heart,
  Minus,
  Plus,
  X,
  Check,
} from 'lucide-react';

interface EnemyCardProps {
  enemy: Enemy;
  isCurrentTarget: boolean;
  onSelect: () => void;
  onDealDamage: (amount: number) => void;
  onHeal: (amount: number) => void;
  onRemove: () => void;
  onUpdate: (updates: Partial<Enemy>) => void;
}

export function EnemyCard({
  enemy,
  isCurrentTarget,
  onSelect,
  onDealDamage,
  onHeal,
  onRemove,
  onUpdate,
}: EnemyCardProps) {
  const [damageInput, setDamageInput] = useState('');
  const [showDamageControls, setShowDamageControls] = useState(false);
  
  const healthStatus = getHealthStatus(enemy.currentHP, enemy.maxHP);
  const hpPercent = enemy.maxHP > 0 ? (enemy.currentHP / enemy.maxHP) * 100 : 0;
  const isDefeated = enemy.currentHP <= 0;

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
          ) : (
            <div className="w-2 h-2 rounded-full bg-muted-foreground" />
          )}
        </div>

        {/* Enemy info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
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
          
          {/* Notes display */}
          {enemy.notes && (
            <p className="text-[11px] text-muted-foreground italic px-1">
              📝 {enemy.notes}
            </p>
          )}
          
          {/* Remove button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="w-full h-8 text-xs text-muted-foreground hover:text-destructive"
          >
            <X className="w-3 h-3 mr-1" />
            Remove from Combat
          </Button>
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
