import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { 
  Menu, 
  RotateCcw, 
  Settings,
  Skull,
  Activity
} from 'lucide-react';

interface CombatTopBarProps {
  round: number;
  isYourTurn: boolean;
  lastAction: string;
  onResetTurn: () => void;
  onMenuOpen: () => void;
  onSettingsOpen: () => void;
}

export function CombatTopBar({
  round,
  isYourTurn,
  lastAction,
  onResetTurn,
  onMenuOpen,
  onSettingsOpen,
}: CombatTopBarProps) {
  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-background/95 backdrop-blur-sm border-b border-red-900/30 z-50 safe-area-top">
      <div className="flex items-center justify-between h-full px-4">
        {/* Left: Menu */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuOpen}
          className="h-10 w-10 border border-red-900/40"
        >
          <Menu className="h-5 w-5 text-red-400" />
        </Button>

        {/* Center: Round & Status */}
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-mono text-muted-foreground">Round</span>
            <span className="font-bold text-red-400">{round}</span>
            <span className="text-muted-foreground">|</span>
            <span className={cn(
              "font-semibold",
              isYourTurn ? "text-green-400" : "text-muted-foreground"
            )}>
              {isYourTurn ? "Your Turn" : "Waiting..."}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Activity className="w-3 h-3 text-red-500 animate-pulse" />
            <span className="truncate max-w-[150px]">{lastAction}</span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onResetTurn}
            className="h-10 w-10 border border-red-900/40"
          >
            <RotateCcw className="h-5 w-5 text-red-400" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onSettingsOpen}
            className="h-10 w-10 border border-muted/30"
          >
            <Settings className="h-5 w-5 text-muted-foreground" />
          </Button>
        </div>
      </div>
    </header>
  );
}
