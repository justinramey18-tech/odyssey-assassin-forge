import { useRef, useEffect } from 'react';
import { Swords, Shield, Heart, Sparkles, Skull, HeartCrack } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PartyCombatLogEntry {
  id: string;
  party_id: string;
  user_id: string;
  character_name: string;
  action_type: string;
  description: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface PartyCombatLogProps {
  entries: PartyCombatLogEntry[];
  currentUserId?: string;
}

const ACTION_CONFIG: Record<string, { icon: typeof Swords; color: string }> = {
  attack: { icon: Swords, color: 'text-orange-400' },
  damage_taken: { icon: Shield, color: 'text-red-400' },
  heal: { icon: Heart, color: 'text-emerald-400' },
  spell: { icon: Sparkles, color: 'text-purple-400' },
  kill: { icon: Skull, color: 'text-amber-400' },
  death_save: { icon: HeartCrack, color: 'text-red-500' },
};

export function PartyCombatLog({ entries, currentUserId }: PartyCombatLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries.length]);

  if (entries.length === 0) {
    return (
      <div className="text-center py-3">
        <Swords className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
        <p className="text-[10px] text-muted-foreground">No combat events yet</p>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="max-h-[200px] overflow-y-auto scrollbar-hide space-y-1">
      {entries.map((entry) => {
        const config = ACTION_CONFIG[entry.action_type] || ACTION_CONFIG.attack;
        const Icon = config.icon;
        const isSelf = entry.user_id === currentUserId;

        return (
          <div
            key={entry.id}
            className={cn(
              "flex items-start gap-2 px-2 py-1.5 rounded-md text-xs",
              isSelf ? "bg-primary/5 border border-primary/10" : "bg-muted/10 border border-border/10"
            )}
          >
            <Icon className={cn("w-3.5 h-3.5 shrink-0 mt-0.5", config.color)} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-1">
                <span className="font-medium truncate max-w-[100px]">{entry.character_name}</span>
                <span className="text-[9px] text-muted-foreground shrink-0">{getTimeAgo(entry.created_at)}</span>
              </div>
              <p className="text-foreground/70 break-words">{entry.description}</p>
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
