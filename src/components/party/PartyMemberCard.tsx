import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Heart, Shield, Sparkles, ChevronDown, ChevronUp, Eye } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import type { PartyMember } from '@/hooks/use-party-sync';

interface PartyMemberCardProps {
  member: PartyMember;
  isSelf: boolean;
  onViewActions?: (member: PartyMember) => void;
}

export function PartyMemberCard({ member, isSelf, onViewActions }: PartyMemberCardProps) {
  const [showSlots, setShowSlots] = useState(false);
  const status = member.character_status;
  const currentHP = status.currentHP ?? 0;
  const maxHP = status.maxHP ?? 1;
  const tempHP = status.tempHP ?? 0;
  const ac = status.ac ?? 10;
  const hpPercent = Math.max(0, Math.min(100, (currentHP / maxHP) * 100));
  const conditions = status.conditions ?? [];
  const spellSlots = status.spellSlots ?? {};
  const hasSpellSlots = Object.keys(spellSlots).length > 0;
  const profileImage = status.profileImage;

  const isTappable = !isSelf && onViewActions;

  const handleCardClick = () => {
    if (isTappable) {
      onViewActions(member);
    }
  };

  return (
    <div
      className={cn(
        "p-3 rounded-lg border bg-card/60 backdrop-blur-sm space-y-2 transition-colors",
        isSelf ? "border-primary/40" : "border-border/40",
        isTappable && "cursor-pointer hover:bg-card/80 active:bg-card/90"
      )}
      onClick={handleCardClick}
    >
      {/* Name + Level + Class + Avatar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Avatar className="w-7 h-7">
            {profileImage ? (
              <AvatarImage src={profileImage} alt={member.character_name} />
            ) : null}
            <AvatarFallback className="text-[10px] font-bold bg-primary/20 text-primary">
              {member.character_name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="font-cinzel font-semibold text-sm truncate max-w-[120px]">
            {member.character_name}
          </span>
          {isSelf && (
            <span className="text-[9px] uppercase tracking-wider text-primary font-bold">You</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {status.className && (
            <span className="text-[10px] text-muted-foreground">{status.className}</span>
          )}
          {status.level && (
            <span className="text-[10px] text-muted-foreground">Lv.{status.level}</span>
          )}
          {isTappable && (
            <Eye className="w-3 h-3 text-muted-foreground/50" />
          )}
        </div>
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

      {/* Spell Slots - Compact Summary with Expand */}
      {hasSpellSlots && (
        <div className="space-y-1">
          <button
            onClick={(e) => { e.stopPropagation(); setShowSlots(!showSlots); }}
            className="flex items-center gap-1 w-full hover:bg-muted/10 rounded px-0.5 py-0.5 transition-colors"
          >
            <Sparkles className="w-3 h-3 text-purple-400" />
            <span className="text-[10px] text-muted-foreground">Spell Slots</span>
            {showSlots ? (
              <ChevronUp className="w-3 h-3 text-muted-foreground ml-auto" />
            ) : (
              <>
                <div className="flex gap-1 ml-1">
                  {Object.entries(spellSlots).slice(0, 5).map(([level, slots]) => (
                    <span key={level} className="text-[9px] text-muted-foreground">
                      L{level}:{slots.current}/{slots.max}
                    </span>
                  ))}
                </div>
                <ChevronDown className="w-3 h-3 text-muted-foreground ml-auto" />
              </>
            )}
          </button>

          {/* Expanded pip view */}
          {showSlots && (
            <div className="grid grid-cols-3 gap-1.5 pt-1">
              {Object.entries(spellSlots).map(([level, slots]) => (
                <div key={level} className="flex items-center gap-1">
                  <span className="text-[9px] text-muted-foreground w-5">L{level}</span>
                  <div className="flex gap-0.5">
                    {Array.from({ length: slots.max }).map((_, i) => (
                      <div
                        key={i}
                        className={cn(
                          "w-2 h-2 rounded-full border",
                          i < slots.current
                            ? "bg-purple-400 border-purple-500"
                            : "bg-muted/30 border-muted-foreground/20"
                        )}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
