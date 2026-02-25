import { useState, useCallback } from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { Gauge } from 'lucide-react';
import { cn } from '@/lib/utils';
import { loadNarrationSpeed, saveNarrationSpeed } from '@/lib/tts-utils';

const PRESETS = [
  { label: '0.75x', value: 0.75 },
  { label: '1x', value: 1.0 },
  { label: '1.25x', value: 1.25 },
  { label: '1.5x', value: 1.5 },
  { label: '2x', value: 2.0 },
];

interface NarrationSpeedPopoverProps {
  /** Icon size class, e.g. "w-4 h-4" or "w-5 h-5" */
  iconSize?: string;
}

export function NarrationSpeedPopover({ iconSize = 'w-4 h-4' }: NarrationSpeedPopoverProps) {
  const [speed, setSpeed] = useState(() => loadNarrationSpeed());

  const update = useCallback((value: number) => {
    const rounded = Math.round(value * 10) / 10;
    setSpeed(rounded);
    saveNarrationSpeed(rounded);
  }, []);

  const isDefault = speed === 1.0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "p-2 rounded-xl border shrink-0 transition-colors",
            "bg-white/5 border-white/10 hover:border-amber-500/30 hover:bg-amber-900/20",
            !isDefault && "border-amber-500/20"
          )}
          style={{ touchAction: 'manipulation' }}
          title={`Narration speed: ${speed.toFixed(1)}x`}
        >
          <div className="relative">
            <Gauge className={cn(iconSize, "text-white/50")} />
            {!isDefault && (
              <span className="absolute -top-1.5 -right-2 text-[8px] font-bold text-amber-400">
                {speed}x
              </span>
            )}
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="center"
        className="w-52 p-3 bg-[hsl(var(--card))] border-white/10"
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Speed</span>
            <span className="text-xs font-mono text-foreground">{speed.toFixed(1)}x</span>
          </div>

          {/* Preset buttons */}
          <div className="flex gap-1">
            {PRESETS.map(p => (
              <button
                key={p.value}
                onClick={() => update(p.value)}
                className={cn(
                  "flex-1 text-[10px] py-1 rounded-md border transition-colors font-mono",
                  speed === p.value
                    ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                    : "bg-white/5 border-white/10 text-muted-foreground hover:border-amber-500/30"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Fine-tune slider */}
          <Slider
            min={0.5}
            max={2.0}
            step={0.05}
            value={[speed]}
            onValueChange={([v]) => update(v)}
            className="w-full"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
