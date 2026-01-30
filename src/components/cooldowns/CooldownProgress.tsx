import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

interface CooldownProgressProps {
  remaining: number; // seconds remaining
  total: number; // total cooldown in seconds
  tree: 'hunter' | 'warrior' | 'assassin';
  className?: string;
}

export function CooldownProgress({
  remaining,
  total,
  tree,
  className,
}: CooldownProgressProps) {
  const progress = total > 0 ? ((total - remaining) / total) * 100 : 100;
  
  const formatTime = (seconds: number): string => {
    if (seconds <= 0) return 'Ready';
    
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    if (mins > 0) {
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    return `${secs}s`;
  };
  
  // Tree-specific colors
  const treeProgressColors = {
    hunter: '[&>div]:bg-hunter',
    warrior: '[&>div]:bg-warrior',
    assassin: '[&>div]:bg-assassin',
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Progress 
        value={progress} 
        className={cn(
          'h-1.5 flex-1 bg-muted/30',
          treeProgressColors[tree]
        )}
      />
      <span className="text-xs font-mono text-muted-foreground min-w-[50px] text-right">
        {formatTime(remaining)}
      </span>
    </div>
  );
}
