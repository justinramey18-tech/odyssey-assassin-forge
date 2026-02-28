import { useState } from 'react';
import { X, Compass } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type AlignmentScore, getAlignmentZone } from '@/lib/alignmentSpectrum';

interface AlignmentBannerProps {
  alignmentTarget: AlignmentScore | null;
  onApply: (target: AlignmentScore) => void;
  onDismiss: () => void;
  className?: string;
}

/**
 * Dismissible banner suggesting alignment-based prompt highlighting
 * when the user has an active alignment drift.
 */
export function AlignmentBanner({ alignmentTarget, onApply, onDismiss, className }: AlignmentBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || !alignmentTarget) return null;

  const zone = getAlignmentZone(alignmentTarget);

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-xs',
        className,
      )}
      style={{
        backgroundColor: `${zone.color.replace(')', ', 0.1)').replace('hsl', 'hsla')}`,
        borderColor: `${zone.color.replace(')', ', 0.3)').replace('hsl', 'hsla')}`,
      }}
    >
      <Compass className="w-4 h-4 shrink-0" style={{ color: zone.color }} />
      <span className="flex-1 min-w-0">
        <span className="text-muted-foreground">Your drift is </span>
        <span className="font-medium" style={{ color: zone.color }}>{zone.label}</span>
        <span className="text-muted-foreground"> — tap to highlight matching prompts</span>
      </span>
      <button
        onClick={() => onApply(alignmentTarget)}
        className="shrink-0 px-2 py-1 rounded text-[10px] font-medium border transition-colors min-h-[28px]"
        style={{
          borderColor: zone.color,
          color: zone.color,
        }}
      >
        Apply
      </button>
      <button
        onClick={() => { setDismissed(true); onDismiss(); }}
        className="shrink-0 p-1 rounded hover:bg-white/10 transition-colors"
      >
        <X className="w-3.5 h-3.5 text-muted-foreground" />
      </button>
    </div>
  );
}
