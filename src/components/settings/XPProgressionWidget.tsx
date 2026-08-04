import { useState, useEffect } from 'react';
import { getScopedItem, setScopedItem } from '@/lib/scoped-storage';
import { Zap, Snail, Gauge, Flag, Hash } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';

export type XPProgressionMode = 'slow' | 'natural' | 'fast' | 'milestone';

interface XPProgressionConfig {
  mode: XPProgressionMode;
  multiplier: number;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const XP_PROGRESSION_MODES: Record<XPProgressionMode, XPProgressionConfig> = {
  slow: {
    mode: 'slow',
    multiplier: 2.0,
    label: 'Slow',
    description: 'Double XP requirements for a longer journey',
    icon: <Snail className="w-4 h-4" />,
  },
  natural: {
    mode: 'natural',
    multiplier: 1.0,
    label: 'Natural',
    description: 'Standard D&D 5e XP progression',
    icon: <Gauge className="w-4 h-4" />,
  },
  fast: {
    mode: 'fast',
    multiplier: 0.5,
    label: 'Fast Track',
    description: 'Halved XP requirements for faster leveling',
    icon: <Zap className="w-4 h-4" />,
  },
  milestone: {
    mode: 'milestone',
    multiplier: 0,
    label: 'Milestone',
    description: 'No XP numbers — advance a level when the story earns it',
    icon: <Flag className="w-4 h-4" />,
  },
};

const STORAGE_KEY = 'odyssey-xp-progression';

const VALID_MODES: XPProgressionMode[] = ['slow', 'natural', 'fast', 'milestone'];

export function loadXPProgressionMode(): XPProgressionMode {
  try {
    const stored = getScopedItem(STORAGE_KEY);
    if (stored && VALID_MODES.includes(stored as XPProgressionMode)) {
      return stored as XPProgressionMode;
    }
  } catch (e) {
    console.error('Failed to load XP progression mode:', e);
  }
  return 'natural';
}


export function saveXPProgressionMode(mode: XPProgressionMode): void {
  try {
    setScopedItem(STORAGE_KEY, mode);
    window.dispatchEvent(new CustomEvent('odyssey-xp-progression-change', { detail: mode }));
  } catch (e) {
    console.error('Failed to save XP progression mode:', e);
  }
}

export function getXPMultiplier(mode: XPProgressionMode): number {
  return XP_PROGRESSION_MODES[mode].multiplier;
}

interface XPProgressionWidgetProps {
  value?: XPProgressionMode;
  onChange?: (mode: XPProgressionMode) => void;
}

export function XPProgressionWidget({ value, onChange }: XPProgressionWidgetProps) {
  const [mode, setMode] = useState<XPProgressionMode>(() => value ?? loadXPProgressionMode());

  useEffect(() => {
    if (value !== undefined) {
      setMode(value);
    }
  }, [value]);

  const handleChange = (newMode: XPProgressionMode) => {
    setMode(newMode);
    saveXPProgressionMode(newMode);
    onChange?.(newMode);
  };

  const isMilestone = mode === 'milestone';
  const [lastSpeed, setLastSpeed] = useState<XPProgressionMode>(
    mode === 'milestone' ? 'natural' : mode
  );

  useEffect(() => {
    if (mode !== 'milestone') setLastSpeed(mode);
  }, [mode]);

  return (
    <div className="space-y-3" data-tutorial-id="xp-progression-widget">
      <div className="flex items-center gap-2">
        <Gauge className="w-4 h-4 text-primary" />
        <Label className="text-sm font-display uppercase tracking-wider">
          Progression Tracking
        </Label>
      </div>

      <p className="text-xs text-muted-foreground">
        Choose whether levels come from tracked XP numbers or story milestones.
      </p>

      {/* Tracking style */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => handleChange(lastSpeed)}
          className={cn(
            "flex flex-col items-start gap-1 p-3 rounded-lg border text-left transition-all min-h-[48px]",
            !isMilestone
              ? "border-primary bg-primary/10"
              : "border-border/50 bg-card/50 hover:bg-card/80"
          )}
        >
          <span className={cn("flex items-center gap-2", !isMilestone ? "text-primary" : "text-muted-foreground")}>
            <Hash className="w-4 h-4" />
            <span className="font-display text-sm uppercase tracking-wider">XP</span>
          </span>
          <span className="text-xs text-muted-foreground">Track XP numbers and auto-level</span>
        </button>

        <button
          type="button"
          onClick={() => handleChange('milestone')}
          className={cn(
            "flex flex-col items-start gap-1 p-3 rounded-lg border text-left transition-all min-h-[48px]",
            isMilestone
              ? "border-primary bg-primary/10"
              : "border-border/50 bg-card/50 hover:bg-card/80"
          )}
        >
          <span className={cn("flex items-center gap-2", isMilestone ? "text-primary" : "text-muted-foreground")}>
            <Flag className="w-4 h-4" />
            <span className="font-display text-sm uppercase tracking-wider">Milestone</span>
          </span>
          <span className="text-xs text-muted-foreground">No numbers — level up by story beats</span>
        </button>
      </div>

      {!isMilestone && (
        <RadioGroup
          value={mode}
          onValueChange={(val) => handleChange(val as XPProgressionMode)}
          className="grid gap-2"
        >
          {(['slow', 'natural', 'fast'] as XPProgressionMode[]).map((modeKey) => {
            const config = XP_PROGRESSION_MODES[modeKey];
            const isSelected = mode === modeKey;

            return (
              <Label
                key={modeKey}
                htmlFor={`xp-${modeKey}`}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                  isSelected
                    ? "border-primary bg-primary/10"
                    : "border-border/50 bg-card/50 hover:bg-card/80"
                )}
              >
                <RadioGroupItem value={modeKey} id={`xp-${modeKey}`} className="mt-0.5" />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "transition-colors",
                      isSelected ? "text-primary" : "text-muted-foreground"
                    )}>
                      {config.icon}
                    </span>
                    <span className={cn(
                      "font-display text-sm uppercase tracking-wider",
                      isSelected ? "text-primary" : "text-foreground"
                    )}>
                      {config.label}
                    </span>
                    <span className={cn(
                      "text-xs px-1.5 py-0.5 rounded",
                      isSelected 
                        ? "bg-primary/20 text-primary" 
                        : "bg-muted text-muted-foreground"
                    )}>
                      {config.multiplier === 1 ? '1×' : config.multiplier < 1 ? '0.5×' : '2×'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {config.description}
                  </p>
                </div>
              </Label>
            );
          })}
        </RadioGroup>
      )}

      <div className="text-xs text-muted-foreground pt-2 border-t border-border/30">
        <p className="flex items-center gap-1">
          <span className="font-medium">Current:</span>
          {mode === 'slow' && 'Requires 2× XP to level up'}
          {mode === 'natural' && 'Standard XP requirements'}
          {mode === 'fast' && 'Requires 0.5× XP to level up'}
          {mode === 'milestone' && 'XP hidden — advance levels manually'}
        </p>
      </div>

    </div>
  );
}
