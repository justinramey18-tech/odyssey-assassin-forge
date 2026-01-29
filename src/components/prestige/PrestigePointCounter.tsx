import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PrestigePointCounterProps {
  available: number;
  total: number;
  spent: number;
  className?: string;
}

export function PrestigePointCounter({ 
  available, 
  total, 
  spent,
  className,
}: PrestigePointCounterProps) {
  if (total === 0) return null;

  return (
    <div 
      className={cn(
        'bg-gradient-to-br from-amber-900/80 to-orange-900/80',
        'border-2 border-amber-500/70 rounded-lg p-4',
        'shadow-lg shadow-amber-500/10',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
            <h3 className="text-amber-400 font-display font-bold text-lg">
              Prestige Points
            </h3>
          </div>
          <p className="text-amber-200/80 text-sm font-body mt-0.5">
            Earned beyond Level 20
          </p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-display font-bold text-amber-300">
            {available}
          </div>
          <div className="text-xs text-amber-400/80 uppercase tracking-wide">
            Available
          </div>
        </div>
      </div>
      
      <div className="mt-3 pt-3 border-t border-amber-500/30 flex gap-4 text-xs text-amber-300/80">
        <span>Total Earned: <span className="font-semibold text-amber-300">{total}</span></span>
        <span>•</span>
        <span>Spent: <span className="font-semibold text-amber-300">{spent}</span></span>
      </div>
    </div>
  );
}
