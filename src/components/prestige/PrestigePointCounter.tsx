import { Star, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface PrestigePointCounterProps {
  available: number;
  total: number;
  spent: number;
  className?: string;
  onSpendPoints?: () => void;
}

export function PrestigePointCounter({ 
  available, 
  total, 
  spent,
  className,
  onSpendPoints,
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
      
      <div className="mt-3 pt-3 border-t border-amber-500/30 flex items-center justify-between">
        <div className="flex gap-4 text-xs text-amber-300/80">
          <span>Total Earned: <span className="font-semibold text-amber-300">{total}</span></span>
          <span>•</span>
          <span>Spent: <span className="font-semibold text-amber-300">{spent}</span></span>
        </div>
        
        {available > 0 && onSpendPoints && (
          <Button
            size="sm"
            onClick={onSpendPoints}
            className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-display gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Spend Points
          </Button>
        )}
      </div>
    </div>
  );
}
