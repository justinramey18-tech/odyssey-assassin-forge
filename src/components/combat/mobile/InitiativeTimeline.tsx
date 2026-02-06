import { useRef, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { InitiativeCombatant } from '@/hooks/use-initiative';
import { User, Skull, Crown, ChevronLeft, ChevronRight } from 'lucide-react';
import './TacticalHUDStyles.css';

interface InitiativeTimelineProps {
  initiativeOrder: InitiativeCombatant[];
  currentTurnId: string | null;
  roundNumber: number;
  isPlayerTurn: boolean;
  combatStarted: boolean;
  onGoToTurn?: (combatantId: string) => void;
  className?: string;
}

/**
 * Horizontal initiative timeline showing all combatants in turn order.
 * Active combatant is centered and highlighted.
 */
export function InitiativeTimeline({
  initiativeOrder,
  currentTurnId,
  roundNumber,
  isPlayerTurn,
  combatStarted,
  onGoToTurn,
  className,
}: InitiativeTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to active combatant
  useEffect(() => {
    if (currentTurnId && scrollRef.current) {
      const activeElement = scrollRef.current.querySelector(`[data-id="${currentTurnId}"]`);
      if (activeElement) {
        activeElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center',
        });
      }
    }
  }, [currentTurnId]);
  
  // Get current turn index
  const currentIndex = useMemo(() => {
    return initiativeOrder.findIndex(c => c.id === currentTurnId);
  }, [initiativeOrder, currentTurnId]);
  
  if (!combatStarted || initiativeOrder.length === 0) {
    return (
      <div className={cn(
        "h-16 flex items-center justify-center",
        "bg-gradient-to-b from-red-950/30 to-transparent",
        "border-b border-red-900/20",
        className
      )}>
        <div className="tactical-data text-center">
          <span className="text-muted-foreground">AWAITING INITIATIVE</span>
        </div>
      </div>
    );
  }
  
  return (
    <div className={cn(
      "relative bg-gradient-to-b from-red-950/40 to-transparent",
      "border-b border-red-900/30",
      className
    )}>
      {/* Round indicator */}
      <div className="absolute top-1 left-3 flex items-center gap-2 z-10">
        <span className="tactical-data">RND</span>
        <span className="tactical-data tactical-data--highlight text-sm font-bold">{roundNumber}</span>
      </div>
      
      {/* Turn status */}
      <div className="absolute top-1 right-3 z-10">
        <span className={cn(
          "tactical-data text-xs",
          isPlayerTurn ? "tactical-data--highlight" : "tactical-data--warning"
        )}>
          {isPlayerTurn ? '⚔️ YOUR TURN' : '⏳ ENEMY TURN'}
        </span>
      </div>
      
      {/* Timeline scroll container */}
      <div 
        ref={scrollRef}
        className="initiative-timeline pt-6 px-12"
      >
        {initiativeOrder.map((combatant, index) => {
          const isActive = combatant.id === currentTurnId;
          const isPlayer = combatant.isPlayer;
          const isDefeated = !combatant.isActive;
          
          return (
            <button
              key={combatant.id}
              data-id={combatant.id}
              onClick={() => onGoToTurn?.(combatant.id)}
              disabled={isDefeated}
              className={cn(
                "initiative-token",
                "relative flex flex-col items-center gap-1",
                "p-2 rounded-lg transition-all",
                "focus:outline-none focus:ring-2 focus:ring-red-500/50",
                isActive && "initiative-token--active",
                isDefeated && "initiative-token--defeated"
              )}
            >
              {/* Token circle */}
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center",
                "border-2 transition-all",
                isPlayer 
                  ? "border-emerald-500 bg-emerald-950/50" 
                  : "border-red-500 bg-red-950/50",
                isActive && !isDefeated && (isPlayer 
                  ? "shadow-[0_0_16px_rgba(16,185,129,0.5)]" 
                  : "shadow-[0_0_16px_rgba(239,68,68,0.5)]"
                ),
                isDefeated && "border-gray-600 bg-gray-900/50"
              )}>
                {isPlayer ? (
                  <Crown className={cn(
                    "w-5 h-5",
                    isActive ? "text-emerald-400" : "text-emerald-500/70"
                  )} />
                ) : isDefeated ? (
                  <Skull className="w-5 h-5 text-gray-500" />
                ) : (
                  <Skull className={cn(
                    "w-5 h-5",
                    isActive ? "text-red-400" : "text-red-500/70"
                  )} />
                )}
              </div>
              
              {/* Initiative value */}
              <span className={cn(
                "text-[10px] font-mono font-bold",
                isPlayer ? "text-emerald-400" : "text-red-400",
                isDefeated && "text-gray-500"
              )}>
                {combatant.initiative}
              </span>
              
              {/* Name (truncated) */}
              <span className={cn(
                "text-[9px] font-mono max-w-[56px] truncate",
                isActive ? "text-foreground" : "text-muted-foreground"
              )}>
                {combatant.name}
              </span>
              
              {/* Active indicator */}
              {isActive && !isDefeated && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              )}
            </button>
          );
        })}
      </div>
      
      {/* Scroll indicators */}
      {currentIndex > 0 && (
        <div className="swipe-indicator swipe-indicator--left">
          <ChevronLeft className="w-4 h-4 text-red-400" />
        </div>
      )}
      {currentIndex < initiativeOrder.length - 1 && (
        <div className="swipe-indicator swipe-indicator--right">
          <ChevronRight className="w-4 h-4 text-red-400" />
        </div>
      )}
    </div>
  );
}
