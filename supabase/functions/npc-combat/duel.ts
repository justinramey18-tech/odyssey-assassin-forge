// Duel (Live NPC Combat v7): the Flurry Parry wheel, as pure rules.
// The same file lives in two places and must stay byte-identical (a test checks it):
//   src/lib/combatDuel.ts                  phones: drawing and instant feedback
//   supabase/functions/npc-combat/duel.ts  the referee: the result that counts
// No imports, no clock and no randomness of its own: callers pass the time and a random source,
// so a phone and the server given the same taps reach the same result.
//
// How a duel plays: eight boxes ring the wheel. A strike fills its box from the outside in, in its colour.
// Tap the pad behind it as the fill reaches the green band (perfect) or near it (block). Heavy (amber):
// hold that pad down through the impact. Sweep (blue, three boxes): tap the center. A feint (dims and
// dashes) never lands: leave it. After a perfect block the same pad says COUNTER: tap it again to hit back.

export type DuelKind = 'slash' | 'lunge' | 'heavy' | 'sweep';
export type DuelStyleKey = 'brute' | 'duelist' | 'savage' | 'soldier';
export type DuelFeel = 'relaxed' | 'standard' | 'tough';
export type DuelPattern = 'mixed' | 'random' | 'steady';
export type DuelSpeed = 'trivial' | 'easy' | 'medium' | 'hard' | 'deadly';
export type DuelQ = 'perfect' | 'block' | 'miss' | 'wrong' | 'early' | 'bait' | 'read' | 'letgo';
/** Random number from 0 (included) to 1 (not included). */
export type DuelRandom = () => number;

// ── Tuning ───────────────────────────────────────────────────────────────────

/** Timing, in ms. A tap from earlyMs before to lateMs after the landing blocks; perfect is the green window. */
export const DUEL_TIMING = {
  earlyMs: 300,
  lateMs: 250,
  /** A heavy must stay held this long after it lands. */
  holdMs: 420,
  /** A feint dims and dashes for the last 35% of its warning. */
  tell: 0.35,
  /** One thumb: a heavy owns the thumb from just before it lands until the hold ends, and a pair is staggered. */
  heavyBeforeMs: 380,
  heavyAfterMs: 720,
  pairGapMs: 200,
  minGapMs: 220,
  /** A counter tap needs this long after the perfect block (so one tap can't count twice). */
  riposteMinMs: 70,
  /** How fast the green window drifts toward its new size. */
  adaptTauMs: 120,
  /** The duel is over this long after the last strike lands. */
  endTailMs: 650,
} as const;
/** The duel's first strike starts filling this long after the server starts it (the READY countdown). */
export const DUEL_LEAD_MS = 3000;
/** A duel nobody sends back settles this long after it ends, as if every strike landed. */
export const DUEL_GRACE_MS = 6000;

export const DUEL_KINDS: Record<DuelKind, { mul: number; wt: number; color: string; label: string }> = {
  slash: { mul: 1, wt: 1, color: 'hsl(0 84% 60%)', label: 'Slash' },
  lunge: { mul: 0.62, wt: 0.8, color: 'hsl(195 90% 80%)', label: 'Lunge' },
  heavy: { mul: 1.45, wt: 1.8, color: 'hsl(43 96% 56%)', label: 'Heavy' },
  sweep: { mul: 1.1, wt: 1.4, color: 'hsl(205 90% 62%)', label: 'Sweep' },
};
const EXTRA_GAP: Record<DuelKind, number> = { slash: 0, lunge: 0, heavy: 0, sweep: 120 };
const SPECIALS: DuelKind[] = ['lunge', 'heavy', 'sweep'];

/** Combat assist: how forgiving the duel is. Relaxed is gentler, Tough is harder. */
export const DUEL_FEEL: Record<DuelFeel, { name: string; win: number; pace: number; strikes: number; trick: number }> = {
  relaxed: { name: 'Relaxed', win: 1.3, pace: 1.12, strikes: -1, trick: 0.5 },
  standard: { name: 'Standard', win: 1, pace: 1, strikes: 0, trick: 1 },
  tough: { name: 'Tough', win: 0.8, pace: 0.9, strikes: 1, trick: 1.3 },
};
export const isDuelFeel = (v: unknown): v is DuelFeel => v === 'relaxed' || v === 'standard' || v === 'tough';

