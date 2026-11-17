// Signet Strain meter for the solo Empyrean story screen: a forged ember gauge with a
// segment per strain point, a danger notch at 75%, and −/+ controls with 48px tap areas.
// The − control shows only when a handler is given (solo Empyrean gives none: strain comes down by
// grounding, rests and the after-reply cool-down).
import { Flame, Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  level: number;
  max: number;
  label?: string;
  onDown?: () => void;
  onUp: () => void;
  compact?: boolean;
}

function tone(ratio: number) {
  if (ratio <= 0) return 'calm';
  if (ratio < 0.4) return 'warm';
  if (ratio < 0.75) return 'hot';
  return 'critical';
}

export function StrainMeter({ level, max, label, onDown, onUp, compact = false }: Props) {
  const safeMax = Number.isFinite(max) && max > 0 ? max : 1;
  const safeLevel = Number.isFinite(level) ? Math.max(0, Math.min(safeMax, level)) : 0;
  const ratio = safeLevel / safeMax;
  const t = tone(ratio);
  return (
    <div className={cn('flex items-center', compact ? 'gap-0' : 'gap-1')} title={label} data-tone={t}>
      {onDown && (
        <button type="button" onClick={onDown} disabled={safeLevel <= 0} aria-label="Lower Signet Strain"
          className="empyrean-meter-step" style={{ touchAction: 'manipulation' }}>
          <span><Minus className="w-3 h-3" /></span>
        </button>
      )}
      <div className={cn('empyrean-strain-gauge', `is-${t}`, compact ? 'w-[92px]' : 'w-[132px]')}
        role="meter" aria-valuemin={0} aria-valuemax={safeMax} aria-valuenow={safeLevel} aria-label={`Signet Strain ${safeLevel} of ${safeMax}`}>
        <Flame className="empyrean-strain-icon" />
        <div className="empyrean-strain-track">
          {Array.from({ length: safeMax }, (_, i) => (
            <span key={i} className={cn('empyrean-strain-seg', i < safeLevel && 'is-lit')} />
          ))}
          <span className="empyrean-strain-notch" style={{ left: '75%' }} />
        </div>
        <span className="empyrean-strain-count">{safeLevel}/{safeMax}</span>
      </div>
      <button type="button" onClick={onUp} disabled={safeLevel >= safeMax} aria-label="Raise Signet Strain"
        className="empyrean-meter-step" style={{ touchAction: 'manipulation' }}>
        <span><Plus className="w-3 h-3" /></span>
      </button>
    </div>
  );
}
