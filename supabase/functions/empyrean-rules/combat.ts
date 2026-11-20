// Solo Empyrean fights: the referee's rules as pure functions (no Deno, no database, no network).

// Real time on the server's clock: every enemy and the rider's dragon act on their own timers,

// big enemy moves are telegraphed and can be answered with Counter Clash (./minigames.ts, the same

// rules the party referee uses), and the rider's own moves wait on a cooldown. Nothing here reads

// a clock or rolls dice by itself: callers pass `now` and `rand`, so the tests replay exact fights.



import * as M from './minigames.ts';

import { d, masteryInfo, signetStrainCost, type Rand, type RuleEvent } from './rules.ts';

import * as P from './prodigy.ts';



const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

const int = (v: unknown, fallback = 0) => (Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : fallback);

const str = (v: unknown, cap: number, fallback = '') => (typeof v === 'string' && v.trim() ? v.trim().slice(0, cap) : fallback);



// ── dice ──

export interface Dice { count: number; sides: number; bonus: number }

/** "2d6+3", "1d8", "d10-1". Null when it isn't dice. */

export function parseDice(text: unknown): Dice | null {

  const m = typeof text === 'string' ? text.replace(/\s+/g, '').match(/^(\d{0,2})d(\d{1,3})([+-]\d{1,3})?/i) : null;

  if (!m) return null;

  const count = clamp(int(m[1] || 1, 1), 1, 20), sides = int(m[2]);

  if (sides < 2 || sides > 100) return null;

  return { count, sides, bonus: clamp(int(m[3] || 0), -20, 50) };

}

/** A critical hit rolls the dice twice; the flat bonus counts once. Never less than 1. */

export function rollDice(dice: Dice, rand: Rand, crit = false): number {

  let total = dice.bonus;

  for (let i = 0; i < dice.count * (crit ? 2 : 1); i++) total += d(dice.sides, rand);

  return Math.max(1, total);

}

export const proficiency = (level: number) => Math.ceil(clamp(int(level, 1), 1, 20) / 4) + 1;

export interface Attack { d20: number; total: number; hit: boolean; crit: boolean }

/** d20 + bonus against AC. A natural 20 always hits and is critical; a natural 1 always misses. */

export function attackRoll(rand: Rand, bonus: number, ac: number): Attack {

  const d20 = d(20, rand);

  const total = d20 + bonus;

  return { d20, total, crit: d20 === 20, hit: d20 === 20 || (d20 !== 1 && total >= ac) };

}



// ── timing ──

export const RIDER_COOLDOWN_MS = 8000;

/** A check-in gap longer than this means the phone was away: the fight stood still meanwhile. */

export const AWAY_MS = 20000;

/** Time between a telegraphed move's warning and the first ring. */

export const WINDUP_LEAD_MS = 1800;

export const DRAGON_INTERVAL_MS = 10000;

export type Challenge = 'easy' | 'moderate' | 'hard' | 'deadly';

export const CHALLENGES: Challenge[] = ['easy', 'moderate', 'hard', 'deadly'];

export const asChallenge = (v: unknown): Challenge => (CHALLENGES.includes(v as Challenge) ? (v as Challenge) : 'moderate');

export const ENEMY_INTERVAL_MS: Record<Challenge, number> = { easy: 14000, moderate: 12000, hard: 10000, deadly: 8000 };

const HP_FACTOR: Record<Challenge, number> = { easy: 0.75, moderate: 1, hard: 1.3, deadly: 1.6 };

const TIER: Record<Challenge, number> = { easy: 0, moderate: 1, hard: 2, deadly: 3 };

export const FLEE_DC: Record<Challenge, number> = { easy: 10, moderate: 13, hard: 16, deadly: 19 };

export const VICTORY_XP: Record<Challenge, number> = { easy: 40, moderate: 90, hard: 180, deadly: 350 };



// ── who can be fought ──

export type Arena = 'mat' | 'ground' | 'air';

export type FoeKind = 'cadet' | 'rider' | 'soldier' | 'flier' | 'wyvern' | 'venin' | 'beast';

interface FoeTemplate {

  label: string; hpBase: number; hpPerLevel: number; ac: number; atk: number; dice: [number, number];

  /** Chance (0..1) that a turn is a telegraphed big move, and which ones it knows. */

  big: number; moves: M.ClashMove[]; moveNames: Partial<Record<M.ClashMove, string>>;

  /** Chance to go for the dragon when one is in the fight. */

  dragonBias: number;

}

export const FOES: Record<FoeKind, FoeTemplate> = {

  cadet: { label: 'Cadet', hpBase: 8, hpPerLevel: 6, ac: 12, atk: 3, dice: [1, 6], big: 0.3, moves: ['heavy'], moveNames: { heavy: 'Heavy blow' }, dragonBias: 0 },

  soldier: { label: 'Soldier', hpBase: 10, hpPerLevel: 7, ac: 14, atk: 3, dice: [1, 8], big: 0.3, moves: ['heavy', 'sweep'], moveNames: { heavy: 'Shield bash', sweep: 'Wide cut' }, dragonBias: 0.1 },

  rider: { label: 'Rider', hpBase: 12, hpPerLevel: 8, ac: 14, atk: 4, dice: [1, 8], big: 0.4, moves: ['heavy', 'signature'], moveNames: { heavy: 'Heavy blow', signature: 'Signet burst' }, dragonBias: 0.1 },

  flier: { label: 'Gryphon flier', hpBase: 14, hpPerLevel: 9, ac: 14, atk: 4, dice: [1, 10], big: 0.4, moves: ['heavy', 'sweep'], moveNames: { heavy: 'Diving strike', sweep: 'Talon rake' }, dragonBias: 0.3 },

  beast: { label: 'Beast', hpBase: 16, hpPerLevel: 9, ac: 13, atk: 4, dice: [1, 10], big: 0.35, moves: ['heavy', 'sweep'], moveNames: { heavy: 'Pounce', sweep: 'Thrash' }, dragonBias: 0.2 },

  venin: { label: 'Venin', hpBase: 20, hpPerLevel: 11, ac: 15, atk: 5, dice: [2, 6], big: 0.45, moves: ['heavy', 'signature'], moveNames: { heavy: 'Dark lash', signature: 'Draining grasp' }, dragonBias: 0.25 },

  wyvern: { label: 'Wyvern', hpBase: 30, hpPerLevel: 14, ac: 15, atk: 5, dice: [2, 8], big: 0.45, moves: ['heavy', 'sweep', 'signature'], moveNames: { heavy: 'Tail smash', sweep: 'Wing buffet', signature: 'Fire stream' }, dragonBias: 0.6 },

};

export const FOE_KINDS = Object.keys(FOES) as FoeKind[];

export const asFoeKind = (v: unknown): FoeKind => (FOE_KINDS.includes(v as FoeKind) ? (v as FoeKind) : 'soldier');

const MOVE_MULT: Record<M.ClashMove, number> = { heavy: 1.5, signature: 2, sweep: 1, pin: 1 };



// ── the fight ──

export type Tone = 'info' | 'good' | 'warn' | 'muted';

