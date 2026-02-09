// Sorcery Points Display Component
// Shows current/max sorcery points with Font of Magic conversion buttons

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Flame, Zap, ArrowRightLeft, Plus, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { TrackedSpellSlots } from '@/hooks/use-class-spellcasting';
import { getSlotCreationCost, getPointsFromSlotLevel } from '@/lib/magic/sorceryPoints';

interface SorceryPointsTrackerProps {
  current: number;
  max: number;
  spellSlots: TrackedSpellSlots;
  /** Whether to show as compact inline display */
  compact?: boolean;
  /** Callback to use sorcery points */
  onUseSorceryPoints?: (amount: number, reason?: string) => boolean;
  /** Callback to restore sorcery points */
  onRestoreSorceryPoints?: (amount: number) => void;
  /** Convert a spell slot to sorcery points */
  onConvertSlotToPoints?: (slotLevel: number) => boolean;
  /** Create a spell slot using sorcery points */
  onCreateSlotFromPoints?: (slotLevel: number) => boolean;
}

export function SorceryPointsTracker({
  current,
  max,
  spellSlots,
  compact = false,
  onUseSorceryPoints,
  onRestoreSorceryPoints,
  onConvertSlotToPoints,
  onCreateSlotFromPoints,
}: SorceryPointsTrackerProps) {
  const [isConverting, setIsConverting] = useState(false);
  const percentage = max > 0 ? (current / max) * 100 : 0;

  // Determine color based on percentage
  const getColor = () => {
    if (percentage <= 25) return 'text-red-400 bg-red-500/20 border-red-500/50';
    if (percentage <= 50) return 'text-amber-400 bg-amber-500/20 border-amber-500/50';
    return 'text-red-400 bg-red-500/20 border-red-500/50';
  };

  // Get available slots for conversion
  const availableSlots = Object.entries(spellSlots)
    .filter(([_, slot]) => slot.current > 0)
    .map(([level]) => parseInt(level));

  // Compact display for header
  if (compact) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-red-600/20 border border-red-500/30 hover:bg-red-600/30 transition-colors">
            <Flame className="w-4 h-4 text-red-400" />
            <span className="text-sm font-bold text-red-400">{current}</span>
            <span className="text-xs text-muted-foreground">/{max}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-3 bg-background/95 border-red-500/30" align="start">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-cinzel text-muted-foreground">Sorcery Points</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-red-400"
                  onClick={() => onUseSorceryPoints?.(1)}
                  disabled={current <= 0}
                >
                  <Minus className="w-3 h-3" />
                </Button>
                <span className="text-lg font-bold text-red-400">{current}/{max}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-red-400"
                  onClick={() => onRestoreSorceryPoints?.(1)}
                  disabled={current >= max}
                >
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-300"
                style={{ width: `${percentage}%` }}
              />
            </div>

            {/* Font of Magic toggle */}
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground hover:text-violet-400"
              onClick={() => setIsConverting(!isConverting)}
            >
              <ArrowRightLeft className="w-3 h-3 mr-1" />
              Font of Magic
            </Button>

            {isConverting && (
              <FontOfMagicPanel
                current={current}
                max={max}
                spellSlots={spellSlots}
                onConvertSlotToPoints={onConvertSlotToPoints}
                onCreateSlotFromPoints={onCreateSlotFromPoints}
              />
            )}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  // Full card display
  return (
    <Card className={cn("bg-background/40 border", getColor())}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-red-400" />
            <span className="font-cinzel text-sm text-foreground">Sorcery Points</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400"
              onClick={() => onUseSorceryPoints?.(1)}
              disabled={current <= 0}
            >
              <Minus className="w-4 h-4" />
            </Button>
            <span className="text-2xl font-bold text-red-400">{current}</span>
            <span className="text-lg text-muted-foreground">/{max}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400"
              onClick={() => onRestoreSorceryPoints?.(1)}
              disabled={current >= max}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-3 bg-muted/30 rounded-full overflow-hidden mb-4">
          <div 
            className="h-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-300"
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Font of Magic Section */}
        <div className="border-t border-white/10 pt-3">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-between text-muted-foreground hover:text-violet-400"
            onClick={() => setIsConverting(!isConverting)}
          >
            <span className="flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4" />
              Font of Magic
            </span>
            <Zap className={cn("w-4 h-4 transition-transform", isConverting && "rotate-180")} />
          </Button>

          {isConverting && (
            <FontOfMagicPanel
              current={current}
              max={max}
              spellSlots={spellSlots}
              onConvertSlotToPoints={onConvertSlotToPoints}
              onCreateSlotFromPoints={onCreateSlotFromPoints}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Font of Magic conversion panel
interface FontOfMagicPanelProps {
  current: number;
  max: number;
  spellSlots: TrackedSpellSlots;
  onConvertSlotToPoints?: (slotLevel: number) => boolean;
  onCreateSlotFromPoints?: (slotLevel: number) => boolean;
}

function FontOfMagicPanel({
  current,
  max,
  spellSlots,
  onConvertSlotToPoints,
  onCreateSlotFromPoints,
}: FontOfMagicPanelProps) {
  const slotLevels = [1, 2, 3, 4, 5];

  return (
    <div className="mt-3 space-y-3 p-2 bg-muted/10 rounded-lg border border-white/5">
      {/* Convert Slot to Points */}
      <div>
        <p className="text-xs text-muted-foreground mb-2">
          Convert Slot → Points
        </p>
        <div className="flex flex-wrap gap-1">
          {slotLevels.map(level => {
            const slot = spellSlots[level];
            const hasSlot = slot && slot.current > 0;
            const pointsGained = getPointsFromSlotLevel(level);
            
            return (
              <Button
                key={`slot-to-points-${level}`}
                variant="ghost"
                size="sm"
                className={cn(
                  "h-8 px-2 text-xs",
                  hasSlot 
                    ? "text-violet-400 hover:bg-violet-500/20" 
                    : "text-muted-foreground opacity-50"
                )}
                onClick={() => onConvertSlotToPoints?.(level)}
                disabled={!hasSlot}
                title={`Convert level ${level} slot to ${pointsGained} sorcery point${pointsGained > 1 ? 's' : ''}`}
              >
                L{level} → +{pointsGained}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Create Slot from Points */}
      <div>
        <p className="text-xs text-muted-foreground mb-2">
          Points → Create Slot
        </p>
        <div className="flex flex-wrap gap-1">
          {slotLevels.map(level => {
            const cost = getSlotCreationCost(level);
            const canAfford = cost !== null && current >= cost;
            
            return (
              <Button
                key={`points-to-slot-${level}`}
                variant="ghost"
                size="sm"
                className={cn(
                  "h-8 px-2 text-xs",
                  canAfford 
                    ? "text-indigo-400 hover:bg-indigo-500/20" 
                    : "text-muted-foreground opacity-50"
                )}
                onClick={() => onCreateSlotFromPoints?.(level)}
                disabled={!canAfford}
                title={`Spend ${cost} sorcery points to create a level ${level} slot`}
              >
                -{cost} → L{level}
              </Button>
            );
          })}
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground italic">
        Slots created this way vanish at the end of a long rest if unused.
      </p>
    </div>
  );
}
