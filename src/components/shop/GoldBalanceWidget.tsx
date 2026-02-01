// Gold Balance Widget - Shows current gold in shop header

import { Coins } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GoldBalanceWidgetProps {
  currentGold: number;
  className?: string;
}

export function GoldBalanceWidget({ currentGold, className }: GoldBalanceWidgetProps) {
  const formattedGold = currentGold.toLocaleString();
  
  return (
    <div className={cn(
      "flex items-center gap-2 px-4 py-2 rounded-lg",
      "bg-gradient-to-r from-amber-500/20 to-yellow-500/10",
      "border border-amber-500/30",
      className
    )}>
      <Coins className="w-5 h-5 text-amber-400" />
      <span className="font-cinzel text-lg font-bold text-amber-300">
        {formattedGold}
      </span>
      <span className="text-xs text-amber-400/70 uppercase tracking-wider">GP</span>
    </div>
  );
}
