import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface CooldownBadgeProps {
  remaining: number; // seconds remaining
  total: number; // total cooldown in seconds
  className?: string;
}

export function CooldownBadge({
  remaining,
  total,
  className,
}: CooldownBadgeProps) {
  const isReady = remaining <= 0;
  
  const formatTime = (seconds: number): string => {
    if (seconds <= 0) return '';
    
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}`;
    }
    if (mins > 0) {
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    return `${secs}s`;
  };
  
  // Color based on time remaining
  const getColor = () => {
    if (isReady) return 'bg-green-500/80 text-green-100';
    
    const percentRemaining = (remaining / total) * 100;
    if (percentRemaining > 50) return 'bg-red-500/80 text-red-100';
    if (percentRemaining > 25) return 'bg-amber-500/80 text-amber-100';
    return 'bg-yellow-400/80 text-yellow-900 animate-pulse';
  };

  return (
    <div
      className={cn(
        'absolute -top-1 -right-1 z-10',
        'px-1.5 py-0.5 rounded-full',
        'text-[9px] font-mono font-bold',
        'shadow-lg',
        getColor(),
        className
      )}
    >
      {isReady ? (
        <Check className="w-3 h-3" />
      ) : (
        formatTime(remaining)
      )}
    </div>
  );
}
