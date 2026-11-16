// Combat mini-games (Live NPC Combat v6): Counter Clash and Tug & Slip, as pure rules.
// The same file lives in two places and must stay byte-identical (a test checks it):
//   src/lib/combatMinigames.ts                  phones: drawing and instant feedback
//   supabase/functions/npc-combat/minigames.ts  the referee: the result that counts
// No imports, no clock and no randomness of its own: callers pass the time and the dice,
// so a phone and the server given the same tap reach the same result.

/** Dice: roll(n) returns a whole number from 1 to n. */
export type Roller = (sides: number) => number;

// ── Counter Clash ────────────────────────────────────────────────────────────
// A big NPC move (heavy blow, signature, sweep, pin) comes as a chain of swings. For each swing a circle
// shrinks onto a ring on the target's phone; a tap in the right third of the ring as it lands blocks or
// parries it. Every swing perfect = no damage, the NPC staggers, and the player lands a free counter.

export type ClashMove = 'heavy' | 'signature' | 'sweep' | 'pin';
export const CLASH_MOVES: ClashMove[] = ['heavy', 'signature', 'sweep', 'pin'];
export const isClashMove = (v: unknown): v is ClashMove => typeof v === 'string' && (CLASH_MOVES as string[]).includes(v);

/** Swings in each chain. A sweep is one swing, but every target gets their own ring. */
export const CLASH_SWINGS: Record<ClashMove, number> = { heavy: 2, signature: 3, sweep: 1, pin: 1 };
/** How long the circle takes to shrink onto the ring (ms). It moves at an even speed, so the bands are to scale. */
export const CLASH_SHRINK_MS: Record<ClashMove, number> = { heavy: 1100, signature: 1000, sweep: 1200, pin: 1200 };
/** Feints in 10: the chance that a swing is a fake first. */
export const FEINT_IN_10: Record<ClashMove, number> = { heavy: 3, signature: 5, sweep: 3, pin: 3 };

export interface ClashWindow { perfectMs: number; earlyMs: number; lateMs: number }
/** Perfect = within perfectMs of the landing. Block = from earlyMs before to lateMs after. */
export const CLASH_WINDOW: ClashWindow = { perfectMs: 120, earlyMs: 300, lateMs: 250 };
export const CLASH_WINDOW_SIGNATURE: ClashWindow = { perfectMs: 80, earlyMs: 220, lateMs: 180 };
export const clashWindow = (move: ClashMove): ClashWindow => (move === 'signature' ? CLASH_WINDOW_SIGNATURE : CLASH_WINDOW);

/** Time between one swing landing and the next one's fake or real landing. */
export const SWING_GAP_MS = 850;
/** A feint fakes a landing, snaps back, and the real swing lands this much later. */
export const FEINT_EXTRA_MS = 600;
/** The hit happens this long after the last swing lands, so late taps on slow connections still count. */
export const CLASH_HOLD_MS = 450;
/** Counter damage: weapon damage times this (signature moves give more). */
export const COUNTER_MULT = 1.5;
export const COUNTER_MULT_SIGNATURE = 2;
/** Riposte: this many perfect chains in a row makes the counter a critical hit, then the count starts again. */
export const RIPOSTE_STREAK = 3;
/** A blocked (not perfect) Pin swing: the struggle starts with the knot this far toward you instead of the middle. */
export const BLOCKED_PIN_KNOT = 70;

export type Side = 'left' | 'top' | 'right';
export const SIDES: Side[] = ['left', 'top', 'right'];
const isSide = (v: unknown): v is Side => v === 'left' || v === 'top' || v === 'right';

/** One swing. `off` = when it really lands, in ms before the hit (0 or less). A feint fakes a landing FEINT_EXTRA_MS earlier. */
export interface Swing { off: number; side: Side; feint: boolean }
export interface Clash { id: string; move: ClashMove; swings: Swing[] }

/** How a tap went: perfect (no damage), block (half), wrong side, took the bait on a feint, too early. */
export type ClashQ = 'perfect' | 'block' | 'wrong' | 'bait' | 'early';
const isQ = (v: unknown): v is ClashQ => v === 'perfect' || v === 'block' || v === 'wrong' || v === 'bait' || v === 'early';
export const CLASH_LABEL: Record<ClashQ, string> = {
  perfect: 'PERFECT!', block: 'Blocked', wrong: 'Wrong side!', bait: 'Took the bait!', early: 'Too early',
};

