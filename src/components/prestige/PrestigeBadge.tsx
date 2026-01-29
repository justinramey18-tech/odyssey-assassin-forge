import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PrestigeBadgeProps {
  prestigeLevel: number;
  isActive: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function PrestigeBadge({ 
  prestigeLevel, 
  isActive,
  size = 'md',
  className,
}: PrestigeBadgeProps) {
  if (!isActive || prestigeLevel === 0) return null;

  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-[10px] gap-0.5',
    md: 'px-2 py-1 text-xs gap-1',
    lg: 'px-3 py-1.5 text-sm gap-1.5',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  };

  return (
    <div 
      className={cn(
        'inline-flex items-center rounded border font-display font-bold',
        'bg-gradient-to-r from-amber-500 to-orange-600',
        'border-amber-400 text-white',
        'shadow-sm shadow-amber-500/30',
        sizeClasses[size],
        className
      )}
    >
      <Star className={cn(iconSizes[size], 'fill-current')} />
      <span>P{prestigeLevel}</span>
    </div>
  );
}
