// Mobile Tier Section - Extracted component for mobile tier layout

import { Lock, Check, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { PrestigeAbility } from '@/lib/prestigeTree/types';
import { PrestigeAbilityNode } from './PrestigeAbilityNode';

interface MobileTierSectionProps {
  tierName: string;
  tierNumber: 1 | 2 | 3;
  abilities: PrestigeAbility[];
  isAccessible: boolean;
  progress: { unlockedCount: number; totalRequired: number };
  previousTierProgress?: { unlockedCount: number; totalRequired: number };
  unlockedSet: Set<string>;
  canUnlockAbility: (id: string) => { canUnlock: boolean; reason?: string };
  onNodeClick: (ability: PrestigeAbility) => void;
  glowColor: string;
}

export function MobileTierSection({
  tierName,
  tierNumber,
  abilities,
  isAccessible,
  progress,
  previousTierProgress,
  unlockedSet,
  canUnlockAbility,
  onNodeClick,
  glowColor,
}: MobileTierSectionProps) {
  const isComplete = progress.totalRequired > 0 && progress.unlockedCount >= progress.totalRequired;
  const percentage = progress.totalRequired > 0 
    ? Math.round((progress.unlockedCount / progress.totalRequired) * 100)
    : 0;

  return (
    <div className={cn(
      "relative rounded-xl overflow-hidden transition-all duration-300",
      isAccessible 
        ? "bg-gradient-to-b from-slate-900/60 to-slate-950/40" 
        : "bg-slate-950/30 opacity-60"
    )}>
      {/* Tier Header */}
      <div className={cn(
        "flex items-center justify-between px-4 py-3",
        "border-b",
        isAccessible ? "border-purple-900/30" : "border-slate-800/30"
      )}>
        <div className="flex items-center gap-3">
          {/* Tier Number Badge */}
          <div className={cn(
            "flex items-center justify-center w-8 h-8 rounded-lg font-bold text-sm",
            isComplete 
              ? "bg-green-500/20 text-green-400 border border-green-500/30"
              : isAccessible 
                ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                : "bg-slate-800/50 text-slate-500 border border-slate-700/30"
          )}>
            {isComplete ? <Check className="w-4 h-4" /> : tierNumber}
          </div>
          
          {/* Tier Name and Status */}
          <div>
            <h4 className={cn(
              "text-sm font-semibold font-cinzel",
              isAccessible ? "text-foreground" : "text-muted-foreground"
            )}>
              {tierName}
            </h4>
            {!isAccessible && previousTierProgress && (
              <p className="text-[10px] text-amber-400/70 flex items-center gap-1">
                <Lock className="w-3 h-3" />
                Complete previous tier ({previousTierProgress.unlockedCount}/{previousTierProgress.totalRequired})
              </p>
            )}
          </div>
        </div>
        
        {/* Progress Badge */}
        <div className="flex items-center gap-2">
          <Badge 
            variant={isComplete ? "default" : "outline"}
            className={cn(
              "text-[10px] px-2",
              isComplete && "bg-green-600 text-white"
            )}
          >
            {progress.unlockedCount}/{progress.totalRequired}
          </Badge>
        </div>
      </div>

      {/* Progress Bar - Full width */}
      <div className="h-1 bg-slate-800/50">
        <div 
          className="h-full transition-all duration-700 ease-out"
          style={{ 
            width: `${percentage}%`,
            backgroundColor: isComplete ? '#22c55e' : isAccessible ? glowColor : '#475569',
          }}
        />
      </div>

      {/* Abilities Grid */}
      <div className="p-4">
        {!isAccessible ? (
          // Locked tier overlay
          <div className="flex items-center justify-center py-6 text-muted-foreground/50">
            <Lock className="w-5 h-5 mr-2" />
            <span className="text-sm">Unlock previous tier to access</span>
          </div>
        ) : (
          // Ability nodes in a grid
          <div className="grid grid-cols-2 gap-3">
            {abilities.map((ability) => {
              const check = canUnlockAbility(ability.id);
              const isUnlocked = unlockedSet.has(ability.id);
              
              return (
                <button
                  key={ability.id}
                  onClick={() => onNodeClick(ability)}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl transition-all",
                    "touch-manipulation active:scale-98",
                    "text-left",
                    isUnlocked
                      ? "bg-gradient-to-r from-purple-900/40 to-purple-950/20 border border-purple-500/40"
                      : check.canUnlock
                        ? "bg-gradient-to-r from-amber-900/20 to-amber-950/10 border border-amber-500/40 border-dashed"
                        : "bg-slate-900/40 border border-slate-700/30"
                  )}
                  style={isUnlocked ? {
                    boxShadow: `0 0 12px ${glowColor}20`,
                  } : undefined}
                >
                  {/* Mini Node */}
                  <PrestigeAbilityNode
                    ability={ability}
                    isUnlocked={isUnlocked}
                    canUnlock={check.canUnlock}
                    unlockReason={check.reason}
                    onClick={() => {}}
                    isMobile={true}
                    isTierLocked={!isAccessible}
                  />
                  
                  {/* Ability Info */}
                  <div className="flex-1 min-w-0">
                    <h5 className={cn(
                      "text-xs font-semibold truncate",
                      isUnlocked ? "text-foreground" : "text-muted-foreground"
                    )}>
                      {ability.name}
                    </h5>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={cn(
                        "text-[10px]",
                        check.canUnlock ? "text-amber-400" : "text-muted-foreground/60"
                      )}>
                        {ability.prestigeCost} pts
                      </span>
                      {isUnlocked && (
                        <Badge className="text-[8px] px-1 py-0 bg-green-600 text-white">
                          ✓
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  {/* Chevron indicator */}
                  <ChevronRight className={cn(
                    "w-4 h-4 flex-shrink-0",
                    isUnlocked ? "text-purple-400" : "text-muted-foreground/40"
                  )} />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
