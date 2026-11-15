// Dragon bond and trust meters for solo Empyrean (DECISIONS D-30, 2026-11-15).
// Pure rules, no React or Supabase. The server record (empyrean_dragons) stores the results;
// src/lib/dragon-record.ts saves them; use-dragon-bond.ts and DragonBondChat.tsx call these.
//
// Justin's picks: two-way bond with a floor, repairable trust ("wounds" instead of permanent
// ruptures), meters that unlock powers, and the "Gentler" loss sizes.
import type { DragonBondState } from '@/lib/dragonBondState';

export const BOND_FLOOR = 15;
export const MAX_WOUNDS = 3;
/** A trust loss this big, in one go, opens a wound. */
export const WOUND_TRUST_LOSS = 5;
/** Each open wound cuts trust gains by this much (3 wounds: gains at 40%). */
export const WOUND_GAIN_CUT = 0.2;
export const STRAIN_BASE = 8;
export const STRAIN_HARD_CAP = 12;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Sizes of every meter change, in one place. */
export const METER_RULES = {
  dmBondGrowth: 3,
  sharedFight: 2,
  recklessStrainBond: -2,
  neglectBondPerWeek: -1,
  neglectTrustPerWeek: -3,
  dmBondStrainTrust: -5,
  promiseKeptBond: 2,
  promiseBrokenBond: -2,
} as const;

export interface Meters {
  bond: number;
  trust: number;
  wounds: number;
}

export interface MeterChange {
  /** Raw bond change (a loss stops at the floor). */
  bond?: number;
  /** Raw trust change (a gain is cut by open wounds; a loss of 5+ opens a wound). */
  trust?: number;
  /** Close one open wound (amends in the story, or a finished Dragon & Bond quest). */
  amends?: boolean;
}

export interface MeterResult {
  meters: Meters;
  /** What actually changed, after the floor, the wound cut and the clamps. */
  applied: Meters;
  woundOpened: boolean;
  woundClosed: boolean;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const whole = (n: unknown, fallback: number) => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.round(v) : fallback;
};

export function trustGainMultiplier(wounds: number): number {
  return Math.max(1 - MAX_WOUNDS * WOUND_GAIN_CUT, 1 - clamp(wounds, 0, MAX_WOUNDS) * WOUND_GAIN_CUT);
}

export function normalizeMeters(m: Partial<Meters> | null | undefined): Meters {
  return {
    bond: clamp(whole(m?.bond, BOND_FLOOR), 0, 100),
    trust: clamp(whole(m?.trust, 10), 0, 100),
    wounds: clamp(whole(m?.wounds, 0), 0, MAX_WOUNDS),
  };
}

export function applyMeterChange(current: Partial<Meters>, change: MeterChange): MeterResult {
  const before = normalizeMeters(current);
  let { bond, trust, wounds } = before;
  let woundOpened = false;
  let woundClosed = false;

  const bondDelta = whole(change.bond, 0);
  if (bondDelta > 0) bond = Math.min(100, bond + bondDelta);
  else if (bondDelta < 0) {
    // Losses stop at the floor; a pair already under it (a new bond) never drops further.
    const floor = Math.min(bond, BOND_FLOOR);
    bond = Math.max(floor, bond + bondDelta);
  }

  const trustDelta = whole(change.trust, 0);
  if (trustDelta > 0) {
    const cut = Math.round(trustDelta * trustGainMultiplier(wounds));
    trust = Math.min(100, trust + Math.max(1, cut));
  } else if (trustDelta < 0) {
    trust = Math.max(0, trust + trustDelta);
    if (-trustDelta >= WOUND_TRUST_LOSS && wounds < MAX_WOUNDS) {
      wounds += 1;
      woundOpened = true;
    }
  }

  if (change.amends && wounds > 0 && !woundOpened) {
    wounds -= 1;
    woundClosed = true;
  }

  const meters = { bond, trust, wounds };
  return {
    meters,
    applied: { bond: bond - before.bond, trust: trust - before.trust, wounds: wounds - before.wounds },
    woundOpened,
    woundClosed,
  };
}

/** The meters out of a phone bond state (wounds default to 0 when the state predates them). */
export function metersOf(state: Pick<DragonBondState, 'bond' | 'trust'> & { wounds?: number }): Meters {
  return normalizeMeters({ bond: state.bond, trust: state.trust, wounds: state.wounds ?? 0 });
}

/** First move from the phone: old ruptures become wounds (at most 3). */
export function metersFromLegacy(state: Partial<DragonBondState> & { wounds?: number }): Meters {
  const wounds = typeof state.wounds === 'number' ? state.wounds : Math.min(MAX_WOUNDS, Math.max(0, whole(state.ruptures, 0)));
  return normalizeMeters({ bond: state.bond, trust: state.trust, wounds });
}

// ── Neglect ──

/**
 * Full weeks without contact that haven't been charged yet. Contact is any story message or
 * dragon chat; `chargedThrough` is when neglect was last charged, so a week is charged once.
 */
export function neglectWeeks(lastContactISO: string | null | undefined, chargedThroughISO: string | null | undefined, nowMs: number): number {
  const contact = lastContactISO ? Date.parse(lastContactISO) : NaN;
  if (!Number.isFinite(contact)) return 0;
  const charged = chargedThroughISO ? Date.parse(chargedThroughISO) : NaN;
  const from = Number.isFinite(charged) ? Math.max(contact, charged) : contact;
  if (nowMs <= from) return 0;
  return Math.floor((nowMs - from) / WEEK_MS);
}