/** Who acted and how, on the log line where it shows: for the phone's fight animations only. The rules never read it. */
export type FightActor = 'rider' | 'dragon';
export type FightMove = 'attack' | 'signet' | 'potion' | 'counter' | 'claw' | 'bite' | 'fire' | 'guard';
export interface FightEvent { n: number; at: number; text: string; tone: Tone; targetId?: string; amount?: number; flash?: 'hit' | 'heal'; by?: FightActor; move?: FightMove }

export interface Pending {

  move: M.ClashMove; label: string; target: 'rider' | 'dragon' | 'both'; strikeAt: number;

  /** The Counter Clash chain when the move is aimed at the rider. */

  clash: M.Clash | null; warded?: boolean;

  /** Wingwall (progression web): the shielded blow deals a quarter instead of half. */

  wardedDeep?: boolean;

}

export interface Enemy {

  id: string; name: string; kind: FoeKind; hp: number; maxHp: number; ac: number; atk: number; dice: Dice;

  intervalMs: number; nextAt: number; status: 'up' | 'down'; pending: Pending | null;

}

export interface RiderFighter {

  name: string; hp: number; maxHp: number; startHp: number; ac: number; level: number; atk: number;

  weapons: Array<{ name: string; dice: Dice }>; readyAt: number; masteryRank: number;

  clash: { id: string; r: Array<M.ClashQ | null> } | null; streak: number;

  /** The progression web's Ward in this fight: what is left of it, and its size (absent: no Ward). */

  shield?: number; shieldMax?: number;

}

export interface DragonFighter { name: string; hp: number; maxHp: number; startHp: number; ac: number; atk: number; bond: number; nextAt: number; turns: number; status: 'up' | 'down' }

export type Outcome = 'victory' | 'defeat' | 'fled' | 'yield';

export interface Fight {

  v: 1; id: string; status: 'active' | 'ended'; outcome: Outcome | null; lethal: boolean; arena: Arena; challenge: Challenge;

  startedAt: number; seenAt: number; endedAt: number | null; seq: number; settled: boolean;

  rider: RiderFighter; dragon: DragonFighter | null; enemies: Enemy[]; log: FightEvent[];

  strainSpent: number; signetUses: number; dragonDied: boolean; riderDown: boolean;

  /** The rider's Prodigy Ascension tier (0 for every other rider; absent in fights saved before D-37). */

  prodigy?: P.ProdigyTier;

  /** What the rider's progression web adds in this fight (absent: nothing, and in fights saved before it existed). */

  web?: FightPerks;

  /** Once-a-fight perks already used (see once()), and whether the dragon carried its fallen rider out (Loyalty, Devoted). */

  used?: Record<string, boolean>;

  rescued?: boolean;

}

/** The progression web's fight perks (see web.ts for what each one is): every number with the most a stored fight may hold.

 *  Every number is 0 and every flag false for a rider who owns none. */

const PERK_TOP = {

  wardMax: 100, regenTurn: 10, adrDamage: 10, adrHit: 5, adrHasteMs: 4000, bloodPrice: 20, sigDamage: 20, sigDice: 6,

  wpnDamage: 20, wpnHit: 10, wpnDice: 4, wpnFinish: 4, critFrom: 20, graze: 5,

  tempoMs: 4000, foeDelayMs: 10000, fightAc: 5, flee: 10, missHasteMs: 3000,

  mountHit: 5, mountAc: 5, mountDamage: 10, mountDice: 3, mountGuard: 5, mountHasteMs: 4000,

  dHp: 300, dMendTurn: 20, dAtk: 10, dBite: 30, dBiteDice: 6, dCritFrom: 20, dFireDice: 8,

  dTempoMs: 4000, dOpenMs: 6000, dHarryMs: 5000, dFoeDelayMs: 10000, dFlee: 10, dAirHit: 5, dAirBite: 10,

  dAc: 10, dSoak: 10, dShieldChance: 45, dShieldBond: 100,

} as const;

const PERK_FLAGS = [

  'wardFightRefill', 'regenWard', 'adrDouble', 'heartfire', 'sigKillRefund', 'openReady', 'firstCrit', 'blur', 'dodgeFirst',

  'dSecondWind', 'dWinMend', 'dLastStand', 'dCleave', 'dFireEager', 'dFireFast', 'dFireOpen', 'dSureFlee',

  'dBrace', 'dFirstHit', 'dShieldDeep', 'dShieldFree', 'dAvenge', 'dTakeBlow', 'dRescue',

] as const;

export type FightPerks = { [K in keyof typeof PERK_TOP]: number } & { [K in typeof PERK_FLAGS[number]]: boolean };

function readPerks(r: Record<string, unknown>): FightPerks {

  const p: Record<string, number | boolean> = {};

  for (const key of Object.keys(PERK_TOP) as Array<keyof typeof PERK_TOP>) p[key] = clamp(int(r[key]), 0, PERK_TOP[key]);

  for (const key of PERK_FLAGS) p[key] = r[key] === true;

  return p as unknown as FightPerks;

}

export const NO_PERKS: FightPerks = readPerks({});

/** Perks come from the server's own ledger, but a stored fight is still untrusted JSON: clamp everything. Null when the rider has none. */

export function cleanPerks(raw: unknown): FightPerks | null {

  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;

  if (!r) return null;

  const p = readPerks(r);

  const any = Object.values(p as unknown as Record<string, number | boolean>).some(v => v === true || (typeof v === 'number' && v > 0));

  return any ? p : null;

}

/** The fight's perks, whole: a fight saved before a perk existed reads that perk as off. */

const perksOf = (f: Fight): FightPerks => (f.web ? { ...NO_PERKS, ...f.web } : NO_PERKS);

/** A once-a-fight perk: true the first time it is asked for in a fight, false ever after. */

function once(f: Fight, key: string): boolean {

  if (f.used?.[key]) return false;

  f.used = { ...(f.used ?? {}), [key]: true };

  return true;

}

/** Adrenaline right now: 0 above half HP, 1 at half or less, 2 at a quarter or less (when the rider owns the doubling). */

export function adrenaline(f: Fight): { level: 0 | 1 | 2; damage: number; hit: number; hasteMs: number } {

  const w = f.web;

  if (!w || !(w.adrDamage || w.adrHit || w.adrHasteMs) || f.rider.hp <= 0 || f.rider.hp * 2 > f.rider.maxHp) return { level: 0, damage: 0, hit: 0, hasteMs: 0 };

  const deep = w.adrDouble && f.rider.hp * 4 <= f.rider.maxHp;

  return { level: deep ? 2 : 1, damage: w.adrDamage * (deep ? 2 : 1), hit: w.adrHit * (deep ? 2 : 1), hasteMs: w.adrHasteMs };

}

/** Adrenaline never shortens the wait between the rider's moves below this. */

export const RIDER_COOLDOWN_FLOOR_MS = 3000;

/** Wing never shortens the wait between the dragon's turns below this. */

export const DRAGON_INTERVAL_FLOOR_MS = 6000;

