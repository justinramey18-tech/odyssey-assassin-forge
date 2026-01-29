import { useState } from 'react';
import { Achievement } from '@/lib/achievements';
import { 
  XP_REWARDS, 
  XPRewardType, 
  XP_PRESETS, 
  XPPreset,
  calculateXPGain,
  getLevelProgress,
  getXPToNextLevel,
  getXPForLevel,
} from '@/lib/xpSystem';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Sparkles, 
  Star, 
  Settings, 
  Zap,
  Trophy,
  Swords,
  Scroll,
  Search,
  Users,
  Gift,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface XPTrackerProps {
  currentLevel: number;
  currentXP: number;
  xpPreset: XPPreset;
  achievements: Achievement[];
  onAddXP: (amount: number, source: string) => void;
  onPresetChange: (preset: XPPreset) => void;
}

const rewardIcons: Record<XPRewardType, React.ReactNode> = {
  combatVictory: <Swords className="w-4 h-4" />,
  questComplete: <Scroll className="w-4 h-4" />,
  bossDefeated: <Trophy className="w-4 h-4" />,
  roleplayMoment: <Star className="w-4 h-4" />,
  discoveryMade: <Search className="w-4 h-4" />,
  socialVictory: <Users className="w-4 h-4" />,
  customAmount: <Gift className="w-4 h-4" />,
};

export function XPTracker({
  currentLevel,
  currentXP,
  xpPreset,
  achievements,
  onAddXP,
  onPresetChange,
}: XPTrackerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const [selectedReward, setSelectedReward] = useState<XPRewardType | null>(null);

  const multiplier = XP_PRESETS[xpPreset].multiplier;
  const progress = getLevelProgress(currentLevel, currentXP, multiplier);
  const xpToNext = getXPToNextLevel(currentLevel, currentXP, multiplier);
  const currentLevelXP = getXPForLevel(currentLevel, multiplier);
  const nextLevelXP = getXPForLevel(currentLevel + 1, multiplier);
  const xpInCurrentLevel = currentXP - currentLevelXP;
  const xpNeededForLevel = nextLevelXP - currentLevelXP;

  const handleAddReward = (rewardType: XPRewardType) => {
    const reward = XP_REWARDS[rewardType];
    const baseXP = Math.floor(Math.random() * (reward.max - reward.min + 1)) + reward.min;
    const { totalXP, achievementBonus } = calculateXPGain(baseXP, achievements);
    
    const source = achievementBonus > 0 
      ? `${reward.label} (+${achievementBonus} feat bonus)`
      : reward.label;
    
    onAddXP(totalXP, source);
    setSelectedReward(rewardType);
    setTimeout(() => setSelectedReward(null), 1000);
  };

  const handleAddCustom = () => {
    const amount = parseInt(customAmount);
    if (isNaN(amount) || amount <= 0) return;
    
    const { totalXP, achievementBonus } = calculateXPGain(amount, achievements);
    const source = achievementBonus > 0 
      ? `Custom XP (+${achievementBonus} feat bonus)`
      : 'Custom XP';
    
    onAddXP(totalXP, source);
    setCustomAmount('');
  };

  return (
    <div className="space-y-2">
      {/* XP Progress Bar */}
      <div className="relative">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-muted-foreground font-body">Experience</span>
          <span className="font-display font-semibold">
            <span className="text-primary">{xpInCurrentLevel.toLocaleString()}</span>
            <span className="text-muted-foreground"> / {xpNeededForLevel.toLocaleString()}</span>
          </span>
        </div>
        <Progress value={progress} className="h-3" />
        <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
          <span>Lv {currentLevel}</span>
          <span>{xpToNext.toLocaleString()} XP to next</span>
        </div>
      </div>

      {/* Quick XP Add Buttons */}
      <div className="flex gap-2">
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1 gap-1.5 border-primary/30 hover:border-primary/50 hover:bg-primary/10"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="text-xs">Add XP</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Award Experience
              </DialogTitle>
            </DialogHeader>

            {/* Preset Selection */}
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">XP Rate</label>
                <Select value={xpPreset} onValueChange={(v) => onPresetChange(v as XPPreset)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(XP_PRESETS).map(([key, preset]) => (
                      <SelectItem key={key} value={key}>
                        {preset.name} {preset.multiplier > 0 && `(×${preset.multiplier})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Achievement Bonus Indicator */}
              {achievements.some(a => a.currentValue > 0) && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-purple-500/10 border border-purple-500/30">
                  <Trophy className="w-4 h-4 text-purple-400" />
                  <span className="text-xs text-purple-300">
                    Feat progress adds bonus XP to rewards!
                  </span>
                </div>
              )}

              {/* Quick Reward Buttons */}
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(XP_REWARDS) as XPRewardType[])
                  .filter(k => k !== 'customAmount')
                  .map(rewardType => {
                    const reward = XP_REWARDS[rewardType];
                    return (
                      <Button
                        key={rewardType}
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddReward(rewardType)}
                        className={cn(
                          'justify-start gap-2 h-auto py-2 px-3 transition-all',
                          selectedReward === rewardType && 'bg-primary/20 border-primary'
                        )}
                      >
                        {rewardIcons[rewardType]}
                        <div className="text-left">
                          <p className="text-xs font-medium">{reward.label}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {reward.min}-{reward.max} XP
                          </p>
                        </div>
                      </Button>
                    );
                  })}
              </div>

              {/* Custom Amount */}
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Custom amount..."
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  className="flex-1"
                  min={1}
                />
                <Button 
                  onClick={handleAddCustom}
                  disabled={!customAmount || parseInt(customAmount) <= 0}
                >
                  <Zap className="w-4 h-4 mr-1" />
                  Add
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Settings Button */}
        <Button 
          variant="ghost" 
          size="sm"
          className="px-2"
          onClick={() => setIsOpen(true)}
        >
          <Settings className="w-3.5 h-3.5 text-muted-foreground" />
        </Button>
      </div>

      {/* Current Preset Badge */}
      <div className="flex justify-center">
        <Badge variant="outline" className="text-[10px] gap-1">
          <Zap className="w-3 h-3" />
          {XP_PRESETS[xpPreset].name}
        </Badge>
      </div>
    </div>
  );
}
