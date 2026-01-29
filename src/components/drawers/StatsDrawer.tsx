import { useState } from 'react';
import { Heart, Sparkles, Plus, Minus, Shield, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { EdgeDrawer } from './EdgeDrawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { 
  XP_REWARDS, 
  XPRewardType,
  getLevelProgress,
  getXPToNextLevel,
  XP_PRESETS,
  XPPreset,
} from '@/lib/xpSystem';

interface StatsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  characterName: string;
  level: number;
  currentXP: number;
  xpPreset: XPPreset;
  onAddXP: (amount: number, source: string) => void;
  // HP State (managed locally for now, could be lifted)
  currentHP?: number;
  maxHP?: number;
  tempHP?: number;
  onHPChange?: (current: number, temp: number) => void;
}

export function StatsDrawer({ 
  open, 
  onOpenChange,
  characterName,
  level,
  currentXP,
  xpPreset,
  onAddXP,
  currentHP: propCurrentHP,
  maxHP: propMaxHP,
  tempHP: propTempHP,
  onHPChange,
}: StatsDrawerProps) {
  // Local HP state (with default values based on level)
  const defaultMaxHP = 8 + (level - 1) * 5; // Simple formula: 8 + 5 per level
  const [localCurrentHP, setLocalCurrentHP] = useState(propCurrentHP ?? defaultMaxHP);
  const [localMaxHP] = useState(propMaxHP ?? defaultMaxHP);
  const [localTempHP, setLocalTempHP] = useState(propTempHP ?? 0);
  const [customXP, setCustomXP] = useState('');
  const [hpDelta, setHpDelta] = useState('');

  const currentHP = propCurrentHP ?? localCurrentHP;
  const maxHP = propMaxHP ?? localMaxHP;
  const tempHP = propTempHP ?? localTempHP;

  const multiplier = XP_PRESETS[xpPreset].multiplier;
  const xpProgress = getLevelProgress(level, currentXP, multiplier);
  const xpToNext = getXPToNextLevel(level, currentXP, multiplier);

  const updateHP = (newCurrent: number, newTemp: number) => {
    const clampedCurrent = Math.max(0, Math.min(newCurrent, maxHP));
    const clampedTemp = Math.max(0, newTemp);
    
    if (onHPChange) {
      onHPChange(clampedCurrent, clampedTemp);
    } else {
      setLocalCurrentHP(clampedCurrent);
      setLocalTempHP(clampedTemp);
    }
  };

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

    // Apply remaining to current HP
    newCurrent = Math.max(0, newCurrent - remainingDamage);
    updateHP(newCurrent, newTemp);
    setHpDelta('');
    
    toast.error(`${characterName} takes ${amount} damage!`);
  };

  const handleHeal = () => {
    const amount = parseInt(hpDelta) || 1;
    const newCurrent = Math.min(maxHP, currentHP + amount);
    updateHP(newCurrent, tempHP);
    setHpDelta('');
    
    toast.success(`${characterName} heals for ${amount} HP!`);
  };

  const handleAddTempHP = () => {
    const amount = parseInt(hpDelta) || 1;
    // Temp HP doesn't stack, take the higher value
    const newTemp = Math.max(tempHP, amount);
    updateHP(currentHP, newTemp);
    setHpDelta('');
    
    toast.success(`${characterName} gains ${amount} temporary HP!`);
  };

  const handleQuickXP = (rewardType: XPRewardType) => {
    const reward = XP_REWARDS[rewardType];
    const amount = Math.floor(Math.random() * (reward.max - reward.min + 1)) + reward.min;
    onAddXP(amount, reward.label);
  };

  const handleCustomXP = () => {
    const amount = parseInt(customXP);
    if (amount > 0) {
      onAddXP(amount, 'Custom XP');
      setCustomXP('');
    }
  };

  const hpPercentage = (currentHP / maxHP) * 100;
  const hpColor = hpPercentage > 50 ? '#22c55e' : hpPercentage > 25 ? '#eab308' : '#ef4444';

  return (
    <EdgeDrawer
      side="left"
      open={open}
      onOpenChange={onOpenChange}
      title="Stats"
      icon={<Heart className="w-5 h-5" />}
      accentColor="#ef4444"
    >
      <ScrollArea className="h-[calc(100vh-120px)]">
        <div className="space-y-6 pr-2">
          {/* HP Section */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Heart className="w-4 h-4" style={{ color: hpColor }} />
              Hit Points
            </h3>
            
            {/* HP Display */}
            <div 
              className="p-4 rounded-lg border"
              style={{ 
                backgroundColor: `${hpColor}10`,
                borderColor: `${hpColor}40`,
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl font-bold" style={{ color: hpColor }}>
                  {currentHP}
                  <span className="text-sm font-normal text-muted-foreground">/{maxHP}</span>
                </span>
                {tempHP > 0 && (
                  <span className="flex items-center gap-1 text-sm text-cyan-400">
                    <Shield className="w-4 h-4" />
                    +{tempHP}
                  </span>
                )}
              </div>
              <Progress 
                value={hpPercentage} 
                className="h-3"
                style={{ 
                  ['--progress-background' as string]: hpColor,
                }}
              />
            </div>

            {/* HP Controls */}
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Amount"
                value={hpDelta}
                onChange={(e) => setHpDelta(e.target.value)}
                className="flex-1 h-9"
              />
              <Button 
                size="sm" 
                variant="destructive" 
                onClick={handleDamage}
                className="gap-1"
              >
                <Minus className="w-3 h-3" />
                Damage
              </Button>
              <Button 
                size="sm" 
                variant="default"
                onClick={handleHeal}
                className="gap-1 bg-green-600 hover:bg-green-700"
              >
                <Plus className="w-3 h-3" />
                Heal
              </Button>
            </div>
            
            <Button 
              size="sm" 
              variant="outline" 
              onClick={handleAddTempHP}
              className="w-full gap-1 border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/20"
            >
              <Shield className="w-3 h-3" />
              Add Temp HP
            </Button>
          </div>

          {/* XP Section */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Experience Points
            </h3>
            
            {/* XP Display */}
            <div 
              className="p-4 rounded-lg border"
              style={{ 
                backgroundColor: 'hsl(var(--amber-500) / 0.1)',
                borderColor: 'hsl(var(--amber-500) / 0.4)',
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-lg font-bold text-amber-400">
                  {currentXP.toLocaleString()} XP
                </span>
                <span className="text-xs text-muted-foreground">
                  Level {level} • {xpToNext.toLocaleString()} to next
                </span>
              </div>
              <Progress 
                value={xpProgress} 
                className="h-2"
              />
            </div>

            {/* Quick XP Buttons */}
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(XP_REWARDS).slice(0, 6).map(([key, reward]) => (
                <Button
                  key={key}
                  size="sm"
                  variant="outline"
                  onClick={() => handleQuickXP(key as XPRewardType)}
                  className="text-xs h-8"
                >
                  <Zap className="w-3 h-3 mr-1 text-amber-400" />
                  {reward.label}
                </Button>
              ))}
            </div>

            {/* Custom XP */}
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Custom XP amount"
                value={customXP}
                onChange={(e) => setCustomXP(e.target.value)}
                className="flex-1 h-9"
              />
              <Button 
                size="sm" 
                onClick={handleCustomXP}
                disabled={!customXP || parseInt(customXP) <= 0}
                className="gap-1 bg-amber-600 hover:bg-amber-700"
              >
                <Plus className="w-3 h-3" />
                Add
              </Button>
            </div>
          </div>
        </div>
      </ScrollArea>
    </EdgeDrawer>
  );
}
