import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { 
  Menu, 
  RotateCcw, 
  Settings,
  Activity,
  Heart,
  Shield,
  Swords,
  Users
} from 'lucide-react';

interface CombatTopBarProps {
  round: number;
  isYourTurn: boolean;
  lastAction: string;
  onResetTurn: () => void;
  onMenuOpen: () => void;
  onSettingsOpen: () => void;
  onPartyOpen?: () => void;
  partyMemberCount?: number;
  // New stats props
  currentHP?: number;
  maxHP?: number;
  tempHP?: number;
  ac?: number;
  attackBonus?: number;
}

export function CombatTopBar({
  round,
  isYourTurn,
  lastAction,
  onResetTurn,
  onMenuOpen,
  onSettingsOpen,
  onPartyOpen,
  partyMemberCount = 0,
  currentHP,
  maxHP,
  tempHP = 0,
  ac,
  attackBonus,
}: CombatTopBarProps) {
  // Calculate HP percentage for color coding
  const hpPercent = maxHP ? ((currentHP ?? maxHP) / maxHP) * 100 : 100;
  const hpColor = hpPercent > 50 ? 'text-emerald-400' : hpPercent > 25 ? 'text-amber-400' : 'text-rose-400';
  const isDown = (currentHP ?? 1) <= 0;
  
  return (
    <header className="fixed top-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-b border-red-900/30 z-50 safe-area-top">
      {/* Main row */}
      <div className="flex items-center justify-between h-14 px-3">
        {/* Left: Menu */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuOpen}
          className="h-9 w-9 border border-red-900/40"
        >
          <Menu className="h-5 w-5 text-red-400" />
        </Button>

        {/* Center: Round & Status */}
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-mono text-muted-foreground text-xs">R{round}</span>
            <span className={cn(
              "font-semibold text-xs",
              isYourTurn ? "text-green-400" : "text-muted-foreground"
            )}>
              {isYourTurn ? "Your Turn" : "Waiting..."}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Activity className="w-3 h-3 text-red-500 animate-pulse" />
            <span className="truncate max-w-[120px]">{lastAction}</span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1">
          {partyMemberCount > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onPartyOpen}
              className="h-9 w-9 border border-emerald-500/40 relative"
            >
              <Users className="h-4 w-4 text-emerald-400" />
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 flex items-center justify-center text-[10px] font-bold rounded-full bg-emerald-500 text-white">
                {partyMemberCount}
              </span>
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onResetTurn}
            className="h-9 w-9 border border-red-900/40"
          >
            <RotateCcw className="h-4 w-4 text-red-400" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onSettingsOpen}
            className="h-9 w-9 border border-muted/30"
          >
            <Settings className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </div>
      
      {/* Stats row - HP, AC, ATK */}
      {(currentHP !== undefined || ac !== undefined) && (
        <div className="flex items-center justify-center gap-4 px-3 pb-2 border-t border-red-900/20">
          {/* HP Display */}
          {currentHP !== undefined && maxHP !== undefined && (
            <div className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-md",
              isDown ? "bg-rose-500/20 animate-pulse" : "bg-background/50"
            )}>
              <Heart className={cn("w-4 h-4", hpColor, isDown && "text-rose-500")} />
              <span className={cn("font-mono font-bold text-sm", hpColor)}>
                {isDown ? 'DOWN' : currentHP}
              </span>
              {!isDown && (
                <>
                  <span className="text-muted-foreground text-xs">/</span>
                  <span className="text-muted-foreground text-xs font-mono">{maxHP}</span>
                </>
              )}
              {tempHP > 0 && (
                <span className="text-cyan-400 text-xs font-mono">+{tempHP}</span>
              )}
            </div>
          )}
          
          {/* AC Display */}
          {ac !== undefined && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-background/50">
              <Shield className="w-4 h-4 text-cyan-400" />
              <span className="font-mono font-bold text-sm text-cyan-400">{ac}</span>
            </div>
          )}
          
          {/* Attack Bonus Display */}
          {attackBonus !== undefined && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-background/50">
              <Swords className="w-4 h-4 text-red-400" />
              <span className="font-mono font-bold text-sm text-red-400">+{attackBonus}</span>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
