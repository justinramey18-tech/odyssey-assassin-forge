import { useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  type AlignmentScore,
  ALIGNMENT_ZONES,
  getAlignmentZone,
} from '@/lib/alignmentSpectrum';
import { X } from 'lucide-react';

interface AlignmentRecommenderProps {
  value: AlignmentScore | null;
  onChange: (score: AlignmentScore | null) => void;
  compact?: boolean;
}

const GRID_SIZE = 160;

/** Convert alignment score (-5..+5) to pixel position on the grid */
function toPixel(score: AlignmentScore): { x: number; y: number } {
  return {
    x: ((score.law + 5) / 10) * GRID_SIZE,
    y: ((5 - score.good) / 10) * GRID_SIZE,
  };
}

/** Convert pixel position to alignment score */
function toScore(x: number, y: number): AlignmentScore {
  return {
    law: Math.round(((x / GRID_SIZE) * 10 - 5) * 2) / 2,
    good: Math.round(((1 - y / GRID_SIZE) * 10 - 5) * 2) / 2,
  };
}

// 3x3 zone grid, ordered top-left → bottom-right
const GRID_ZONES = [
  ['cg', 'ng', 'lg'],
  ['cn', 'tn', 'ln'],
  ['ce', 'ne', 'le'],
];

export function AlignmentRecommender({ value, onChange, compact }: AlignmentRecommenderProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);

  const handleGridClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, Math.min(GRID_SIZE, e.clientX - rect.left));
    const y = Math.max(0, Math.min(GRID_SIZE, e.clientY - rect.top));
    onChange(toScore(x, y));
  }, [onChange]);

  const activeZone = value ? getAlignmentZone(value) : null;
  const markerPos = value ? toPixel(value) : null;

  return (
    <div className={cn('flex flex-col items-center gap-2', compact && 'scale-90 origin-top')}>
      {/* Header */}
      <div className="flex items-center gap-2 w-full">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          Alignment Filter
        </span>
        {value && (
          <button
            onClick={() => onChange(null)}
            className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded border border-border/50"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      {/* Grid */}
      <div className="relative" style={{ width: GRID_SIZE, height: GRID_SIZE }}>
        <div
          ref={gridRef}
          className="grid grid-cols-3 grid-rows-3 w-full h-full cursor-crosshair rounded-lg overflow-hidden border border-border/30"
          onClick={handleGridClick}
        >
          {GRID_ZONES.flat().map(zoneId => {
            const zone = ALIGNMENT_ZONES.find(z => z.id === zoneId)!;
            const isActive = activeZone?.id === zoneId;
            const isHovered = hoveredZone === zoneId;

            return (
              <div
                key={zoneId}
                className={cn(
                  'flex items-center justify-center transition-all duration-200 border border-border/10',
                  isActive && 'ring-1 ring-inset ring-white/40',
                )}
                style={{
                  backgroundColor: isActive
                    ? `${zone.cssColor}4d`
                    : isHovered
                      ? `${zone.cssColor}26`
                      : 'hsla(0, 0%, 100%, 0.03)',
                }}
                onMouseEnter={() => setHoveredZone(zoneId)}
                onMouseLeave={() => setHoveredZone(null)}
              >
                <span className="text-[9px] font-medium text-center leading-tight opacity-60 select-none pointer-events-none">
                  {zone.shortLabel}
                </span>
              </div>
            );
          })}
        </div>

        {/* Marker */}
        {markerPos && (
          <motion.div
            className="absolute w-3.5 h-3.5 rounded-full border-2 border-white shadow-lg pointer-events-none"
            style={{
              backgroundColor: activeZone?.cssColor || 'white',
              boxShadow: `0 0 8px ${activeZone?.cssColor || 'white'}`,
            }}
            initial={{ scale: 0 }}
            animate={{
              scale: 1,
              left: markerPos.x - 7,
              top: markerPos.y - 7,
            }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          />
        )}

        {/* Axis labels */}
        <span className="absolute -bottom-4 left-0 text-[8px] text-muted-foreground/50">Chaotic</span>
        <span className="absolute -bottom-4 right-0 text-[8px] text-muted-foreground/50">Lawful</span>
        <span className="absolute -left-1 top-0 text-[8px] text-muted-foreground/50 -rotate-90 origin-top-left translate-y-full">Good</span>
        <span className="absolute -left-1 bottom-0 text-[8px] text-muted-foreground/50 -rotate-90 origin-bottom-left">Evil</span>
      </div>

      {/* Active zone label */}
      {activeZone && (
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{activeZone.emoji}</span>
          <span className="text-xs font-medium" style={{ color: activeZone.cssColor }}>
            {activeZone.label}
          </span>
        </div>
      )}
    </div>
  );
}
