// Mobile Prestige Header - Compact header for mobile Legacy tab

import { Crown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DRIZZT_CENTRAL_NODE } from '@/lib/prestigeTree/branchConfig';

interface MobilePrestigeHeaderProps {
  prestigeLevel: number;
  totalUnlocked: number;
  pointsSpent: number;
  availablePoints?: number;
  className?: string;
}

export function MobilePrestigeHeader({
  prestigeLevel,
  totalUnlocked,
  pointsSpent,
  availablePoints,
  className,
}: MobilePrestigeHeaderProps) {
  return (
    <div className={cn("relative overflow-hidden", className)}>
      {/* Background gradient */}
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          background: `radial-gradient(ellipse at top center, ${DRIZZT_CENTRAL_NODE.glowColor}40 0%, transparent 70%)`,
        }}
      />
      
      <div className="relative flex items-center gap-4 p-4">
        {/* Portrait/Icon */}
        <div className="relative flex-shrink-0">
          {/* Glow ring */}
          <div 
            className="absolute -inset-1 rounded-full blur-md opacity-50 animate-pulse"
            style={{ backgroundColor: DRIZZT_CENTRAL_NODE.glowColor }}
          />
          
          <div className={cn(
            "relative flex items-center justify-center w-14 h-14 rounded-full",
            "bg-gradient-to-b from-purple-900/80 to-black/90",
            "border-2 border-purple-500/50"
          )}>
            <Crown className="w-7 h-7 text-purple-400" />
          </div>
        </div>
        
        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-cinzel font-bold text-base text-purple-300 truncate">
            {DRIZZT_CENTRAL_NODE.name}
          </h3>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Drizzt's Legacy
          </p>
        </div>
        
        {/* Available Points - consistent with header style */}
        <div className="text-right">
          <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">
            Available Ability Points
          </div>
          <div className="font-display font-bold text-xl text-primary">
            {Math.max(0, availablePoints ?? 0)}
          </div>
        </div>
      </div>
    </div>
  );
}