function say(f: Fight, at: number, text: string, tone: Tone = 'info', flash?: { targetId: string; amount: number; kind: 'hit' | 'heal' }) {

  f.seq += 1;

  f.log.push({ n: f.seq, at, text, tone, ...(flash ? { targetId: flash.targetId, amount: flash.amount, flash: flash.kind } : {}) });

  if (f.log.length > 60) f.log = f.log.slice(-60);

}

/** Tags the first log line written since `from` with who acted and how. It changes no number and no outcome. */

function mark(f: Fight, from: number, by: FightActor, move: FightMove) {

  const line = f.log.find(l => l.n > from && !l.by);

  if (line) { line.by = by; line.move = move; }

}

const up = (e: { status: string; hp: number }) => e.status === 'up' && e.hp > 0;

const dragonUp = (f: Fight) => !!f.dragon && up(f.dragon);

/** The rider's AC right now: Evasion always, Wing Cover while the dragon is up. */

const riderAc = (f: Fight) => { const k = perksOf(f); return f.rider.ac + k.fightAc + (dragonUp(f) ? k.mountAc : 0); };

/** Sidestep (Tempo): an enemy's miss brings the rider's next move closer. */

function sidestep(f: Fight, at: number) { const ms = perksOf(f).missHasteMs; if (ms > 0) f.rider.readyAt = Math.max(at, f.rider.readyAt - ms); }

export const RIDER_ID = 'rider';

export const DRAGON_ID = 'dragon';



/** A dragon's body for fights: tougher with level, and surer with the bond. */

export function dragonBody(level: number, bond: number): { maxHp: number; ac: number; atk: number } {

  const lv = clamp(int(level, 1), 1, 20);

  return { maxHp: 60 + lv * 12, ac: 16, atk: 5 + (bond >= 81 ? 3 : bond >= 61 ? 2 : bond >= 41 ? 1 : 0) + Math.floor(lv / 5) };

}



export interface StartInput {

  id: string; riderName: string; level: number; maxHp: number; hp: number; ac: number;

  attackBonus?: number | null; weapons?: Array<{ name?: unknown; damage?: unknown }>;

  foeKind: unknown; foeName?: unknown; count: unknown; challenge: unknown; lethal: boolean; arena: unknown;

  dragon: { name: string; hp: number | null; bond: number } | null; masteryXp: number;

  /** The rider's Prodigy Ascension tier (0 = not a Prodigy). */

  prodigy?: number;

  /** The progression web's fight perks, and the Ward the rider walks in with. */

  web?: unknown; shield?: number | null;

}

export function startFight(input: StartInput, now: number, rand: Rand): Fight {

  const level = clamp(int(input.level, 1), 1, 20);

  const challenge = asChallenge(input.challenge);

  const kind = asFoeKind(input.foeKind);

  const t = FOES[kind];

  const arena: Arena = input.arena === 'mat' || input.arena === 'air' ? input.arena : 'ground';

  const count = clamp(int(input.count, 1), 1, 4);

  const tier = TIER[challenge];

  const baseName = str(input.foeName, 40, t.label);

  const enemies: Enemy[] = [];

  for (let i = 0; i < count; i++) {

    const maxHp = Math.max(4, Math.round((t.hpBase + t.hpPerLevel * level) * HP_FACTOR[challenge] * (count > 1 ? 0.8 : 1)));

    enemies.push({

      id: `e${i + 1}`, name: count > 1 ? `${baseName} ${i + 1}` : baseName, kind, hp: maxHp, maxHp, ac: t.ac + Math.floor(tier / 2),

      atk: t.atk + tier + Math.floor(level / 4), dice: { count: t.dice[0], sides: t.dice[1], bonus: 1 + tier + Math.floor(level / 4) },

      intervalMs: ENEMY_INTERVAL_MS[challenge], status: 'up', pending: null,

      // The first move comes after a breath, staggered so several enemies never act in the same instant.

      nextAt: now + 4000 + i * 2500 + Math.floor(rand() * 1500),

    });

  }

  const weapons = (Array.isArray(input.weapons) ? input.weapons : [])

    .map(w => ({ name: str(w?.name, 60), dice: parseDice(w?.damage) }))

    .filter((w): w is { name: string; dice: Dice } => !!w.name && !!w.dice).slice(0, 8);

  const maxHp = clamp(int(input.maxHp, 10), 1, 999);

  const hp = clamp(int(input.hp, maxHp), 1, maxHp);

  const atk = Number.isFinite(Number(input.attackBonus)) ? clamp(int(input.attackBonus), -2, 20) : proficiency(level) + 3;

  const pt = clamp(int(input.prodigy, 0), 0, 5) as P.ProdigyTier;

  let dragon: DragonFighter | null = null;

  // The dragon's half of the progression web: more health (Vigor), armor (Scale), a surer strike (Fang and Flame) and an earlier first move (Wing).

  const k0 = cleanPerks(input.web) ?? NO_PERKS;

  if (input.dragon && arena !== 'mat') {

    const base = dragonBody(level, input.dragon.bond);

    const body = { maxHp: Math.round(base.maxHp * P.prodigyDragonHpMultiplier(pt)) + k0.dHp, ac: base.ac + k0.dAc, atk: base.atk + k0.dAtk + (arena === 'air' ? k0.dAirHit : 0) };

    const dhp = input.dragon.hp == null ? body.maxHp : clamp(int(input.dragon.hp, body.maxHp), 0, body.maxHp);

    if (dhp > 0) dragon = { name: str(input.dragon.name, 60, 'Your dragon'), hp: dhp, maxHp: body.maxHp, startHp: dhp, ac: body.ac, atk: body.atk, bond: input.dragon.bond, nextAt: now + Math.max(0, 6000 - k0.dOpenMs), turns: 0, status: 'up' };

  }

  const f: Fight = {

    v: 1, id: input.id, status: 'active', outcome: null, lethal: input.lethal && arena !== 'mat', arena, challenge,

    startedAt: now, seenAt: now, endedAt: null, seq: 0, settled: false,

    rider: { name: str(input.riderName, 60, 'The rider'), hp, maxHp, startHp: hp, ac: clamp(int(input.ac, 12), 5, 30), level, atk, weapons, readyAt: now + 1500, masteryRank: masteryInfo(input.masteryXp).rank, clash: null, streak: 0 },

    dragon, enemies, log: [], strainSpent: 0, signetUses: 0, dragonDied: false, riderDown: false, prodigy: pt,

  };

  const perks = cleanPerks(input.web);

  if (perks) {

    f.web = perks;

    if (perks.wardMax > 0) {

      f.rider.shieldMax = perks.wardMax;

      f.rider.shield = perks.wardFightRefill ? perks.wardMax : clamp(int(input.shield, 0), 0, perks.wardMax);

    }

  }

  // Tempo (Initiative) and Wing (Stormrider): the first seconds of the fight.

  if (k0.openReady) f.rider.readyAt = now;

  const late = k0.foeDelayMs + (dragon ? k0.dFoeDelayMs : 0);

  if (late > 0) for (const e of f.enemies) e.nextAt += late;

  say(f, now, `${count > 1 ? `${count} ${baseName}s` : baseName} ${count > 1 ? 'want' : 'wants'} to fight!`, 'warn');

  if (dragon) say(f, now, `${dragon.name} lands beside you.`, 'good');

  return f;

}



