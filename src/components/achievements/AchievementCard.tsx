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
import { Minus, Plus, Zap, ChevronDown } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useState } from 'react';

interface AchievementCardProps {
  achievement: Achievement;
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
}

export function AchievementCard({ achievement, onIncrement, onDecrement }: AchievementCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const Icon = getIconByName(achievement.icon);
  const progress = getAchievementProgress(achievement);
  const isComplete = achievement.currentValue >= achievement.maxValue;
  const claimedMilestones = achievement.claimedMilestones || [];
  const nextMilestone = getNextMilestone(achievement);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div 
        className={cn(
          "relative rounded-lg border transition-all overflow-hidden",
          isComplete 
            ? "bg-gradient-to-r from-amber-500/10 to-amber-400/5 border-amber-500/50" 
            : "bg-card/50 border-border/50 hover:border-primary/30"
        )}
      >
        {/* Collapsible Header */}
        <CollapsibleTrigger className="w-full text-left">
          <div className="flex items-center gap-3 p-3">
            {/* Icon */}
            <div className={cn(
              "p-2 rounded-lg shrink-0",
              isComplete ? "bg-amber-500/20 text-amber-400" : "bg-primary/10 text-primary"
            )}>
              <Icon className="w-5 h-5" />
            </div>
            
            {/* Title and Progress */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h3 className={cn(
                  "font-semibold text-sm leading-tight truncate",
                  isComplete && "text-amber-400"
                )}>
                  {achievement.name}
                </h3>
                <span className={cn(
                  "text-xs font-medium shrink-0",
                  isComplete ? "text-amber-400" : "text-muted-foreground"
                )}>
                  {achievement.currentValue}/{achievement.maxValue}
                </span>
              </div>
              
              {/* Compact Progress Bar */}
              <div className="relative h-1.5 bg-muted/50 rounded-full mt-2 overflow-hidden">
                <div 
                  className={cn(
                    "h-full transition-all duration-300 rounded-full",
                    isComplete 
                      ? "bg-gradient-to-r from-amber-500 to-amber-400" 
                      : "bg-primary"
                  )}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
            
            {/* Chevron */}
            <ChevronDown className={cn(
              "w-4 h-4 shrink-0 text-muted-foreground transition-transform duration-200",
              isOpen && "rotate-180"
            )} />
          </div>
        </CollapsibleTrigger>

        {/* Complete Badge */}
        {isComplete && (
          <div className="absolute -top-1 -right-1 bg-amber-500 text-amber-950 text-[9px] font-bold px-1.5 py-0.5 rounded-full">
            MAX
          </div>
        )}

        {/* Expanded Content */}
        <CollapsibleContent>
          <div className="px-3 pb-3 pt-1 border-t border-border/30">
            {/* Description */}
            <p className="text-xs text-muted-foreground mb-3">
              {achievement.description}
            </p>

            {/* Milestone Progress Markers */}
            <div className="mb-3">
              <div className="flex justify-between text-[10px] text-muted-foreground mb-1.5">
                <span>Milestones</span>
                <span>{Math.round(progress)}% Complete</span>
              </div>
              <div className="relative h-2.5 bg-muted/50 rounded-full overflow-visible">
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
                {ACHIEVEMENT_MILESTONES.map(milestone => {
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
                          "w-3 h-3 rounded-full border-2 transition-all -translate-x-1/2",
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
              
              {/* Milestone XP Labels */}
              <div className="flex justify-between mt-2">
                {ACHIEVEMENT_MILESTONES.map(milestone => {
                  const isClaimed = claimedMilestones.includes(milestone);
                  const isReached = progress >= milestone;
                  
                  return (
                    <div key={milestone} className="text-center" style={{ width: '25%' }}>
                      <div className={cn(
                        "text-[9px] font-medium",
                        isClaimed ? "text-primary" : isReached ? "text-primary/70" : "text-muted-foreground/50"
                      )}>
                        {milestone}%
                      </div>
                      <div className={cn(
                        "text-[8px] flex items-center justify-center gap-0.5",
                        isClaimed ? "text-primary" : "text-muted-foreground/50"
                      )}>
                        <Zap className="w-2.5 h-2.5" />
                        {MILESTONE_XP_REWARDS[milestone]}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Next milestone info */}
            {nextMilestone && !isComplete && (
              <div className="bg-muted/30 rounded-md p-2 mb-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">
                    Next: <span className="text-foreground font-medium">{nextMilestone.valueNeeded - achievement.currentValue}</span> more for {nextMilestone.percent}%
                  </span>
                  <span className="text-[10px] text-primary flex items-center gap-0.5 font-medium">
                    <Zap className="w-3 h-3" />
                    +{MILESTONE_XP_REWARDS[nextMilestone.percent]} XP
                  </span>
                </div>
              </div>
            )}

            {/* Counter Controls */}
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={(e) => {
                  e.stopPropagation();
                  onDecrement(achievement.id);
                }}
                disabled={achievement.currentValue <= 0}
              >
                <Minus className="w-4 h-4" />
              </Button>
              <span className="font-mono text-xl font-bold min-w-[4rem] text-center">
                {achievement.currentValue}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={(e) => {
                  e.stopPropagation();
                  onIncrement(achievement.id);
                }}
                disabled={achievement.currentValue >= achievement.maxValue}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {/* Claimed milestones display */}
            {claimedMilestones.length > 0 && (
              <div className="mt-3 pt-2 border-t border-border/30">
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {claimedMilestones.map(m => (
                    <span 
                      key={m}
                      className="text-[9px] px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium"
                    >
                      {m}% ✓
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
