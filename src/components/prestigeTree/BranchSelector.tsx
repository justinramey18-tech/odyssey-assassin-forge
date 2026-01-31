// Branch Selector - Mobile-First Tab Navigation for Prestige Tree Branches

import { cn } from '@/lib/utils';
import { PrestigeBranch } from '@/lib/prestigeTree/types';
import { BRANCH_VISUAL_CONFIG, BRANCH_ORDER } from '@/lib/prestigeTree/branchConfig';

interface BranchSelectorProps {
  selectedBranch: PrestigeBranch;
  onSelectBranch: (branch: PrestigeBranch) => void;
  branchProgress: Record<string, { unlocked: number; total: number }>;
}

export function BranchSelector({ 
  selectedBranch, 
  onSelectBranch,
  branchProgress,
}: BranchSelectorProps) {
  return (
    <div className="w-full">
      {/* Mobile-first: Full-width horizontal tabs with equal spacing */}
      <div className="grid grid-cols-4 gap-1 p-1.5 bg-black/60 rounded-xl border border-purple-900/40 backdrop-blur-sm">
        {BRANCH_ORDER.map((branchId) => {
          const config = BRANCH_VISUAL_CONFIG[branchId];
          const progress = branchProgress[branchId];
          const isSelected = selectedBranch === branchId;
          const Icon = config.icon;
          const progressPercent = progress?.total > 0 
            ? Math.round((progress.unlocked / progress.total) * 100) 
            : 0;

          return (
            <button
              key={branchId}
              onClick={() => onSelectBranch(branchId)}
              className={cn(
                "relative flex flex-col items-center gap-1 py-3 px-2 rounded-lg transition-all duration-200",
                "touch-manipulation active:scale-95",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500",
                isSelected 
                  ? "bg-gradient-to-b from-purple-900/60 to-purple-950/40 shadow-lg" 
                  : "bg-transparent hover:bg-white/5 active:bg-white/10"
              )}
              style={isSelected ? {
                boxShadow: `0 4px 12px ${config.glowColor}30, inset 0 1px 0 ${config.glowColor}20`,
              } : undefined}
              aria-selected={isSelected}
              aria-label={`${config.name}: ${progress?.unlocked || 0} of ${progress?.total || 0} abilities unlocked`}
            >
              {/* Icon with glow when selected */}
              <div className={cn(
                "relative flex items-center justify-center w-10 h-10 rounded-full transition-all",
                isSelected && "bg-gradient-to-b from-white/10 to-transparent"
              )}>
                <Icon 
                  className={cn(
                    "w-6 h-6 transition-colors",
                    isSelected ? "drop-shadow-lg" : "text-muted-foreground/70"
                  )}
                  style={isSelected ? { color: config.glowColor } : undefined}
                />
                {/* Glow effect for selected */}
                {isSelected && (
                  <div 
                    className="absolute inset-0 rounded-full blur-md opacity-40"
                    style={{ backgroundColor: config.glowColor }}
                  />
                )}
              </div>
              
              {/* Branch name - abbreviated for mobile */}
              <span 
                className={cn(
                  "text-[10px] font-medium uppercase tracking-wide leading-tight text-center",
                  isSelected ? "text-foreground" : "text-muted-foreground/60"
                )}
              >
                {config.name.split(' ')[0]}
              </span>
              
              {/* Progress indicator */}
              {progress && (
                <div className="w-full px-1">
                  {/* Progress bar */}
                  <div className="w-full h-1 bg-slate-800/80 rounded-full overflow-hidden">
                    <div 
                      className="h-full transition-all duration-500"
                      style={{ 
                        width: `${progressPercent}%`,
                        backgroundColor: progressPercent === 100 ? '#22c55e' : config.glowColor,
                      }}
                    />
                  </div>
                  {/* Fraction text */}
                  <span className={cn(
                    "text-[8px] text-center block mt-0.5",
                    isSelected ? "text-muted-foreground/80" : "text-muted-foreground/50"
                  )}>
                    {progress.unlocked}/{progress.total}
                  </span>
                </div>
              )}
              
              {/* Selection indicator line */}
              {isSelected && (
                <div 
                  className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full"
                  style={{ backgroundColor: config.glowColor }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
