import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Sword, 
  Zap, 
  Shield, 
  Footprints, 
  RotateCcw,
  Hexagon
} from 'lucide-react';
import { ActionEconomy } from '@/lib/combat/combatTypes';
import '../combat/CombatHUDStyles.css';

interface ActionEconomyTrackerProps {
  economy: ActionEconomy;
  onEconomyChange: (economy: ActionEconomy) => void;
  actionCount: number;
  bonusCount: number;
  reactionCount: number;
}

export function ActionEconomyTracker({
  economy,
  onEconomyChange,
  actionCount,
  bonusCount,
  reactionCount,
}: ActionEconomyTrackerProps) {
  const resetTurn = () => {
    onEconomyChange({
      actionUsed: false,
      bonusActionUsed: false,
      reactionUsed: false,
      movementUsed: 0,
      maxMovement: economy.maxMovement,
    });
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

  const updateMovement = (value: string) => {
    const num = parseInt(value) || 0;
    onEconomyChange({ ...economy, movementUsed: Math.min(num, economy.maxMovement) });
  };

  return (
    <div className="hud-panel">
      <div className="hud-panel-header mb-2">
        <Hexagon className="w-4 h-4" />
        <span>ACTION ECONOMY</span>
        <div className="flex-1 h-px bg-gradient-to-r from-red-500/50 to-transparent ml-2" />
      </div>

      <div className="flex items-stretch gap-1">
        {/* Action */}
        <ActionSegment
          icon={<Sword className="w-4 h-4" />}
          label="ACTION"
          used={economy.actionUsed}
          onToggle={toggleAction}
          count={actionCount}
          color="red"
        />

        {/* Bonus Action */}
        <ActionSegment
          icon={<Zap className="w-4 h-4" />}
          label="BONUS"
          used={economy.bonusActionUsed}
          onToggle={toggleBonus}
          count={bonusCount}
          color="amber"
        />

        {/* Reaction */}
        <ActionSegment
          icon={<Shield className="w-4 h-4" />}
          label="REACT"
          used={economy.reactionUsed}
          onToggle={toggleReaction}
          count={reactionCount}
          color="cyan"
        />

        {/* Movement */}
        <div className={cn(
          "flex-1 flex flex-col items-center justify-center gap-1 p-2 rounded border",
          economy.movementUsed >= economy.maxMovement
            ? "bg-muted/30 border-muted/30 opacity-60"
            : "bg-green-500/10 border-green-500/30"
        )}>
          <Footprints className={cn(
            "w-4 h-4",
            economy.movementUsed >= economy.maxMovement ? "text-muted-foreground" : "text-green-400"
          )} />
          <div className="flex items-center gap-1">
            <Input
              type="number"
              value={economy.movementUsed}
              onChange={(e) => updateMovement(e.target.value)}
              className="w-10 h-5 text-[10px] text-center p-0 bg-transparent border-none"
              min={0}
              max={economy.maxMovement}
            />
            <span className="text-[10px] text-muted-foreground">/{economy.maxMovement}ft</span>
          </div>
          <span className="text-[8px] font-mono text-muted-foreground">MOVEMENT</span>
        </div>

        {/* Reset Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={resetTurn}
          className="h-auto px-3 border border-red-500/40 bg-red-500/10 hover:bg-red-500/20 text-red-400 flex flex-col gap-1"
        >
          <RotateCcw className="w-4 h-4" />
          <span className="text-[8px] font-mono">RESET</span>
        </Button>
      </div>
    </div>
  );
}

function ActionSegment({
  icon,
  label,
  used,
  onToggle,
  count,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  used: boolean;
  onToggle: () => void;
  count: number;
  color: 'red' | 'amber' | 'cyan' | 'green';
}) {
  const colorClasses = {
    red: {
      active: 'bg-red-500/20 border-red-500/50',
      used: 'bg-muted/20 border-muted/30 opacity-50',
      icon: 'text-red-400',
      iconUsed: 'text-muted-foreground',
      badge: 'bg-red-500/30 text-red-300',
    },
    amber: {
      active: 'bg-amber-500/20 border-amber-500/50',
      used: 'bg-muted/20 border-muted/30 opacity-50',
      icon: 'text-amber-400',
      iconUsed: 'text-muted-foreground',
      badge: 'bg-amber-500/30 text-amber-300',
    },
    cyan: {
      active: 'bg-cyan-500/20 border-cyan-500/50',
      used: 'bg-muted/20 border-muted/30 opacity-50',
      icon: 'text-cyan-400',
      iconUsed: 'text-muted-foreground',
      badge: 'bg-cyan-500/30 text-cyan-300',
    },
    green: {
      active: 'bg-green-500/20 border-green-500/50',
      used: 'bg-muted/20 border-muted/30 opacity-50',
      icon: 'text-green-400',
      iconUsed: 'text-muted-foreground',
      badge: 'bg-green-500/30 text-green-300',
    },
  };

  const classes = colorClasses[color];

  return (
    <button
      onClick={onToggle}
      className={cn(
        "flex-1 flex flex-col items-center justify-center gap-1 p-2 rounded border transition-all",
        used ? classes.used : classes.active
      )}
    >
      <div className="flex items-center gap-1">
        <Checkbox
          checked={used}
          className="h-3 w-3"
          onCheckedChange={onToggle}
        />
        <span className={cn("transition-colors", used ? classes.iconUsed : classes.icon)}>
          {icon}
        </span>
      </div>
      <span className="text-[8px] font-mono text-muted-foreground line-through-when-used" style={{
        textDecoration: used ? 'line-through' : 'none'
      }}>{label}</span>
      {count > 0 && (
        <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-mono", classes.badge)}>
          {count}
        </span>
      )}
    </button>
  );
}
