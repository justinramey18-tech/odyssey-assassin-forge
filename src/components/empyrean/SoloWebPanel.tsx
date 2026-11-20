// The progression web's wall in the solo hall: a painted panel beside the dragon's. It shows what the
// rider has to spend and how much of the web is unlocked. Tapping the silver half of the great wheel
// opens the rider's web and the ember half the dragon's. The web itself opens full screen
// (ProgressionWeb): it is dragged in every direction, and nothing inside the hall may scroll sideways.
import { cn } from '@/lib/utils';
import type { RulesWeb } from '@/lib/empyrean-rules-client';
import { WEB_PANEL_ART, WEB_TOKEN_ART, webArtStyle, type WebArtRef } from '@/lib/empyrean-web-art';

type Half = 'rider' | 'dragon';

interface SoloWebPanelProps {
  /** The web as the server keeps it; null while the game server is off or older. */
  web: RulesWeb | null;
  /** Step up to the wall: open the full-screen web on this half. */
  onOpen: (half: Half) => void;
}

const SIDES: Array<{ half: Half; label: string; unit: string; token: WebArtRef; side: string; tint: string; border: string; text: string }> = [
  { half: 'rider', label: 'Rider', unit: 'XP', token: WEB_TOKEN_ART.xp, side: 'left-0', tint: 'active:bg-sky-200/10', border: 'border-sky-200/40', text: 'text-sky-100' },
  { half: 'dragon', label: 'Dragon', unit: 'Kinship', token: WEB_TOKEN_ART.kin, side: 'right-0', tint: 'active:bg-orange-300/10', border: 'border-orange-300/40', text: 'text-orange-100' },
];

export function SoloWebPanel({ web, onOpen }: SoloWebPanelProps) {
  const nodes = web ? web.spokes.flatMap(s => s.nodes.map(n => ({ n, half: s.half }))) : [];
  const owned = nodes.filter(x => x.n.owned).length;
  const balance = (half: Half) => (web ? (half === 'dragon' ? web.kin?.balance ?? 0 : web.xp.balance) : null);
  const ready = (half: Half) => nodes.filter(x => x.half === half && x.n.canBuy).length;
  return (
    <div data-web-panel="" className="relative flex-1 min-h-0 overflow-hidden">
      <img
        src={WEB_PANEL_ART}
        alt=""
        draggable={false}
        className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
        style={{ objectPosition: '50% 40%' }}
      />
      <div className="absolute inset-x-0 top-0 px-4 pt-3 pb-10 text-center pointer-events-none bg-gradient-to-b from-black/85 via-black/45 to-transparent">
        <p className="font-cinzel text-sm uppercase tracking-[0.2em] text-amber-200">The Web</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground" data-testid="web-panel-count">
          {web ? `${owned} of ${nodes.length} unlocked` : 'The web needs the game server.'}
        </p>
      </div>
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-28 pointer-events-none bg-gradient-to-t from-black/85 to-transparent" />
      {SIDES.map(s => {
        const have = balance(s.half);
        const open = ready(s.half);
        return (
          <button
            key={s.half}
            type="button"
            onClick={() => onOpen(s.half)}
            aria-label={`${s.label}'s web${have != null ? `, ${have} ${s.unit} to spend` : ''}${open > 0 ? `, ${open} to unlock` : ''}`}
            className={cn('absolute inset-y-0 w-1/2 flex flex-col items-center justify-end gap-1 pb-4 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary', s.side, s.tint)}
            style={{ touchAction: 'manipulation' }}
          >
            <span className={cn('inline-flex items-center gap-2 rounded-full border bg-black/75 pl-1.5 pr-3 py-1.5', s.border)}>
              <span aria-hidden="true" className="w-8 h-8 shrink-0 rounded-full" style={webArtStyle(s.token, 32)} />
              <span className="text-left leading-tight">
                <span className={cn('block font-cinzel text-xs', s.text)}>{s.label}</span>
                <span className="block text-[11px] text-muted-foreground">{have != null ? `${have} ${s.unit}` : s.unit}</span>
              </span>
            </span>
            <span className={cn('text-[10px] leading-none', open > 0 ? 'text-amber-200' : 'text-transparent')}>{open > 0 ? `${open} to unlock` : 'none'}</span>
          </button>
        );
      })}
    </div>
  );
}