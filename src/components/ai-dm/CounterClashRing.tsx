// Counter Clash (Live NPC Combat v6): the ring a player taps when a big NPC move (heavy blow, signature,
// sweep, pin) is aimed at them. For each swing a circle shrinks onto the ring; tap the lit third as it lands.
// Green band = perfect (no damage), amber band = block (half). Every swing perfect = a free counter.
// The phone judges a tap at once for feedback; the server judges it again with the same rules, and its result counts.
// It floats above every sheet and drawer, and only listens to taps on the ring itself.

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import * as M from '@/lib/combatMinigames';
import { COMBAT_ART, clipOrNull } from '@/lib/combatArt';

const R0 = 135;
const RT = 60;
const DEBOUNCE_MS = 250;
const FLASH_MS = 650;

const Q_COLOR: Record<M.ClashQ, string> = {
  perfect: 'hsl(142 76% 55%)', block: 'hsl(43 96% 56%)', wrong: 'hsl(0 84% 60%)', bait: 'hsl(0 84% 60%)', early: 'hsl(0 84% 60%)',
};
const SIDE_LABEL: Record<M.Side, string> = { left: '◀ LEFT', top: '▲ TOP', right: 'RIGHT ▶' };

/** An uploaded art piece: the clip or the still image, both on black and drawn with screen blend so the black disappears. Nothing when neither is uploaded. */
export function ArtFx({ image, clip, className, style }: { image: string | null; clip?: string | null; className?: string; style?: React.CSSProperties }) {
  const playable = clipOrNull(clip ?? null);
  if (playable) {
    // The still shows as the poster while the clip loads (or if it can't play).
    return <video src={playable} poster={image ?? undefined} autoPlay muted playsInline className={cn('pointer-events-none', className)} style={{ mixBlendMode: 'screen', ...style }} />;
  }
  if (image) return <img src={image} alt="" draggable={false} className={cn('pointer-events-none select-none', className)} style={{ mixBlendMode: 'screen', ...style }} />;
  return null;
}

/** A big moment across the screen: COUNTER! or BREAK FREE! Shows for about 1.4 s and lets taps through. */
export function CombatBurst({ kind, sub }: { kind: 'counter' | 'free'; sub?: string }) {
  const counter = kind === 'counter';
  const image = counter ? COMBAT_ART.clashCounter : COMBAT_ART.tugFree;
  const clip = counter ? COMBAT_ART.clashCounterClip : COMBAT_ART.tugFreeClip;
  return (
    <>
      {/* The art is its own screen-blended layer, so its black blends into whatever is behind it. */}
      {(image || clip) && (
        <div className="fixed inset-0 z-[81] flex items-center justify-center pointer-events-none" style={{ mixBlendMode: 'screen' }}>
          <ArtFx image={image} clip={clip} className="w-[320px] h-[320px] object-contain animate-in zoom-in-75 fade-in duration-200" style={{ mixBlendMode: 'normal' }} />
        </div>
      )}
      <div className="fixed inset-0 z-[82] flex items-center justify-center pointer-events-none" aria-live="polite">
        <div className="relative flex flex-col items-center animate-in zoom-in-50 fade-in duration-200">
        <span
          className={cn('font-cinzel text-[40px] font-bold tracking-wider', counter ? 'text-amber-200' : 'text-green-200')}
          style={{ textShadow: counter ? '0 0 18px hsl(43 96% 56% / 0.9), 0 2px 0 #000' : '0 0 18px hsl(142 76% 45% / 0.9), 0 2px 0 #000' }}
        >
          {counter ? 'COUNTER!' : 'BREAK FREE!'}
        </span>
        {sub && <span className="mt-1 rounded-full bg-black/80 px-3 py-1 text-[14px] text-white/90">{sub}</span>}
        </div>
      </div>
    </>
  );
}

