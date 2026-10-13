// Tug & Slip (Live NPC Combat v6): the Pin struggle. It takes the place of the action buttons while you're pinned.
// The enemy drags the rope knot away from you; reach the FREE line and you break the pin.
// Heave while the needle is in the green gap = a big pull (bigger in a row), the gap shrinks a step and things speed up.
// Heave outside = a slip (bigger in a row; double on the red edges), the gap grows a step and Heave locks for 0.7 s.
// The phone plays the struggle from the same seed and rules as the server, so a tap shows its result at once;
// the server's answer always wins.

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import * as M from '@/lib/combatMinigames';
import { COMBAT_ART } from '@/lib/combatArt';
import { ArtFx, MinigameStage } from './CounterClashRing';

const FEEDBACK_MS = 700;

interface Props {
  /** Who pinned me (from the pin event), for the header. */
  npcName: string | null;
  pinnedUntil: number;
  /** The struggle as the server last stored it. */
  struggle: M.Struggle | null;
  serverTime: () => number;
  /** While the fight is paused everything stands still at this moment. */
  frozenAt: number | null;
  onHeave: (tapAt: number) => Promise<{ ok?: boolean; free?: boolean; struggle?: unknown } | null>;
  /** Called the moment a heave breaks the pin (before the server confirms), for the BREAK FREE! burst. */
  onFree?: () => void;
}

type Feedback = { text: string; tone: 'good' | 'bad' | 'trap'; at: number };

