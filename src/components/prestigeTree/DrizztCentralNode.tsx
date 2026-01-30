// Drizzt Central Node - Portrait and Prestige Info Display

import { Crown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DRIZZT_CENTRAL_NODE } from '@/lib/prestigeTree/branchConfig';

interface DrizztCentralNodeProps {
  prestigeLevel: number;
  totalPointsEarned: number;
  pointsSpentOnTree: number;
  availablePoints: number;
  isMobile: boolean;
  className?: string;
}

export function DrizztCentralNode({
  prestigeLevel,
  totalPointsEarned,
  pointsSpentOnTree,
  availablePoints,
  isMobile,
  className,
}: DrizztCentralNodeProps) {
  return (
    <div 
      className={cn(
        "flex flex-col items-center text-center",
        isMobile ? "p-4" : "p-6",
        className
      )}
    >
      {/* Portrait Circle with Glow */}
      <div className="relative mb-4">
        {/* Outer glow ring */}
        <div 
          className="absolute -inset-3 rounded-full blur-xl opacity-50 animate-pulse"
          style={{ backgroundColor: DRIZZT_CENTRAL_NODE.glowColor }}
        />
        
        {/* Inner glow ring */}
        <div 
          className="absolute -inset-1 rounded-full border-2 animate-pulse"
          style={{ borderColor: DRIZZT_CENTRAL_NODE.glowColor }}
        />
        
        {/* Portrait container */}
        <div 
          className={cn(
            "relative flex items-center justify-center rounded-full",
            "bg-gradient-to-b from-purple-900/80 to-black/90",
            "border-2 border-purple-500/50",
            isMobile ? "w-20 h-20" : "w-28 h-28"
          )}
        >
          <Crown 
            className={cn(
              "text-purple-400",
              isMobile ? "w-10 h-10" : "w-14 h-14"
            )} 
          />
        </div>
      </div>

      {/* Name and Title */}
      <h3 className={cn(
        "font-cinzel font-bold text-purple-300",
        isMobile ? "text-base" : "text-lg"
      )}>
        {DRIZZT_CENTRAL_NODE.name}
      </h3>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">
        {DRIZZT_CENTRAL_NODE.title}
      </p>

      {/* Stats Display */}
      <div className={cn(
        "flex items-center gap-4 text-xs",
        isMobile && "flex-col gap-2"
      )}>
        {/* Prestige Level */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/30">
          <span className="text-purple-400 font-bold">P{prestigeLevel}</span>
          <span className="text-muted-foreground">Prestige</span>
        </div>
        
        {/* Points */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30">
          <span className="text-amber-400 font-bold">{availablePoints}</span>
          <span className="text-muted-foreground">Available</span>
        </div>
        
        {/* Spent on Tree */}
        {pointsSpentOnTree > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-500/10 border border-slate-500/30">
            <span className="text-slate-300 font-bold">{pointsSpentOnTree}</span>
            <span className="text-muted-foreground">Spent</span>
          </div>
        )}
      </div>
    </div>
  );
}