/** The full-screen stage a mini-game plays in: it covers the live chat window, holds the title and blocks taps underneath. */
export function MinigameStage({ tone, title, subtitle, right, children, footer }: {
  tone: 'clash' | 'pin';
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[78] flex flex-col animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        touchAction: 'none',
        overscrollBehavior: 'contain',
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
      }}
    >
      {/* The backdrop dims the chat; the glow matches the game's mood. It never takes taps itself. */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden
        style={{
          background: 'hsl(240 10% 4% / 0.94)',
          boxShadow: tone === 'clash' ? 'inset 0 0 80px 18px hsl(0 84% 50% / 0.45)' : 'inset 0 0 80px 18px hsl(43 96% 50% / 0.40)',
        }}
      />
      <div className="relative px-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className={cn('block font-cinzel text-[18px] font-bold truncate', tone === 'clash' ? 'text-red-100' : 'text-amber-100')}>{title}</span>
          {subtitle && <p className="text-[12px] text-white/70">{subtitle}</p>}
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>
      <div className="relative flex-1 min-h-0 flex items-center justify-center px-4">{children}</div>
      {footer && <div className="relative px-4 pt-2">{footer}</div>}
    </div>
  );
}

/** An annular sector from angle a0 to a1 (degrees, 0 = right, 90 = down) between radii r0 and r1. */
function sector(a0: number, a1: number, r0: number, r1: number): string {
  const rad = (d: number) => (d * Math.PI) / 180;
  const pt = (r: number, d: number) => `${(r * Math.cos(rad(d))).toFixed(2)} ${(r * Math.sin(rad(d))).toFixed(2)}`;
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${pt(r1, a0)} A ${r1} ${r1} 0 ${large} 1 ${pt(r1, a1)} L ${pt(r0, a1)} A ${r0} ${r0} 0 ${large} 0 ${pt(r0, a0)} Z`;
}

interface Props {
  skillName: string;
  npcName: string;
  clash: M.Clash;
  /** When the hit lands (strike_at), on the server's clock. */
  hitAt: number;
  /** My taps on this chain as the server stored them. */
  results: Array<M.ClashQ | null>;
  serverTime: () => number;
  /** While the fight is paused everything stands still at this moment. */
  frozenAt: number | null;
  onTap: (side: M.Side, tapAt: number) => Promise<{ ok?: boolean; index?: number; quality?: M.ClashQ } | null>;
}

export function CounterClashRing({ skillName, npcName, clash, hitAt, results, serverTime, frozenAt, onTap }: Props) {
  const [t, setT] = useState(() => frozenAt ?? serverTime());
  const [local, setLocal] = useState<Array<M.ClashQ | null>>([]);
  const [flash, setFlash] = useState<{ q: M.ClashQ; at: number } | null>(null);
  const lastTapRef = useRef(0);

  // A new chain starts with no taps.
  useEffect(() => { setLocal([]); setFlash(null); }, [clash.id]);

  // Redraw every frame while the chain is on (frozen during a pause).
  useEffect(() => {
    if (frozenAt !== null) { setT(frozenAt); return; }
    let raf = 0;
    const loop = () => { setT(serverTime()); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [frozenAt, serverTime]);

  const merged = clash.swings.map((_, i) => local[i] ?? results[i] ?? null);
  const startsAt = M.clashStartsAt(clash, hitAt);
  if (t < startsAt - 300 || t > hitAt + 700) return null;

  const w = M.clashWindow(clash.move);
  const shrink = M.CLASH_SHRINK_MS[clash.move];
  const v = (R0 - RT) / shrink;
  const times = clash.swings.map(s => M.swingTimes(s, hitAt));
  // The swing to read now: the first one not yet tapped whose window is still open.
  const active = clash.swings.findIndex((_, i) => !merged[i] && t <= times[i].zero + w.lateMs);
  const activeSide = active >= 0 ? clash.swings[active].side : null;

  const tap = (e: React.PointerEvent<SVGSVGElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (frozenAt !== null) return;
    const tapAt = Math.round(serverTime());
    if (tapAt - lastTapRef.current < DEBOUNCE_MS) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const deg = (Math.atan2(e.clientY - (rect.top + rect.height / 2), e.clientX - (rect.left + rect.width / 2)) * 180) / Math.PI;
    const side = M.sideOfAngle(deg);
    const judged = M.judgeClash(clash, hitAt, tapAt, side, merged);
    if (!judged) return;
    lastTapRef.current = tapAt;
    setLocal(prev => { const next = [...prev]; next[judged.index] = judged.q; return next; });
    setFlash({ q: judged.q, at: tapAt });
    try { navigator.vibrate?.(judged.q === 'perfect' ? [20, 30, 20] : judged.q === 'block' ? 25 : 70); } catch { /* not supported */ }
    void onTap(side, tapAt).then(r => {
      // The server's judgement counts: show it if it differs.
      if (r?.ok && typeof r.index === 'number' && r.quality && r.quality !== judged.q) {
        const q = r.quality;
        const index = r.index;
        setLocal(prev => { const next = [...prev]; next[index] = q; return next; });
      }
    });
  };

  const flashOn = flash && t - flash.at < FLASH_MS ? flash : null;
  const flashArt = flashOn
    ? flashOn.q === 'perfect' ? { image: COMBAT_ART.clashPerfect, clip: COMBAT_ART.clashPerfectClip }
      : flashOn.q === 'block' ? { image: COMBAT_ART.clashBlock, clip: null }
        : { image: COMBAT_ART.clashBait, clip: null }
    : null;
  // A swing that lands without a good tap: its side flashes red (or the slash art plays) for a moment.
  const landing = clash.swings.findIndex((s, i) => t >= times[i].zero && t <= times[i].zero + 220 && merged[i] !== 'perfect' && merged[i] !== 'block');

  return (
    <MinigameStage
      tone="clash"
      title={`⚔ ${npcName}: ${skillName}`}
      subtitle="Tap the lit side as the circle hits the ring"
      right={frozenAt !== null ? <span className="font-cinzel text-[22px] text-amber-200">⏸</span> : undefined}
      footer={clash.swings.length > 1 ? (
        <p className="text-center text-[13px] text-white/70">
          Swing {active >= 0 ? active + 1 : clash.swings.length} of {clash.swings.length}
        </p>
      ) : undefined}
    >
      {/* The ring scales with the screen: big on a phone, capped so it always fits between the header and the bottom. */}
      <div className="relative" style={{ width: 'min(90vw, 60dvh, 480px)', aspectRatio: '1 / 1' }}>
        <svg
          viewBox="-150 -150 300 300"
          className="absolute inset-0 w-full h-full touch-none select-none"
          style={{ pointerEvents: 'auto', touchAction: 'none' }}
          onPointerDown={tap}
          role="button"
          aria-label={activeSide ? `Counter Clash: tap the ${activeSide} side as the circle lands` : 'Counter Clash'}
        >
          {/* Solid backing: the art's black (screen blend) needs something solid to blend into. */}
          <circle r={148} fill="hsl(240 10% 4%)" />
          {/* The three thirds. */}
          {M.SIDES.map(s => (
            <path
              key={s}
              d={sector(M.SIDE_ANGLE[s] - 59, M.SIDE_ANGLE[s] + 59, 26, 146)}
              fill={activeSide === s ? 'hsl(0 84% 50% / 0.32)' : landing >= 0 && clash.swings[landing].side === s ? 'hsl(0 90% 55% / 0.6)' : 'hsl(0 0% 100% / 0.03)'}
              stroke={activeSide === s ? 'hsl(0 90% 65% / 0.9)' : 'hsl(0 0% 100% / 0.12)'}
              strokeWidth={activeSide === s ? 2 : 1}
            />
          ))}
          {activeSide && (
            <text
              x={Math.cos((M.SIDE_ANGLE[activeSide] * Math.PI) / 180) * 112}
              y={Math.sin((M.SIDE_ANGLE[activeSide] * Math.PI) / 180) * 112 + 5}
              textAnchor="middle" fontSize="15" fontWeight="700" fill="hsl(0 90% 80%)"
            >
              {SIDE_LABEL[activeSide]}
            </text>
          )}
          {/* Block band (amber) and Perfect band (green), drawn to scale: the circle moves at an even speed. */}
          <circle r={RT + (v * (w.earlyMs - w.lateMs)) / 2} fill="none" stroke="hsl(43 96% 56% / 0.38)" strokeWidth={v * (w.earlyMs + w.lateMs)} />
          <circle r={RT} fill="none" stroke="hsl(142 76% 50% / 0.75)" strokeWidth={Math.max(2, v * w.perfectMs * 2)} />
          {!COMBAT_ART.clashRing && <circle r={RT} fill="none" stroke="hsl(0 0% 100% / 0.55)" strokeWidth={1.5} />}
          {/* The approaching circle(s): dashed while a feint fakes, solid for the real swing. */}
          {clash.swings.map((s, i) => {
            if (merged[i]) return null;
            const { zero, fake } = times[i];
            if (fake !== null && t >= fake - shrink && t <= fake) {
              return <circle key={i} r={RT + v * (fake - t)} fill="none" stroke="hsl(0 0% 100% / 0.85)" strokeWidth={3} strokeDasharray="7 7" />;
            }
            const from = fake !== null ? fake : zero - shrink;
            if (t < from || t > zero + w.lateMs) return null;
            return <circle key={i} r={Math.max(4, RT + v * (zero - t))} fill="none" stroke="hsl(0 0% 100%)" strokeWidth={4} />;
          })}
          {/* Chain progress. */}
          {clash.swings.length > 1 && clash.swings.map((_, i) => {
            const q = merged[i];
            const passed = t > times[i].zero + w.lateMs;
            return (
              <circle
                key={`pip${i}`} cx={(i - (clash.swings.length - 1) / 2) * 16} cy={0} r={5}
                fill={q ? Q_COLOR[q] : passed ? 'hsl(0 84% 60%)' : 'transparent'}
                stroke="hsl(0 0% 100% / 0.6)" strokeWidth={1.5}
              />
            );
          })}
        </svg>
        {/* The ring art sits over the drawing; screen blend lets the circle and bands show through. */}
        <ArtFx
          image={COMBAT_ART.clashRing}
          className="absolute object-contain"
          style={{ left: '50%', top: '50%', width: `${((RT + 22) * 2 * 100) / 300}%`, height: `${((RT + 22) * 2 * 100) / 300}%`, transform: 'translate(-50%, -50%)' }}
        />
        {landing >= 0 && (COMBAT_ART.clashSlash || COMBAT_ART.clashSlashClip) && (
          <ArtFx
            image={COMBAT_ART.clashSlash}
            clip={COMBAT_ART.clashSlashClip}
            className="absolute object-contain"
            style={{ left: '15%', top: '15%', width: '70%', height: '70%', transform: `rotate(${M.SIDE_ANGLE[clash.swings[landing].side]}deg)` }}
          />
        )}
        {flashOn && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {flashArt && <ArtFx image={flashArt.image} clip={flashArt.clip} className="absolute w-[70%] h-[70%] object-contain" />}
            <span
              className="relative font-cinzel text-[clamp(22px,7vw,34px)] font-bold animate-in zoom-in-75 duration-150"
              style={{ color: Q_COLOR[flashOn.q], textShadow: '0 2px 0 #000, 0 0 10px #000' }}
            >
              {M.CLASH_LABEL[flashOn.q]}
            </span>
          </div>
        )}
      </div>
    </MinigameStage>
  );
}