export interface DuelStyle {
  name: string;
  tag: string;
  accent: string;
  mix: Record<'lunge' | 'heavy' | 'sweep', number>;
  warn: number;
  gap: number;
  special: number;
  feints: number;
  doubles: number;
  pattern: DuelPattern;
  /** Drawing only: fill width (half, degrees), rim thickness, claw marks, and a thud on every impact. */
  shape: { half: number; rim: number; claws?: boolean };
  thud?: boolean;
}
/** The NPC's fighting style: its stats pick one (see autoDuelStyle). */
export const DUEL_STYLES: Record<DuelStyleKey, DuelStyle> = {
  brute: { name: 'Brute', tag: 'Slow, heavy and wide.', accent: 'hsl(28 92% 58%)', mix: { lunge: 1, heavy: 5, sweep: 2 }, warn: 1.12, gap: 1.15, special: 10, feints: -10, doubles: -10, pattern: 'steady', shape: { half: 20, rim: 4.5 }, thud: true },
  duelist: { name: 'Duelist', tag: 'Quick, with feints and pairs.', accent: 'hsl(190 90% 74%)', mix: { lunge: 5, heavy: 0, sweep: 1 }, warn: 0.9, gap: 0.88, special: 10, feints: 10, doubles: 5, pattern: 'mixed', shape: { half: 11, rim: 1.6 } },
  savage: { name: 'Savage', tag: 'Wild angles and sweeps.', accent: 'hsl(285 62% 68%)', mix: { lunge: 3, heavy: 1, sweep: 4 }, warn: 1, gap: 0.95, special: 10, feints: 0, doubles: 0, pattern: 'random', shape: { half: 20, rim: 2.2, claws: true } },
  soldier: { name: 'Soldier', tag: 'A steady rhythm.', accent: 'hsl(215 24% 72%)', mix: { lunge: 1, heavy: 1, sweep: 1 }, warn: 1, gap: 1, special: -10, feints: 0, doubles: 0, pattern: 'steady', shape: { half: 20, rim: 2.6 } },
};
export const isDuelStyle = (v: unknown): v is DuelStyleKey => typeof v === 'string' && Object.prototype.hasOwnProperty.call(DUEL_STYLES, v);

/** Damage: each strike that gets through deals one roll of the NPC's damage x npcMult x its share of the flurry. */
export const DUEL_DAMAGE = {
  npcMult: 1.5,
  /** Each counter: one roll of the player's weapon x this. */
  riposteMult: 0.5,
  /** Every strike perfect: a finishing blow of one weapon roll x this. */
  finisherMult: 1.5,
};

/** The Duel bar: fills with damage dealt and taken (about 5 exchanges), empties when a duel starts. */
export const DUEL_CHARGE = { max: 100, perPct: 1.3, least: 4, most: 30 };
/** Duel charge for losing (or dealing) `lost` HP out of `maxHp`: 1.3 per 1% of max HP, 4 to 30 per hit. */
export function duelChargeGain(lost: number, maxHp: number): number {
  if (!(lost > 0)) return 0;
  const pct = (100 * lost) / Math.max(1, maxHp);
  return Math.round(clamp(DUEL_CHARGE.perPct * pct, DUEL_CHARGE.least, DUEL_CHARGE.most) * 10) / 10;
}
export const duelChargeNow = (v: unknown): number => clamp(typeof v === 'number' && Number.isFinite(v) ? v : 0, 0, DUEL_CHARGE.max);

// ── Stats → numbers ──────────────────────────────────────────────────────────

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const snap = (v: number, step: number, lo: number, hi: number) => clamp(Math.round(v / step) * step, lo, hi);
const modOf = (n: number) => Math.floor((n - 10) / 2);
const profOf = (l: number) => Math.ceil(clamp(l, 1, 20) / 4) + 1;
export const DUEL_TIERS: DuelSpeed[] = ['trivial', 'easy', 'medium', 'hard', 'deadly'];
const tierOf = (s: unknown) => Math.max(0, DUEL_TIERS.indexOf(s as DuelSpeed));