/** Stored fights are untrusted JSON: anything that isn't a whole fight is no fight. */

export function cleanFight(raw: unknown): Fight | null {

  const f = raw && typeof raw === 'object' ? (raw as Fight) : null;

  if (!f || f.v !== 1 || typeof f.id !== 'string' || !f.rider || !Array.isArray(f.enemies) || !Array.isArray(f.log)) return null;

  if (f.status !== 'active' && f.status !== 'ended') return null;

  return f;

}



function finish(f: Fight, at: number, outcome: Outcome) {

  if (f.status === 'ended') return;

  f.status = 'ended'; f.outcome = outcome; f.endedAt = at;

  for (const e of f.enemies) e.pending = null;

}

function checkEnd(f: Fight, at: number) {

  if (f.status === 'ended') return;

  if (f.dragon && f.dragon.hp <= 0 && f.dragon.status === 'up') {

    f.dragon.status = 'down';

    if (f.lethal) {

      f.dragonDied = true;

      say(f, at, `${f.dragon.name} falls. The bond tears, and you fall with it.`, 'warn');

      finish(f, at, 'defeat');

      return;

    }

  }

  if (f.rider.hp <= 0) {

    // Loyalty (Devoted): the dragon carries its fallen rider out of a real fight.

    if (f.lethal && perksOf(f).dRescue && f.dragon && up(f.dragon)) {

      f.rider.hp = 1; f.rescued = true;

      say(f, at, `${f.dragon.name} snatches you up and carries you clear. You live.`, 'good');

      finish(f, at, 'fled');

      return;

    }

    if (f.lethal) { f.riderDown = true; say(f, at, `${f.rider.name} goes down!`, 'warn'); }

    else { f.rider.hp = 1; say(f, at, `${f.rider.name} is beaten and the match is called.`, 'warn'); }

    finish(f, at, 'defeat');

    return;

  }

  if (f.enemies.every(e => !up(e))) { say(f, at, 'The fight is won!', 'good'); finish(f, at, 'victory'); }

}

function hurtEnemy(f: Fight, at: number, e: Enemy, amount: number) {

  const lost = Math.min(e.hp, Math.max(0, amount));

  e.hp -= lost;

  if (e.hp <= 0) { e.status = 'down'; e.pending = null; say(f, at, `${e.name} ${f.lethal ? 'falls' : 'is out of the fight'}!`, 'good', { targetId: e.id, amount: lost, kind: 'hit' }); }

  return lost;

}

/** Damage to the rider: Saddle takes some off while the dragon is up, then the Ward soaks, then HP. Returns the HP lost. */

function hurtRider(f: Fight, amount: number, at?: number) {

  const k = perksOf(f);

  let left = Math.max(0, amount - (dragonUp(f) ? k.mountGuard : 0));

  const soaked = Math.min(f.rider.shield ?? 0, left);

  if (soaked > 0) {

    f.rider.shield = (f.rider.shield ?? 0) - soaked;

    left -= soaked;

    if (at != null) say(f, at, `Your Ward absorbs ${soaked}.`, 'info');

  }

  // Loyalty (Take the Blow): once a fight, a hit that would drop the rider lands on the dragon instead.

  if (left > 0 && left >= f.rider.hp && k.dTakeBlow && f.dragon && up(f.dragon) && once(f, 'blow')) {

    const taken = hurtDragon(f, left, at);

    if (at != null) say(f, at, `${f.dragon.name} takes the blow meant for you (${taken}).`, 'good', { targetId: DRAGON_ID, amount: taken, kind: 'hit' });

    return 0;

  }

  const lost = Math.min(f.rider.hp, left); f.rider.hp -= lost;

  // Loyalty (Vengeance): once a fight, the dragon strikes at once when its rider falls to half HP or less.

  if (lost > 0 && at != null && k.dAvenge && f.dragon && up(f.dragon) && f.rider.hp > 0 && f.rider.hp * 2 <= f.rider.maxHp && once(f, 'avenge')) {

    f.dragon.nextAt = at;

    say(f, at, `${f.dragon.name} roars and turns on your attacker.`, 'good');

  }

  return lost;

}

/** Damage to the dragon, through its armor (Scale) and its last reserves (Vigor). big: a telegraphed move. Returns the HP lost. */

function hurtDragon(f: Fight, amount: number, at?: number, big = false) {

  const g = f.dragon;

  if (!g) return 0;

  const k = perksOf(f);

  let left = Math.max(0, amount);

  if (left > 0 && k.dFirstHit && once(f, 'firstHit')) { if (at != null) say(f, at, `Ironhide: the blow glances off ${g.name}.`, 'good'); return 0; }

  if (big && k.dBrace) left = Math.ceil(left / 2);

  left = Math.max(0, left - k.dSoak);

  let lost = Math.min(g.hp, left);

  if (g.hp > 0 && lost >= g.hp && k.dLastStand && once(f, 'stand')) { lost = g.hp - 1; if (at != null) say(f, at, `Unbroken: ${g.name} will not fall.`, 'good'); }

  g.hp -= lost;

  // Saddle (Shared Fury): a hit on the dragon brings the rider's next move closer.

  if (lost > 0 && at != null && k.mountHasteMs > 0) f.rider.readyAt = Math.max(at, f.rider.readyAt - k.mountHasteMs);

  if (g.hp > 0 && g.hp * 4 <= g.maxHp && k.dSecondWind && once(f, 'wind')) {

    const back = Math.min(g.maxHp - g.hp, Math.ceil(g.maxHp / 3));

    g.hp += back;

    if (at != null) say(f, at, `Second Wind: ${g.name} recovers ${back}.`, 'good', { targetId: DRAGON_ID, amount: back, kind: 'heal' });

  }

  return lost;

}

