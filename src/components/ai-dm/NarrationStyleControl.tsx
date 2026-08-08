import { cn } from '@/lib/utils';
import {
  NARRATION_INTENSITIES,
  NARRATION_STYLES,
  narrationStyleMeta,
  type NarrationIntensity,
  type NarrationStyleId,
  type NarrationStyleState,
} from '@/lib/narrationStyle';

interface NarrationStyleControlProps {
  state: NarrationStyleState;
  onStyleChange: (style: NarrationStyleId) => void;
  onIntensityChange: (intensity: NarrationIntensity) => void;
  /** When false the control renders read-only (non-host players). */
  editable?: boolean;
  readOnlyNote?: string;
}

export function NarrationStyleControl({
  state,
  onStyleChange,
  onIntensityChange,
  editable = true,
  readOnlyNote,
}: NarrationStyleControlProps) {
  const meta = narrationStyleMeta(state.style);

  if (!editable) {
    return (
      <div className="px-3 py-2.5">
        <p className="text-[11px] text-muted-foreground mb-2">The tone the DM narrates in.</p>
        <div className={cn('inline-flex items-center rounded-md border px-2.5 py-1 text-sm', meta.className)}>
          {meta.label}
          {meta.id !== 'default' && (
            <span className="ml-1.5 text-[10px] uppercase tracking-wide opacity-70">
              {NARRATION_INTENSITIES.find(i => i.id === state.intensity)?.label}
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">{readOnlyNote ?? 'Set by the host.'}</p>
      </div>
    );
  }

  return (
    <div className="px-3 py-2.5 space-y-3">
      <p className="text-[11px] text-muted-foreground">
        The tone the DM narrates in — applied to every beat, including quest objective steps. GM Guides and OOC directives still win.
      </p>

      <div className="grid grid-cols-2 gap-2">
        {NARRATION_STYLES.map(s => {
          const active = s.id === state.style;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onStyleChange(s.id)}
              style={{ touchAction: 'manipulation' }}
              className={cn(
                'min-h-[56px] rounded-lg border px-3 py-2 text-left transition-colors',
                active ? s.className : 'border-border bg-muted/10 text-foreground hover:bg-muted/20',
              )}
            >
              <div className="text-sm font-cinzel">{s.label}</div>
              <div className="text-[10px] text-muted-foreground leading-snug mt-0.5">{s.blurb}</div>
            </button>
          );
        })}
      </div>

      {state.style !== 'default' && (
        <div>
          <div className="text-[11px] text-muted-foreground mb-1.5">Intensity</div>
          <div className="grid grid-cols-3 gap-2">
            {NARRATION_INTENSITIES.map(i => {
              const active = i.id === state.intensity;
              return (
                <button
                  key={i.id}
                  type="button"
                  onClick={() => onIntensityChange(i.id)}
                  style={{ touchAction: 'manipulation' }}
                  className={cn(
                    'min-h-[48px] rounded-lg border px-2 text-sm transition-colors',
                    active
                      ? 'border-primary/50 bg-primary/15 text-foreground'
                      : 'border-border bg-muted/10 text-muted-foreground hover:bg-muted/20',
                  )}
                >
                  {i.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