export interface DuelFighters {
  /** The player: level, DEX score, AC, max HP. */
  level: number;
  dex: number;
  ac: number;
  maxHp: number;
  /** The NPC: attack bonus, average damage of one hit, Speed preset. */
  npcAttack: number;
  npcDamageAvg: number;
  npcSpeed: DuelSpeed | string;
  style?: DuelStyleKey | 'auto';
  feel?: DuelFeel;
}

/** Hits hard (a full flurry is 28%+ of the player's HP) and/or fast (Speed hard+ or attack +7). */
export function autoDuelStyle(F: DuelFighters): DuelStyleKey {
  const hard = (F.npcDamageAvg * DUEL_DAMAGE.npcMult) / Math.max(1, F.maxHp) >= 0.28;
  const fast = tierOf(F.npcSpeed) >= 3 || F.npcAttack >= 7;
  return hard && fast ? 'savage' : hard ? 'brute' : fast ? 'duelist' : 'soldier';
}

export interface DuelParams {
  style: DuelStyleKey;
  feel: DuelFeel;
  /** Player reflex (DEX mod + proficiency) and edge over the NPC (reflex - its attack bonus). */
  reflex: number;
  edge: number;
  strikes: number;
  warn: number;
  gap: number;
  ramp: number;
  special: number;
  feints: number;
  doubles: number;
  /** Starting perfect window, either side (ms). */
  perfect: number;
  /** Share of a strike a plain block still lets through. */
  block: number;
  /** How long the COUNTER pad stays open after a perfect block (ms). */
  riposteMs: number;
}

/** Everything the two fighters' stats decide. Stronger player = wider window, longer counter, softer blocks. */
export function deriveDuel(F: DuelFighters): DuelParams {
  const t = tierOf(F.npcSpeed);
  const atk = clamp(Math.round(F.npcAttack) || 0, -5, 20);
  const style = F.style && F.style !== 'auto' && isDuelStyle(F.style) ? F.style : autoDuelStyle(F);
  const S = DUEL_STYLES[style];
  const feel = isDuelFeel(F.feel) ? F.feel : 'standard';
  const E = DUEL_FEEL[feel];
  const reflex = modOf(clamp(Math.round(F.dex) || 10, 1, 30)) + profOf(Math.round(F.level) || 1);
  const edge = reflex - atk;
  const ac = clamp(Math.round(F.ac) || 10, 1, 40);
  return {
    style, feel, reflex, edge,
    strikes: clamp(3 + Math.round(atk / 2) + t + E.strikes, 4, 12),
    warn: snap((960 - 50 * t - 8 * atk) * S.warn * E.pace, 10, 500, 1400),
    gap: snap((760 - 70 * t - 8 * atk) * S.gap * E.pace, 10, 300, 1000),
    ramp: snap(6 * t, 5, 0, 50),
    special: snap(12 * t + S.special, 5, 0, 100),
    feints: snap(((t >= 3 ? 10 * (t - 2) : 0) + S.feints) * E.trick, 5, 0, 40),
    doubles: snap(((t >= 4 ? 10 : 0) + S.doubles) * E.trick, 5, 0, 30),
    perfect: snap((130 + 10 * edge) * E.win, 10, 60, 200),
    block: clamp(0.5 - 0.04 * (ac - 10 - atk), 0.25, 0.75),
    riposteMs: snap(520 + 40 * reflex, 10, 520, 900),
  };
}

// ── The flurry ───────────────────────────────────────────────────────────────

export interface DuelStrike {
  lane: number;
  kind: DuelKind;
  feint: boolean;
  /** The second of a quick pair. */
  second?: boolean;
  /** ms from the duel's start until it lands, and how long its box takes to fill. */
  zero: number;
  warn: number;
}

export interface Duel {
  v: 1;
  id: string;
  /** The NPC's fighter row and name. */
  npcId: string;
  npcName: string;
  /** Server time (ms) the first box starts filling. */
  startAt: number;
  finish: 'knockout' | 'kill';
  weapon: string | null;
  style: DuelStyleKey;
  feel: DuelFeel;
  perfect: number;
  block: number;
  riposteMs: number;
  strikes: DuelStrike[];
  /** ms from the start until the duel is over. */
  endMs: number;
}

