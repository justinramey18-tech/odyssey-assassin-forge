import { cn } from '@/lib/utils';
import { 
  Achievement, 
  getAchievementProgress, 
  ACHIEVEMENT_MILESTONES,
  MILESTONE_XP_REWARDS,
  getNextMilestone,
} from '@/lib/achievements';
import { getIconByName } from '@/lib/iconUtils';
import { Button } from '@/components/ui/button';
import { Minus, Plus, Zap } from 'lucide-react';

interface AchievementCardProps {
  achievement: Achievement;
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
}

export function AchievementCard({ achievement, onIncrement, onDecrement }: AchievementCardProps) {
  const Icon = getIconByName(achievement.icon);
  const progress = getAchievementProgress(achievement);
  const isComplete = achievement.currentValue >= achievement.maxValue;
  const claimedMilestones = achievement.claimedMilestones || [];
  const nextMilestone = getNextMilestone(achievement);

  return (
    <div 
      className={cn(
        "relative p-4 rounded-lg border transition-all",
        isComplete 
          ? "bg-gradient-to-r from-amber-500/10 to-amber-400/5 border-amber-500/50" 
          : "bg-card/50 border-border/50 hover:border-primary/30"
      )}
    >
      {/* Icon and Title */}
      <div className="flex items-start gap-3 mb-3">
        <div className={cn(
          "p-2 rounded-lg",
          isComplete ? "bg-amber-500/20 text-amber-400" : "bg-primary/10 text-primary"
        )}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className={cn(
            "font-semibold text-sm leading-tight",
            isComplete && "text-amber-400"
          )}>
            {achievement.name}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {achievement.description}
          </p>
        </div>
      </div>

      {/* Progress Bar with Milestone Markers */}
      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-muted-foreground">Progress</span>
          <span className={cn(
            "font-medium",
            isComplete ? "text-amber-400" : "text-foreground"
          )}>
            {achievement.currentValue} / {achievement.maxValue}
          </span>
        </div>
        <div className="relative h-2 bg-muted/50 rounded-full overflow-visible">
          {/* Progress fill */}
          <div 
            className={cn(
              "h-full transition-all duration-300 rounded-full",
              isComplete 
                ? "bg-gradient-to-r from-amber-500 to-amber-400" 
                : "bg-primary"
            )}
            style={{ width: `${progress}%` }}
          />
          
          {/* Milestone markers */}
          {ACHIEVEMENT_MILESTONES.slice(0, -1).map(milestone => {
            const isClaimed = claimedMilestones.includes(milestone);
            const isReached = progress >= milestone;
            
            return (
              <div
                key={milestone}
                className="absolute top-1/2 -translate-y-1/2"
                style={{ left: `${milestone}%` }}
              >
                <div
                  className={cn(
                    "w-2.5 h-2.5 rounded-full border-2 transition-all -translate-x-1/2",
                    isClaimed 
                      ? "bg-primary border-primary" 
                      : isReached 
                        ? "bg-primary/50 border-primary animate-pulse" 
                        : "bg-muted border-muted-foreground/30"
                  )}
                  title={`${milestone}% - ${MILESTONE_XP_REWARDS[milestone]} XP`}
                />
              </div>
            );
          })}
        </div>
        
        {/* Next milestone info */}
        {nextMilestone && !isComplete && (
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[10px] text-muted-foreground">
              Next: {nextMilestone.valueNeeded - achievement.currentValue} more for {nextMilestone.percent}%
            </span>
            <span className="text-[10px] text-primary flex items-center gap-0.5">
              <Zap className="w-3 h-3" />
              +{MILESTONE_XP_REWARDS[nextMilestone.percent]} XP
            </span>
          </div>
        )}
      </div>

      {/* Counter Controls */}
      <div className="flex items-center justify-center gap-3">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onDecrement(achievement.id)}
          disabled={achievement.currentValue <= 0}
        >
          <Minus className="w-4 h-4" />
        </Button>
        <span className="font-mono text-lg font-bold min-w-[3rem] text-center">
          {achievement.currentValue}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onIncrement(achievement.id)}
          disabled={achievement.currentValue >= achievement.maxValue}
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {/* Claimed milestones display */}
      {claimedMilestones.length > 0 && (
        <div className="mt-3 pt-2 border-t border-border/30">
          <div className="flex flex-wrap gap-1 justify-center">
            {claimedMilestones.map(m => (
              <span 
                key={m}
                className="text-[9px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-medium"
              >
                {m}% ✓
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Complete Badge */}
      {isComplete && (
        <div className="absolute -top-2 -right-2 bg-amber-500 text-amber-950 text-[10px] font-bold px-2 py-0.5 rounded-full">
          MAX
        </div>
      )}
    </div>
  );
}
