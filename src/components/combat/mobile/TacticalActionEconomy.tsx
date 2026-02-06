import { cn } from '@/lib/utils';
import { ActionEconomy } from '@/lib/combat/combatTypes';
import { Sword, Zap, Shield, Footprints } from 'lucide-react';
import './TacticalHUDStyles.css';

interface TacticalActionEconomyProps {
  economy: ActionEconomy;
  onUseAction?: () => void;
  onUseBonus?: () => void;
  onUseReaction?: () => void;
  className?: string;
}

/**
 * Compact tactical display of action economy with icon indicators.
 */
export function TacticalActionEconomy({
  economy,
  onUseAction,
  onUseBonus,
  onUseReaction,
  className,
}: TacticalActionEconomyProps) {
  const actions = [
    {
      id: 'action',
      icon: Sword,
      label: 'ACT',
      used: economy.actionUsed,
      color: 'text-red-400',
      bgColor: 'bg-red-500/20',
      borderColor: 'border-red-500/50',
      onClick: onUseAction,
    },
    {
      id: 'bonus',
      icon: Zap,
      label: 'BNS',
      used: economy.bonusActionUsed,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/20',
      borderColor: 'border-amber-500/50',
      onClick: onUseBonus,
    },
    {
      id: 'reaction',
      icon: Shield,
      label: 'RXN',
      used: economy.reactionUsed,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/20',
      borderColor: 'border-cyan-500/50',
      onClick: onUseReaction,
    },
  ];
  
  // Movement percentage
  const movementPercent = (economy.movementUsed / economy.maxMovement) * 100;
  const movementRemaining = economy.maxMovement - economy.movementUsed;
  
  return (
    <div className={cn(
      "flex items-center justify-between gap-2 px-4 py-2",
      "bg-gradient-to-r from-transparent via-red-950/20 to-transparent",
      className
    )}>
      {/* Action indicators */}
      <div className="flex items-center gap-2">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              onClick={action.onClick}
              disabled={action.used}
              className={cn(
                "action-indicator",
                action.used ? "action-indicator--used" : "action-indicator--available",
                !action.used && "action-indicator--ready",
                !action.used && action.borderColor
              )}
              title={action.used ? `${action.label} used` : `${action.label} available`}
            >
              <Icon className={cn(
                "w-4 h-4 transition-colors",
                action.used ? "text-muted-foreground" : action.color
              )} />
            </button>
          );
        })}
      </div>
      
      {/* Movement indicator */}
      <div className="flex items-center gap-2">
        <Footprints className="w-4 h-4 text-emerald-400" />
        <div className="flex flex-col gap-0.5">
          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${100 - movementPercent}%` }}
            />
          </div>
          <span className="tactical-data text-[9px] text-emerald-400">
            {movementRemaining}ft
          </span>
        </div>
      </div>
    </div>
  );
}
