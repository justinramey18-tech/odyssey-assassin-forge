import { cn } from '@/lib/utils';
import { Sparkles } from 'lucide-react';

interface CooldownOverlayProps {
  remaining: number; // seconds remaining
  total: number; // total cooldown in seconds
  tree: 'hunter' | 'warrior' | 'assassin';
  className?: string;
}

export function CooldownOverlay({
  remaining,
  total,
  tree,
  className,
}: CooldownOverlayProps) {
  const progress = total > 0 ? ((total - remaining) / total) * 100 : 100;
  const isReady = remaining <= 0;
  
  // Tree-specific colors
  const treeColors = {
    hunter: {
      stroke: 'stroke-hunter',
      bg: 'from-hunter/60 to-hunter-dim/60',
      glow: 'shadow-hunter/50',
    },
    warrior: {
      stroke: 'stroke-warrior',
      bg: 'from-warrior/60 to-warrior-dim/60',
      glow: 'shadow-warrior/50',
    },
    assassin: {
      stroke: 'stroke-assassin',
      bg: 'from-assassin/60 to-assassin-dim/60',
      glow: 'shadow-assassin/50',
    },
  };
  
  // Time-based urgency colors
  const getUrgencyColor = () => {
    const percentRemaining = (remaining / total) * 100;
    if (percentRemaining > 50) return 'text-red-400';
    if (percentRemaining > 25) return 'text-amber-400';
    return 'text-yellow-300';
  };
  
  const formatTime = (seconds: number): string => {
    if (seconds <= 0) return 'READY';
    
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  // SVG circle calculations
  const size = 48;
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  if (isReady) {
    return (
      <div
        className={cn(
          'absolute inset-0 flex items-center justify-center',
          'bg-green-500/20 backdrop-blur-[1px] rounded-lg',
          'border-2 border-green-400 animate-pulse',
          className
        )}
      >
        <div className="text-center">
          <Sparkles className="w-5 h-5 text-green-400 mx-auto mb-0.5" />
          <span className="text-green-400 font-bold text-[10px]">READY!</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'absolute inset-0 flex items-center justify-center',
        'bg-gradient-to-b backdrop-blur-[2px] rounded-lg',
        treeColors[tree].bg,
        className
      )}
    >
      <div className="relative">
        {/* Background circle */}
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-muted/30"
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className={cn(treeColors[tree].stroke, 'transition-all duration-1000')}
          />
        </svg>
        
        {/* Time text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn(
            'text-[10px] font-mono font-bold',
            getUrgencyColor(),
            remaining < total * 0.25 && 'animate-pulse'
          )}>
            {formatTime(remaining)}
          </span>
        </div>
      </div>
    </div>
  );
}
