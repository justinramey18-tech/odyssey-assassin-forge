import { cn } from '@/lib/utils';

interface SignetIntensitySelectorProps {
  currentBurnout: number;
  maxBurnout: number;
  selected: number | null;
  onSelect: (intensity: number) => void;
  onCancel: () => void;
}

export function SignetIntensitySelector({
  currentBurnout,
  maxBurnout,
  selected,
  onSelect,
  onCancel,
}: SignetIntensitySelectorProps) {
  const maxSelectable = Math.max(0, maxBurnout - currentBurnout);

  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-cinzel text-amber-200">Signet Intensity</span>
        <button
          onClick={onCancel}
          className="text-[10px] text-muted-foreground hover:text-amber-300"
          style={{ touchAction: 'manipulation' }}
        >
          Cancel
        </button>
      </div>
      <p className="text-[10px] text-muted-foreground leading-relaxed">
        Burnout {currentBurnout}/{maxBurnout}. Higher intensity = stronger signet, more burnout.{' '}
        {maxSelectable === 0
          ? 'You are too burned out to channel.'
          : `You can channel up to ${maxSelectable}.`}
      </p>
      <div className="grid grid-cols-8 gap-1">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => {
          const disabled = n > maxSelectable;
          const isCatastrophic = currentBurnout + n >= maxBurnout;
          return (
            <button
              key={n}
              disabled={disabled}
              onClick={() => onSelect(n)}
              className={cn(
                'h-9 rounded text-xs font-bold transition-colors',
                disabled
                  ? 'bg-white/5 text-white/20 cursor-not-allowed'
                  : selected === n
                  ? 'bg-amber-500 text-amber-950'
                  : isCatastrophic
                  ? 'bg-red-600/30 text-red-200 hover:bg-red-600/50 border border-red-500/40'
                  : 'bg-amber-500/15 text-amber-200 hover:bg-amber-500/30',
              )}
              style={{ touchAction: 'manipulation' }}
            >
              {n}
            </button>
          );
        })}
      </div>
      {selected != null && currentBurnout + selected >= maxBurnout && (
        <p className="text-[10px] text-red-300 font-semibold">
          ⚠️ This will push you to CATASTROPHIC burnout.
        </p>
      )}
    </div>
  );
}
