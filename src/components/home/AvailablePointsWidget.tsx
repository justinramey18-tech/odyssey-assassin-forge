import { motion } from 'framer-motion';
import { Sparkles, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AvailablePointsWidgetProps {
  availablePoints: number;
  onSpendClick: () => void;
}

export function AvailablePointsWidget({ 
  availablePoints, 
  onSpendClick 
}: AvailablePointsWidgetProps) {
  // Don't render if no points available
  if (availablePoints <= 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.45 }}
      className="px-4"
    >
      <button
        onClick={onSpendClick}
        className={cn(
          "w-full flex items-center justify-between p-3 rounded-lg",
          "bg-primary/10 border-2 border-primary/40",
          "hover:bg-primary/20 hover:border-primary/60 transition-all",
          "animate-points-glow"
        )}
        style={{ touchAction: 'manipulation' }}
        aria-label={`${availablePoints} ability points available. Tap to spend.`}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div className="text-left">
            <p className="font-cinzel font-bold text-primary text-lg">
              {availablePoints} Points Available
            </p>
            <p className="text-xs text-muted-foreground">
              Upgrade your abilities
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-1 text-primary">
          <span className="text-sm font-semibold">Spend Now</span>
          <ChevronRight className="w-4 h-4" />
        </div>
      </button>
    </motion.div>
  );
}
