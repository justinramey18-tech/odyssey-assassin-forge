import { Dices } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PartyDiceRoll } from '@/hooks/use-party-sync';

interface PartyRollFeedProps {
  rolls: PartyDiceRoll[];
  currentUserId?: string;
}

export function PartyRollFeed({ rolls, currentUserId }: PartyRollFeedProps) {
  if (rolls.length === 0) {
    return (
      <div className="text-center py-3">
        <Dices className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
        <p className="text-[10px] text-muted-foreground">No shared rolls yet</p>
      </div>
    );
  }

  const recentRolls = rolls.slice(-10);

  return (
    <div className="space-y-1.5 max-h-[200px] overflow-y-auto scrollbar-hide">
      {recentRolls.map((roll) => {
        const isSelf = roll.user_id === currentUserId;
        const timeAgo = getTimeAgo(roll.created_at);

        return (
          <div
            key={roll.id}
            className={cn(
              "flex items-center justify-between px-2 py-1.5 rounded-md text-xs",
              isSelf ? "bg-primary/10 border border-primary/20" : "bg-muted/20 border border-border/20"
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Dices className="w-3 h-3 text-primary shrink-0" />
              <span className="font-medium truncate max-w-[80px]">{roll.roller_name}</span>
              <span className="text-muted-foreground truncate">{roll.roll_label}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="font-mono font-bold text-sm">{roll.roll_result}</span>
              <span className="text-[9px] text-muted-foreground">{timeAgo}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h`;
}