/** When the charged weeks end, so the next charge starts from there. */
export function neglectChargedThrough(lastContactISO: string, chargedThroughISO: string | null | undefined, weeks: number): string {
  const contact = Date.parse(lastContactISO);
  const charged = chargedThroughISO ? Date.parse(chargedThroughISO) : NaN;
  const from = Number.isFinite(charged) ? Math.max(contact, charged) : contact;
  return new Date(from + weeks * WEEK_MS).toISOString();
}

// ── Tiers and unlocks ──

export interface Tier {
  index: number;
  name: string;
  min: number;
}

export const BOND_TIERS: Tier[] = [
  { index: 0, name: 'New', min: 0 },
  { index: 1, name: 'Growing', min: 21 },
  { index: 2, name: 'Strong', min: 41 },
  { index: 3, name: 'Deep', min: 61 },
  { index: 4, name: 'Legendary', min: 81 },
];

export const TRUST_TIERS: Tier[] = [
  { index: 0, name: 'Wary', min: 0 },
  { index: 1, name: 'Guarded', min: 21 },
  { index: 2, name: 'Open', min: 41 },
  { index: 3, name: 'Deep', min: 61 },
  { index: 4, name: 'Profound', min: 81 },
];

const tierOf = (tiers: Tier[], value: number) => [...tiers].reverse().find(t => value >= t.min) ?? tiers[0];
export const bondTier = (bond: number) => tierOf(BOND_TIERS, bond);
export const trustTier = (trust: number) => tierOf(TRUST_TIERS, trust);

/** Extra Signet Strain the bond carries: Strong +1, Deep +2, Legendary +3. */
export function bondStrainBonus(bond: number): number {
  return Math.max(0, bondTier(bond).index - 1);
}

/**
 * The solo Signet Strain limit: the Quest Hub's ceiling (8, or 9/10 from Signet rank, D-27)
 * plus the bond's bonus, never above 12.
 */
export function strainCeiling(bond: number, questCeiling: number = STRAIN_BASE): number {
  const base = Number.isFinite(questCeiling) ? questCeiling : STRAIN_BASE;
  return Math.min(STRAIN_HARD_CAP, base + bondStrainBonus(bond));
}

export interface Unlock {
  meter: 'bond' | 'trust';
  tier: number;
  title: string;
  detail: string;
  /** 'live' works now; 'later' is shown locked until its phase is built. */
  status: 'live' | 'later';
}

export const UNLOCKS: Unlock[] = [
  { meter: 'bond', tier: 1, title: 'Mind-speak', detail: 'Speaks into your mind, words only you hear.', status: 'later' },
  { meter: 'bond', tier: 1, title: 'Its own senses', detail: 'Rolls its own checks: scenting danger, reading a liar.', status: 'later' },
  { meter: 'bond', tier: 2, title: 'Signet Strain +1', detail: 'The bond carries more of your signet’s burn.', status: 'live' },
  { meter: 'bond', tier: 2, title: 'Full strength in battle', detail: 'Fights beside you at full power.', status: 'later' },
  { meter: 'bond', tier: 2, title: 'First combo moves', detail: 'Combined rider-and-dragon attacks.', status: 'later' },
  { meter: 'bond', tier: 3, title: 'Signet Strain +2', detail: 'The bond carries even more of the burn.', status: 'live' },
  { meter: 'bond', tier: 3, title: 'Shared senses', detail: 'Scout ahead or look through its eyes.', status: 'later' },
  { meter: 'bond', tier: 4, title: 'Signet Strain +3', detail: 'Near-total sharing of the burn.', status: 'live' },
  { meter: 'bond', tier: 4, title: 'Last stand', detail: 'Once per arc, keeps you standing at 0 HP.', status: 'later' },
  { meter: 'trust', tier: 0, title: 'May refuse', detail: 'Refuses or bargains when you ask too much.', status: 'later' },
  { meter: 'trust', tier: 1, title: 'Does what you ask', detail: 'Follows your lead, if not always quietly.', status: 'later' },
  { meter: 'trust', tier: 2, title: 'Its own plans', detail: 'Offers plans and argues with yours.', status: 'later' },
  { meter: 'trust', tier: 3, title: 'Acts before you ask', detail: 'Steps in on its own at key moments.', status: 'later' },
  { meter: 'trust', tier: 4, title: 'Ancestral dreams', detail: 'Shares dreams from its line.', status: 'later' },
];

export function unlockState(u: Unlock, meters: Meters): 'open' | 'locked' | 'coming' {
  const reached = (u.meter === 'bond' ? bondTier(meters.bond) : trustTier(meters.trust)).index >= u.tier;
  if (!reached) return 'locked';
  return u.status === 'live' ? 'open' : 'coming';
}

// ── History labels ──

export const SOURCE_LABELS: Record<string, string> = {
  start: 'Bond record started',
  dm: 'The story',
  fight: 'Fought together',
  quest: 'Dragon & Bond quest',
  chat: 'Talking with your dragon',
  strain: 'Signet Strain',
  neglect: 'Time apart',
  amends: 'Amends',
  promise: 'A promise',
};

export function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}