export function TugAndSlip({ npcName, pinnedUntil, struggle, serverTime, frozenAt, onHeave, onFree }: Props) {
  const [local, setLocal] = useState<M.Struggle | null>(struggle);
  const localRef = useRef<M.Struggle | null>(struggle);
  const [t, setT] = useState(() => frozenAt ?? serverTime());
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const freedRef = useRef(false);

  const adopt = (s: M.Struggle | null) => { localRef.current = s; setLocal(s); };

  // The server's struggle wins when it is newer (another phone, a pause) or a new pin started.
  useEffect(() => {
    const cur = localRef.current;
    if (!struggle) return;
    if (!cur || struggle.seed !== cur.seed || struggle.n > cur.n || (struggle.n === cur.n && struggle.t0 !== cur.t0)) {
      adopt(struggle);
      if (!cur || struggle.seed !== cur.seed) freedRef.current = false;
    }
  }, [struggle]);

  // Redraw every frame (frozen during a pause).
  useEffect(() => {
    if (frozenAt !== null) { setT(frozenAt); return; }
    let raf = 0;
    const loop = () => { setT(serverTime()); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [frozenAt, serverTime]);

  const heave = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const s = localRef.current;
    if (!s || frozenAt !== null || freedRef.current) return;
    const tapAt = Math.round(serverTime());
    const r = M.heave(s, tapAt);
    if (!r) return; // locked out: the button already shows it
    adopt(r.state);
    setFeedback({
      text: r.outcome === 'heave' ? `HEAVE! +${r.amount}` : r.outcome === 'trap' ? `Edge! −${r.amount}` : `Fumble −${r.amount}`,
      tone: r.outcome === 'heave' ? 'good' : r.outcome === 'trap' ? 'trap' : 'bad',
      at: tapAt,
    });
    try { navigator.vibrate?.(r.outcome === 'heave' ? 18 : [60, 40, 60]); } catch { /* not supported */ }
    if (r.free) { freedRef.current = true; onFree?.(); }
    void onHeave(tapAt).then(res => {
      const back = M.cleanStruggle(res?.struggle);
      const cur = localRef.current;
      // A tap the server didn't count puts the phone back on the server's struggle.
      if (back && (!res?.ok || !cur || back.n >= cur.n)) {
        adopt(back);
        if (!res?.ok) freedRef.current = false;
      }
    });
  };

  const secsLeft = Math.max(0, Math.ceil((pinnedUntil - t) / 1000));
  const title = `📌 ${npcName ? `${npcName} has you pinned!` : 'Pinned!'}`;
  const timer = <span className="font-cinzel text-[22px] text-amber-100 tabular-nums">{frozenAt !== null ? '⏸' : `${secsLeft}s`}</span>;
  if (!local) {
    return <MinigameStage tone="pin" title={title} right={timer}><p className="text-center text-[15px] text-amber-100">Getting a grip…</p></MinigameStage>;
  }
  const p = M.struggleAt(local, t);
  const locked = t < local.lockUntil;
  const fb = feedback && t - feedback.at < FEEDBACK_MS ? feedback : null;
  const knotPct = Math.min(100, p.knot);
  const gapLeft = p.gap - p.width / 2;

  return (
    <MinigameStage tone="pin" title={title} subtitle="Heave when the needle is in the green. Misses slip and lock you for a moment." right={timer}>
      <div className="w-full max-w-md space-y-4 select-none">

        {/* The rope: the knot slides toward the enemy; drag it past FREE. */}
        <div className="relative h-16 rounded-md border border-white/15 bg-black overflow-hidden" aria-label={`Knot at ${Math.round(knotPct)} percent`}>
          <div
            className="absolute left-0 right-0"
            style={COMBAT_ART.tugRope
              ? { top: '20%', bottom: '20%', backgroundImage: `url(${COMBAT_ART.tugRope})`, backgroundSize: 'auto 100%', backgroundRepeat: 'repeat-x', mixBlendMode: 'screen' }
              : { top: '36%', bottom: '36%', background: 'repeating-linear-gradient(115deg, #8a6a3d 0 6px, #6b4f2a 6px 12px)' }}
          />
          <div className="absolute inset-y-0 left-0 bg-red-600/25" style={{ width: '18%' }} />
          <div className="absolute inset-y-0 border-l-2 border-dashed border-green-400/80" style={{ left: `${M.TUG.freeAt}%` }} />
          <span className="absolute right-1 top-0.5 text-[12px] font-semibold text-green-300">FREE</span>
          <span className="absolute left-1 top-0.5 text-[12px] text-red-200/80">{npcName ?? 'Enemy'}</span>
          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-[left] duration-75" style={{ left: `${knotPct}%` }}>
            {COMBAT_ART.tugKnot
              ? <img src={COMBAT_ART.tugKnot} alt="" draggable={false} className="w-12 h-12 object-contain" style={{ mixBlendMode: 'screen' }} />
              : <div className="w-9 h-9 rounded-full border-2 border-amber-200 bg-amber-600 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />}
          </div>
        </div>

        {/* The needle bar: red edges, green gap, needle. */}
        <div className="relative h-20 rounded-md border border-white/15 bg-black overflow-hidden">
          <div className="absolute inset-y-0 bg-red-500/45" style={{ left: `${gapLeft - M.TUG.trap}%`, width: `${M.TUG.trap}%` }} />
          <div className="absolute inset-y-0 bg-green-500/70 shadow-[0_0_10px_rgba(34,197,94,0.7)]" style={{ left: `${gapLeft}%`, width: `${p.width}%` }} />
          <div className="absolute inset-y-0 bg-red-500/45" style={{ left: `${gapLeft + p.width}%`, width: `${M.TUG.trap}%` }} />
          {COMBAT_ART.tugNeedle
            ? <img src={COMBAT_ART.tugNeedle} alt="" draggable={false} className="absolute inset-y-0 h-full w-6 -translate-x-1/2 object-contain" style={{ left: `${p.needle}%`, mixBlendMode: 'screen' }} />
            : <div className="absolute inset-y-0 w-1.5 -translate-x-1/2 bg-white shadow-[0_0_6px_white]" style={{ left: `${p.needle}%` }} />}
        </div>

        <div className="relative">
          <button
            type="button"
            onPointerDown={heave}
            disabled={frozenAt !== null}
            style={{ touchAction: 'manipulation' }}
            className={cn(
              'w-full min-h-[96px] rounded-xl border-2 font-cinzel text-[30px] tracking-wider transition-transform active:scale-[0.97]',
              locked ? 'border-red-500/60 bg-red-950/80 text-red-200' : 'border-amber-300/80 bg-amber-500/25 text-amber-100',
            )}
          >
            {locked ? 'Fumbled…' : 'HEAVE'}
          </button>
          {fb && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              {fb.tone !== 'good' && <ArtFx image={COMBAT_ART.tugFumble} className="absolute h-[140%] object-contain" />}
              <span
                className={cn('relative -translate-y-14 rounded-full bg-black/85 px-3 py-0.5 text-[18px] font-bold animate-in fade-in zoom-in-75 duration-100',
                  fb.tone === 'good' ? 'text-green-300' : 'text-red-300')}
              >
                {fb.text}
              </span>
            </div>
          )}
        </div>
        {local.hit > 1 && <p className="text-center text-[14px] text-amber-200">🔥 {local.hit} in a row</p>}
      </div>
    </MinigameStage>
  );
}