/** A new chain for a move, timed from the hit backwards. */
export function buildClash(id: string, move: ClashMove, roll: Roller): Clash {
  const count = CLASH_SWINGS[move];
  const raw: Array<{ at: number; side: Side; feint: boolean }> = [];
  let t = 0;
  for (let i = 0; i < count; i++) {
    const feint = roll(10) <= FEINT_IN_10[move];
    const at = t + (feint ? FEINT_EXTRA_MS : 0);
    raw.push({ at, side: SIDES[Math.max(0, Math.min(2, roll(3) - 1))], feint });
    t = at + SWING_GAP_MS;
  }
  const hit = raw[raw.length - 1].at + CLASH_HOLD_MS;
  return { id, move, swings: raw.map(s => ({ off: s.at - hit, side: s.side, feint: s.feint })) };
}

/** A checked copy of a stored chain (pending.clash), or null. */
export function cleanClash(raw: unknown): Clash | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || !r.id || !isClashMove(r.move) || !Array.isArray(r.swings)) return null;
  const swings: Swing[] = [];
  for (const s of r.swings) {
    if (!s || typeof s !== 'object') return null;
    const x = s as Record<string, unknown>;
    const off = Number(x.off);
    if (!Number.isFinite(off) || off > 0 || off < -20_000 || !isSide(x.side)) return null;
    swings.push({ off, side: x.side, feint: x.feint === true });
  }
  if (swings.length === 0 || swings.length > 5) return null;
  return { id: r.id, move: r.move, swings };
}

/** When a swing really lands, and when its feint fakes a landing (null if it isn't a feint). */
export function swingTimes(s: Swing, hitAt: number): { zero: number; fake: number | null } {
  const zero = hitAt + s.off;
  return { zero, fake: s.feint ? zero - FEINT_EXTRA_MS : null };
}

/** When the first circle starts shrinking: from then on the chain is under way. */
export function clashStartsAt(c: Clash, hitAt: number): number {
  const first = swingTimes(c.swings[0], hitAt);
  return (first.fake ?? first.zero) - CLASH_SHRINK_MS[c.move];
}

/** True once the first circle is on the ring: a hit on the NPC no longer pushes the move back. */
export const clashUnderWay = (c: Clash, hitAt: number, now: number): boolean => now >= clashStartsAt(c, hitAt);

/** A player's stored taps for one chain (minigame.clash), or an empty list when they belong to another chain. */
export function clashResultsOf(minigame: unknown, clashId: string): Array<ClashQ | null> {
  const m = minigame && typeof minigame === 'object' ? (minigame as Record<string, unknown>).clash : null;
  if (!m || typeof m !== 'object') return [];
  const c = m as Record<string, unknown>;
  if (c.id !== clashId || !Array.isArray(c.r)) return [];
  return c.r.slice(0, 5).map(q => (isQ(q) ? q : null));
}

/**
 * Judges one tap. It goes to the first swing not yet tapped whose window is still open.
 * Null = the tap doesn't count (nothing on the ring yet, or every window has closed).
 */
export function judgeClash(
  c: Clash, hitAt: number, tapAt: number, side: Side, results: Array<ClashQ | null | undefined>,
): { index: number; q: ClashQ } | null {
  const w = clashWindow(c.move);
  const shrink = CLASH_SHRINK_MS[c.move];
  for (let i = 0; i < c.swings.length; i++) {
    if (results[i]) continue;
    const s = c.swings[i];
    const { zero, fake } = swingTimes(s, hitAt);
    if (tapAt > zero + w.lateMs) continue;
    const first = fake ?? zero;
    if (tapAt < first - shrink) return null;
    const off = tapAt - zero;
    let q: ClashQ;
    if (off < -w.earlyMs) q = fake !== null && tapAt >= fake - w.earlyMs ? 'bait' : 'early';
    else q = Math.abs(off) <= w.perfectMs ? 'perfect' : 'block';
    if ((q === 'perfect' || q === 'block') && side !== s.side) q = 'wrong';
    return { index: i, q };
  }
  return null;
}

/** Share of the damage a swing still deals: perfect none, block half, anything else (or no tap) all. */
export const clashFactor = (q: ClashQ | null | undefined): number => (q === 'perfect' ? 0 : q === 'block' ? 0.5 : 1);
/** The damage multiplier for a whole chain: each swing carries an equal share. */
export function chainScale(c: Clash, results: Array<ClashQ | null | undefined>): number {
  const n = c.swings.length;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += clashFactor(results[i]);
  return sum / n;
}
export const chainPerfect = (c: Clash, results: Array<ClashQ | null | undefined>): boolean =>
  c.swings.every((_, i) => results[i] === 'perfect');

/** The Riposte count after a chain: a perfect chain adds one, anything else starts again. */
export function nextClashStreak(prev: number, perfect: boolean): { streak: number; riposte: boolean } {
  if (!perfect) return { streak: 0, riposte: false };
  const n = (Number.isFinite(prev) && prev > 0 ? Math.floor(prev) : 0) + 1;
  return n >= RIPOSTE_STREAK ? { streak: 0, riposte: true } : { streak: n, riposte: false };
}

