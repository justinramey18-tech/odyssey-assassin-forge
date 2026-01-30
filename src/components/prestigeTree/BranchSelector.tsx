// Branch Selector - Mobile Tab Navigation for Prestige Tree Branches

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
    <div className="flex overflow-x-auto scrollbar-hide gap-1 p-2 bg-black/40 rounded-lg border border-purple-900/30">
      {BRANCH_ORDER.map((branchId) => {
        const config = BRANCH_VISUAL_CONFIG[branchId];
        const progress = branchProgress[branchId];
        const isSelected = selectedBranch === branchId;
        const Icon = config.icon;

        return (
          <button
            key={branchId}
            onClick={() => onSelectBranch(branchId)}
            className={cn(
              "flex flex-col items-center gap-1 px-4 py-2 min-w-[80px] rounded-md transition-all",
              "focus:outline-none focus:ring-2 focus:ring-purple-500/50",
              isSelected 
                ? `bg-gradient-to-b ${config.gradient} border border-${config.primaryColor}/40` 
                : "hover:bg-white/5"
            )}
            aria-selected={isSelected}
            aria-label={`${config.name}: ${progress?.unlocked || 0} of ${progress?.total || 0} abilities unlocked`}
          >
            <Icon 
              className={cn(
                "w-5 h-5 transition-colors",
                isSelected ? `text-${config.primaryColor}` : "text-muted-foreground"
              )}
              style={isSelected ? { color: config.glowColor } : undefined}
            />
            <span 
              className={cn(
                "text-[10px] font-cinzel uppercase tracking-wider whitespace-nowrap",
                isSelected ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {config.name.split(' ')[0]}
            </span>
            {progress && (
              <span className="text-[9px] text-muted-foreground/70">
                {progress.unlocked}/{progress.total}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
