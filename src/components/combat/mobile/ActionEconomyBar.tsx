import { useState } from 'react';
import { cn } from '@/lib/utils';
import { 
  Sword, 
  Zap, 
  Shield, 
  Footprints 
} from 'lucide-react';
import { ActionEconomy } from '@/lib/combat/combatTypes';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

interface ActionEconomyBarProps {
  economy: ActionEconomy;
  onEconomyChange: (economy: ActionEconomy) => void;
  actionCount: number;
  bonusCount: number;
  reactionCount: number;
}

export function ActionEconomyBar({
  economy,
  onEconomyChange,
  actionCount,
  bonusCount,
  reactionCount,
}: ActionEconomyBarProps) {
  const [showMovementPicker, setShowMovementPicker] = useState(false);

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
        />

        {/* Divider */}
        <div className="w-px bg-red-900/30" />

        {/* Reaction */}
        <ActionSegment
          icon={<Shield className="w-5 h-5" />}
          label="REACTION"
          used={economy.reactionUsed}
          onToggle={toggleReaction}
          count={reactionCount}
          colorClass="cyan"
        />

        {/* Divider */}
        <div className="w-px bg-red-900/30" />

        {/* Movement */}
        <button
          onClick={() => setShowMovementPicker(true)}
          className={cn(
            "flex-1 flex flex-col items-center justify-center gap-1 transition-all active:scale-95",
            economy.movementUsed >= economy.maxMovement
              ? "bg-muted/20 opacity-60"
              : "bg-green-500/10"
          )}
        >
          <Footprints className={cn(
            "w-5 h-5",
            economy.movementUsed >= economy.maxMovement ? "text-muted-foreground" : "text-green-400"
          )} />
          <span className="text-lg font-mono font-bold">
            {economy.movementUsed}/{economy.maxMovement}
          </span>
          <span className="text-[9px] font-mono text-muted-foreground">MOVEMENT</span>
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
}: {
  icon: React.ReactNode;
  label: string;
  used: boolean;
  onToggle: () => void;
  count: number;
  colorClass: 'red' | 'amber' | 'cyan' | 'green';
}) {
  const colors = {
    red: {
      active: 'bg-red-500/20 text-red-400',
      used: 'bg-muted/20 text-muted-foreground opacity-50',
      badge: 'bg-red-500/30 text-red-300',
    },
    amber: {
      active: 'bg-amber-500/20 text-amber-400',
      used: 'bg-muted/20 text-muted-foreground opacity-50',
      badge: 'bg-amber-500/30 text-amber-300',
    },
    cyan: {
      active: 'bg-cyan-500/20 text-cyan-400',
      used: 'bg-muted/20 text-muted-foreground opacity-50',
      badge: 'bg-cyan-500/30 text-cyan-300',
    },
    green: {
      active: 'bg-green-500/20 text-green-400',
      used: 'bg-muted/20 text-muted-foreground opacity-50',
      badge: 'bg-green-500/30 text-green-300',
    },
  };

  const colorSet = colors[colorClass];

  return (
    <button
      onClick={onToggle}
      className={cn(
        "flex-1 flex flex-col items-center justify-center gap-1 transition-all active:scale-95",
        used ? colorSet.used : colorSet.active
      )}
    >
      <div className="relative">
        {icon}
        {count > 0 && !used && (
          <span className={cn(
            "absolute -top-1 -right-2 min-w-[16px] h-4 px-1 flex items-center justify-center",
            "text-[10px] font-bold rounded-full",
            colorSet.badge
          )}>
            {count}
          </span>
        )}
      </div>
      <span className={cn(
        "text-[10px] font-mono",
        used && "line-through"
      )}>
        {label}
      </span>
      <span className="text-[9px] text-muted-foreground">
        {used ? 'USED' : 'READY'}
      </span>
    </button>
  );
}