/** Counter damage from a weapon damage roll. */
export const counterDamage = (rolled: number, move: ClashMove): number =>
  Math.max(1, Math.round(Math.max(0, rolled) * (move === 'signature' ? COUNTER_MULT_SIGNATURE : COUNTER_MULT)));

/**
 * Which third of the ring a tap is in, from its angle around the ring's centre in degrees
 * (0 = right, 90 = down, as on a screen). Right: -30 to 90, left: 90 to 210, top: 210 to 330.
 */
export function sideOfAngle(deg: number): Side {
  const a = ((deg % 360) + 360) % 360;
  if (a >= 90 && a < 210) return 'left';
  if (a >= 210 && a < 330) return 'top';
  return 'right';
}
/** The middle of each third, in the same degrees. */
export const SIDE_ANGLE: Record<Side, number> = { right: 30, left: 150, top: 270 };

// ── Tug & Slip (the Pin struggle) ────────────────────────────────────────────
// A rope knot sits on a bar: the enemy drags it away from you; reach 96% and you break free.
// A needle sweeps a second bar with a drifting green gap. Heave with the needle in the gap = a big pull,
// the gap shrinks a step and everything speeds up; outside = a slip, the gap grows a step, and Heave locks briefly.
// Everything moves at an even speed and bounces at the ends, so the server can replay it exactly.

export const TUG = {
  startKnot: 50,
  freeAt: 96,
  /** The enemy's pull, % of the bar per second. */
  enemyPerS: 4.5,
  needleLo: 2,
  needleHi: 98,
  /** A full sweep there and back in 2.2 s. */
  needleBasePerS: 192 / 2.2,
  needleStep: 1.2,
  needleCap: 1.8,
  driftBasePerS: 30,
  driftStep: 1.6,
  driftCap: 5,
  /** Gap sizes, % of the bar, biggest first. A heave moves one step down, a miss one step up. */
  sizes: [30, 25, 20, 16, 13, 10, 8],
  startSize: 2,
  /** Red slivers on each side of the gap: a tap there costs double. */
  trap: 4,
  lockMs: 700,
  /** Tap grace: the needle counts if it was in the gap at any moment this long before the tap. */
  graceMs: 140,
  sampleMs: 10,
} as const;

export const heavePull = (hitStreak: number): number => Math.min(16, 10 + 2 * Math.max(0, hitStreak));
export const slipFor = (missStreak: number): number => 5 + 3 * Math.max(0, missStreak);

/** The struggle as it stood at t0 (the pin's start or the last counted tap). Stored in minigame.struggle. */
export interface Struggle {
  seed: number;
  t0: number;
  knot: number;
  /** Taps counted so far (heaves and misses). */
  n: number;
  /** Successful heaves so far (speeds the needle and the gap up). */
  heaves: number;
  hit: number;
  miss: number;
  size: number;
  needle: number;
  nDir: 1 | -1;
  gap: number;
  gDir: 1 | -1;
  lockUntil: number;
}

