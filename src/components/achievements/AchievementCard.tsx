import { cn } from '@/lib/utils';
import { Achievement, getAchievementProgress } from '@/lib/achievements';
import { getIconByName } from '@/lib/iconUtils';
import { Button } from '@/components/ui/button';
import { Minus, Plus } from 'lucide-react';

interface AchievementCardProps {
  achievement: Achievement;
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
}

export function AchievementCard({ achievement, onIncrement, onDecrement }: AchievementCardProps) {
  const Icon = getIconByName(achievement.icon);
  const progress = getAchievementProgress(achievement);
  const isComplete = achievement.currentValue >= achievement.maxValue;

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

      {/* Progress Bar */}
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
        <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
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

      {/* Complete Badge */}
      {isComplete && (
        <div className="absolute -top-2 -right-2 bg-amber-500 text-amber-950 text-[10px] font-bold px-2 py-0.5 rounded-full">
          MAX
        </div>
      )}
    </div>
  );
}
