import { cn } from '@/lib/utils';
import { SpellSlotLevel, PactSlots } from '@/lib/magic/types';
import { getSpellLevelLabel } from '@/lib/magic/spells';
import { Zap } from 'lucide-react';

interface SpellSlotTrackerProps {
  spellSlots: Record<number, SpellSlotLevel>;
  pactSlots?: PactSlots;
  onUseSlot?: (level: number) => void;
  onRestoreSlot?: (level: number) => void;
  onUsePactSlot?: () => void;
  onRestorePactSlot?: () => void;
  compact?: boolean;
}

export function SpellSlotTracker({
  spellSlots,
  pactSlots,
  onUseSlot,
  onRestoreSlot,
  onUsePactSlot,
  onRestorePactSlot,
  compact = false,
}: SpellSlotTrackerProps) {
  const slotLevels = Object.keys(spellSlots)
    .map(Number)
    .sort((a, b) => a - b);

  if (slotLevels.length === 0 && !pactSlots) {
    return (
      <div className="text-center py-4 text-muted-foreground text-sm">
        No spell slots available yet
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-3 flex-wrap">
        {slotLevels.map((level) => {
          const slot = spellSlots[level];
          return (
            <div key={level} className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground font-mono">
                {getSpellLevelLabel(level)}:
              </span>
              <div className="flex gap-0.5">
                {Array.from({ length: slot.max }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "w-2.5 h-2.5 rounded-full transition-all",
                      i < slot.current
                        ? "bg-indigo-400 shadow-[0_0_6px_2px_rgba(129,140,248,0.4)]"
                        : "bg-muted/40 border border-white/10"
                    )}
                  />
                ))}
              </div>
            </div>
          );
        })}
        {pactSlots && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-violet-400 font-mono">
              Pact:
            </span>
            <div className="flex gap-0.5">
              {Array.from({ length: pactSlots.max }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "w-2.5 h-2.5 rounded-full transition-all",
                    i < pactSlots.current
                      ? "bg-violet-500 shadow-[0_0_6px_2px_rgba(139,92,246,0.4)]"
                      : "bg-muted/40 border border-white/10"
                  )}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Regular Spell Slots */}
      {slotLevels.map((level) => {
        const slot = spellSlots[level];
        return (
          <div key={level} className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {getSpellLevelLabel(level)} Level
              </span>
              <span className="text-xs text-muted-foreground">
                {slot.current} / {slot.max}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {Array.from({ length: slot.max }).map((_, i) => {
                const isAvailable = i < slot.current;
                return (
                  <button
                    key={i}
                    onClick={() => {
                      if (isAvailable && onUseSlot) {
                        onUseSlot(level);
                      } else if (!isAvailable && onRestoreSlot) {
                        onRestoreSlot(level);
                      }
                    }}
                    className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                      "border-2",
                      isAvailable
                        ? "bg-gradient-to-br from-indigo-500 to-indigo-700 border-indigo-400 shadow-[0_0_12px_4px_rgba(129,140,248,0.3)]"
                        : "bg-muted/20 border-muted/30 hover:border-muted/50"
                    )}
                  >
                    {isAvailable && (
                      <Zap className="w-4 h-4 text-white" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Pact Slots (Warlock) */}
      {pactSlots && (
        <div className="space-y-2 pt-2 border-t border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-violet-300">
              Pact Slots (Level {pactSlots.level})
            </span>
            <span className="text-xs text-muted-foreground">
              {pactSlots.current} / {pactSlots.max}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {Array.from({ length: pactSlots.max }).map((_, i) => {
              const isAvailable = i < pactSlots.current;
              return (
                <button
                  key={i}
                  onClick={() => {
                    if (isAvailable && onUsePactSlot) {
                      onUsePactSlot();
                    } else if (!isAvailable && onRestorePactSlot) {
                      onRestorePactSlot();
                    }
                  }}
                  className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                    "border-2",
                    isAvailable
                      ? "bg-gradient-to-br from-violet-500 to-purple-700 border-violet-400 shadow-[0_0_12px_4px_rgba(139,92,246,0.3)]"
                      : "bg-muted/20 border-muted/30 hover:border-muted/50"
                  )}
                >
                  {isAvailable && (
                    <Zap className="w-4 h-4 text-white" />
                  )}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground">
            Pact slots recharge on a short rest
          </p>
        </div>
      )}
    </div>
  );
}
