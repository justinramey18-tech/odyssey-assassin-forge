// Prestige Ability Node - Individual Node in the Constellation
// Mobile-first with larger touch targets

import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PrestigeAbility } from '@/lib/prestigeTree/types';
import { BRANCH_VISUAL_CONFIG } from '@/lib/prestigeTree/branchConfig';
import { getIconByName } from '@/lib/iconUtils';

interface PrestigeAbilityNodeProps {
  ability: PrestigeAbility;
  isUnlocked: boolean;
  canUnlock: boolean;
  unlockReason?: string;
  onClick: () => void;
  isMobile: boolean;
  isTierLocked?: boolean;
}

export function PrestigeAbilityNode({
  ability,
  isUnlocked,
  canUnlock,
  unlockReason,
  onClick,
  isMobile,
  isTierLocked = false,
}: PrestigeAbilityNodeProps) {
  const branchConfig = BRANCH_VISUAL_CONFIG[ability.branch];
  const Icon = getIconByName(ability.icon);
  
  // Mobile-first: Larger touch targets
  const nodeSize = isMobile ? 'w-10 h-10' : 'w-16 h-16';
  const iconSize = isMobile ? 'w-4 h-4' : 'w-7 h-7';

  return (
    <div
      onClick={!isTierLocked ? onClick : undefined}
      role="button"
      tabIndex={isTierLocked ? -1 : 0}
      onKeyDown={(e) => {
        if (!isTierLocked && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        "relative flex items-center justify-center rounded-full transition-all duration-300",
        "touch-manipulation",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black",
        nodeSize,
        // Tier locked state
        isTierLocked && [
          "opacity-30",
          "cursor-not-allowed",
          "bg-slate-900/40",
          "border border-slate-800/40",
        ],
        // Unlocked state
        !isTierLocked && isUnlocked && [
          "bg-gradient-to-br from-purple-600/30 to-purple-900/20",
          "border-2 border-purple-500/60",
          "shadow-lg cursor-pointer",
        ],
        // Can unlock state
        !isTierLocked && !isUnlocked && canUnlock && [
          "bg-gradient-to-br from-amber-500/20 to-amber-600/10",
          "border-2 border-amber-500/50 border-dashed",
          "cursor-pointer",
          "animate-pulse",
        ],
        // Cannot unlock yet state
        !isTierLocked && !isUnlocked && !canUnlock && [
          "bg-slate-900/40",
          "border border-slate-700/40",
          "opacity-50",
          "cursor-not-allowed",
        ]
      )}
      style={{
        boxShadow: isTierLocked 
          ? undefined 
          : isUnlocked 
            ? `0 0 16px ${branchConfig.glowColor}40` 
            : canUnlock 
              ? '0 0 12px rgba(251, 191, 36, 0.25)' 
              : undefined,
      }}
      aria-label={`${ability.name}: ${ability.description}. Cost: ${ability.prestigeCost} points. ${isTierLocked ? 'Tier locked' : isUnlocked ? 'Unlocked' : unlockReason || 'Locked'}`}
    >
      {/* Tier lock overlay */}
      {isTierLocked && (
        <div className="absolute inset-0 rounded-full bg-black/70 backdrop-blur-sm flex items-center justify-center z-20">
          <Lock className={cn(iconSize, "text-slate-500")} />
        </div>
      )}

      {/* Outer glow for unlocked nodes */}
      {!isTierLocked && isUnlocked && (
        <div 
          className="absolute -inset-1 rounded-full blur-md opacity-40"
          style={{ backgroundColor: branchConfig.glowColor }}
        />
      )}
      
      {/* Icon or Lock */}
      {!isTierLocked && (
        <div className="relative z-10">
          {isUnlocked ? (
            <Icon 
              className={cn(iconSize)}
              style={{ color: branchConfig.glowColor }}
            />
          ) : canUnlock ? (
            <Icon className={cn(iconSize, "text-amber-400")} />
          ) : (
            <Lock className={cn(iconSize, "text-slate-500")} />
          )}
        </div>
      )}

      {/* Cost badge for unlockable nodes - mobile: smaller */}
      {!isTierLocked && !isUnlocked && canUnlock && !isMobile && (
        <div className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-full bg-amber-500 text-[9px] font-bold text-black">
          {ability.prestigeCost}
        </div>
      )}

      {/* Tier indicator - mobile: smaller */}
      {!isMobile && (
        <div 
          className={cn(
            "absolute -top-1 -left-1 w-4 h-4 rounded-full flex items-center justify-center",
            "text-[8px] font-bold",
            isTierLocked
              ? "bg-slate-800 text-slate-600"
              : isUnlocked 
                ? "bg-purple-600 text-white" 
                : "bg-slate-700 text-slate-400"
          )}
        >
          {ability.tier}
        </div>
      )}
    </div>
  );
}
