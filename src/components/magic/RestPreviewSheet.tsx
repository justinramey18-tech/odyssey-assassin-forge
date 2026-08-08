import { useMemo } from 'react';
import { Moon, Sun, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { previewRest } from '@/lib/magic/castBus';

export interface RestPreviewSheetProps {
  type: 'short' | 'long' | null;
  onClose: () => void;
  onConfirm: (type: 'short' | 'long') => void;
  /** Extra recovery lines from outside the magic system (HP, abilities, uses). */
  extraLines?: Array<{ label: string; detail: string }>;
}

/**
 * Strict 5e recovery: nothing comes back until the player confirms, and they
 * see exactly what they're getting first.
 */
export function RestPreviewSheet({ type, onClose, onConfirm, extraLines = [] }: RestPreviewSheetProps) {
  const lines = useMemo(() => (type ? [...previewRest(type), ...extraLines] : []), [type, extraLines]);

  if (!type) return null;

  const isLong = type === 'long';
  const Icon = isLong ? Sun : Moon;

  return (
    <div className="fixed inset-0 z-[86] flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-t-2xl border-t border-x border-amber-400/25 bg-[#0b0a12] p-4 pb-8 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Icon className="w-4 h-4 text-amber-300/80 shrink-0" />
            <h3 className="font-cinzel text-base text-amber-100">{isLong ? 'Long Rest' : 'Short Rest'}</h3>
          </div>
          <button onClick={onClose} className="p-2 -m-2 text-white/40" style={{ touchAction: 'manipulation' }} aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-[11px] text-white/45">
          {isLong
            ? 'Eight hours. All spell slots return, active spells and concentration end.'
            : 'One hour. Only short-rest resources return — spell slots do not.'}
        </p>

        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 space-y-2">
          {lines.length === 0 ? (
            <p className="text-xs text-white/40">Nothing to recover — you are already at full strength for this rest.</p>
          ) : (
            lines.map((l, i) => (
              <div key={`${l.label}-${i}`} className="flex items-start justify-between gap-3 text-xs">
                <span className="text-white/45 shrink-0">{l.label}</span>
                <span className="text-white/80 text-right">{l.detail}</span>
              </div>
            ))
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 min-h-[48px]" onClick={onClose} style={{ touchAction: 'manipulation' }}>
            Cancel
          </Button>
          <Button
            className="flex-1 min-h-[48px]"
            onClick={() => { onConfirm(type); onClose(); }}
            style={{ touchAction: 'manipulation' }}
          >
            Take {isLong ? 'long' : 'short'} rest
          </Button>
        </div>
      </div>
    </div>
  );
}
