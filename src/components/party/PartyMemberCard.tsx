import { cn } from '@/lib/utils';
import { Heart, Shield, Sparkles } from 'lucide-react';
import type { PartyMember } from '@/hooks/use-party-sync';

interface PartyMemberCardProps {
  member: PartyMember;
  isSelf: boolean;
}

export function PartyMemberCard({ member, isSelf }: PartyMemberCardProps) {
  const status = member.character_status;
  const currentHP = status.currentHP ?? 0;
  const maxHP = status.maxHP ?? 1;
  const tempHP = status.tempHP ?? 0;
  const ac = status.ac ?? 10;
  const hpPercent = Math.max(0, Math.min(100, (currentHP / maxHP) * 100));
  const conditions = status.conditions ?? [];

  return (
    <div className={cn(
      "p-3 rounded-lg border bg-card/60 backdrop-blur-sm space-y-2",
      isSelf ? "border-primary/40" : "border-border/40"
    )}>
      {/* Name + Level */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-cinzel font-semibold text-sm truncate max-w-[140px]">
            {member.character_name}
          </span>
          {isSelf && (
            <span className="text-[9px] uppercase tracking-wider text-primary font-bold">You</span>
          )}
        </div>
        {status.level && (
          <span className="text-[10px] text-muted-foreground">Lv.{status.level}</span>
        )}
      </div>

      {/* HP Bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px]">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Heart className="w-3 h-3 text-red-400" />
            <span>{currentHP}{tempHP > 0 ? `+${tempHP}` : ''}/{maxHP}</span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Shield className="w-3 h-3 text-sky-400" />
            <span>{ac}</span>
          </div>
        </div>
        <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              hpPercent > 50 ? "bg-emerald-500" :
              hpPercent > 25 ? "bg-amber-500" :
              "bg-red-500"
            )}
            style={{ width: `${hpPercent}%` }}
          />
        </div>
      </div>

      {/* Conditions */}
      {conditions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {conditions.map(c => (
            <span key={c} className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {c}
            </span>
          ))}
        </div>
      )}

      {/* Spell Slots Summary */}
      {status.spellSlots && Object.keys(status.spellSlots).length > 0 && (
        <div className="flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-purple-400" />
          <div className="flex gap-1">
            {Object.entries(status.spellSlots).slice(0, 5).map(([level, slots]) => (
              <span key={level} className="text-[9px] text-muted-foreground">
                L{level}:{slots.current}/{slots.max}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