interface Pat { lane: number; kind: DuelKind; feint: boolean; slot: number; second?: boolean }

function makePattern(P: DuelParams, rand: DuelRandom): Pat[] {
  const out: Pat[] = [];
  const S = DUEL_STYLES[P.style];
  const pattern = S.pattern;
  const steady = pattern === 'steady';
  let prev = -1;
  let dir = rand() < 0.5 ? 1 : -1;
  let slot = 0;
  const wts = SPECIALS.map(k => S.mix[k as 'lunge' | 'heavy' | 'sweep']);
  const wsum = wts.reduce((a, b) => a + b, 0);
  const pickSpecial = (): DuelKind => {
    let r = rand() * wsum;
    for (let i = 0; i < SPECIALS.length; i++) {
      r -= wts[i];
      if (r < 0) return SPECIALS[i];
    }
    return SPECIALS[SPECIALS.length - 1];
  };
  const jump = () => {
    let l: number;
    do { l = Math.floor(rand() * 8); } while (l === prev);
    return l;
  };
  while (out.length < P.strikes) {
    let lane: number;
    if (prev < 0 || pattern === 'random') lane = jump();
    else if (rand() < (steady ? 0.88 : 0.55)) {
      if (rand() < (steady ? 0.08 : 0.2)) dir = -dir;
      lane = (prev + dir * (rand() < (steady ? 0.9 : 0.75) ? 1 : 2) + 16) % 8;
    } else lane = jump();
    if (lane === prev) lane = jump();
    prev = lane;
    const left = P.strikes - out.length;
    const kind: DuelKind = rand() * 100 < P.special ? pickSpecial() : 'slash';
    if (kind === 'slash' && left >= 2 && slot > 0 && rand() * 100 < P.doubles) {
      const other = (lane + 3 + Math.floor(rand() * 3)) % 8;
      out.push({ lane, kind, feint: false, slot }, { lane: other, kind: 'slash', feint: false, slot, second: true });
    } else {
      out.push({ lane, kind, feint: kind === 'slash' && slot > 0 && left > 1 && rand() * 100 < P.feints, slot });
    }
    slot++;
  }
  return out;
}

const lanesOf = (kind: DuelKind, lane: number) => (kind === 'sweep' ? [(lane + 7) % 8, lane, (lane + 1) % 8] : [lane]);

/** A sweep and another strike are never on screen from the same direction at the same time. */
function fixLanes(items: DuelStrike[], P: DuelParams, rand: DuelRandom): void {
  const T = DUEL_TIMING;
  const span = (it: DuelStrike) => [it.zero - it.warn, it.zero + T.lateMs + (it.kind === 'heavy' ? T.holdMs : 0)];
  const overlap = (a: DuelStrike, b: DuelStrike) => {
    const [a0, a1] = span(a);
    const [b0, b1] = span(b);
    return a0 < b1 && b0 < a1;
  };
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const bad = (kind: DuelKind, lane: number) =>
      items.slice(0, i).some(o => overlap(it, o) && lanesOf(kind, lane).some(l => lanesOf(o.kind, o.lane).includes(l)));
    const pick = (kind: DuelKind) => {
      const order = [0, 1, 2, 3, 4, 5, 6, 7];
      for (let j = order.length - 1; j > 0; j--) {
        const k = Math.floor(rand() * (j + 1));
        [order[j], order[k]] = [order[k], order[j]];
      }
      return order.find(l => !bad(kind, l));
    };
    if (!bad(it.kind, it.lane)) continue;
    let l = pick(it.kind);
    if (l === undefined && it.kind === 'sweep') {
      it.kind = 'slash';
      it.warn = P.warn;
      l = bad('slash', it.lane) ? pick('slash') : it.lane;
    }
    // Still no free direction: the rest of the flurry waits a beat.
    for (let t = 0; l === undefined && t < 20; t++) {
      for (let j = i; j < items.length; j++) items[j].zero += 120;
      l = bad(it.kind, it.lane) ? pick(it.kind) : it.lane;
    }
    if (l !== undefined) it.lane = l;
  }
}

