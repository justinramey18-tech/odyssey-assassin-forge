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

export interface FightEvent { n: number; at: number; text: string; tone: Tone; targetId?: string; amount?: number; flash?: 'hit' | 'heal' }

export interface Pending {

  move: M.ClashMove; label: string; target: 'rider' | 'dragon' | 'both'; strikeAt: number;

  /** The Counter Clash chain when the move is aimed at the rider. */

  clash: M.Clash | null; warded?: boolean;

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

}



/** The progression web's fight perks (see web.ts). Every number is 0 and every flag false for a rider who owns none. */

export interface FightPerks {

  wardMax: number; wardFightRefill: boolean; regenTurn: number; regenWard: boolean;

  adrDamage: number; adrHit: number; adrDouble: boolean; adrHasteMs: number;

  bloodPrice: number; heartfire: boolean;

}

/** Perks come from the server's own ledger, but a stored fight is still untrusted JSON: clamp everything. */

export function cleanPerks(raw: unknown): FightPerks | null {

  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;

  if (!r) return null;

  const p: FightPerks = {

    wardMax: clamp(int(r.wardMax), 0, 100), wardFightRefill: r.wardFightRefill === true,

    regenTurn: clamp(int(r.regenTurn), 0, 10), regenWard: r.regenWard === true,

    adrDamage: clamp(int(r.adrDamage), 0, 10), adrHit: clamp(int(r.adrHit), 0, 5), adrDouble: r.adrDouble === true, adrHasteMs: clamp(int(r.adrHasteMs), 0, 4000),

    bloodPrice: clamp(int(r.bloodPrice), 0, 20), heartfire: r.heartfire === true,

  };

  return p.wardMax || p.regenTurn || p.adrDamage || p.adrHit || p.adrHasteMs || p.bloodPrice ? p : null;

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

function say(f: Fight, at: number, text: string, tone: Tone = 'info', flash?: { targetId: string; amount: number; kind: 'hit' | 'heal' }) {

  f.seq += 1;

  f.log.push({ n: f.seq, at, text, tone, ...(flash ? { targetId: flash.targetId, amount: flash.amount, flash: flash.kind } : {}) });

  if (f.log.length > 60) f.log = f.log.slice(-60);

}

const up = (e: { status: string; hp: number }) => e.status === 'up' && e.hp > 0;

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

  if (input.dragon && arena !== 'mat') {

    const base = dragonBody(level, input.dragon.bond);

    const body = { ...base, maxHp: Math.round(base.maxHp * P.prodigyDragonHpMultiplier(pt)) };

    const dhp = input.dragon.hp == null ? body.maxHp : clamp(int(input.dragon.hp, body.maxHp), 0, body.maxHp);

    if (dhp > 0) dragon = { name: str(input.dragon.name, 60, 'Your dragon'), hp: dhp, maxHp: body.maxHp, startHp: dhp, ac: body.ac, atk: body.atk, bond: input.dragon.bond, nextAt: now + 6000, turns: 0, status: 'up' };

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

/** Damage to the rider goes through the Ward first. Returns the HP lost. */

function hurtRider(f: Fight, amount: number, at?: number) {

  let left = Math.max(0, amount);

  const soaked = Math.min(f.rider.shield ?? 0, left);

  if (soaked > 0) {

    f.rider.shield = (f.rider.shield ?? 0) - soaked;

    left -= soaked;

    if (at != null) say(f, at, `Your Ward absorbs ${soaked}.`, 'info');

  }

  const lost = Math.min(f.rider.hp, left); f.rider.hp -= lost; return lost;

}

function hurtDragon(f: Fight, amount: number) { if (!f.dragon) return 0; const lost = Math.min(f.dragon.hp, Math.max(0, amount)); f.dragon.hp -= lost; return lost; }



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

    const lost = hurtDragon(f, rollDice(e.dice, rand, a.crit));

    say(f, at, `${e.name} hits ${f.dragon.name} for ${lost}${a.crit ? ' (critical)' : ''}.`, 'warn', { targetId: DRAGON_ID, amount: lost, kind: 'hit' });

    return;

  }

  const a = attackRoll(rand, e.atk, f.rider.ac);

  if (!a.hit) { say(f, at, `${e.name} attacks and misses.`, 'muted'); return; }

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

    if (a.hit) { const lost = hurtDragon(f, base); say(f, at, `${p.label} hits ${f.dragon.name} for ${lost}.`, 'warn', { targetId: DRAGON_ID, amount: lost, kind: 'hit' }); }

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

  if (p.warded) amount = Math.round(amount / 2);

  if (amount <= 0) say(f, at, `PERFECT! You turn ${p.label} aside.`, 'good');

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

  g.nextAt = at + P.prodigyDragonIntervalMs(pt, DRAGON_INTERVAL_MS);

  const foes = f.enemies.filter(up);

  if (!foes.length) return;

  // A deep bond: the dragon puts itself between its rider and a blow already on its way.

  const threat = f.enemies.find(e => up(e) && e.pending && e.pending.target === 'rider' && !e.pending.warded);

  if (threat?.pending && g.bond >= P.prodigyShieldBond(pt) && rand() < 0.5) {

    threat.pending.warded = true;

    say(f, at, `${g.name} throws a wing between you and ${threat.name}.`, 'good');

    return;

  }

  if (g.turns % P.prodigyFireEvery(pt) === 0 && (foes.length >= 2 || rand() < 0.5)) {

    say(f, at, `${g.name} breathes fire!`, 'good');

    for (const e of foes) {

      const full = rollDice({ count: 3, sides: 8, bonus: 0 }, rand);

      const lost = hurtEnemy(f, at, e, attackRoll(rand, g.atk, e.ac).hit ? full : Math.floor(full / 2));

      if (up(e)) say(f, at, `${e.name} is burned for ${lost}.`, 'good', { targetId: e.id, amount: lost, kind: 'hit' });

    }

    return;

  }

  // Otherwise it goes for whoever is winding up at its rider, else the weakest.

  const target = threat ?? foes.slice().sort((a, b) => a.hp - b.hp)[0];

  const a = attackRoll(rand, g.atk, target.ac);

  if (!a.hit) { say(f, at, `${g.name} snaps at ${target.name} and misses.`, 'muted'); return; }

  const lost = hurtEnemy(f, at, target, rollDice({ count: 2, sides: 8, bonus: 4 }, rand, a.crit));

  if (up(target)) say(f, at, `${g.name} tears into ${target.name} for ${lost}${a.crit ? ' (critical)' : ''}.`, 'good', { targetId: target.id, amount: lost, kind: 'hit' });

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

  const adr = adrenaline(f);

  const rush = adr.damage ? ` (adrenaline +${adr.damage})` : '';

  if (a.type === 'attack') {

    if (!target) return { ok: false, error: 'Pick an enemy that is still standing.' };

    const wanted = (a.weapon || '').trim().toLowerCase();

    const w = f.rider.weapons.find(x => x.name.toLowerCase() === wanted) ?? f.rider.weapons[0] ?? { name: 'Unarmed strike', dice: { count: 1, sides: 4, bonus: 1 } };

    const r = attackRoll(rand, f.rider.atk + adr.hit, target.ac);

    if (!r.hit) say(f, now, `You swing ${w.name} at ${target.name} and miss (${r.total} vs AC ${target.ac}).`, 'muted');

    else {

      const lost = hurtEnemy(f, now, target, rollDice(w.dice, rand, r.crit) + adr.damage);

      if (up(target)) say(f, now, `${w.name} hits ${target.name} for ${lost}${r.crit ? ' (critical)' : ''}${rush}.`, 'good', { targetId: target.id, amount: lost, kind: 'hit' });

    }

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

    const bonus = proficiency(f.rider.level) + 3 + Math.min(f.rider.masteryRank, 3) + adr.hit;

    const r = attackRoll(rand, bonus, target.ac);

    const heart = blood > 0 && f.web?.heartfire ? 2 : 0;

    const full = rollDice({ count: intensity + P.prodigySignetDice(f.prodigy ?? 0) + heart, sides: 6, bonus: f.rider.masteryRank }, rand, r.crit) + adr.damage;

    f.strainSpent += strain; f.signetUses += 1;

    strain -= blood;

    if (r.hit) {

      const lost = hurtEnemy(f, now, target, full);

      if (up(target)) say(f, now, `Your signet strikes ${target.name} for ${lost}${r.crit ? ' (critical)' : ''}${heart ? ' (heartfire)' : ''}${rush}.`, 'good', { targetId: target.id, amount: lost, kind: 'hit' });

    } else if (intensity >= 5) {

      const lost = hurtEnemy(f, now, target, Math.floor(full / 2));

      if (up(target)) say(f, now, `${target.name} half-avoids your signet and takes ${lost}.`, 'info', { targetId: target.id, amount: lost, kind: 'hit' });

    } else say(f, now, `Your signet goes wide of ${target.name}.`, 'muted');

  } else if (a.type === 'potion') {

    const dice = parseDice(a.dice) ?? { count: 2, sides: 4, bonus: 2 };

    const gained = Math.min(f.rider.maxHp - f.rider.hp, rollDice(dice, rand));

    f.rider.hp += gained; usedPotion = true;

    say(f, now, `You drink ${str(a.name, 40, 'a potion')} and recover ${gained}.`, 'good', { targetId: RIDER_ID, amount: gained, kind: 'heal' });

  } else if (a.type === 'flee') {

    if (!f.lethal) return { ok: false, error: 'This is a match on the mat. Yield instead.' };

    const dragonUp = !!f.dragon && up(f.dragon);

    const roll = d(20, rand) + proficiency(f.rider.level) + 2 + (dragonUp ? 4 : 0) + P.prodigyFleeBonus(f.prodigy ?? 0);

    if (roll >= FLEE_DC[f.challenge]) { say(f, now, dragonUp ? `${f.dragon?.name ?? 'Your dragon'} hauls you clear. You get away.` : 'You break away and escape.', 'info'); finish(f, now, 'fled'); }

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

  const cooldown = P.prodigyRiderCooldownMs(f.prodigy ?? 0, RIDER_COOLDOWN_MS);

  const haste = adrenaline(f).hasteMs;

  f.rider.readyAt = now + (haste > 0 ? Math.max(Math.min(cooldown, RIDER_COOLDOWN_FLOOR_MS), cooldown - haste) : cooldown);

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



/** shield: what is left of the rider's Ward when the fight ends (null: the rider has none). */

export interface Settlement {

  shield: number | null;

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

  const bits = [

    `${word} against ${foes} (${f.lethal ? 'a real fight' : 'a match on the mat'}, ${secs} seconds)`,

    `${f.rider.name} ${net < 0 ? `took ${-net} damage` : net > 0 ? `ended ${net} HP up` : 'took no lasting damage'} and stands at ${Math.max(0, f.rider.hp)}/${f.rider.maxHp} HP`,

    g ? `${g.name} ${g.hp < g.startHp ? `took ${g.startHp - g.hp} damage (${Math.max(0, g.hp)}/${g.maxHp})` : 'was not hurt'}` : '',

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

  return { shield, events, dragonHp: g ? Math.max(0, g.hp) : null, condition, injury, line, xp, masteryXp: Math.min(3, f.signetUses) };

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
