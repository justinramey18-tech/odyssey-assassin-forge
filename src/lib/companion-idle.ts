// Companion "idle life" director — pure logic, no React, no canvas.
// Tracks four inner feelings and picks what the creature does when left alone.
import type { CompanionRig, HeadShape, Temperament } from './companion-rig';

export type IdleKind =
  | 'watch' | 'sniff' | 'earTwitch' | 'spark' | 'shake' | 'yawn' | 'groom'
  | 'nod' | 'alert' | 'stretch' | 'glance';

/** Body-specific flavour of a behaviour (what it physically looks like). */
export type IdleVariant =
  | 'sniff' | 'tongue' | 'scan'
  | 'shake' | 'ripple' | 'ruffle'
  | 'yawn' | 'vent'
  | 'lick' | 'preen' | 'polish'
  | 'default';

export interface Feelings { energy: number; safety: number; comfort: number; attention: number }

export interface Behavior {
  kind: IdleKind;
  variant: IdleVariant;
  duration: number;     // seconds
  /** Fraction 0..1 before which a tap waits for the behaviour to finish. */
  finishBefore: number;
}

export type Decision = Behavior | 'sleep' | null;

export const freshFeelings = (): Feelings => ({ energy: 1, safety: 0.8, comfort: 0.6, attention: 0.3 });

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

/** How each temperament leans. rate = how busy it is; weights bias choices. */
export const TEMPERAMENT_IDLE: Record<Temperament, {
  rate: number; drain: number; alertChance: number; wakeSpeed: number;
  w: Partial<Record<IdleKind, number>>;
}> = {
  feral:    { rate: 1.4, drain: 0.9, alertChance: 0.18, wakeSpeed: 2,   w: { sniff: 3, shake: 2, earTwitch: 2, alert: 2, spark: 1.5 } },
  sentinel: { rate: 0.8, drain: 0.7, alertChance: 0.14, wakeSpeed: 1.4, w: { watch: 3, earTwitch: 2.5, alert: 1.5, glance: 1.5, groom: 0.6 } },
  reckless: { rate: 1.3, drain: 1.3, alertChance: 0.06, wakeSpeed: 1,   w: { spark: 3.5, shake: 1.5, yawn: 1.5, sniff: 1.5 } },
  cunning:  { rate: 1.0, drain: 1.0, alertChance: 0.1,  wakeSpeed: 1.6, w: { glance: 3, sniff: 1.2, groom: 1.8, watch: 1.5 } },
};

/** Which physical version a behaviour takes for a given head shape. */
export function variantFor(kind: IdleKind, head: HeadShape): IdleVariant {
  if (kind === 'sniff') return head === 'reptile' ? 'tongue' : head === 'visor' ? 'scan' : 'sniff';
  if (kind === 'shake') return head === 'reptile' ? 'ripple' : head === 'beaked' ? 'ruffle' : head === 'visor' ? 'ripple' : 'shake';
  if (kind === 'yawn') return head === 'visor' ? 'vent' : 'yawn';
  if (kind === 'groom') return head === 'beaked' ? 'preen' : head === 'visor' ? 'polish' : 'lick';
  return 'default';
}

const DURATION: Record<IdleKind, number> = {
  watch: 3, sniff: 2.4, earTwitch: 0.9, spark: 2.6, shake: 1.6, yawn: 2.2,
  groom: 3.2, nod: 3.4, alert: 3.6, stretch: 2.2, glance: 1.8,
};
// shakes and yawns finish before they acknowledge a tap
const FINISH: Partial<Record<IdleKind, number>> = { shake: 0.85, yawn: 0.7, alert: 0.6 };

export function makeBehavior(kind: IdleKind, rig: Pick<CompanionRig, 'head'>, speed = 1): Behavior {
  return { kind, variant: variantFor(kind, rig.head), duration: DURATION[kind] / speed, finishBefore: FINISH[kind] ?? 0 };
}

