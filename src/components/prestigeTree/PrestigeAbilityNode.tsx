// Prestige Ability Node - Individual Node in the Constellation

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
}

export function PrestigeAbilityNode({
  ability,
  isUnlocked,
  canUnlock,
  unlockReason,
  onClick,
  isMobile,
}: PrestigeAbilityNodeProps) {
  const branchConfig = BRANCH_VISUAL_CONFIG[ability.branch];
  const Icon = getIconByName(ability.icon);
  
  const nodeSize = isMobile ? 'w-12 h-12' : 'w-16 h-16';
  const iconSize = isMobile ? 'w-5 h-5' : 'w-7 h-7';

  return (
    <button
      onClick={onClick}
      disabled={!isUnlocked && !canUnlock}
      className={cn(
        "relative flex items-center justify-center rounded-full transition-all duration-300",
        "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black",
        nodeSize,
        // Unlocked state
        isUnlocked && [
          "bg-gradient-to-br",
          `from-${branchConfig.primaryColor}/40 to-${branchConfig.primaryColor}/20`,
          `border-2 border-${branchConfig.primaryColor}/60`,
          "shadow-lg",
        ],
        // Can unlock state
        !isUnlocked && canUnlock && [
          "bg-gradient-to-br from-amber-500/20 to-amber-600/10",
          "border-2 border-amber-500/50 border-dashed",
          "hover:border-solid hover:scale-110",
          "animate-pulse",
        ],
        // Locked state
        !isUnlocked && !canUnlock && [
          "bg-slate-900/40",
          "border border-slate-700/40",
          "opacity-50",
          "cursor-not-allowed",
        ]
      )}
      style={{
        boxShadow: isUnlocked 
          ? `0 0 20px ${branchConfig.glowColor}40, 0 0 40px ${branchConfig.glowColor}20` 
          : canUnlock 
            ? '0 0 15px rgba(251, 191, 36, 0.3)' 
            : undefined,
      }}
      aria-label={`${ability.name}: ${ability.description}. Cost: ${ability.prestigeCost} points. ${isUnlocked ? 'Unlocked' : unlockReason || 'Locked'}`}
    >
      {/* Outer glow for unlocked nodes */}
      {isUnlocked && (
        <div 
          className="absolute -inset-1 rounded-full blur-md opacity-50"
          style={{ backgroundColor: branchConfig.glowColor }}
        />
      )}
      
      {/* Icon or Lock */}
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

      {/* Cost badge for unlockable nodes */}
      {!isUnlocked && canUnlock && (
        <div className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-full bg-amber-500 text-[9px] font-bold text-black">
          {ability.prestigeCost}
        </div>
      )}

      {/* Tier indicator */}
      <div 
        className={cn(
          "absolute -top-1 -left-1 w-4 h-4 rounded-full flex items-center justify-center",
          "text-[8px] font-bold",
          isUnlocked 
            ? "bg-purple-600 text-white" 
            : "bg-slate-700 text-slate-400"
        )}
      >
        {ability.tier}
      </div>
    </button>
  );
}
