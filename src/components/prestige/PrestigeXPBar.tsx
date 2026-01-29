import { cn } from '@/lib/utils';
import { Star } from 'lucide-react';

interface PrestigeXPBarProps {
  currentXP: number;
  requiredXP: number;
  prestigeLevel: number;
  className?: string;
}

export function PrestigeXPBar({ 
  currentXP, 
  requiredXP, 
  prestigeLevel,
  className,
}: PrestigeXPBarProps) {
  const percentage = Math.min((currentXP / requiredXP) * 100, 100);
  const xpToNext = Math.max(0, requiredXP - currentXP);

  return (
    <div className={cn('space-y-1', className)}>
      {/* Labels */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
          <span className="text-amber-400 font-display font-semibold">
            Prestige {prestigeLevel}
          </span>
        </div>
        <span className="font-display">
          <span className="text-amber-300">{currentXP.toLocaleString()}</span>
          <span className="text-amber-400/60"> / {requiredXP.toLocaleString()} XP</span>
        </span>
      </div>

      {/* Progress Bar */}
      <div className="h-3 bg-black/50 rounded-full border border-amber-600/60 overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 transition-all duration-500 relative"
          style={{ width: `${percentage}%` }}
        >
          {/* Shimmer effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
        </div>
      </div>

      {/* XP to next level */}
      <div className="flex justify-end text-[10px] text-amber-400/80">
        <span>{xpToNext.toLocaleString()} XP to next prestige</span>
      </div>
    </div>
  );
}