/** Slowly change feelings while the camp is quiet. */
export function tickFeelings(f: Feelings, dt: number, temperament: Temperament, idleSec: number, sleeping: boolean): Feelings {
  if (!Number.isFinite(dt) || dt <= 0) return f;
  const T = TEMPERAMENT_IDLE[temperament];
  return {
    energy: clamp01(sleeping ? f.energy + dt * 0.06 : f.energy - dt * 0.012 * T.drain * (idleSec > 10 ? 1.6 : 1)),
    safety: clamp01(f.safety + dt * 0.04),
    comfort: clamp01(f.comfort + dt * (sleeping ? 0.03 : 0.01)),
    attention: clamp01(f.attention + dt * (idleSec > 8 ? 0.02 : -0.01)),
  };
}

export const notifyTouch = (f: Feelings): Feelings => ({ ...f, attention: 0, safety: clamp01(f.safety + 0.15), energy: clamp01(f.energy + 0.08) });
export const notifyTreat = (f: Feelings): Feelings => ({ ...f, attention: 0, energy: clamp01(f.energy + 0.2), comfort: clamp01(f.comfort + 0.1) });
export const notifyAlert = (f: Feelings): Feelings => ({ ...f, safety: clamp01(f.safety - 0.45), energy: clamp01(f.energy + 0.15) });

/** Time (s) to wait before the next idle beat. */
export function gapAfter(temperament: Temperament, rand: () => number): number {
  return (2.5 + rand() * 4) / TEMPERAMENT_IDLE[temperament].rate;
}

/**
 * Choose what to do next. Follows the camp rhythm: early = small looks,
 * later = bigger moments, long idle + low energy = drowsy then sleep.
 */
export function pickNextBehavior(f: Feelings, rig: Pick<CompanionRig, 'head' | 'temperament'>, idleSec: number, rand: () => number): Decision {
  const T = TEMPERAMENT_IDLE[rig.temperament];
  if (f.energy < 0.25 && idleSec > 45) return rand() < 0.5 ? makeBehavior('nod', rig) : 'sleep';
  if (f.energy < 0.4 && idleSec > 35 && rand() < 0.5) return makeBehavior('nod', rig);
  if (idleSec > 8 && f.safety > 0.5 && rand() < T.alertChance) return makeBehavior('alert', rig);

  const pool: [IdleKind, number][] = [];
  const add = (k: IdleKind, base: number) => pool.push([k, base * (T.w[k] ?? 1)]);
  add('watch', 1.2); add('earTwitch', 1); add('glance', f.attention > 0.4 ? 1.6 : 0.6);
  if (idleSec > 6) { add('sniff', 1); add('spark', 0.8); }
  if (idleSec > 18) { add('shake', 0.8); add('groom', 0.8); add('yawn', f.energy < 0.7 ? 1.4 : 0.5); }
  if (f.safety < 0.4) add('watch', 2);

  const total = pool.reduce((a, [, w]) => a + w, 0);
  let r = rand() * total;
  for (const [k, w] of pool) { r -= w; if (r <= 0) return makeBehavior(k, rig); }
  return makeBehavior('watch', rig);
}

export interface Pose {
  headDelta: number;   // added to head angle (positive = down)
  jaw: number;         // 0..1 extra jaw open
  shakeX: number;      // body wobble (px at scale 1)
  earKick: number;     // ear spring impulse
  lidMin: number;      // 0..1 forced eyelid closure
  gaze: 'none' | 'ground' | 'fire' | 'treeline' | 'player' | 'spark';
  crouch: number;      // 0..1 body dip / stretch-down
  tongue: number;      // 0..1 tongue flick (reptile)
  scan: number;        // -1..1 visor scan sweep
}

const NEUTRAL: Pose = { headDelta: 0, jaw: 0, shakeX: 0, earKick: 0, lidMin: 0, gaze: 'none', crouch: 0, tongue: 0, scan: 0 };
const bell = (p: number) => Math.sin(Math.PI * Math.min(1, Math.max(0, p)));

