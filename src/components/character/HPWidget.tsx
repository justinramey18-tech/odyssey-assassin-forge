import { useState, useCallback } from 'react';
import { Heart, Shield, Plus, Minus, Zap, Skull } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { DeathSavesTracker } from './DeathSavesTracker';

interface DeathSavesState {
  successes: number;
  failures: number;
}

interface HPWidgetProps {
  currentHP: number;
  maxHP: number;
  tempHP: number;
  deathSaves: DeathSavesState;
  onHPChange: (current: number, max: number, temp: number) => void;
  onDeathSavesChange: (saves: DeathSavesState) => void;
}

export function HPWidget({ currentHP, maxHP, tempHP, deathSaves, onHPChange, onDeathSavesChange }: HPWidgetProps) {
  const [hpDelta, setHpDelta] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  const hpPercentage = Math.max(0, Math.min(100, (currentHP / maxHP) * 100));
  
  // Color based on HP percentage
  const getHPColor = () => {
    if (hpPercentage > 50) return 'text-emerald-400';
    if (hpPercentage > 25) return 'text-amber-400';
    return 'text-rose-400';
  };

  const getProgressColor = () => {
    if (hpPercentage > 50) return 'bg-emerald-500';
    if (hpPercentage > 25) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  const updateHP = useCallback((newCurrent: number, newTemp: number) => {
    const clampedCurrent = Math.max(0, Math.min(newCurrent, maxHP));
    const clampedTemp = Math.max(0, newTemp);
    onHPChange(clampedCurrent, maxHP, clampedTemp);
  }, [maxHP, onHPChange]);

  const handleDamage = () => {
    const amount = parseInt(hpDelta) || 1;
    let remainingDamage = amount;
    let newTemp = tempHP;
    let newCurrent = currentHP;

    // Temp HP absorbs damage first
    if (newTemp > 0) {
      if (remainingDamage >= newTemp) {
        remainingDamage -= newTemp;
        newTemp = 0;
      } else {
        newTemp -= remainingDamage;
        remainingDamage = 0;
      }
    }

    // Remaining damage goes to current HP
    newCurrent = Math.max(0, newCurrent - remainingDamage);
    updateHP(newCurrent, newTemp);
    setHpDelta('');

    toast({
      title: `💔 Took ${amount} damage`,
      description: newCurrent === 0 ? "You're down!" : `HP: ${newCurrent}/${maxHP}`,
      className: 'border-rose-500/30 bg-rose-500/10',
    });
  };

  const handleHeal = () => {
    const amount = parseInt(hpDelta) || 1;
    const newCurrent = Math.min(maxHP, currentHP + amount);
    updateHP(newCurrent, tempHP);
    setHpDelta('');

    toast({
      title: `💚 Healed ${amount} HP`,
      description: `HP: ${newCurrent}/${maxHP}`,
      className: 'border-emerald-500/30 bg-emerald-500/10',
    });
  };

  const handleAddTempHP = () => {
    const amount = parseInt(hpDelta) || 1;
    // Temp HP doesn't stack, take the higher value
    const newTemp = Math.max(tempHP, amount);
    updateHP(currentHP, newTemp);
    setHpDelta('');

    toast({
      title: `🛡️ +${amount} Temp HP`,
      description: `Total temp HP: ${newTemp}`,
      className: 'border-sky-500/30 bg-sky-500/10',
    });
  };

  const handleMaxHPChange = (delta: number) => {
    const newMax = Math.max(1, maxHP + delta);
    const newCurrent = Math.min(currentHP, newMax);
    onHPChange(newCurrent, newMax, tempHP);
  };

  const handleQuickAction = (action: 'damage' | 'heal', amount: number) => {
    if (action === 'damage') {
      let remainingDamage = amount;
      let newTemp = tempHP;
      let newCurrent = currentHP;

      if (newTemp > 0) {
        if (remainingDamage >= newTemp) {
          remainingDamage -= newTemp;
          newTemp = 0;
        } else {
          newTemp -= remainingDamage;
          remainingDamage = 0;
        }
      }

      newCurrent = Math.max(0, newCurrent - remainingDamage);
      updateHP(newCurrent, newTemp);
    } else {
      const newCurrent = Math.min(maxHP, currentHP + amount);
      updateHP(newCurrent, tempHP);
    }
  };

  const isDown = currentHP === 0;

  // Handler for regaining HP from death saves (natural 20)
  const handleRegainHP = (amount: number) => {
    onHPChange(amount, maxHP, tempHP);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors",
          isDown 
            ? "bg-rose-950/50 border-rose-500/50 hover:bg-rose-950/80 animate-pulse" 
            : "bg-card/50 border-border/50 hover:bg-card/80"
        )}>
          {isDown ? (
            <Skull className="w-4 h-4 text-rose-400" />
          ) : (
            <Heart className={cn("w-4 h-4", getHPColor())} />
          )}
          <div className="flex flex-col items-start">
            <div className="flex items-center gap-1">
              <span className={cn("font-bold text-sm", isDown ? "text-rose-400" : getHPColor())}>
                {isDown ? "DOWN" : currentHP}
              </span>
              {!isDown && (
                <>
                  <span className="text-xs text-muted-foreground">/{maxHP}</span>
                  {tempHP > 0 && (
                    <span className="text-xs text-sky-400 ml-1">+{tempHP}</span>
                  )}
                </>
              )}
            </div>
            <div className="w-16 h-1 rounded-full bg-muted overflow-hidden">
              <div 
                className={cn("h-full transition-all", getProgressColor())}
                style={{ width: `${hpPercentage}%` }}
              />
            </div>
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent className={cn("p-4", isDown ? "w-80" : "w-72")} align="start">
        <div className="space-y-4">
          {/* Death Saves Tracker - Show when HP is 0 */}
          {isDown && (
            <DeathSavesTracker
              deathSaves={deathSaves}
              onDeathSavesChange={onDeathSavesChange}
              onRegainHP={handleRegainHP}
            />
          )}

          {/* HP Display */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Heart className={cn("w-6 h-6", getHPColor())} />
              <span className={cn("text-3xl font-bold", getHPColor())}>
                {currentHP}
              </span>
              <span className="text-xl text-muted-foreground">/ {maxHP}</span>
            </div>
            {tempHP > 0 && (
              <div className="flex items-center justify-center gap-1 text-sky-400">
                <Shield className="w-4 h-4" />
                <span className="font-medium">+{tempHP} Temp HP</span>
              </div>
            )}
            <Progress 
              value={hpPercentage} 
              className="h-3 mt-2"
            />
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-4 gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-8 text-rose-400 hover:bg-rose-500/10"
              onClick={() => handleQuickAction('damage', 1)}
            >
              -1
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-8 text-rose-400 hover:bg-rose-500/10"
              onClick={() => handleQuickAction('damage', 5)}
            >
              -5
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-8 text-emerald-400 hover:bg-emerald-500/10"
              onClick={() => handleQuickAction('heal', 1)}
            >
              +1
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-8 text-emerald-400 hover:bg-emerald-500/10"
              onClick={() => handleQuickAction('heal', 5)}
            >
              +5
            </Button>
          </div>

          {/* Custom Amount */}
          <div className="space-y-2">
            <Input
              type="number"
              placeholder="Amount..."
              value={hpDelta}
              onChange={(e) => setHpDelta(e.target.value)}
              className="text-center"
            />
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-rose-400 border-rose-500/30 hover:bg-rose-500/10"
                onClick={handleDamage}
                disabled={!hpDelta}
              >
                <Minus className="w-3 h-3 mr-1" />
                Damage
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                onClick={handleHeal}
                disabled={!hpDelta}
              >
                <Plus className="w-3 h-3 mr-1" />
                Heal
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-sky-400 border-sky-500/30 hover:bg-sky-500/10"
                onClick={handleAddTempHP}
                disabled={!hpDelta}
              >
                <Shield className="w-3 h-3 mr-1" />
                Temp
              </Button>
            </div>
          </div>

          {/* Max HP Adjustment */}
          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            <span className="text-xs text-muted-foreground">Max HP</span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => handleMaxHPChange(-1)}
              >
                <Minus className="w-3 h-3" />
              </Button>
              <span className="font-mono text-sm w-8 text-center">{maxHP}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => handleMaxHPChange(1)}
              >
                <Plus className="w-3 h-3" />
              </Button>
            </div>
          </div>

          {/* Full Heal */}
          <Button
            variant="outline"
            size="sm"
            className="w-full text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
            onClick={() => {
              updateHP(maxHP, tempHP);
              toast({
                title: '💚 Fully Healed!',
                description: `HP restored to ${maxHP}/${maxHP}`,
                className: 'border-emerald-500/30 bg-emerald-500/10',
              });
            }}
          >
            <Zap className="w-4 h-4 mr-2" />
            Full Heal
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
