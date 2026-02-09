// Natural Recovery Panel
// Circle of the Land Druid feature: recover spell slots during short rest
// Combined slot levels ≤ ceil(druidLevel / 2), no slots 6th+, once per long rest

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Leaf, Check, RotateCcw, Sparkles, Lock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrackedSpellSlots } from '@/hooks/use-class-spellcasting';

interface NaturalRecoveryPanelProps {
  druidLevel: number;
  spellSlots: TrackedSpellSlots;
  naturalRecoveryUsed: boolean;
  naturalRecoveryMax: number;
  onRecover: (slotLevels: number[]) => boolean;
}

export function NaturalRecoveryPanel({
  druidLevel,
  spellSlots,
  naturalRecoveryUsed,
  naturalRecoveryMax,
  onRecover,
}: NaturalRecoveryPanelProps) {
  const [selectedSlots, setSelectedSlots] = useState<number[]>([]);

  // Calculate which slot levels have missing slots (and are ≤ 5th)
  const recoverableSlots = useMemo(() => {
    const slots: { level: number; current: number; max: number; missing: number }[] = [];
    for (let level = 1; level <= 5; level++) {
      const slot = spellSlots[level];
      if (slot && slot.max > 0) {
        const missing = slot.max - slot.current;
        slots.push({ level, current: slot.current, max: slot.max, missing });
      }
    }
    return slots;
  }, [spellSlots]);

  const selectedTotal = selectedSlots.reduce((sum, l) => sum + l, 0);
  const remaining = naturalRecoveryMax - selectedTotal;
  const hasExpendedSlots = recoverableSlots.some(s => s.missing > 0);

  // Count how many of each level are selected
  const selectedCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const level of selectedSlots) {
      counts[level] = (counts[level] || 0) + 1;
    }
    return counts;
  }, [selectedSlots]);

  const canAddSlot = (level: number): boolean => {
    if (naturalRecoveryUsed) return false;
    if (level > remaining) return false;
    // Can't recover more than are missing
    const slot = spellSlots[level];
    if (!slot) return false;
    const missing = slot.max - slot.current;
    const alreadySelected = selectedCounts[level] ?? 0;
    return alreadySelected < missing;
  };

  const toggleSlot = (level: number) => {
    const alreadySelected = selectedCounts[level] ?? 0;
    
    if (alreadySelected > 0 && !canAddSlot(level)) {
      // Remove one of this level
      const idx = selectedSlots.lastIndexOf(level);
      if (idx >= 0) {
        setSelectedSlots(prev => [...prev.slice(0, idx), ...prev.slice(idx + 1)]);
      }
    } else if (canAddSlot(level)) {
      setSelectedSlots(prev => [...prev, level]);
    }
  };

  const removeSlot = (level: number) => {
    const idx = selectedSlots.lastIndexOf(level);
    if (idx >= 0) {
      setSelectedSlots(prev => [...prev.slice(0, idx), ...prev.slice(idx + 1)]);
    }
  };

  const handleRecover = () => {
    if (selectedSlots.length === 0) return;
    const success = onRecover(selectedSlots);
    if (success) {
      setSelectedSlots([]);
    }
  };

  if (druidLevel < 2) return null;

  return (
    <Card className={cn(
      "overflow-hidden transition-all",
      naturalRecoveryUsed
        ? "bg-background/30 border-white/5"
        : "bg-green-950/30 border-green-500/30"
    )}>
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <Leaf className={cn(
            "w-5 h-5",
            naturalRecoveryUsed ? "text-muted-foreground/50" : "text-green-400"
          )} />
          <h3 className="font-cinzel text-sm uppercase tracking-wider text-green-300">
            Natural Recovery
          </h3>
          <Badge
            variant="outline"
            className={cn(
              "ml-auto text-[10px] font-mono",
              naturalRecoveryUsed
                ? "border-muted-foreground/30 text-muted-foreground"
                : "border-green-500/50 text-green-400"
            )}
          >
            {naturalRecoveryUsed ? 'Used' : `${naturalRecoveryMax} levels`}
          </Badge>
        </div>

        {naturalRecoveryUsed ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Lock className="w-4 h-4" />
            <span>Already used. Recharges on long rest.</span>
          </div>
        ) : !hasExpendedSlots ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="w-4 h-4 text-green-400" />
            <span>All spell slots are full.</span>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground mb-3">
              During a short rest, recover spell slots with combined levels ≤ {naturalRecoveryMax}. Tap slots to select.
            </p>

            {/* Slot Level Buttons */}
            <div className="grid grid-cols-5 gap-2 mb-3">
              {recoverableSlots.map(({ level, current, max, missing }) => {
                const count = selectedCounts[level] ?? 0;
                const canAdd = canAddSlot(level);
                const isSelected = count > 0;

                return (
                  <button
                    key={level}
                    onClick={() => {
                      if (isSelected && !canAdd) {
                        removeSlot(level);
                      } else if (canAdd) {
                        toggleSlot(level);
                      } else if (isSelected) {
                        removeSlot(level);
                      }
                    }}
                    disabled={missing === 0}
                    className={cn(
                      "relative p-2 rounded-lg border text-center transition-all",
                      missing === 0
                        ? "border-white/5 bg-background/20 opacity-40"
                        : isSelected
                          ? "border-green-500/60 bg-green-500/20"
                          : canAdd
                            ? "border-white/20 bg-background/30 hover:border-green-500/40"
                            : "border-white/10 bg-background/20 opacity-60"
                    )}
                  >
                    <div className="text-xs text-muted-foreground">Lv {level}</div>
                    <div className={cn(
                      "text-sm font-bold",
                      isSelected ? "text-green-400" : "text-foreground/70"
                    )}>
                      {current}/{max}
                    </div>
                    {missing > 0 && (
                      <div className="text-[9px] text-amber-400/70">{missing} empty</div>
                    )}
                    {isSelected && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                        {count > 1 ? (
                          <span className="text-[9px] font-bold text-white">{count}</span>
                        ) : (
                          <Check className="w-2.5 h-2.5 text-white" />
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Selection Summary */}
            {selectedSlots.length > 0 && (
              <div className="flex items-center gap-2 mb-3 p-2 rounded-lg bg-green-600/15 border border-green-500/20">
                <RotateCcw className="w-3.5 h-3.5 text-green-400" />
                <span className="text-xs text-green-300 flex-1">
                  Recovering {selectedSlots.length} slot{selectedSlots.length > 1 ? 's' : ''} ({selectedTotal}/{naturalRecoveryMax} levels used)
                </span>
                <Badge variant="outline" className="text-[9px] border-green-500/30 text-green-400">
                  {remaining} remaining
                </Badge>
              </div>
            )}

            {/* Recover Button */}
            <Button
              onClick={handleRecover}
              disabled={selectedSlots.length === 0}
              className={cn(
                "w-full",
                selectedSlots.length > 0
                  ? "bg-green-600 hover:bg-green-500 text-white"
                  : ""
              )}
              variant={selectedSlots.length === 0 ? "outline" : "default"}
            >
              <Leaf className="w-4 h-4 mr-2" />
              {selectedSlots.length === 0
                ? 'Select Slots to Recover'
                : `Recover ${selectedSlots.length} Slot${selectedSlots.length > 1 ? 's' : ''}`}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