/** The flurry's strikes, timed from 0 (the first box starts filling). */
export function buildStrikes(P: DuelParams, rand: DuelRandom): DuelStrike[] {
  const T = DUEL_TIMING;
  const pattern = makePattern(P, rand);
  const slots = pattern[pattern.length - 1].slot + 1;
  const offs: number[] = [];
  const inSlot = (k: number) => pattern.filter(p => p.slot === k);
  let acc = 0;
  for (let k = 0; k < slots; k++) {
    offs[k] = acc;
    const here = inSlot(k);
    const extra = Math.max(...here.map(p => EXTRA_GAP[p.kind]));
    let gap = Math.max(T.minGapMs, P.gap * (1 - (P.ramp / 100) * (slots > 1 ? k / (slots - 1) : 0))) + extra;
    if (here.some(p => p.kind === 'heavy')) gap = Math.max(gap, T.heavyAfterMs);
    if (inSlot(k + 1).some(p => p.kind === 'heavy')) gap = Math.max(gap, T.heavyBeforeMs);
    acc += (here.some(p => p.second) ? T.pairGapMs : 0) + gap;
  }
  const base = Math.max(...inSlot(0).map(p => P.warn * DUEL_KINDS[p.kind].mul));
  const items: DuelStrike[] = pattern.map(p => ({
    lane: p.lane, kind: p.kind, feint: p.feint, ...(p.second ? { second: true } : {}),
    warn: Math.round(P.warn * DUEL_KINDS[p.kind].mul),
    zero: Math.round(base + offs[p.slot] + (p.second ? T.pairGapMs : 0)),
  }));
  fixLanes(items, P, rand);
  return items;
}

/** A new duel, ready to store on the player's fighter row (minigame.duel). */
export function newDuel(
  o: { id: string; npcId: string; npcName: string; startAt: number; finish: 'knockout' | 'kill'; weapon: string | null },
  P: DuelParams, rand: DuelRandom,
): Duel {
  const strikes = buildStrikes(P, rand);
  const last = Math.max(...strikes.map(s => s.zero));
  return {
    v: 1, id: o.id, npcId: o.npcId, npcName: o.npcName.slice(0, 80), startAt: Math.round(o.startAt), finish: o.finish,
    weapon: o.weapon ? o.weapon.slice(0, 80) : null, style: P.style, feel: P.feel, perfect: P.perfect,
    block: Math.round(P.block * 1000) / 1000, riposteMs: P.riposteMs, strikes, endMs: last + DUEL_TIMING.endTailMs,
  };
}

const KINDS: DuelKind[] = ['slash', 'lunge', 'heavy', 'sweep'];
/** A checked copy of a stored duel, or null. */
export function cleanDuel(raw: unknown): Duel | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : NaN);
  if (r.v !== 1 || typeof r.id !== 'string' || typeof r.npcId !== 'string' || !Array.isArray(r.strikes)) return null;
  const strikes: DuelStrike[] = [];
  for (const s of r.strikes.slice(0, 40)) {
    const x = (s ?? {}) as Record<string, unknown>;
    const lane = num(x.lane);
    const zero = num(x.zero);
    const warn = num(x.warn);
    if (!KINDS.includes(x.kind as DuelKind) || !(lane >= 0 && lane < 8) || !Number.isFinite(zero) || !(warn > 0)) return null;
    strikes.push({ lane: Math.floor(lane), kind: x.kind as DuelKind, feint: x.feint === true, ...(x.second === true ? { second: true } : {}), warn, zero });
  }
  const startAt = num(r.startAt);
  const endMs = num(r.endMs);
  if (strikes.length === 0 || !Number.isFinite(startAt) || !Number.isFinite(endMs)) return null;
  return {
    v: 1, id: r.id, npcId: r.npcId, npcName: typeof r.npcName === 'string' ? r.npcName : 'The enemy', startAt, endMs, strikes,
    finish: r.finish === 'kill' ? 'kill' : 'knockout', weapon: typeof r.weapon === 'string' ? r.weapon : null,
    style: isDuelStyle(r.style) ? r.style : 'soldier', feel: isDuelFeel(r.feel) ? r.feel : 'standard',
    perfect: clamp(num(r.perfect) || 120, 40, 260), block: clamp(num(r.block) || 0.5, 0, 1), riposteMs: clamp(num(r.riposteMs) || 650, 0, 2000),
  };
}