/** Pose offsets for a behaviour at phase 0..1. Pure; layered over breathing/blinks. */
export function poseFor(b: Behavior | null, p: number, t: number): Pose {
  if (!b) return NEUTRAL;
  const e = bell(p);
  switch (b.kind) {
    case 'sniff':
      if (b.variant === 'scan') return { ...NEUTRAL, headDelta: 0.35 * e, gaze: 'ground', scan: Math.sin(p * Math.PI * 4) };
      if (b.variant === 'tongue') return { ...NEUTRAL, headDelta: 0.3 * e, gaze: 'ground', tongue: Math.max(0, Math.sin(p * Math.PI * 6)) * e };
      return { ...NEUTRAL, headDelta: 0.55 * e + Math.sin(t * 22) * 0.04 * e, gaze: 'ground', earKick: p > 0.9 ? 0.6 : 0 };
    case 'earTwitch': return { ...NEUTRAL, earKick: p < 0.3 ? 2 : 0 };
    case 'spark': return { ...NEUTRAL, gaze: 'spark', headDelta: -0.25 * e };
    case 'shake': {
      const amp = b.variant === 'ripple' ? 2 : b.variant === 'ruffle' ? 4 : 7;
      const k = p < 0.15 ? p / 0.15 : p > 0.8 ? (1 - p) / 0.2 : 1;
      return { ...NEUTRAL, shakeX: Math.sin(p * Math.PI * 14) * amp * k, headDelta: Math.sin(p * Math.PI * 14 + 0.6) * 0.18 * k, earKick: k > 0.5 ? 1.2 : 0, lidMin: 0.5 * k };
    }
    case 'yawn': return { ...NEUTRAL, jaw: (b.variant === 'vent' ? 0.35 : 1) * e, headDelta: -0.35 * e, lidMin: 0.8 * e };
    case 'groom': return { ...NEUTRAL, headDelta: 0.75 * e, jaw: 0.15 * e * (0.5 + 0.5 * Math.sin(t * 14)), lidMin: 0.5 * e, gaze: 'none' };
    case 'nod': {
      // drifts down, catches itself, drifts again
      const drop = p < 0.55 ? p / 0.55 : p < 0.65 ? 1 - (p - 0.55) / 0.1 : (p - 0.65) / 0.35 * 0.7;
      return { ...NEUTRAL, headDelta: 0.6 * drop, lidMin: 0.4 + 0.55 * drop, gaze: 'fire' };
    }
    case 'alert': {
      const freeze = p > 0.1 && p < 0.75 ? 1 : e;
      return { ...NEUTRAL, gaze: 'treeline', headDelta: -0.3 * freeze, earKick: p < 0.12 ? 3 : 0, crouch: 0.2 * freeze };
    }
    case 'stretch': return { ...NEUTRAL, crouch: 0.6 * e, headDelta: -0.2 * e, jaw: 0.5 * e, lidMin: 0.5 * (1 - p) };
    case 'glance': return { ...NEUTRAL, gaze: 'player', lidMin: 0.2 };
    case 'watch': return { ...NEUTRAL, gaze: 'fire' };
  }
  return NEUTRAL;
}

/** Small line for the reaction log when a behaviour starts (null = stay quiet). */
export function narrate(b: Behavior, name: string): string | null {
  switch (b.kind) {
    case 'alert': return `${name}'s ears snap toward the dark treeline.`;
    case 'shake': return b.variant === 'ruffle' ? `${name} ruffles every feather, then smooths them flat.` : b.variant === 'ripple' ? `A ripple runs down ${name}'s plates.` : `${name} shakes out its coat from nose to tail.`;
    case 'yawn': return b.variant === 'vent' ? `${name} vents a long hiss of steam.` : `${name} gives a huge, jaw-cracking yawn.`;
    case 'nod': return `${name}'s head droops toward the fire... then jerks back up.`;
    case 'groom': return b.variant === 'preen' ? `${name} preens a crooked feather.` : b.variant === 'polish' ? `${name} buffs a scuff off its plating.` : `${name} licks a paw clean.`;
    default: return null;
  }
}
