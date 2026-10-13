import { useEffect } from 'react';
import { Swords, Infinity as InfinityIcon, Users, X, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { takeArenaSnapshot, restoreArenaSnapshot } from '@/lib/arena/arenaSnapshot';

interface ArenaScreenProps {
  open: boolean;
  onClose: () => void;
}

const MODES = [
  { id: 'solo', label: 'Solo Training', blurb: 'Dummy, sparring partner, drill masters and your own NPCs.', icon: Swords },
  { id: 'gauntlet', label: 'Endless Gauntlet', blurb: 'Waves that get tougher until you fall.', icon: InfinityIcon },
  { id: 'party', label: 'Party Arena', blurb: 'Train with your party or spar each other.', icon: Users },
] as const;

export function ArenaScreen({ open, onClose }: ArenaScreenProps) {
  useEffect(() => {
    if (open) takeArenaSnapshot();
  }, [open]);

  if (!open) return null;

  const exit = () => {
    restoreArenaSnapshot();
    onClose();
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Training Grounds" className="fixed inset-0 z-[62] flex flex-col bg-background">
      <div className="flex items-center justify-between px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <h1 className="font-cinzel text-lg font-bold uppercase tracking-[0.15em] text-primary">Training Grounds</h1>
        <button
          type="button"
          onClick={exit}
          aria-label="Leave the arena"
          style={{ touchAction: 'manipulation' }}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card text-foreground active:scale-95"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="mx-4 mb-3 flex items-start gap-2 rounded-lg border border-border bg-card/60 p-3 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <span>Practice is free. Health, potions, spells and gold go back to exactly how they were when you leave.</span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => toast('Coming in the next arena step')}
            style={{ touchAction: 'manipulation' }}
            className="flex min-h-[72px] w-full items-center gap-3 rounded-xl border border-border bg-card p-4 text-left active:scale-[0.98]"
          >
            <m.icon className="h-6 w-6 shrink-0 text-primary" />
            <span className="flex flex-col">
              <span className="font-cinzel text-sm font-bold uppercase tracking-wider text-foreground">{m.label}</span>
              <span className="text-xs text-muted-foreground">{m.blurb}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