/** Each real strike's share of the flurry's damage (feints count as much as a strike of their kind if you bite). */
export function strikeShares(duel: Duel): number[] {
  const total = duel.strikes.filter(s => !s.feint).reduce((a, s) => a + DUEL_KINDS[s.kind].wt, 0) || 1;
  return duel.strikes.map(s => DUEL_KINDS[s.kind].wt / total);
}

// ── Playing it: one run, fed taps in order ───────────────────────────────────
// Inputs are [ms since startAt, code]: 0-7 press pad 0-7 (0 = top, clockwise), 8-15 release pad (code - 8), 16 tap the center.
// The phone feeds real taps as they happen and calls advanceRun every frame; the server replays the same list.
// Both reach the same result because everything that happens on its own (a miss, a heavy hold ending) is
// worked out at its exact moment, not at frame times.

export type DuelInput = [number, number];
export interface DuelNote {
  at: number;
  type: 'resolve' | 'riposte' | 'hold' | 'pad';
  i?: number;
  q?: DuelQ;
  off?: number | null;
  lane?: number | null;
  zone?: 'pad' | 'core' | null;
}
interface Rip { lane: number; born: number; until: number; idx: number; done: boolean }
export interface DuelRun {
  duel: Duel;
  res: ({ q: DuelQ; off: number | null; at: number } | null)[];
  hold: ({ start: number; end: number } | null)[];
  checked: boolean[];
  held: number[];
  rips: Rip[];
  ripostes: number;
  ripIdx: number[];
  form: number;
  win: { at: number; val: number; target: number };
  t: number;
  notes: DuelNote[];
  inputs: DuelInput[];
  done: boolean;
}

export function startRun(duel: Duel): DuelRun {
  const n = duel.strikes.length;
  return {
    duel, res: Array(n).fill(null), hold: Array(n).fill(null), checked: Array(n).fill(false), held: Array(8).fill(0),
    rips: [], ripostes: 0, ripIdx: [], form: 0, win: { at: -1e9, val: duel.perfect, target: duel.perfect },
    t: -1e9, notes: [], inputs: [], done: false,
  };
}

/** The green window (ms, either side) at time t. It shrinks while you do well and grows while you struggle. */
export function duelWindow(run: DuelRun, t: number): number {
  const w = run.win;
  return w.target + (w.val - w.target) * Math.exp(-Math.max(0, t - w.at) / DUEL_TIMING.adaptTauMs);
}

function settle(run: DuelRun, i: number, q: DuelQ, off: number | null, at: number, zone: 'pad' | 'core' | null, lane: number | null): void {
  const s = run.duel.strikes[i];
  run.res[i] = { q, off, at };
  run.hold[i] = null;
  if (!s.feint || q === 'bait') {
    const delta = q === 'perfect' ? 1 : q === 'block' ? 0.25 : q === 'read' ? run.form : -1;
    const form = clamp(run.form + (delta - run.form) * 0.3, -1, 1);
    if (form !== run.form) {
      const val = duelWindow(run, at);
      run.form = form;
      const k = -form;
      run.win = { at, val, target: clamp(run.duel.perfect * (1 + (k > 0 ? 0.5 : 0.22) * k), 40, 260) };
    }
  }
  if (q === 'perfect' && s.kind !== 'sweep' && !s.feint) {
    run.rips.push({ lane: s.lane, born: at, until: at + run.duel.riposteMs, idx: i, done: false });
  }
  run.notes.push({ at, type: 'resolve', i, q, off, zone, lane });
}

/** The next thing due on its own at or before t: [time, strike, what]. */
function nextDue(run: DuelRun, t: number): [number, number, 'check' | 'holdEnd' | 'deadline'] | null {
  let best: [number, number, 'check' | 'holdEnd' | 'deadline'] | null = null;
  const consider = (at: number, i: number, what: 'check' | 'holdEnd' | 'deadline', strict: boolean) => {
    if (strict ? !(at < t) : !(at <= t)) return;
    if (!best || at < best[0]) best = [at, i, what];
  };
  run.duel.strikes.forEach((s, i) => {
    if (run.res[i]) return;
    const h = run.hold[i];
    if (h) { consider(h.end, i, 'holdEnd', false); return; }
    if (s.kind === 'heavy' && !run.checked[i]) consider(s.zero, i, 'check', false);
    // A strike nobody answered lands just after its late window (a tap exactly on the edge still counts).
    consider(s.zero + DUEL_TIMING.lateMs, i, 'deadline', true);
  });
  return best;
}

