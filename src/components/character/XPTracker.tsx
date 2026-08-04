import { useState } from 'react';
import { Achievement } from '@/lib/achievements';
import { 
  XP_REWARDS, 
  XPRewardType, 
  calculateXPGain,
  getLevelProgress,
  getXPToNextLevel,
  getXPForLevel,
} from '@/lib/xpSystem';
import { PrestigeData } from '@/lib/prestige';
import { useXPProgression } from '@/hooks/use-xp-progression';
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
import { Badge } from '@/components/ui/badge';
import { PrestigeXPBar } from '@/components/prestige';
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
  Snail,
  Gauge,
  Flag,
  ChevronUp,
} from 'lucide-react';

import { cn } from '@/lib/utils';

interface XPTrackerProps {
  currentLevel: number;
  currentXP: number;
  achievements: Achievement[];
  onAddXP: (amount: number, source: string) => void;
  prestigeData?: PrestigeData;
  nextPrestigeXPRequired?: number;
  onManualLevelUp?: () => void;
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
  achievements,
  onAddXP,
  prestigeData,
  nextPrestigeXPRequired,
  onManualLevelUp,
}: XPTrackerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const [selectedReward, setSelectedReward] = useState<XPRewardType | null>(null);

  // Use the reactive XP progression hook
  const { mode, multiplier } = useXPProgression();

  const isMaxLevel = currentLevel >= 20;
  const isMilestoneMode = multiplier === 0;

  const progress = getLevelProgress(currentLevel, currentXP, multiplier);
  const xpToNext = getXPToNextLevel(currentLevel, currentXP, multiplier);
  const currentLevelXP = getXPForLevel(currentLevel, multiplier);
  const nextLevelXP = getXPForLevel(currentLevel + 1, multiplier);
  // Guard against negative values if currentXP < currentLevelXP (data integrity issue)
  const xpInCurrentLevel = Math.max(0, currentXP - currentLevelXP);
  const xpNeededForLevel = nextLevelXP - currentLevelXP;

  const getModeIcon = () => {
    switch (mode) {
      case 'slow': return <Snail className="w-3 h-3" />;
      case 'fast': return <Zap className="w-3 h-3" />;
      case 'milestone': return <Flag className="w-3 h-3" />;
      default: return <Gauge className="w-3 h-3" />;
    }
  };

  const getModeLabel = () => {
    switch (mode) {
      case 'slow': return 'Slow';
      case 'fast': return 'Fast Track';
      case 'milestone': return 'Milestone';
      default: return 'Natural';
    }
  };

  if (isMilestoneMode) {
    return (
      <div className="space-y-3" data-tutorial-id="xp-tracker">
        {isMaxLevel && prestigeData && nextPrestigeXPRequired ? (
          <PrestigeXPBar
            currentXP={prestigeData.prestigeXP}
            requiredXP={nextPrestigeXPRequired}
            prestigeLevel={prestigeData.prestigeLevel}
          />
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-body">Milestone progression</span>
            <span className="font-display text-sm text-primary">Level {currentLevel}</span>
          </div>
        )}

        {!isMaxLevel && onManualLevelUp && (
          <Button
            variant="outline"
            size="sm"
            onClick={onManualLevelUp}
            className="w-full gap-1.5 min-h-[48px] border-primary/30 hover:border-primary/50 hover:bg-primary/10"
          >
            <ChevronUp className="w-4 h-4 text-primary" />
            <span className="text-xs">Advance a Level</span>
          </Button>
        )}

        <div className="flex justify-center">
          <Badge variant="outline" className="text-[10px] gap-1">
            <Flag className="w-3 h-3" />
            Milestone
          </Badge>
        </div>
      </div>
    );
  }


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
    <div className="space-y-2" data-tutorial-id="xp-tracker">
      {/* XP Progress Bar - switches to Prestige at max level */}
      {isMaxLevel && prestigeData && nextPrestigeXPRequired ? (
        <PrestigeXPBar
          currentXP={prestigeData.prestigeXP}
          requiredXP={nextPrestigeXPRequired}
          prestigeLevel={prestigeData.prestigeLevel}
        />
      ) : (
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
          {currentXP < currentLevelXP && (
            <p className="text-[10px] text-amber-400/80 mt-1">
              Your level was set manually, so earned XP fills this bar only after it reaches {currentLevelXP.toLocaleString()} XP.
            </p>
          )}
        </div>
      )}

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

            {/* Progression Mode Indicator */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50 border border-border/50">
                {getModeIcon()}
                <span className="text-xs">
                  <span className="font-medium">{getModeLabel()}</span>
                  <span className="text-muted-foreground"> progression ({multiplier}× XP required)</span>
                </span>
              </div>

              {/* Prestige Mode Indicator */}
              {isMaxLevel && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-500/10 border border-amber-500/30">
                  <Star className="w-4 h-4 text-amber-400" />
                  <span className="text-xs text-amber-300">
                    Max level reached! XP now contributes to <span className="font-semibold">Prestige</span>.
                  </span>
                </div>
              )}

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

      {/* Current Mode Badge */}
      <div className="flex justify-center">
        <Badge variant="outline" className="text-[10px] gap-1">
          {getModeIcon()}
          {getModeLabel()}
        </Badge>
      </div>
    </div>
  );
}
