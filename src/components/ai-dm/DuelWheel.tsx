// Duel (Live NPC Combat v7): the Flurry Parry wheel, full screen. A player with a full Duel bar challenged an NPC;
// its flurry comes at them on eight boxes. Tap the pad behind a filling box as the fill reaches the green band,
// hold the pad for a heavy (amber), tap the center to dodge a sweep (blue), leave a feint alone, and tap the
// same pad again after a perfect block to counter. The phone plays it with the shared rules (combatDuel.ts) for
// instant feedback, then sends every tap; the server replays them with the same rules and deals the damage.
// The wheel is drawn once and then updated straight on the SVG every frame (fast on phones).

import { useEffect, useRef, useState } from 'react';
import { Loader2, Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';
import * as DU from '@/lib/combatDuel';
import { MinigameStage } from './CounterClashRing';

/** What the server says happened (the duel_end answer). */
export interface DuelVerdict {
  ok?: boolean;
  perfect?: number;
  block?: number;
  hits?: number;
  ripostes?: number;
  allPerfect?: boolean;
  dealt?: number;
  taken?: number;
  defeated?: boolean;
  downed?: boolean;
  npcName?: string;
}

interface Props {
  duel: DU.Duel;
  /** The server's clock (ms). */
  serverTime: () => number;
  /** Sends my taps once the duel is over. Resolves with the server's verdict (null if it could not be reached). */
  onFinish: (inputs: DU.DuelInput[]) => Promise<DuelVerdict | null>;
  /** Closes the duel screen. */
  onClose: () => void;
}

// ── Geometry (SVG units, viewBox -190..190) ──────────────────────────────────
const PAD_IN = 58, PAD_OUT = 104, BOX_IN = 110, BOX_OUT = 166, HALF = 20, DEPTH = BOX_OUT - BOX_IN;
const CORE_R = 46, TAP_PAD_MAX = 107, TAP_BOX_MAX = 172;
const C = {
  bg: 'hsl(240 10% 4%)', panel: 'hsl(240 9% 8%)', panel2: 'hsl(240 8% 12%)', line: 'hsl(240 8% 21%)', fg: 'hsl(40 18% 92%)',
  red: 'hsl(0 84% 60%)', amber: 'hsl(43 96% 56%)', green: 'hsl(142 76% 55%)', blue: 'hsl(205 90% 62%)', steel: 'hsl(215 24% 64%)',
};
const ang = (i: number) => -90 + 45 * i;
const rad = (d: number) => (d * Math.PI) / 180;
const pt = (r: number, d: number) => `${(r * Math.cos(rad(d))).toFixed(2)} ${(r * Math.sin(rad(d))).toFixed(2)}`;
const sector = (a0: number, a1: number, r0: number, r1: number) =>
  `M ${pt(r1, a0)} A ${r1} ${r1} 0 0 1 ${pt(r1, a1)} L ${pt(r0, a1)} A ${r0} ${r0} 0 0 0 ${pt(r0, a0)} Z`;
const arc = (r: number, a: number, w: number) => `M ${pt(r, a - w)} A ${r} ${r} 0 0 1 ${pt(r, a + w)}`;
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const set = (el: Element | null | undefined, attrs: Record<string, string | number>) => {
  if (!el) return;
  for (const k in attrs) el.setAttribute(k, String(attrs[k]));
};

const LABEL: Record<DU.DuelQ | 'riposte' | 'hold', string> = {
  perfect: 'PERFECT', block: 'BLOCK', riposte: 'COUNTER!', hold: 'HOLD IT', miss: 'HIT', wrong: 'WRONG MOVE',
  early: 'TOO EARLY', bait: 'FEINT!', read: 'READ IT', letgo: 'LET GO',
};
function labelOf(kind: DU.DuelKind, q: DU.DuelQ | 'riposte' | 'hold'): string {
  if (q === 'perfect') return kind === 'sweep' ? 'DODGED' : kind === 'heavy' ? 'BRACED' : 'PERFECT';
  if (q === 'block') return kind === 'sweep' ? 'CLOSE CALL' : kind === 'heavy' ? 'HELD' : 'BLOCK';
  return LABEL[q];
}

// ── Sound and buzz ───────────────────────────────────────────────────────────
const SOUND_KEY = 'duel-sound';
function soundOn(): boolean {
  try { return localStorage.getItem(SOUND_KEY) !== 'off'; } catch { return true; }
}
let audioCtx: AudioContext | null = null;
function tone(f0: number, f1: number, dur: number, type: OscillatorType, gain: number, delay = 0) {
  try {
    const W = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
    const Ctx = W.AudioContext || W.webkitAudioContext;
    if (!Ctx) return;
    audioCtx = audioCtx || new Ctx();
    if (audioCtx.state === 'suspended') void audioCtx.resume();
    const t = audioCtx.currentTime + delay;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start(t);
    o.stop(t + dur + 0.03);
  } catch { /* no sound */ }
}
const SFX = {
  perfect: () => { tone(900, 1500, 0.12, 'sine', 0.18); tone(300, 200, 0.06, 'square', 0.05); },
  riposte: () => { tone(700, 1700, 0.14, 'sine', 0.2); tone(220, 90, 0.16, 'square', 0.09, 0.04); },
  block: () => tone(340, 220, 0.12, 'triangle', 0.22),
  hold: () => tone(260, 260, 0.08, 'triangle', 0.12),
  bad: () => tone(150, 60, 0.22, 'sawtooth', 0.16),
  read: () => tone(500, 420, 0.06, 'sine', 0.07),
};
const vib = (p: number | number[]) => { try { navigator.vibrate?.(p); } catch { /* not supported */ } };

type Phase = 'ready' | 'run' | 'sending' | 'done' | 'away';
interface BoxEls { base: SVGPathElement | null; f: (SVGPathElement | null)[]; rim: SVGPathElement | null; perf: SVGPathElement | null; pedge: SVGPathElement | null; lit: SVGPathElement | null }
interface PadEls { ready: SVGPathElement | null; flash: SVGPathElement | null }

export function DuelWheel({ duel, serverTime, onFinish, onClose }: Props) {
  const style = DU.DUEL_STYLES[duel.style];
  const real = duel.strikes.filter(s => !s.feint).length;
  const [phase, setPhase] = useState<Phase>('ready');
  const [verdict, setVerdict] = useState<DuelVerdict | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [sound, setSound] = useState(soundOn);
  const soundRef = useRef(sound);
  soundRef.current = sound;

  // Elements updated every frame.
  const svgRef = useRef<SVGSVGElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);
  const vigRef = useRef<HTMLDivElement | null>(null);
  const winRef = useRef<HTMLElement | null>(null);
  const cntRef = useRef<HTMLSpanElement | null>(null);
  const pipsRef = useRef<HTMLDivElement | null>(null);
  const fxRef = useRef<SVGGElement | null>(null);
  const boxes = useRef<BoxEls[]>(Array.from({ length: 8 }, () => ({ base: null, f: [null, null, null], rim: null, perf: null, pedge: null, lit: null })));
  const pads = useRef<PadEls[]>(Array.from({ length: 8 }, () => ({ ready: null, flash: null })));
  const ripLbl = useRef<(SVGTextElement | null)[]>([]);
  const holdTxt = useRef<SVGTextElement | null>(null);
  const dodgeTxt = useRef<SVGTextElement | null>(null);
  const coreRing = useRef<SVGCircleElement | null>(null);
  const blade = useRef<SVGGElement | null>(null);

  // The run: the shared rules, fed my taps as they happen.
  const runRef = useRef<DU.DuelRun>(DU.startRun(duel));
  const phaseRef = useRef<Phase>('ready');
  const downs = useRef(new Map<number, number>());
  // A steady clock for the whole duel: the server time when the screen opened, moved on by this phone's own timer.
  const baseRef = useRef<number>(serverTime() - performance.now());
  const nowT = () => Math.round(performance.now() + baseRef.current - duel.startAt);

  const go = (p: Phase) => { phaseRef.current = p; setPhase(p); };

  // Opened too late (a reload mid-duel): the strikes already came. Hidden mid-duel: you walked away.
  useEffect(() => {
    const first = Math.min(...duel.strikes.map(s => s.zero - s.warn));
    if (nowT() > first + 300) go('away');
    const onHide = () => {
      if (document.hidden && (phaseRef.current === 'run' || phaseRef.current === 'ready')) go('away');
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duel.id]);

  // Effects that fade out: pad and box flashes, impact rings.
  const fx = useRef({
    padFlash: Array<{ c: string; at: number } | null>(8).fill(null),
    boxFlash: Array<{ c: string; at: number } | null>(8).fill(null),
    bursts: [] as { el: SVGCircleElement; at: number }[],
    thudDone: new Set<number>(),
    noteAt: 0,
    bladeAng: -90,
    lastFrame: 0,
    lastWin: -1,
  });

  const burst = (lane: number | null, r: number, c: string, t: number) => {
    const g = fxRef.current;
    if (!g) return;
    const a = ang(lane ?? 0);
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    set(el, { cx: lane == null ? 0 : (r * Math.cos(rad(a))).toFixed(1), cy: lane == null ? 0 : (r * Math.sin(rad(a))).toFixed(1), r: 8, fill: 'none', stroke: c, 'stroke-width': 4 });
    g.appendChild(el);
    fx.current.bursts.push({ el, at: t });
  };
  const restart = (el: HTMLElement | null, cls: string) => {
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  };
  const popup = (main: string, sub: string, cls: 'good' | 'okay' | 'bad' | 'read') => {
    const p = popRef.current;
    if (!p) return;
    p.className = `duelw-pop duelw-${cls}`;
    (p.firstChild as HTMLElement).textContent = main;
    (p.lastChild as HTMLElement).textContent = sub;
    restart(p, 'duelw-show');
  };
  const setPip = (i: number, cls: string) => {
    const el = pipsRef.current?.children[i] as HTMLElement | undefined;
    if (el) el.className = `duelw-pip ${cls}`;
  };

  /** Reacts to what the rules just decided: popups, sounds, buzzes and flashes. */
  const react = (n: DU.DuelNote) => {
    const F = fx.current;
    const s = n.i !== undefined ? duel.strikes[n.i] : null;
    if (n.type === 'pad') {
      if (n.lane != null && n.zone === 'pad') F.padFlash[n.lane] = { c: C.steel, at: n.at };
      return;
    }
    if (n.type === 'hold' && s) {
      F.padFlash[s.lane] = { c: C.amber, at: n.at };
      popup('HOLD IT', 'Keep your thumb down', 'okay');
      if (soundRef.current) SFX.hold();
      vib(15);
      return;
    }
    if (n.type === 'riposte' && n.lane != null) {
      burst(n.lane, 83, C.green, n.at);
      F.padFlash[n.lane] = { c: C.green, at: n.at };
      if (n.i !== undefined) setPip(n.i, 'rip');
      popup('COUNTER!', 'You hit back', 'good');
      if (soundRef.current) SFX.riposte();
      vib([30, 30, 50]);
      return;
    }
    if (n.type !== 'resolve' || !s || !n.q || n.i === undefined) return;
    const q = n.q;
    const good = q === 'perfect' || q === 'block';
    const col = q === 'block' ? C.amber : C.green;
    if (good) {
      if (n.zone === 'core') burst(null, 0, col, n.at);
      else if (n.lane != null) {
        burst(n.lane, 83, col, n.at);
        F.padFlash[n.lane] = { c: col, at: n.at };
        F.boxFlash[s.lane] = { c: col, at: n.at };
      }
    } else if (q !== 'read') {
      if (q === 'bait') {
        if (n.zone === 'core') burst(null, 0, C.red, n.at);
        else if (n.lane != null) burst(n.lane, 83, C.red, n.at);
      } else if (s.kind === 'sweep') burst(null, 0, C.red, n.at);
      else burst(s.lane, 136, C.red, n.at);
      if (n.zone === 'pad' && n.lane != null) F.padFlash[n.lane] = { c: C.red, at: n.at };
      if (q !== 'bait') F.boxFlash[s.lane] = { c: C.red, at: n.at };
    }
    setPip(n.i, q === 'perfect' ? 'perfect' : q === 'block' ? 'block' : q === 'read' ? 'read' : 'hit');
    const off = n.off ?? 0;
    const ms = `${Math.abs(Math.round(off))} ms ${off < 0 ? 'early' : 'late'}`;
    const sub = (q === 'perfect' || q === 'block' || q === 'early') && s.kind !== 'heavy' ? ms
      : q === 'bait' ? 'It never landed' : q === 'letgo' ? 'Hold through the impact' : q === 'read' ? '' : '';
    popup(labelOf(s.kind, q), sub, q === 'perfect' ? 'good' : q === 'block' ? 'okay' : q === 'read' ? 'read' : 'bad');
    if (q === 'perfect') { if (soundRef.current) SFX.perfect(); vib([20, 30, 20]); }
    else if (q === 'block') { if (soundRef.current) SFX.block(); vib(25); }
    else if (q === 'read') { if (soundRef.current) SFX.read(); }
    else {
      if (soundRef.current) SFX.bad();
      vib(90);
      restart(wrapRef.current, 'duelw-shake');
      restart(vigRef.current, 'duelw-vig-on');
    }
  };

  const flushNotes = () => {
    const run = runRef.current;
    const F = fx.current;
    while (F.noteAt < run.notes.length) react(run.notes[F.noteAt++]);
    if (cntRef.current) cntRef.current.textContent = String(run.res.filter((r, i) => r && !duel.strikes[i].feint).length);
  };

  /** Draws the wheel at duel time t (a straight port of the prototype's frame). */
  const draw = (t: number, dtF: number) => {
    const run = runRef.current;
    const F = fx.current;
    const shape = style.shape;
    const win = DU.duelWindow(run, t);
    const wr = Math.round(win);
    if (wr !== F.lastWin && winRef.current) { F.lastWin = wr; winRef.current.textContent = `±${wr} ms`; }

    const lit = Array.from({ length: 8 }, () => ({ op: 0, c: C.red }));
    const fillL: ({ alpha: number; p: number; col: string; dashed: boolean; band: boolean; warn: number; dt: number } | null)[] = Array(8).fill(null);
    const glow = Array(8).fill(0);
    let coreOp = 0;
    let holdAt: { s: DU.DuelStrike; i: number } | null = null;
    let aim: DU.DuelStrike | null = null;
    duel.strikes.forEach((s, i) => {
      const res = run.res[i];
      const hold = run.hold[i];
      const dt = s.zero - t;
      const k = DU.DUEL_KINDS[s.kind];
      if (!res && (!aim || s.zero < aim.zero)) aim = s;
      if (style.thud && !s.feint && dt <= 0 && !F.thudDone.has(i)) { F.thudDone.add(i); restart(wrapRef.current, 'duelw-thud'); }
      const live = !res && dt <= s.warn && (dt > -DU.DUEL_TIMING.lateMs || !!hold);
      const tell = s.feint && dt <= DU.DUEL_TIMING.tell * s.warn;
      const lanes = s.kind === 'sweep' ? [(s.lane + 7) % 8, s.lane, (s.lane + 1) % 8] : [s.lane];
      let alpha = 0;
      let p = 0;
      if (live) {
        p = clamp(1 - dt / s.warn, 0, 1);
        alpha = 0.5 + 0.35 * p;
        if (s.kind === 'heavy' && (hold || dt <= 0)) alpha = 0.8 + 0.15 * Math.sin(t / 70);
        if (tell) alpha *= 0.55;
        if (s.feint && dt < 0) alpha *= clamp(1 - -dt / 320, 0, 1);
        if (s.kind === 'sweep') coreOp = Math.max(coreOp, 0.2 + 0.6 * p);
        else if (!tell) { const h = hold ? 0.5 : 0.04 + 0.34 * p * p; if (h > glow[s.lane]) glow[s.lane] = h; }
        if (s.kind === 'heavy' && !holdAt) holdAt = { s, i };
      } else if (res && res.q !== 'read' && dt <= s.warn) {
        const full = res.q === 'miss' || res.q === 'letgo';
        p = full ? 1 : clamp(1 - (s.zero - res.at) / s.warn, 0, 1);
        alpha = 0.8 * clamp(1 - (t - res.at) / (full ? 260 : 140), 0, 1);
      }
      if (alpha > 0.01) {
        const band = live && !hold && s.kind !== 'heavy' && !tell;
        for (const l of lanes) {
          const cur = fillL[l];
          if (!cur || alpha > cur.alpha) fillL[l] = { alpha, p, col: tell ? C.steel : k.color, dashed: tell, band, warn: s.warn, dt };
        }
      }
    });

    const ripGlow = Array(8).fill(0);
    ripLbl.current.forEach(el => set(el, { opacity: 0 }));
    for (const r of run.rips) {
      if (r.done || t > r.until) continue;
      ripGlow[r.lane] = 0.5 + 0.3 * Math.sin(t / 60);
      set(ripLbl.current[r.lane], { opacity: clamp(((r.until - t) / duel.riposteMs) * 4, 0, 1).toFixed(2) });
    }
    for (let i = 0; i < 8; i++) {
      const bf = F.boxFlash[i];
      if (bf) {
        const age = t - bf.at;
        if (age < 320) { const op = 0.9 * (1 - age / 320); if (op > lit[i].op) { lit[i].op = op; lit[i].c = bf.c; } }
        else F.boxFlash[i] = null;
      }
      const b = boxes.current[i];
      const a = ang(i);
      const fl = fillL[i];
      set(b.lit, { fill: lit[i].c, 'fill-opacity': lit[i].op.toFixed(2) });
      set(pads.current[i].ready, { 'fill-opacity': glow[i].toFixed(2) });
      if (fl) {
        const rF = BOX_OUT - DEPTH * fl.p;
        const open = BOX_OUT - rF > 0.5;
        const fo = fl.alpha.toFixed(2);
        set(b.base, { stroke: fl.col, 'stroke-width': 2.2 });
        for (let j = 0; j < 3; j++) {
          const claw = !!shape.claws;
          const r = claw && j !== 1 ? rF + 6 : rF;
          if ((claw || j === 0) && open && r < BOX_OUT - 0.5) {
            const off = claw ? (j - 1) * 10.5 : 0;
            const w = claw ? 3.6 : shape.half;
            set(b.f[j], { d: sector(a + off - w, a + off + w, r, BOX_OUT), fill: fl.col, 'fill-opacity': fo });
          } else set(b.f[j], { 'fill-opacity': 0 });
        }
        if (open) {
          set(b.rim, {
            d: arc(rF, a, shape.claws ? 14 : shape.half), stroke: fl.dashed ? C.steel : C.fg, 'stroke-width': shape.rim,
            'stroke-dasharray': fl.dashed ? '6 5' : 'none', 'stroke-opacity': clamp(fl.alpha * 1.15, 0, 1).toFixed(2),
          });
        } else set(b.rim, { 'stroke-opacity': 0 });
        if (fl.band) {
          // The green band: the perfect window drawn to scale on the box (it grows and shrinks with the window).
          const dP = clamp((DEPTH * win) / fl.warn, 3, DEPTH * 0.55);
          const inWin = Math.abs(fl.dt) <= win;
          const after = fl.dt < -win;
          set(b.perf, { d: sector(a - HALF, a + HALF, BOX_IN, BOX_IN + dP), fill: after ? C.amber : C.green, 'fill-opacity': (inWin ? 0.85 : after ? 0.3 : 0.5).toFixed(2) });
          set(b.pedge, { d: arc(BOX_IN + dP, a, HALF), stroke: after ? C.amber : C.green, 'stroke-opacity': (after ? 0.4 : 1).toFixed(2) });
        } else {
          set(b.perf, { 'fill-opacity': 0 });
          set(b.pedge, { 'stroke-opacity': 0 });
        }
      } else {
        set(b.base, { stroke: C.line, 'stroke-width': 1.2 });
        b.f.forEach(e => set(e, { 'fill-opacity': 0 }));
        set(b.rim, { 'stroke-opacity': 0 });
        set(b.perf, { 'fill-opacity': 0 });
        set(b.pedge, { 'stroke-opacity': 0 });
      }
      const pf = F.padFlash[i];
      let pop = 0;
      if (pf) {
        const age = t - pf.at;
        if (age < 280) { pop = 0.85 * (1 - age / 280); set(pads.current[i].flash, { fill: pf.c }); }
        else F.padFlash[i] = null;
      }
      if (ripGlow[i] > pop) { pop = ripGlow[i]; set(pads.current[i].flash, { fill: C.green }); }
      set(pads.current[i].flash, { 'fill-opacity': pop.toFixed(2) });
    }
    set(coreRing.current, { 'stroke-opacity': coreOp.toFixed(2), 'fill-opacity': (coreOp * 0.25).toFixed(2) });
    set(dodgeTxt.current, { opacity: coreOp.toFixed(2) });
    const h = holdAt as { s: DU.DuelStrike; i: number } | null;
    if (h) {
      const a = ang(h.s.lane);
      set(holdTxt.current, {
        x: (68 * Math.cos(rad(a))).toFixed(1), y: (68 * Math.sin(rad(a))).toFixed(1),
        opacity: (run.hold[h.i] ? 1 : clamp(1 - (h.s.zero - t) / h.s.warn, 0.3, 1)).toFixed(2),
      });
    } else set(holdTxt.current, { opacity: 0 });
    for (let i = F.bursts.length - 1; i >= 0; i--) {
      const b = F.bursts[i];
      const age = t - b.at;
      if (age > 380 || age < -50) { b.el.remove(); F.bursts.splice(i, 1); continue; }
      const q = Math.max(0, age) / 380;
      set(b.el, { r: (8 + 44 * q).toFixed(1), 'stroke-opacity': (1 - q).toFixed(2), 'stroke-width': (1 + 4 * (1 - q)).toFixed(1) });
    }
    const target = aim ? ang((aim as DU.DuelStrike).lane) : -90;
    const diff = ((target - F.bladeAng + 540) % 360) - 180;
    F.bladeAng += diff * (1 - Math.exp(-dtF / 70));
    set(blade.current, { transform: `rotate(${F.bladeAng.toFixed(1)})` });
  };

  // The loop: advance the rules to now, react, draw. When the duel is over, send the taps.
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const p = phaseRef.current;
      if (p === 'away' || p === 'sending' || p === 'done') return;
      const t = nowT();
      const F = fx.current;
      const dtF = Math.min(64, F.lastFrame ? performance.now() - F.lastFrame : 16);
      F.lastFrame = performance.now();
      if (t < 0) {
        const c = Math.max(1, Math.ceil(-t / 1000));
        setCountdown(prev => (prev === c ? prev : c));
      } else if (p === 'ready') go('run');
      const run = runRef.current;
      DU.advanceRun(run, Math.min(t, duel.endMs));
      flushNotes();
      draw(t, dtF);
      if (t > duel.endMs) {
        DU.finishRun(run);
        flushNotes();
        go('sending');
        void onFinish(run.inputs.slice()).then(v => { setVerdict(v); go('done'); });
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duel.id]);

  // ── Input: which part of the wheel a finger is on ──
  const zoneOf = (e: React.PointerEvent): { zone: 'pad' | 'core' | 'box'; lane: number } | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    const k = 380 / r.width;
    const x = (e.clientX - r.left - r.width / 2) * k;
    const y = (e.clientY - r.top - r.height / 2) * k;
    const d = Math.hypot(x, y);
    if (d < CORE_R) return { zone: 'core', lane: 0 };
    if (d > TAP_BOX_MAX) return null;
    const relDeg = ((((Math.atan2(y, x) * 180) / Math.PI + 90) % 360) + 360) % 360;
    return { zone: d <= TAP_PAD_MAX ? 'pad' : 'box', lane: Math.round(relDeg / 45) % 8 };
  };
  const feed = (code: number) => {
    const p = phaseRef.current;
    if (p !== 'run' && p !== 'ready') return;
    DU.inputRun(runRef.current, [nowT(), code]);
    flushNotes();
  };
  const onDown = (e: React.PointerEvent<SVGSVGElement>) => {
    e.preventDefault();
    e.stopPropagation();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not supported */ }
    const z = zoneOf(e);
    if (!z) return;
    if (z.zone === 'box') { fx.current.padFlash[z.lane] = { c: C.steel, at: nowT() }; return; }
    if (z.zone === 'pad') downs.current.set(e.pointerId, z.lane);
    feed(z.zone === 'core' ? 16 : z.lane);
  };
  const onUp = (e: React.PointerEvent<SVGSVGElement>) => {
    const lane = downs.current.get(e.pointerId);
    if (lane === undefined) return;
    downs.current.delete(e.pointerId);
    feed(lane + 8);
  };

  const toggleSound = () => {
    const next = !sound;
    setSound(next);
    try { localStorage.setItem(SOUND_KEY, next ? 'on' : 'off'); } catch { /* storage blocked */ }
  };

  const allGood = !!verdict?.allPerfect;
  const verdictTitle = !verdict ? 'DUEL OVER'
    : verdict.defeated ? `${(verdict.npcName || duel.npcName).toUpperCase()} DOWN!`
      : allGood ? 'COUNTER!'
        : (verdict.taken ?? 0) === 0 ? 'HELD THE LINE'
          : (verdict.hits ?? 0) * 2 <= real ? 'WEATHERED IT' : 'BATTERED';
  const verdictTone = !verdict ? 'text-white' : verdict.defeated || allGood ? 'text-amber-300' : (verdict.taken ?? 0) === 0 || (verdict.hits ?? 0) * 2 <= real ? 'text-green-300' : 'text-red-300';

  return (
    <MinigameStage
      tone="clash"
      title={`⚔ Duel: ${duel.npcName}`}
      subtitle={`${style.name}: ${style.tag}`}
      right={(
        <button type="button" onClick={toggleSound} aria-label={sound ? 'Sound off' : 'Sound on'} className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-white/15 text-white/80" style={{ touchAction: 'manipulation' }}>
          {sound ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
        </button>
      )}
      footer={(
        <div className="space-y-2">
          <p className="flex justify-center items-center gap-2 text-[13px] text-white/60">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: C.green }} />
            Perfect window <b ref={winRef} className="font-mono text-green-300">±{duel.perfect} ms</b>
            <span className="ml-2 font-mono text-white"><span ref={cntRef}>0</span> / {real}</span>
          </p>
          <div ref={pipsRef} className="flex justify-center flex-wrap gap-1.5 min-h-[14px]" aria-hidden>
            {duel.strikes.map((_, i) => <span key={i} className="duelw-pip" />)}
          </div>
          <p className="text-center text-[12px] text-white/55">Pad = block, tap it again = counter. Hold = heavy. Center = dodge.</p>
        </div>
      )}
    >
      <style>{DUEL_CSS}</style>
      <div ref={vigRef} className="duelw-vig" aria-hidden />
      <div ref={wrapRef} className="relative" style={{ width: 'min(94vw, 56dvh, 460px)', aspectRatio: '1 / 1' }}>
        <svg
          ref={svgRef}
          viewBox="-190 -190 380 380"
          className="absolute inset-0 w-full h-full select-none"
          style={{ touchAction: 'none', pointerEvents: 'auto' }}
          onPointerDown={onDown}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onLostPointerCapture={onUp}
          role="application"
          aria-label="Duel wheel. Tap the pad behind a filling box to block, hold it for heavy blows, tap the center to dodge sweeps, tap the same pad again after a perfect block to counter."
        >
          <circle r={186} fill={C.panel} />
          <polygon
            points={Array.from({ length: 8 }, (_, i) => pt(182, ang(i) + 22.5)).join(' ')}
            fill="none" stroke={style.accent} strokeOpacity={0.6} strokeWidth={2.5} strokeLinejoin="round"
          />
          {Array.from({ length: 8 }, (_, i) => {
            const a = ang(i);
            const b = boxes.current[i];
            const p = pads.current[i];
            return (
              <g key={i}>
                <g>
                  <path ref={el => { b.base = el; }} d={sector(a - HALF, a + HALF, BOX_IN, BOX_OUT)} fill={C.panel2} stroke={C.line} strokeWidth={1.2} />
                  {[0, 1, 2].map(j => <path key={j} ref={el => { b.f[j] = el; }} d="" fill={C.red} fillOpacity={0} pointerEvents="none" />)}
                  <path ref={el => { b.rim = el; }} d="" fill="none" stroke={C.fg} strokeLinecap="round" strokeOpacity={0} pointerEvents="none" />
                  <path ref={el => { b.perf = el; }} d="" fill={C.green} fillOpacity={0} pointerEvents="none" />
                  <path ref={el => { b.pedge = el; }} d="" fill="none" stroke={C.green} strokeWidth={2.2} strokeLinecap="round" strokeOpacity={0} pointerEvents="none" />
                  <path ref={el => { b.lit = el; }} d={sector(a - HALF, a + HALF, BOX_IN, BOX_OUT)} fill={C.red} fillOpacity={0} pointerEvents="none" />
                </g>
                <g>
                  <path d={sector(a - HALF, a + HALF, PAD_IN, PAD_OUT)} fill={C.steel} fillOpacity={0.1} stroke={C.steel} strokeOpacity={0.4} strokeWidth={1.5} />
                  <path ref={el => { p.ready = el; }} d={sector(a - HALF, a + HALF, PAD_IN, PAD_OUT)} fill={C.amber} fillOpacity={0} pointerEvents="none" />
                  <path ref={el => { p.flash = el; }} d={sector(a - HALF, a + HALF, PAD_IN, PAD_OUT)} fill={C.green} fillOpacity={0} pointerEvents="none" />
                </g>
              </g>
            );
          })}
          <text ref={holdTxt} className="duelw-lbl" fill={C.amber} opacity={0}>HOLD</text>
          {Array.from({ length: 8 }, (_, i) => (
            <text
              key={`rip${i}`} ref={el => { ripLbl.current[i] = el; }} className="duelw-lbl" fill={C.green} opacity={0}
              style={{ fontSize: 8, letterSpacing: '.04em' }}
              x={(74 * Math.cos(rad(ang(i)))).toFixed(1)} y={(74 * Math.sin(rad(ang(i)))).toFixed(1)}
            >
              COUNTER
            </text>
          ))}
          <g pointerEvents="none">
            <circle r={44} fill={C.panel2} stroke={C.line} strokeWidth={1.5} />
            <circle ref={coreRing} r={45} fill={C.blue} fillOpacity={0} stroke={C.blue} strokeWidth={4} strokeOpacity={0} />
            <g ref={blade} transform="rotate(-90)">
              <path d="M -8 -4 L 24 -4 L 36 0 L 24 4 L -8 4 Z" fill={C.red} fillOpacity={0.9} />
              <rect x={-12} y={-9} width={5} height={18} rx={1.5} fill={C.amber} />
            </g>
            <circle r={5} fill={C.bg} stroke={C.steel} strokeWidth={1.5} />
          </g>
          <text ref={dodgeTxt} className="duelw-lbl" fill={C.blue} opacity={0} y={24}>DODGE</text>
          <g ref={fxRef} pointerEvents="none" />
        </svg>
        <div ref={popRef} className="duelw-pop" aria-live="polite"><span className="duelw-main" /><span className="duelw-sub" /></div>
        {phase === 'ready' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="duelw-ready">READY</span>
            <span className="font-cinzel text-[28px] text-white/90 tabular-nums">{countdown}</span>
          </div>
        )}
        {(phase === 'sending' || phase === 'done' || phase === 'away') && (
          <div className="absolute inset-0 flex items-center justify-center p-3">
            <div className="w-full max-w-[340px] rounded-2xl border border-white/15 bg-black/90 p-4 space-y-3 text-center">
              {phase === 'sending' && (
                <p className="flex items-center justify-center gap-2 text-[15px] text-white/80"><Loader2 className="w-5 h-5 animate-spin" />The referee is judging…</p>
              )}
              {phase === 'away' && (
                <>
                  <p className="font-cinzel text-[22px] font-bold text-red-300">YOU STEPPED AWAY</p>
                  <p className="text-[14px] text-white/70">Every strike of {duel.npcName}'s flurry lands. The duel settles on its own in a few seconds.</p>
                </>
              )}
              {phase === 'done' && (
                <>
                  <p className={cn('font-cinzel text-[24px] font-bold tracking-wide', verdictTone)}>{verdictTitle}</p>
                  {verdict ? (
                    <>
                      <p className="text-[14px] text-white/80">
                        You dealt <b className="text-amber-200">{verdict.dealt ?? 0}</b> and took <b className="text-red-200">{verdict.taken ?? 0}</b>.
                        {verdict.allPerfect ? ' Every strike answered: the finishing blow lands.' : ''}
                        {verdict.downed ? ' You go down.' : ''}
                      </p>
                      <dl className="grid grid-cols-4 gap-1.5">
                        {[['Perfect', verdict.perfect, 'text-green-300'], ['Block', verdict.block, 'text-amber-300'], ['Counter', verdict.ripostes, 'text-green-300'], ['Hit', verdict.hits, 'text-red-300']].map(([l, v, c]) => (
                          <div key={String(l)} className="rounded-lg bg-white/[0.06] px-1 py-1.5">
                            <dt className="text-[11px] text-white/55">{l}</dt>
                            <dd className={cn('font-mono text-[17px] font-bold', String(c))}>{Number(v ?? 0)}</dd>
                          </div>
                        ))}
                      </dl>
                    </>
                  ) : (
                    <p className="text-[14px] text-white/70">The fight server didn't answer. The duel settles on its own in a few seconds.</p>
                  )}
                </>
              )}
              {phase !== 'sending' && (
                <button type="button" onClick={onClose} className="w-full min-h-[48px] rounded-xl border border-red-500/60 bg-red-900/60 font-cinzel text-[16px] tracking-wider text-white" style={{ touchAction: 'manipulation' }}>
                  Back to the fight
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </MinigameStage>
  );
}

const DUEL_CSS = `
.duelw-pop { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); width:62%; text-align:center; pointer-events:none; opacity:0; }
.duelw-pop .duelw-main { display:block; font:700 clamp(18px,6vw,28px)/1.05 'Cinzel', Georgia, serif; letter-spacing:.05em; text-shadow:0 2px 0 #000,0 0 12px #000; }
.duelw-pop .duelw-sub { display:block; margin-top:3px; font:500 12px ui-monospace, Menlo, monospace; color:hsl(40 18% 92%); text-shadow:0 1px 0 #000,0 0 8px #000; }
.duelw-pop.duelw-show { animation: duelw-pop .8s ease-out; }
.duelw-good .duelw-main { color:hsl(142 76% 55%); }
.duelw-okay .duelw-main { color:hsl(43 96% 56%); }
.duelw-bad .duelw-main { color:hsl(0 84% 60%); }
.duelw-read .duelw-main { color:hsl(215 24% 64%); }
@keyframes duelw-pop { 0% { opacity:0; transform:translate(-50%,-50%) scale(.7); } 14% { opacity:1; transform:translate(-50%,-50%) scale(1.08); } 70% { opacity:1; transform:translate(-50%,-50%) scale(1); } 100% { opacity:0; transform:translate(-50%,-50%) scale(1); } }
.duelw-ready { font:700 24px 'Cinzel', Georgia, serif; letter-spacing:.12em; color:hsl(43 96% 56%); text-shadow:0 2px 0 #000,0 0 14px #000; animation: duelw-breathe .6s ease-in-out infinite alternate; }
@keyframes duelw-breathe { from { opacity:.55; } to { opacity:1; } }
.duelw-shake { animation: duelw-shake .24s linear; }
.duelw-thud { animation: duelw-thud .16s ease-out; }
@keyframes duelw-thud { 0% { transform:scale(1); } 35% { transform:scale(1.012) translateY(2px); } 100% { transform:scale(1); } }
@keyframes duelw-shake { 0%,100% { transform:translate(0,0); } 20% { transform:translate(-5px,2px); } 40% { transform:translate(5px,-2px); } 60% { transform:translate(-3px,-1px); } 80% { transform:translate(3px,1px); } }
.duelw-vig { position:fixed; inset:0; pointer-events:none; opacity:0; box-shadow: inset 0 0 70px 14px hsl(0 84% 50% / .6); }
.duelw-vig.duelw-vig-on { animation: duelw-vig .45s ease-out; }
@keyframes duelw-vig { from { opacity:1; } to { opacity:0; } }
.duelw-lbl { font:700 11px ui-monospace, Menlo, monospace; letter-spacing:.1em; text-anchor:middle; dominant-baseline:central; pointer-events:none; }
.duelw-pip { width:14px; height:14px; border-radius:50%; border:1.5px solid hsl(240 8% 21%); box-sizing:border-box; display:inline-block; }
.duelw-pip.perfect { background:hsl(142 76% 55%); border-color:hsl(142 76% 55%); }
.duelw-pip.rip { background:hsl(142 76% 55%); border:3px solid hsl(43 96% 56%); }
.duelw-pip.block { background:hsl(43 96% 56%); border-color:hsl(43 96% 56%); }
.duelw-pip.hit { background:hsl(0 84% 60%); border-color:hsl(0 84% 60%); }
.duelw-pip.read { border-radius:3px; transform:rotate(45deg); border-color:hsl(215 24% 64%); background:hsl(215 24% 64%); opacity:.6; }
@media (prefers-reduced-motion: reduce) { .duelw-shake, .duelw-thud, .duelw-ready { animation:none; } .duelw-vig.duelw-vig-on, .duelw-pop.duelw-show { animation-duration:1ms; } }
`;
