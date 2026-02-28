import { cn } from '@/lib/utils';
import { useAlignmentDrift } from '@/hooks/useAlignmentDrift';
import { type AlignmentScore, ALIGNMENT_ZONES, getAlignmentZone } from '@/lib/alignmentSpectrum';

interface AlignmentDriftIndicatorProps {
  declaredAlignment?: AlignmentScore | null;
  className?: string;
}

const SIZE = 80;

function toPixel(score: AlignmentScore) {
  return {
    x: ((score.law + 5) / 10) * SIZE,
    y: ((5 - score.good) / 10) * SIZE,
  };
}

export function AlignmentDriftIndicator({ declaredAlignment, className }: AlignmentDriftIndicatorProps) {
  const { driftPosition, driftZone, historyCount } = useAlignmentDrift();

  if (historyCount === 0) return null;

  const driftPx = toPixel(driftPosition);
  const declaredPx = declaredAlignment ? toPixel(declaredAlignment) : null;

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {/* Mini grid */}
      <div className="relative shrink-0 rounded-md overflow-hidden border border-border/30" style={{ width: SIZE, height: SIZE }}>
        {/* Background zones */}
        <div className="grid grid-cols-3 grid-rows-3 w-full h-full">
          {['cg','ng','lg','cn','tn','ln','ce','ne','le'].map(id => {
            const zone = ALIGNMENT_ZONES.find(z => z.id === id)!;
            return (
              <div
                key={id}
                className="border border-border/5"
                style={{
                  backgroundColor: `${zone.color.replace(')', ', 0.08)').replace('hsl', 'hsla')}`,
                }}
              />
            );
          })}
        </div>

        {/* Declared alignment marker */}
        {declaredPx && (
          <div
            className="absolute w-2 h-2 rounded-full border border-white/50 bg-white/30"
            style={{ left: declaredPx.x - 4, top: declaredPx.y - 4 }}
          />
        )}

        {/* Drift marker */}
        <div
          className="absolute w-2.5 h-2.5 rounded-full border-2 border-white"
          style={{
            left: driftPx.x - 5,
            top: driftPx.y - 5,
            backgroundColor: driftZone.color,
            boxShadow: `0 0 6px ${driftZone.color}`,
          }}
        />
      </div>

      {/* Label */}
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Alignment Drift</p>
        <p className="text-xs font-medium flex items-center gap-1">
          <span>{driftZone.emoji}</span>
          <span style={{ color: driftZone.color }}>{driftZone.label}</span>
        </p>
        <p className="text-[10px] text-muted-foreground">
          Based on {historyCount} prompt{historyCount !== 1 ? 's' : ''} used
        </p>
      </div>
    </div>
  );
}