/** A repeatable number from 0 up to 1 for a seed, a step and a purpose. Same on every phone and the server. */
export function seeded(seed: number, k: number, salt: number): number {
  let h = (seed ^ Math.imul(k + 1, 0x9e3779b1) ^ Math.imul(salt + 1, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** step^times, capped. A loop, not Math.pow, so every device gets exactly the same number. */
function grown(step: number, times: number, cap: number): number {
  let m = 1;
  for (let i = 0; i < times && m < cap; i++) m *= step;
  return Math.min(cap, m);
}
export const needleSpeed = (heaves: number): number => TUG.needleBasePerS * grown(TUG.needleStep, heaves, TUG.needleCap);
export const driftSpeed = (heaves: number): number => TUG.driftBasePerS * grown(TUG.driftStep, heaves, TUG.driftCap);
export const gapWidth = (size: number): number => TUG.sizes[Math.max(0, Math.min(TUG.sizes.length - 1, Math.round(size)))];

/** Moving at an even speed between lo and hi, bouncing at the ends. */
export function bounce(p0: number, dir: 1 | -1, perS: number, dtMs: number, lo: number, hi: number): { pos: number; dir: 1 | -1 } {
  const span = hi - lo;
  if (!(span > 0)) return { pos: lo, dir };
  const p = Math.max(lo, Math.min(hi, p0));
  const d = (Math.max(0, dtMs) * perS) / 1000;
  const start = dir === 1 ? p - lo : 2 * span - (p - lo);
  const u = (start + d) % (2 * span);
  return u <= span ? { pos: lo + u, dir: 1 } : { pos: hi - (u - span), dir: -1 };
}

function placeGap(seed: number, n: number, size: number): { gap: number; gDir: 1 | -1 } {
  const half = gapWidth(size) / 2;
  return { gap: half + seeded(seed, n, 1) * (100 - 2 * half), gDir: seeded(seed, n, 2) < 0.5 ? -1 : 1 };
}

/** A new struggle at the moment the pin lands. */
export function newStruggle(seed: number, now: number, knot: number = TUG.startKnot): Struggle {
  return {
    seed: seed >>> 0, t0: now, knot: Math.max(0, Math.min(100, knot)), n: 0, heaves: 0, hit: 0, miss: 0,
    size: TUG.startSize, needle: TUG.needleLo, nDir: 1, ...placeGap(seed >>> 0, 0, TUG.startSize), lockUntil: 0,
  };
}

/** A checked copy of a stored struggle, or null. */
export function cleanStruggle(raw: unknown): Struggle | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const num = (k: string) => (typeof r[k] === 'number' && Number.isFinite(r[k]) ? (r[k] as number) : NaN);
  const s = {
    seed: num('seed'), t0: num('t0'), knot: num('knot'), n: num('n'), heaves: num('heaves'), hit: num('hit'),
    miss: num('miss'), size: num('size'), needle: num('needle'), gap: num('gap'), lockUntil: num('lockUntil'),
  };
  if (Object.values(s).some(v => !Number.isFinite(v))) return null;
  const dir = (v: unknown): 1 | -1 => (v === -1 ? -1 : 1);
  return {
    ...s,
    seed: s.seed >>> 0,
    size: Math.max(0, Math.min(TUG.sizes.length - 1, Math.round(s.size))),
    nDir: dir(r.nDir),
    gDir: dir(r.gDir),
  };
}

/** Where everything is at time t (t before t0 counts as t0). */
export function struggleAt(s: Struggle, t: number): { knot: number; needle: number; gap: number; width: number } {
  const dt = Math.max(0, t - s.t0);
  const width = gapWidth(s.size);
  const needle = bounce(s.needle, s.nDir, needleSpeed(s.heaves), dt, TUG.needleLo, TUG.needleHi).pos;
  const gap = bounce(s.gap, s.gDir, driftSpeed(s.heaves), dt, width / 2, 100 - width / 2).pos;
  const knot = Math.max(0, s.knot - (TUG.enemyPerS * dt) / 1000);
  return { knot, needle, gap, width };
}

export type HeaveOutcome = 'heave' | 'fumble' | 'trap';

/**
 * One tap on Heave at tapAt. Null = it doesn't count: before the last counted tap, or during the lockout.
 * Otherwise the struggle as of the tap, what happened, how far the knot moved, and whether you broke free.
 */
export function heave(s: Struggle, tapAt: number): { state: Struggle; outcome: HeaveOutcome; amount: number; free: boolean } | null {
  if (!Number.isFinite(tapAt) || tapAt < s.t0 || tapAt < s.lockUntil) return null;
  const now = struggleAt(s, tapAt);
  const from = Math.max(s.t0, tapAt - TUG.graceMs);
  let inGap = false;
  for (let t = tapAt; t >= from; t -= TUG.sampleMs) {
    const p = struggleAt(s, t);
    if (Math.abs(p.needle - p.gap) <= p.width / 2) { inGap = true; break; }
  }
  const nDir = bounce(s.needle, s.nDir, needleSpeed(s.heaves), tapAt - s.t0, TUG.needleLo, TUG.needleHi).dir;
  let next: Struggle;
  let outcome: HeaveOutcome;
  let amount: number;
  if (inGap) {
    amount = heavePull(s.hit);
    outcome = 'heave';
    next = {
      ...s, knot: Math.min(100, now.knot + amount), heaves: s.heaves + 1, hit: s.hit + 1, miss: 0,
      size: Math.min(TUG.sizes.length - 1, s.size + 1),
    };
  } else {
    const trap = Math.abs(now.needle - now.gap) <= now.width / 2 + TUG.trap;
    amount = slipFor(s.miss) * (trap ? 2 : 1);
    outcome = trap ? 'trap' : 'fumble';
    next = {
      ...s, knot: Math.max(0, now.knot - amount), hit: 0, miss: s.miss + 1,
      size: Math.max(0, s.size - 1), lockUntil: tapAt + TUG.lockMs,
    };
  }
  next.n = s.n + 1;
  next.t0 = tapAt;
  next.needle = now.needle;
  next.nDir = nDir;
  const placed = placeGap(s.seed, next.n, next.size);
  next.gap = placed.gap;
  next.gDir = placed.gDir;
  return { state: next, outcome, amount, free: next.knot >= TUG.freeAt };
}

/** The struggle moved later by a pause, so nothing moves while the fight is frozen. */
export function shiftStruggle(s: Struggle, byMs: number): Struggle {
  const by = Math.max(0, byMs);
  return { ...s, t0: s.t0 + by, lockUntil: s.lockUntil > 0 ? s.lockUntil + by : 0 };
}
