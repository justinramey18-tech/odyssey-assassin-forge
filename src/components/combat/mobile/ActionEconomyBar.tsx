import { useState, useRef, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { 
  Sword, 
  Zap, 
  Shield, 
  Footprints,
  Flag,
  Sparkles,
  Timer,
} from 'lucide-react';
import { ActionEconomy } from '@/lib/combat/combatTypes';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Ability } from '@/lib/types';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface CooldownWarningInfo {
  abilityId: string;
  name: string;
  remaining: number;
  actionType: 'action' | 'bonus_action' | 'reaction';
}

interface ActionEconomyBarProps {
  economy: ActionEconomy;
  onEconomyChange: (economy: ActionEconomy) => void;
  actionCount: number;
  bonusCount: number;
  reactionCount: number;
  round: number;
  onEndTurn: () => void;
  onEndTurnWithSynthesis?: () => void;
  // Cooldown warnings
  coolingAbilities?: CooldownWarningInfo[];
}

export function ActionEconomyBar({
  economy,
  onEconomyChange,
  actionCount,
  bonusCount,
  reactionCount,
  round,
  onEndTurn,
  onEndTurnWithSynthesis,
  coolingAbilities = [],
}: ActionEconomyBarProps) {
  const [showMovementPicker, setShowMovementPicker] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const holdIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isHoldingRef = useRef(false);

  // Categorize cooling abilities by action type
  const coolingByType = useMemo(() => {
    const byType = {
      action: [] as CooldownWarningInfo[],
      bonus: [] as CooldownWarningInfo[],
      reaction: [] as CooldownWarningInfo[],
    };
    
    coolingAbilities.forEach(ability => {
      if (ability.actionType === 'action') {
        byType.action.push(ability);
      } else if (ability.actionType === 'bonus_action') {
        byType.bonus.push(ability);
      } else if (ability.actionType === 'reaction') {
        byType.reaction.push(ability);
      }
    });
    
    return byType;
  }, [coolingAbilities]);

  // Format cooldown time for display
  const formatCooldownTime = (seconds: number): string => {
    if (seconds <= 0) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    return `${secs}s`;
  };

  const toggleAction = () => {
    onEconomyChange({ ...economy, actionUsed: !economy.actionUsed });
  };

  const toggleBonus = () => {
    onEconomyChange({ ...economy, bonusActionUsed: !economy.bonusActionUsed });
  };

  const toggleReaction = () => {
    onEconomyChange({ ...economy, reactionUsed: !economy.reactionUsed });
  };

  const setMovement = (value: number) => {
    onEconomyChange({ ...economy, movementUsed: value });
    setShowMovementPicker(false);
  };

  // Hold-to-synthesize logic
  const startHold = useCallback(() => {
    if (!onEndTurnWithSynthesis) return;
    
    isHoldingRef.current = true;
    setHoldProgress(0);
    
    // Start progress animation
    holdIntervalRef.current = setInterval(() => {
      setHoldProgress(prev => {
        if (prev >= 100) {
          // Trigger synthesis
          if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
          if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
          onEndTurnWithSynthesis();
          isHoldingRef.current = false;
          return 0;
        }
        return prev + 5; // 20 steps over 1 second
      });
    }, 50);
  }, [onEndTurnWithSynthesis]);

  const endHold = useCallback(() => {
    isHoldingRef.current = false;
    if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    
    // If not fully held, trigger normal end turn
    if (holdProgress < 100 && holdProgress > 0) {
      setHoldProgress(0);
    } else if (holdProgress === 0) {
      // Quick tap - just end turn
      onEndTurn();
    }
    setHoldProgress(0);
  }, [holdProgress, onEndTurn]);

  // Cleanup on unmount
  const handlePointerDown = () => {
    if (onEndTurnWithSynthesis) {
      startHold();
    }
  };

  const handlePointerUp = () => {
    if (onEndTurnWithSynthesis) {
      endHold();
    } else {
      onEndTurn();
    }
  };

  const handlePointerLeave = () => {
    if (isHoldingRef.current) {
      if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
      setHoldProgress(0);
      isHoldingRef.current = false;
    }
  };

  return (
    <>
      <div className="sticky top-[calc(4rem+60px)] z-30 bg-background/95 backdrop-blur-sm border-b border-red-900/30 h-20 flex">
        {/* Action */}
        <ActionSegment
          icon={<Sword className="w-5 h-5" />}
          label="ACTION"
          used={economy.actionUsed}
          onToggle={toggleAction}
          count={actionCount}
          colorClass="red"
          coolingAbilities={coolingByType.action}
          formatTime={formatCooldownTime}
        />

        {/* Divider */}
        <div className="w-px bg-red-900/30" />

        {/* Bonus Action */}
        <ActionSegment
          icon={<Zap className="w-5 h-5" />}
          label="BONUS"
          used={economy.bonusActionUsed}
          onToggle={toggleBonus}
          count={bonusCount}
          colorClass="amber"
          coolingAbilities={coolingByType.bonus}
          formatTime={formatCooldownTime}
        />

        {/* Divider */}
        <div className="w-px bg-red-900/30" />

        {/* Reaction */}
        <ActionSegment
          icon={<Shield className="w-5 h-5" />}
          label="REACT"
          used={economy.reactionUsed}
          onToggle={toggleReaction}
          count={reactionCount}
          colorClass="cyan"
          coolingAbilities={coolingByType.reaction}
          formatTime={formatCooldownTime}
        />

        {/* Divider */}
        <div className="w-px bg-red-900/30" />

        {/* Movement */}
        <button
          onClick={() => setShowMovementPicker(true)}
          className={cn(
            "flex-1 flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95",
            economy.movementUsed >= economy.maxMovement
              ? "bg-muted/20 opacity-60"
              : "bg-green-500/10"
          )}
        >
          <Footprints className={cn(
            "w-4 h-4",
            economy.movementUsed >= economy.maxMovement ? "text-muted-foreground" : "text-green-400"
          )} />
          <span className="text-sm font-mono font-bold">
            {economy.movementUsed}/{economy.maxMovement}
          </span>
          <span className="text-[8px] font-mono text-muted-foreground">MOVE</span>
        </button>

        {/* Divider */}
        <div className="w-px bg-red-900/30" />

        {/* End Turn Button */}
        <button
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
          onPointerCancel={handlePointerLeave}
          className={cn(
            "relative flex-1 flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 overflow-hidden",
            "bg-gradient-to-b from-primary/20 to-primary/10 border-l border-primary/30"
          )}
        >
          {/* Hold progress overlay */}
          {holdProgress > 0 && (
            <div 
              className="absolute inset-0 bg-gradient-to-t from-indigo-500/40 to-indigo-400/20 transition-all"
              style={{ height: `${holdProgress}%` }}
            />
          )}
          
          <div className="relative z-10 flex flex-col items-center gap-0.5">
            {holdProgress > 0 ? (
              <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
            ) : (
              <Flag className="w-5 h-5 text-primary" />
            )}
            <span className="text-[10px] font-mono font-bold text-primary">
              {holdProgress > 0 ? 'AI SYNC' : 'END'}
            </span>
            <span className="text-[8px] font-mono text-muted-foreground">
              {holdProgress > 0 ? `${Math.round(holdProgress)}%` : `R${round}`}
            </span>
          </div>
        </button>
      </div>

      {/* Movement Picker Bottom Sheet */}
      <Sheet open={showMovementPicker} onOpenChange={setShowMovementPicker}>
        <SheetContent side="bottom" className="h-[40vh] rounded-t-2xl">
          <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-4" />
          <SheetHeader>
            <SheetTitle className="font-cinzel text-green-400">Movement Used</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-4 gap-3 mt-6">
            {[0, 5, 10, 15, 20, 25, 30, economy.maxMovement].filter((v, i, arr) => arr.indexOf(v) === i).map(value => (
              <Button
                key={value}
                variant="ghost"
                onClick={() => setMovement(value)}
                className={cn(
                  "h-14 text-lg font-mono",
                  economy.movementUsed === value
                    ? "bg-green-500/20 border-green-500/50 text-green-300"
                    : "border border-muted/30"
                )}
              >
                {value}ft
              </Button>
            ))}
          </div>
          <p className="text-center text-xs text-muted-foreground mt-4">
            Max movement: {economy.maxMovement}ft
          </p>
        </SheetContent>
      </Sheet>
    </>
  );
}

