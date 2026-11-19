import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface SignetIntensitySelectorProps {
  currentBurnout: number;
  maxBurnout: number;
  selected: number | null;
  onSelect: (intensity: number) => void;
  onCancel: () => void;
  /** Lifeblood (solo Empyrean progression web): HP per point of strain over the limit. 0 or absent: a channel cannot pass the limit. */
  bloodPrice?: number;
  /** The rider's HP now, so a channel that would take the last of it stays locked. */
  currentHP?: number;
}

export function SignetIntensitySelector({
  currentBurnout,
  maxBurnout,
  selected,
  onSelect,
  onCancel,
  bloodPrice = 0,
  currentHP = 0,
}: SignetIntensitySelectorProps) {
  const maxSelectable = Math.max(0, maxBurnout - currentBurnout);
  // Lifeblood: what a channel bigger than the room left would cost in HP (null: it cannot be paid).
  const bloodFor = (n: number): number | null => (n <= maxSelectable ? 0 : bloodPrice > 0 && maxSelectable > 0 && (n - maxSelectable) * bloodPrice < currentHP ? (n - maxSelectable) * bloodPrice : null);

  return (
    <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-cinzel text-primary">Signet Intensity</span>
        <Button
          variant="ghost"
          onClick={onCancel}
          className="text-[10px] text-muted-foreground hover:text-primary"
          style={{ touchAction: 'manipulation' }}
        >
          Cancel
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground leading-relaxed">
        Burnout {currentBurnout}/{maxBurnout}. Higher intensity = stronger signet, more burnout.{' '}
        {maxSelectable === 0
          ? 'You are too burned out to channel.'
          : `You can channel up to ${maxSelectable}.`}
        {bloodPrice > 0 && maxSelectable > 0 ? ` Past that, each point costs up to ${bloodPrice} HP in blood.` : ''}
      </p>
      <div className="grid grid-cols-8 gap-1">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => {
          const disabled = bloodFor(n) === null;
          const paid = bloodFor(n) ?? 0;
          const isCatastrophic = currentBurnout + n >= maxBurnout;
          return (
            <Button
              variant="ghost"
              key={n}
              disabled={disabled}
              onClick={() => onSelect(n)}
              className={cn(
                'h-9 rounded text-xs font-bold transition-colors flex-col px-0 gap-0',
                disabled
                  ? 'bg-muted/5 text-muted-foreground/20 cursor-not-allowed'
                  : selected === n
                  ? 'bg-primary text-primary-foreground'
                  : isCatastrophic
                  ? 'bg-destructive/30 text-destructive hover:bg-destructive/50 border border-destructive/40'
                  : 'bg-primary/15 text-primary hover:bg-primary/30',
              )}
              style={{ touchAction: 'manipulation' }}
            >
              {n}
              {paid > 0 && <span className="block text-[8px] leading-none font-normal text-destructive">-{paid}</span>}
            </Button>
          );
        })}
      </div>
      {selected != null && (bloodFor(selected) ?? 0) > 0 && (
        <p className="text-[10px] text-destructive font-semibold">
          This channel is paid partly in blood: up to {bloodFor(selected)} HP.
        </p>
      )}
      {selected != null && currentBurnout + selected >= maxBurnout && (
        <p className="text-[10px] text-destructive font-semibold">
          ⚠️ This will push you to CATASTROPHIC burnout.
        </p>
      )}
    </div>
  );
}