function enemyTurn(f: Fight, e: Enemy, at: number, rand: Rand) {

  const t = FOES[e.kind];

  const dragonUp = !!f.dragon && up(f.dragon);

  const atDragon = dragonUp && rand() < t.dragonBias;

  if (rand() < t.big) {

    const move = t.moves[Math.floor(rand() * t.moves.length)] ?? 'heavy';

    const label = t.moveNames[move] ?? 'Heavy blow';

    const target: Pending['target'] = move === 'sweep' && dragonUp ? 'both' : atDragon ? 'dragon' : 'rider';

    const clash = target === 'dragon' ? null : M.buildClash(`${e.id}-${f.seq + 1}`, move, sides => d(sides, rand));

    const lead = clash ? -M.clashStartsAt(clash, 0) + WINDUP_LEAD_MS : 3500;

    e.pending = { move, label, target, strikeAt: at + lead, clash };

    e.nextAt = at + lead + e.intervalMs;

    const who = target === 'both' ? 'everyone' : target === 'dragon' ? f.dragon?.name ?? f.rider.name : f.rider.name;

    say(f, at, `${e.name} winds up ${label} at ${who}!`, 'warn');

    return;

  }

  e.nextAt = at + e.intervalMs;

  if (atDragon && f.dragon) {

    const a = attackRoll(rand, e.atk, f.dragon.ac);

    if (!a.hit) { say(f, at, `${e.name} strikes at ${f.dragon.name} and misses.`, 'muted'); return; }

    const lost = hurtDragon(f, rollDice(e.dice, rand, a.crit), at);

    say(f, at, `${e.name} hits ${f.dragon.name} for ${lost}${a.crit ? ' (critical)' : ''}.`, 'warn', { targetId: DRAGON_ID, amount: lost, kind: 'hit' });

    return;

  }

  const a = attackRoll(rand, e.atk, riderAc(f));

  if (!a.hit) { say(f, at, `${e.name} attacks and misses.`, 'muted'); sidestep(f, at); return; }

  // Untouchable (Tempo): the first hit of the fight that would land on the rider misses instead.

  if (perksOf(f).dodgeFirst && once(f, 'dodge')) { say(f, at, `Untouchable: you slip ${e.name}'s blow.`, 'good'); return; }

  const lost = hurtRider(f, rollDice(e.dice, rand, a.crit), at);

  say(f, at, `${e.name} hits you for ${lost}${a.crit ? ' (critical)' : ''}.`, 'warn', { targetId: RIDER_ID, amount: lost, kind: 'hit' });

}

function landStrike(f: Fight, e: Enemy, at: number, rand: Rand) {

  const p = e.pending;

  e.pending = null;

  if (!p) return;

  const mult = MOVE_MULT[p.move];

  const base = Math.max(1, Math.round(rollDice(e.dice, rand) * mult));

  if (p.target !== 'rider' && f.dragon && up(f.dragon)) {

    const a = attackRoll(rand, e.atk, f.dragon.ac);

    if (a.hit) { const lost = hurtDragon(f, base, at, true); say(f, at, `${p.label} hits ${f.dragon.name} for ${lost}.`, 'warn', { targetId: DRAGON_ID, amount: lost, kind: 'hit' }); }

    else say(f, at, `${p.label} misses ${f.dragon.name}.`, 'muted');

  }

  if (p.target === 'dragon') return;

  // The rider answers a telegraphed move on the ring: each perfect tap takes that swing's share away.

  const results = p.clash && f.rider.clash?.id === p.clash.id ? f.rider.clash.r : [];

  const scale = p.clash ? M.chainScale(p.clash, results) : 1;

  const perfect = !!p.clash && M.chainPerfect(p.clash, results);

  f.rider.clash = null;

  const next = M.nextClashStreak(f.rider.streak, perfect);

  f.rider.streak = next.streak;

  let amount = Math.round(base * scale);

  if (p.warded) amount = Math.round(amount / (p.wardedDeep ? 4 : 2));

  const slipped = amount > 0 && perksOf(f).dodgeFirst && once(f, 'dodge');

  if (slipped) say(f, at, `Untouchable: you slip ${p.label}.`, 'good');

  else if (amount <= 0) { const before = f.seq; say(f, at, `PERFECT! You turn ${p.label} aside.`, 'good'); mark(f, before, 'rider', 'counter'); }

  else {

    const lost = hurtRider(f, amount, at);

    say(f, at, `${p.label} hits you for ${lost}${scale < 1 ? ' (partly blocked)' : ''}${p.warded ? ' (your dragon took the rest)' : ''}.`, 'warn', { targetId: RIDER_ID, amount: lost, kind: 'hit' });

  }

  if (perfect && up(e)) {

    const w = f.rider.weapons[0]?.dice ?? { count: 1, sides: 4, bonus: 1 };

    const lost = hurtEnemy(f, at, e, M.counterDamage(rollDice(w, rand, next.riposte), p.move));

    if (up(e)) say(f, at, `Counter Clash! You hit ${e.name} for ${lost}${next.riposte ? ' (RIPOSTE!)' : ''}.`, 'good', { targetId: e.id, amount: lost, kind: 'hit' });

    // A perfect answer staggers the attacker: its next turn waits a full interval from now.

    e.nextAt = Math.max(e.nextAt, at + e.intervalMs);

  }

}



function dragonTurn(f: Fight, at: number, rand: Rand) {

  const g = f.dragon;

  if (!g) return;

  g.turns += 1;

  const pt = f.prodigy ?? 0;

  const k = perksOf(f);

  // Wing: a shorter wait between its turns, never below the floor.

  const interval = P.prodigyDragonIntervalMs(pt, DRAGON_INTERVAL_MS);

  g.nextAt = at + (k.dTempoMs > 0 ? Math.max(Math.min(interval, DRAGON_INTERVAL_FLOOR_MS), interval - k.dTempoMs) : interval);

  // Vigor (Mending): a little health back on each of its turns.

  if (k.dMendTurn > 0 && g.hp < g.maxHp) {

    const back = Math.min(g.maxHp - g.hp, k.dMendTurn);

    g.hp += back;

    say(f, at, `${g.name} mends ${back}.`, 'good', { targetId: DRAGON_ID, amount: back, kind: 'heal' });

  }

  const foes = f.enemies.filter(up);

  if (!foes.length) return;

  const markFrom = f.seq;

  // A deep bond: the dragon puts itself between its rider and a blow already on its way. Scale (Guardian) makes it surer.

  const threat = f.enemies.find(e => up(e) && e.pending && e.pending.target === 'rider' && !e.pending.warded);

  const shieldBond = Math.min(P.prodigyShieldBond(pt), k.dShieldBond > 0 ? k.dShieldBond : 999);

  if (threat?.pending && g.bond >= shieldBond && rand() < 0.5 + k.dShieldChance / 100) {

    threat.pending.warded = true;

    if (k.dShieldDeep) threat.pending.wardedDeep = true;

    say(f, at, `${g.name} throws a wing between you and ${threat.name}.`, 'good');

    mark(f, markFrom, 'dragon', 'guard');

    if (!k.dShieldFree) return;

  }

  const every = k.dFireFast ? Math.min(2, P.prodigyFireEvery(pt)) : P.prodigyFireEvery(pt);

  const fireDue = g.turns % every === 0 || (k.dFireOpen && g.turns === 1);

  if (fireDue && (foes.length >= 2 || k.dFireEager || rand() < 0.5)) {

    const fireFrom = f.seq;

    say(f, at, `${g.name} breathes fire!`, 'good');

    mark(f, fireFrom, 'dragon', 'fire');

    for (const e of foes) {

      const full = rollDice({ count: 3 + k.dFireDice, sides: 8, bonus: 0 }, rand);

      // Inferno: no enemy half-avoids the fire.

      const caught = attackRoll(rand, g.atk, e.ac).hit || k.dFireOpen;

      const lost = hurtEnemy(f, at, e, caught ? full : Math.floor(full / 2));

      if (up(e)) say(f, at, `${e.name} is burned for ${lost}.`, 'good', { targetId: e.id, amount: lost, kind: 'hit' });

    }

    return;

  }

  /** One bite, tagged for the phone's animations (a miss or a critical is a bite, any other hit a claw). True when it dropped its target. */

  const bite = (target: Enemy): boolean => {

    const biteFrom = f.seq;

    const a = attackRoll(rand, g.atk, target.ac);

    if (!a.hit) { say(f, at, `${g.name} snaps at ${target.name} and misses.`, 'muted'); mark(f, biteFrom, 'dragon', 'bite'); return false; }

    const crit = a.crit || (k.dCritFrom > 0 && a.d20 >= k.dCritFrom);

    const lost = hurtEnemy(f, at, target, rollDice({ count: 2 + k.dBiteDice, sides: 8, bonus: 4 + k.dBite + (f.arena === 'air' ? k.dAirBite : 0) }, rand, crit));

    if (up(target)) say(f, at, `${g.name} tears into ${target.name} for ${lost}${crit ? ' (critical)' : ''}.`, 'good', { targetId: target.id, amount: lost, kind: 'hit' });

    mark(f, biteFrom, 'dragon', crit ? 'bite' : 'claw');

    if (!up(target)) return true;

    // Wing (Swoop): the bitten enemy's next move comes later (a move already winding up is not delayed).

    if (k.dHarryMs > 0 && !target.pending) target.nextAt += k.dHarryMs;

    return false;

  };

  // Otherwise it goes for whoever is winding up at its rider, else the weakest.

  const target = threat ?? foes.slice().sort((a, b) => a.hp - b.hp)[0];

  if (bite(target) && k.dCleave) {

    // Savage (Fang): a kill frees it to bite again at once.

    const next = f.enemies.filter(up).sort((a, b) => a.hp - b.hp)[0];

    if (next) { say(f, at, `Savage: ${g.name} turns on ${next.name}.`, 'good'); bite(next); }

  }

}