/** Moves the run's clock to t, settling everything that happens on its own on the way. */
export function advanceRun(run: DuelRun, t: number): void {
  if (run.done) return;
  for (let guard = 0; guard < 400; guard++) {
    const d = nextDue(run, t);
    if (!d) break;
    const [at, i, what] = d;
    const s = run.duel.strikes[i];
    if (what === 'check') {
      run.checked[i] = true;
      // A heavy only asks for its pad to be down as it lands. When you started holding doesn't matter.
      if (run.held[s.lane] > 0) {
        run.hold[i] = { start: at, end: Math.max(s.zero + DUEL_TIMING.holdMs, at + 250) };
        run.notes.push({ at, type: 'hold', i, lane: s.lane });
      }
    } else if (what === 'holdEnd') {
      settle(run, i, 'perfect', 0, at, 'pad', s.lane);
    } else {
      settle(run, i, s.feint ? 'read' : 'miss', null, at, null, null);
    }
  }
  if (t > run.t) run.t = t;
}

/** One input, at its time. Inputs must come in time order. */
export function inputRun(run: DuelRun, input: DuelInput): void {
  if (run.done) return;
  const [T, code] = input;
  if (!Number.isFinite(T) || !Number.isInteger(code) || code < 0 || code > 16) return;
  if (T < run.t || T > run.duel.endMs) return;
  advanceRun(run, T);
  run.inputs.push([T, code]);
  const D = run.duel;
  const TM = DUEL_TIMING;
  if (code >= 8 && code <= 15) {
    const lane = code - 8;
    run.held[lane] = Math.max(0, run.held[lane] - 1);
    if (run.held[lane] === 0) {
      D.strikes.forEach((s, i) => {
        if (!run.res[i] && run.hold[i] && s.lane === lane) settle(run, i, 'letgo', 0, T, 'pad', lane);
      });
    }
    return;
  }
  const zone: 'pad' | 'core' = code === 16 ? 'core' : 'pad';
  const lane = code === 16 ? 0 : code;
  if (zone === 'pad') run.held[lane] += 1;
  if (T < -200) return;
  tap(run, zone, lane, T);
  // A heavy coming in on this pad: pressing it any time from its landing to the end of its late window starts the hold.
  if (zone === 'pad') {
    D.strikes.forEach((s, i) => {
      if (s.kind !== 'heavy' || run.res[i] || run.hold[i] || s.lane !== lane) return;
      if (T >= s.zero && T <= s.zero + TM.lateMs) {
        run.checked[i] = true;
        run.hold[i] = { start: T, end: Math.max(s.zero + TM.holdMs, T + 250) };
        run.notes.push({ at: T, type: 'hold', i, lane });
      }
    });
  }
}