function ActionSegment({
  icon,
  label,
  used,
  onToggle,
  count,
  colorClass,
  coolingAbilities = [],
  formatTime,
}: {
  icon: React.ReactNode;
  label: string;
  used: boolean;
  onToggle: () => void;
  count: number;
  colorClass: 'red' | 'amber' | 'cyan' | 'green';
  coolingAbilities?: CooldownWarningInfo[];
  formatTime?: (seconds: number) => string;
}) {
  const colors = {
    red: {
      active: 'bg-red-500/20 text-red-400',
      used: 'bg-muted/20 text-muted-foreground opacity-50',
      badge: 'bg-red-500/30 text-red-300',
      warning: 'text-red-300/70',
    },
    amber: {
      active: 'bg-amber-500/20 text-amber-400',
      used: 'bg-muted/20 text-muted-foreground opacity-50',
      badge: 'bg-amber-500/30 text-amber-300',
      warning: 'text-amber-300/70',
    },
    cyan: {
      active: 'bg-cyan-500/20 text-cyan-400',
      used: 'bg-muted/20 text-muted-foreground opacity-50',
      badge: 'bg-cyan-500/30 text-cyan-300',
      warning: 'text-cyan-300/70',
    },
    green: {
      active: 'bg-green-500/20 text-green-400',
      used: 'bg-muted/20 text-muted-foreground opacity-50',
      badge: 'bg-green-500/30 text-green-300',
      warning: 'text-green-300/70',
    },
  };

  const colorSet = colors[colorClass];
  const hasCoolingAbilities = coolingAbilities.length > 0;

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onToggle}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 relative",
              used ? colorSet.used : colorSet.active
            )}
          >
            {/* Cooling indicator */}
            {hasCoolingAbilities && !used && (
              <div className="absolute top-1 left-1">
                <Timer className="w-3 h-3 text-muted-foreground animate-pulse" />
              </div>
            )}
            
            <div className="relative">
              {icon}
              {count > 0 && !used && (
                <span className={cn(
                  "absolute -top-1 -right-2 min-w-[14px] h-3.5 px-0.5 flex items-center justify-center",
                  "text-[9px] font-bold rounded-full",
                  colorSet.badge
                )}>
                  {count}
                </span>
              )}
            </div>
            <span className={cn(
              "text-[9px] font-mono",
              used && "line-through"
            )}>
              {label}
            </span>
            <span className="text-[8px] text-muted-foreground">
              {used ? 'USED' : hasCoolingAbilities ? `${coolingAbilities.length} ⏳` : 'READY'}
            </span>
          </button>
        </TooltipTrigger>
        
        {/* Tooltip showing cooling abilities */}
        {hasCoolingAbilities && (
          <TooltipContent 
            side="bottom" 
            className="max-w-[200px] bg-background/95 backdrop-blur border border-muted"
          >
            <div className="space-y-1">
              <p className="text-[10px] font-mono text-muted-foreground uppercase">On Cooldown:</p>
              {coolingAbilities.map(ability => (
                <div key={ability.abilityId} className="flex items-center justify-between gap-2">
                  <span className={cn("text-xs truncate", colorSet.warning)}>
                    {ability.name}
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {formatTime?.(ability.remaining) || `${ability.remaining}s`}
                  </span>
                </div>
              ))}
            </div>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
}