/** The soonest moment anything is due; NaN when the fight is over. */

export function nextDueAt(f: Fight): number {

  if (f.status !== 'active') return NaN;

  let soonest = NaN;

  const consider = (t: number) => { if (!(t >= soonest)) soonest = t; };

  for (const e of f.enemies) if (up(e)) consider(e.pending ? e.pending.strikeAt : e.nextAt);

  if (f.dragon && up(f.dragon)) consider(f.dragon.nextAt);

  return soonest;

}



/** Bring the fight up to `now`: everything due happens, in order, at its own moment. */

export function advance(f: Fight, now: number, rand: Rand): Fight {

  if (f.status !== 'active') return f;

  const gap = now - f.seenAt;

  if (gap > AWAY_MS) {

    // The phone was away: nothing happened meanwhile, and every timer picks up where it stopped.

    const shift = gap - 1000;

    for (const e of f.enemies) { e.nextAt += shift; if (e.pending) e.pending.strikeAt += shift; }

    if (f.dragon) f.dragon.nextAt += shift;

    f.rider.readyAt += shift;

  }

  f.seenAt = now;

  for (let guard = 0; guard < 60 && f.status === 'active'; guard++) {

    const due = nextDueAt(f);

    if (!Number.isFinite(due) || due > now) break;

    const g = f.dragon;

    if (g && up(g) && g.nextAt === due) dragonTurn(f, due, rand);

    else {

      const e = f.enemies.find(x => up(x) && (x.pending ? x.pending.strikeAt : x.nextAt) === due);

      if (!e) break;

      if (e.pending) landStrike(f, e, due, rand); else enemyTurn(f, e, due, rand);

    }

    checkEnd(f, due);

  }

  return f;

}



export type ActInput =

  | { type: 'attack'; targetId: string; weapon?: string }

  | { type: 'signet'; targetId: string; intensity: number; strainRoom: number }

  | { type: 'potion'; dice?: string; name?: string }

  | { type: 'flee' } | { type: 'yield' };

/** strain: what is charged to Signet Strain. blood: points over the limit that were paid in HP instead (Lifeblood). */

export type ActResult = { ok: true; strain: number; usedPotion: boolean; blood?: number } | { ok: false; error: string };

/** One move by the rider. Call advance() first so the fight is current. */