function tap(run: DuelRun, zone: 'pad' | 'core', lane: number, T: number): void {
  const D = run.duel;
  const TM = DUEL_TIMING;
  const open = D.strikes.map((s, i) => ({ s, i }))
    .filter(({ s, i }) => !run.res[i] && !run.hold[i] && s.kind !== 'heavy' && T >= s.zero - TM.earlyMs && T <= s.zero + TM.lateMs);
  const byTime = (a: { s: DuelStrike }, b: { s: DuelStrike }) => Math.abs(T - a.s.zero) - Math.abs(T - b.s.zero);
  const m = (zone === 'pad'
    ? open.filter(({ s }) => s.kind !== 'sweep' && s.lane === lane)
    : open.filter(({ s }) => s.kind === 'sweep')).sort(byTime)[0];
  if (m) {
    const off = T - m.s.zero;
    if (m.s.feint) { settle(run, m.i, 'bait', off, T, zone, lane); return; }
    settle(run, m.i, Math.abs(off) <= duelWindow(run, T) ? 'perfect' : 'block', off, T, zone, lane);
    return;
  }
  if (zone === 'pad') {
    const r = run.rips.find(x => x.lane === lane && !x.done && T <= x.until && T - x.born >= TM.riposteMinMs);
    if (r) {
      r.done = true;
      run.ripostes += 1;
      run.ripIdx.push(r.idx);
      run.notes.push({ at: T, type: 'riposte', i: r.idx, lane });
      return;
    }
    // Grabbing a heavy's pad while it is coming in is never a mistake on another strike.
    const grabbing = D.strikes.some((s, i) => s.kind === 'heavy' && !run.res[i] && s.lane === lane
      && T >= s.zero - s.warn - 100 && T <= s.zero + TM.lateMs + TM.holdMs);
    if (grabbing) { run.notes.push({ at: T, type: 'pad', lane, zone }); return; }
  }
  const wrong = open.filter(({ s }) => !s.feint).sort(byTime)[0];
  if (wrong) { settle(run, wrong.i, 'wrong', T - wrong.s.zero, T, zone, lane); return; }
  const compat = (s: DuelStrike) => (zone === 'pad' ? s.kind !== 'sweep' && s.kind !== 'heavy' : s.kind === 'sweep');
  const nextIdx = D.strikes.findIndex((s, i) => !run.res[i] && !run.hold[i] && !s.feint && s.zero > T && compat(s));
  if (nextIdx >= 0) {
    const next = D.strikes[nextIdx];
    if (next.zero - T < next.warn + 400) { settle(run, nextIdx, 'early', T - next.zero, T, zone, lane); return; }
  }
  run.notes.push({ at: T, type: 'pad', lane, zone });
}

export interface DuelOutcome {
  results: DuelQ[];
  perfect: number;
  block: number;
  hits: number;
  ripostes: number;
  /** Every real strike perfect: the finishing blow lands. */
  allPerfect: boolean;
  /** For each strike, how much of its share reaches the player: 0, the block share, or 1. */
  through: number[];
  feintsRead: number;
  feintsBit: number;
}

/** Ends the run (anything unanswered lands) and counts it up. */
export function finishRun(run: DuelRun): DuelOutcome {
  advanceRun(run, run.duel.endMs + 1);
  run.duel.strikes.forEach((s, i) => {
    if (!run.res[i]) settle(run, i, s.feint ? 'read' : 'miss', null, run.duel.endMs, null, null);
  });
  run.done = true;
  const results = run.res.map(r => (r as { q: DuelQ }).q);
  const real = run.duel.strikes.map((s, i) => ({ s, q: results[i] })).filter(x => !x.s.feint);
  const count = (q: DuelQ) => real.filter(x => x.q === q).length;
  const perfect = count('perfect');
  const block = count('block');
  return {
    results, perfect, block, hits: real.length - perfect - block, ripostes: run.ripostes,
    allPerfect: real.length > 0 && perfect === real.length,
    through: results.map(q => (q === 'perfect' || q === 'read' ? 0 : q === 'block' ? run.duel.block : 1)),
    feintsRead: results.filter(q => q === 'read').length,
    feintsBit: results.filter(q => q === 'bait').length,
  };
}

/** The referee: replays a phone's taps (sorted by time, at most 400) and returns the outcome. */
export function replayDuel(duel: Duel, inputs: unknown): DuelOutcome {
  const run = startRun(duel);
  const list = (Array.isArray(inputs) ? inputs : [])
    .slice(0, 400)
    .filter((x): x is DuelInput => Array.isArray(x) && x.length === 2 && Number.isFinite(x[0]) && Number.isInteger(x[1]) && x[1] >= 0 && x[1] <= 16)
    .map(x => [Math.round(x[0]), x[1]] as DuelInput)
    .filter(x => x[0] <= duel.endMs)
    .map((x, k) => ({ x, k }))
    .sort((a, b) => a.x[0] - b.x[0] || a.k - b.k)
    .map(o => o.x);
  for (const x of list) inputRun(run, x);
  return finishRun(run);
}

/** A seeded random source (mulberry32), for tests and replays. */
export function seededRandom(seed: number): DuelRandom {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