export function act(f: Fight, now: number, a: ActInput, rand: Rand): ActResult {

  if (f.status !== 'active') return { ok: false, error: 'The fight is over.' };

  if (a.type === 'yield') {

    if (f.lethal) return { ok: false, error: 'There is no yielding here. Flee, or win.' };

    say(f, now, `${f.rider.name} yields.`, 'muted'); finish(f, now, 'yield');

    return { ok: true, strain: 0, usedPotion: false };

  }

  if (now + 250 < f.rider.readyAt) return { ok: false, error: 'Not ready yet.' };

  const target = 'targetId' in a ? f.enemies.find(e => e.id === a.targetId && up(e)) : undefined;

  let strain = 0, usedPotion = false, blood = 0;

  let markFrom = f.seq;

  const adr = adrenaline(f);

  const rush = adr.damage ? ` (adrenaline +${adr.damage})` : '';

  const k = perksOf(f);

  const mounted = dragonUp(f);

  const ride = mounted && k.mountDamage ? ` (mounted +${k.mountDamage})` : '';

  if (a.type === 'attack') {

    if (!target) return { ok: false, error: 'Pick an enemy that is still standing.' };

    const wanted = (a.weapon || '').trim().toLowerCase();

    const w = f.rider.weapons.find(x => x.name.toLowerCase() === wanted) ?? f.rider.weapons[0] ?? { name: 'Unarmed strike', dice: { count: 1, sides: 4, bonus: 1 } };

    const r = attackRoll(rand, f.rider.atk + adr.hit + k.wpnHit + (mounted ? k.mountHit : 0), target.ac);

    // Blade: flat damage, extra dice (more against a wounded enemy), a wider critical range, and a near miss that still lands.

    const flat = adr.damage + k.wpnDamage + (mounted ? k.mountDamage : 0);

    const dice: Dice = { ...w.dice, count: w.dice.count + k.wpnDice + (mounted ? k.mountDice : 0) + (target.hp * 2 <= target.maxHp ? k.wpnFinish : 0) };

    const edge = k.wpnDamage ? ` (Blade +${k.wpnDamage})` : '';

    if (!r.hit) {

      if (k.graze > 0 && r.d20 !== 1 && r.total + k.graze >= target.ac) {

        const lost = hurtEnemy(f, now, target, Math.max(1, Math.floor((rollDice(dice, rand) + flat) / 2)));

        if (up(target)) say(f, now, `${w.name} glances off ${target.name} for ${lost} (${r.total} vs AC ${target.ac}).`, 'info', { targetId: target.id, amount: lost, kind: 'hit' });

      } else say(f, now, `You swing ${w.name} at ${target.name} and miss (${r.total} vs AC ${target.ac}).`, 'muted');

    } else {

      // First Blood (Tempo): the first hit of the fight is critical.

      const crit = r.crit || (k.critFrom > 0 && r.d20 >= k.critFrom) || (k.firstCrit && once(f, 'firstCrit'));

      const lost = hurtEnemy(f, now, target, rollDice(dice, rand, crit) + flat);

      if (up(target)) say(f, now, `${w.name} hits ${target.name} for ${lost}${crit ? ' (critical)' : ''}${rush}${edge}${ride}.`, 'good', { targetId: target.id, amount: lost, kind: 'hit' });

    }

    mark(f, markFrom, 'rider', 'attack');

  } else if (a.type === 'signet') {

    if (!target) return { ok: false, error: 'Pick an enemy that is still standing.' };

    const intensity = clamp(int(a.intensity, 1), 1, 8);

    strain = signetStrainCost(intensity, f.rider.masteryRank, f.prodigy ?? 0);

    const room = Math.max(0, int(a.strainRoom));

    if (strain > room) {

      // Lifeblood: what does not fit under the limit is paid in HP, never down to 0.

      const price = f.web?.bloodPrice ?? 0;

      if (price <= 0) return { ok: false, error: 'That much power would burn you out. Channel less.' };

      const cost = (strain - room) * price;

      if (cost >= f.rider.hp) return { ok: false, error: 'You do not have the blood to pay for that. Channel less.' };

      blood = strain - room;

      f.rider.hp -= cost;

      say(f, now, `You push past your limit and pay ${cost} HP in blood.`, 'warn', { targetId: RIDER_ID, amount: cost, kind: 'hit' });

    }

    markFrom = f.seq;

    const bonus = proficiency(f.rider.level) + 3 + Math.min(f.rider.masteryRank, 3) + adr.hit + (mounted ? k.mountHit : 0);

    const r = attackRoll(rand, bonus, target.ac);

    const crit = r.crit || (r.hit && k.firstCrit && once(f, 'firstCrit'));

    const heart = blood > 0 && f.web?.heartfire ? 2 : 0;

    const full = rollDice({ count: intensity + P.prodigySignetDice(f.prodigy ?? 0) + heart + (f.web?.sigDice ?? 0) + (mounted ? k.mountDice : 0), sides: 6, bonus: f.rider.masteryRank }, rand, crit) + adr.damage + (f.web?.sigDamage ?? 0) + (mounted ? k.mountDamage : 0);

    f.strainSpent += strain; f.signetUses += 1;

    strain -= blood;

    if (r.hit) {

      const lost = hurtEnemy(f, now, target, full);

      if (!up(target) && f.web?.sigKillRefund && strain > 0) { strain -= 1; say(f, now, 'Stormheart: the kill gives 1 Signet Strain back.', 'good'); }

      if (up(target)) say(f, now, `Your signet strikes ${target.name} for ${lost}${crit ? ' (critical)' : ''}${heart ? ' (heartfire)' : ''}${rush}${ride}.`, 'good', { targetId: target.id, amount: lost, kind: 'hit' });

    } else if (intensity >= 5) {

      const lost = hurtEnemy(f, now, target, Math.floor(full / 2));

      if (up(target)) say(f, now, `${target.name} half-avoids your signet and takes ${lost}.`, 'info', { targetId: target.id, amount: lost, kind: 'hit' });

    } else say(f, now, `Your signet goes wide of ${target.name}.`, 'muted');

    mark(f, markFrom, 'rider', 'signet');

  } else if (a.type === 'potion') {

    const dice = parseDice(a.dice) ?? { count: 2, sides: 4, bonus: 2 };

    const gained = Math.min(f.rider.maxHp - f.rider.hp, rollDice(dice, rand));

    f.rider.hp += gained; usedPotion = true;

    say(f, now, `You drink ${str(a.name, 40, 'a potion')} and recover ${gained}.`, 'good', { targetId: RIDER_ID, amount: gained, kind: 'heal' });

    mark(f, markFrom, 'rider', 'potion');

  } else if (a.type === 'flee') {

    if (!f.lethal) return { ok: false, error: 'This is a match on the mat. Yield instead.' };

    // Tempo (Evasion) and Wing (Flight) add to the roll; Skyborne makes a dragon-borne escape certain.

    const roll = d(20, rand) + proficiency(f.rider.level) + 2 + (mounted ? 4 + k.dFlee : 0) + P.prodigyFleeBonus(f.prodigy ?? 0) + k.flee;

    if (roll >= FLEE_DC[f.challenge] || (mounted && k.dSureFlee)) { say(f, now, mounted ? `${f.dragon?.name ?? 'Your dragon'} hauls you clear. You get away.` : 'You break away and escape.', 'info'); finish(f, now, 'fled'); }

    else say(f, now, `You try to break away and can't (${roll} vs ${FLEE_DC[f.challenge]}).`, 'warn');

  }

  // Regeneration: a little HP on each of the rider's turns; with Wellspring, what HP cannot hold refills the Ward.

  const w = f.web;

  if (w && w.regenTurn > 0 && f.rider.hp > 0 && f.status === 'active') {

    const gained = Math.min(f.rider.maxHp - f.rider.hp, w.regenTurn);

    const refill = w.regenWard ? Math.min((f.rider.shieldMax ?? 0) - (f.rider.shield ?? 0), w.regenTurn - gained) : 0;

    f.rider.hp += gained;

    if (refill > 0) f.rider.shield = (f.rider.shield ?? 0) + refill;

    if (gained > 0) say(f, now, `Regeneration: +${gained} HP${refill > 0 ? `, +${refill} Ward` : ''}.`, 'good', { targetId: RIDER_ID, amount: gained, kind: 'heal' });

    else if (refill > 0) say(f, now, `Regeneration: +${refill} Ward.`, 'good');

  }

  // Adrenaline is judged on the HP the rider has after the move (blood paid counts).

  // Tempo shortens the wait; neither it nor adrenaline takes it below the floor.

  const base = P.prodigyRiderCooldownMs(f.prodigy ?? 0, RIDER_COOLDOWN_MS);

  const cooldown = k.tempoMs > 0 ? Math.max(Math.min(base, RIDER_COOLDOWN_FLOOR_MS), base - k.tempoMs) : base;

  const haste = adrenaline(f).hasteMs;

  f.rider.readyAt = now + (haste > 0 ? Math.max(Math.min(cooldown, RIDER_COOLDOWN_FLOOR_MS), cooldown - haste) : cooldown);

  // Blur (Tempo): no wait after the first move of the fight.

  if (k.blur && f.status === 'active' && once(f, 'blur')) { f.rider.readyAt = now; say(f, now, 'Blur: you can act again at once.', 'good'); }

  checkEnd(f, now);

  return { ok: true, strain, usedPotion, ...(blood > 0 ? { blood } : {}) };

}

/** One tap on the Counter Clash ring, judged on the server's clock. Free: it never uses the cooldown. */

export function clashTap(f: Fight, now: number, enemyId: string, side: unknown, tapAtRaw: unknown): { ok: boolean; index?: number; quality?: M.ClashQ } {

  if (f.status !== 'active' || f.rider.hp <= 0) return { ok: false };

  const e = f.enemies.find(x => x.id === enemyId && up(x));

  const chain = e?.pending?.clash ?? null;

  if (!e || !e.pending || !chain || e.pending.target === 'dragon') return { ok: false };

  if (side !== 'left' && side !== 'top' && side !== 'right') return { ok: false };

  const raw = Number(tapAtRaw);

  const tapAt = Number.isFinite(raw) && raw <= now && raw >= now - 2500 ? raw : now;

  const results = f.rider.clash?.id === chain.id ? [...f.rider.clash.r] : [];

  const judged = M.judgeClash(chain, e.pending.strikeAt, tapAt, side, results);

  if (!judged) return { ok: false };

  while (results.length < chain.swings.length) results.push(null);

  results[judged.index] = judged.q;

  f.rider.clash = { id: chain.id, r: results };

  return { ok: true, index: judged.index, quality: judged.q };

}



/** shield: what is left of the rider's Ward when the fight ends (null: the rider has none).

 *  together: a real fight won with the dragon still standing (it counts toward Kinship and, with Loyalty, trust).

 *  rescued: the dragon carried its fallen rider out. dragonWeb: the Vigor health inside the dragon's max HP in this fight. */

export interface Settlement {

  shield: number | null; together: boolean; rescued: boolean; dragonWeb: number;

  events: RuleEvent[]; dragonHp: number | null; condition: { name: string; penalty: number; minutes: number } | null;

  injury: string | null; line: string; xp: number; masteryXp: number;

}

/** What a finished fight leaves behind. Call once (fight.settled guards it). */

export function settle(f: Fight, rand: Rand): Settlement {

  const won = f.outcome === 'victory';

  const n = f.enemies.length;

  const tierXp = Math.max(1, Math.ceil(f.rider.level / 4));

  let xp = won ? Math.round(VICTORY_XP[f.challenge] * (1 + 0.5 * (n - 1)) * tierXp) : 0;

  if (!f.lethal) xp = Math.round(xp / 4);

  const net = f.rider.hp - f.rider.startHp;

  let condition: Settlement['condition'] = null;

  let injury: string | null = null;

  if (f.outcome === 'defeat' && !f.lethal) condition = { name: 'Battered', penalty: 1, minutes: 240 };

  if (f.lethal && !f.riderDown && !f.dragonDied && f.rider.hp <= Math.floor(f.rider.maxHp / 4) && rand() < 0.5) {

    injury = ['Deep gash', 'Cracked rib', 'Burned arm', 'Wrenched knee'][Math.floor(rand() * 4)];

  }

  const foes = n > 1 ? `${n} ${FOES[f.enemies[0].kind].label.toLowerCase()}s` : f.enemies[0].name;

  const secs = Math.max(1, Math.round(((f.endedAt ?? f.seenAt) - f.startedAt) / 1000));

  const word = f.outcome === 'victory' ? 'VICTORY' : f.outcome === 'fled' ? 'ESCAPED' : f.outcome === 'yield' ? 'YIELDED' : 'DEFEAT';

  const g = f.dragon;

  // Vigor (Victor's Rest): a dragon that won mends a fifth of its health.

  const mended = won && g && g.hp > 0 && perksOf(f).dWinMend ? Math.min(g.maxHp - g.hp, Math.ceil(g.maxHp / 5)) : 0;

  const bits = [

    `${word} against ${foes} (${f.lethal ? 'a real fight' : 'a match on the mat'}, ${secs} seconds)`,

    `${f.rider.name} ${net < 0 ? `took ${-net} damage` : net > 0 ? `ended ${net} HP up` : 'took no lasting damage'} and stands at ${Math.max(0, f.rider.hp)}/${f.rider.maxHp} HP`,

    g ? `${g.name} ${g.hp < g.startHp ? `took ${g.startHp - g.hp} damage (${Math.max(0, g.hp)}/${g.maxHp})` : 'was not hurt'}${mended ? ` and mended ${mended} after the win` : ''}` : '',

    f.rescued && g ? `${g.name} carried the fallen rider out of the fight` : '',

    f.signetUses ? `the signet was channeled ${f.signetUses} time${f.signetUses === 1 ? '' : 's'}` : '',

    `enemies down: ${f.enemies.filter(e => !up(e)).map(e => e.name).join(', ') || 'none'}`,

    injury ? `new injury: ${injury}` : '', condition ? `condition: ${condition.name}` : '',

    f.dragonDied ? `${g?.name} was killed, and the rider dies with the bond` : f.riderDown ? 'the rider is down and dying' : '',

  ].filter(Boolean);

  const line = `[FIGHT RESULT, binding: ${bits.join('. ')}. Narrate the aftermath from this; do not change who won, who is hurt, or any number.]`;

  const events: RuleEvent[] = [{

    kind: 'fight', reason: `${word}: ${foes}`, xp, hp: net, idem_key: `fight:${f.id}`,

    payload: {

      outcome: f.outcome, lethal: f.lethal, riderDown: f.riderDown, dragonDied: f.dragonDied, dragonFought: !!g,

      condition: condition?.name ?? null, injury, line,

    },

  }];

  const shield = (f.rider.shieldMax ?? 0) > 0 ? clamp(int(f.rider.shield, 0), 0, f.rider.shieldMax ?? 0) : null;

  return {

    shield, together: won && f.lethal && !!g && g.hp > 0, rescued: !!f.rescued, dragonWeb: g ? perksOf(f).dHp : 0,

    events, dragonHp: g ? Math.max(0, g.hp) + mended : null, condition, injury, line, xp, masteryXp: Math.min(3, f.signetUses),

  };

}

/** What the phone needs to draw the fight. */

export function viewOf(f: Fight, now: number) {

  return {

    id: f.id, status: f.status, outcome: f.outcome, lethal: f.lethal, arena: f.arena, challenge: f.challenge,

    serverNow: now, nextDueAt: Number.isFinite(nextDueAt(f)) ? nextDueAt(f) : null,

    rider: {

      id: RIDER_ID, name: f.rider.name, hp: f.rider.hp, maxHp: f.rider.maxHp, level: f.rider.level, readyAt: f.rider.readyAt, weapons: f.rider.weapons.map(w => w.name), clash: f.rider.clash,

      // The progression web: the Ward (0 and 0 when the rider has none), adrenaline (0 to 2) and the price of blood (0: none).

      shield: f.rider.shield ?? 0, shieldMax: f.rider.shieldMax ?? 0, adrenaline: adrenaline(f).level, bloodPrice: f.web?.bloodPrice ?? 0,

    },

    dragon: f.dragon ? { id: DRAGON_ID, name: f.dragon.name, hp: f.dragon.hp, maxHp: f.dragon.maxHp, status: f.dragon.status, nextAt: f.dragon.nextAt } : null,

    enemies: f.enemies.map(e => ({

      id: e.id, name: e.name, kind: e.kind, hp: e.hp, maxHp: e.maxHp, status: e.status, nextAt: e.nextAt,

      pending: e.pending ? { move: e.pending.move, label: e.pending.label, target: e.pending.target, strikeAt: e.pending.strikeAt, clash: e.pending.clash, warded: !!e.pending.warded } : null,

    })),

    log: f.log, dragonDied: f.dragonDied, riderDown: f.riderDown,

  };

}

export type FightView = ReturnType<typeof viewOf>;
