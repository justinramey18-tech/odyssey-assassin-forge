// npc-combat rules (Live NPC Combat). Pure functions: no database, no network.
// Every number in a fight is decided here, so the rules can be read and tested in one place.

/** How often an NPC acts, in seconds, for each Speed preset the host can pick. */
export const SPEED_PRESETS = {
  trivial: 120,
  easy: 90,
  medium: 60,
  hard: 40,
  deadly: 20,
} as const;
export type SpeedPreset = keyof typeof SPEED_PRESETS;

/** A downed player rolls one death save this often. */
export const DEATH_SAVE_INTERVAL_S = 30;
/** A player can take one combat action this often. */
export const PLAYER_ACTION_COOLDOWN_S = 8;
/** Medicine check to stabilize a downed ally. */
export const STABILIZE_DC = 10;
/** A phone that pinged this recently counts as present (NPCs only target present players). */
export const PRESENT_S = 45;

/** The host's combat stat block for one NPC (party_npcs.combat_stats). */
export interface NpcCombatStats {
  maxHp: number;
  ac: number;
  attackBonus: number;
  damage: string;
  speed: SpeedPreset;
}

const clampInt = (v: unknown, min: number, max: number, fallback: number): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
};

/** A checked copy of a stat block, or null when it can't be used in a fight. */
export function cleanCombatStats(raw: unknown): NpcCombatStats | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const damage = typeof r.damage === 'string' ? r.damage.trim() : '';
  const dice = parseDice(damage);
  if (!dice) return null;
  const speed = typeof r.speed === 'string' && r.speed in SPEED_PRESETS ? (r.speed as SpeedPreset) : null;
  if (!speed) return null;
  const maxHp = clampInt(r.maxHp, 0, 999, 0);
  if (maxHp < 1) return null;
  return {
    maxHp,
    ac: clampInt(r.ac, 5, 30, 12),
    attackBonus: clampInt(r.attackBonus, -5, 20, 3),
    damage: formatDice(dice),
    speed,
  };
}

// ── Dice ──────────────────────────────────────────────────────────────────────

/** Returns a whole number from 1 to sides. */
export type Roller = (sides: number) => number;

/** A fair roll from crypto random numbers. */
export const cryptoRoll: Roller = (sides) => {
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / sides) * sides;
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) return (buf[0] % sides) + 1;
  }
};

export interface Dice {
  count: number;
  sides: number;
  bonus: number;
}

const ALLOWED_SIDES = new Set([2, 3, 4, 6, 8, 10, 12, 20, 100]);

/** Reads the first "NdS+B" in a text such as "1d6+2 piercing". Null when there is none. */
export function parseDice(text: unknown): Dice | null {
  if (typeof text !== 'string') return null;
  const m = /(\d{1,2})\s*d\s*(\d{1,3})(?:\s*([+-])\s*(\d{1,3}))?/i.exec(text);
  if (!m) return null;
  const count = Number(m[1]);
  const sides = Number(m[2]);
  const bonus = m[4] ? Number(m[4]) * (m[3] === '-' ? -1 : 1) : 0;
  if (count < 1 || count > 20 || !ALLOWED_SIDES.has(sides)) return null;
  return { count, sides, bonus };
}

export function formatDice(d: Dice): string {
  return `${d.count}d${d.sides}${d.bonus > 0 ? `+${d.bonus}` : d.bonus < 0 ? `${d.bonus}` : ''}`;
}

/** Rolls the dice (twice as many on a critical hit). A hit always does at least 1. */
export function rollDamage(d: Dice, roll: Roller, crit = false): number {
  const n = d.count * (crit ? 2 : 1);
  let total = d.bonus;
  for (let i = 0; i < n; i++) total += roll(d.sides);
  return Math.max(1, total);
}

/** Rolls healing dice. Always at least 1. */
export function rollHealing(d: Dice, roll: Roller): number {
  return rollDamage(d, roll, false);
}

// ── Character sheet numbers (from party_members.character_status) ────────────

export interface SheetSummary {
  level?: unknown;
  ac?: unknown;
  maxHP?: unknown;
  currentHP?: unknown;
  abilityScores?: Record<string, unknown> | null;
  quickActions?: { weapons?: Array<{ name?: unknown; damage?: unknown }> | null } | null;
}

export const abilityMod = (score: unknown): number => Math.floor((clampInt(score, 1, 30, 10) - 10) / 2);
export const proficiency = (level: unknown): number => Math.ceil(clampInt(level, 1, 20, 1) / 4) + 1;

const scores = (s: SheetSummary) => s.abilityScores ?? {};

export function sheetAc(s: SheetSummary): number {
  return clampInt(s.ac, 1, 40, 10);
}

export function sheetMaxHp(s: SheetSummary): number {
  return clampInt(s.maxHP, 1, 999, 1);
}

export function sheetCurrentHp(s: SheetSummary): number {
  return clampInt(s.currentHP, 0, sheetMaxHp(s), sheetMaxHp(s));
}

export interface WeaponAttack {
  name: string;
  bonus: number;
  dice: Dice;
}

/**
 * The weapon a player attacks with: the named one from their quick actions, else their first
 * weapon, else an unarmed strike. Weapon damage text already includes its bonus ("1d6+2"),
 * so nothing more is added. Attack bonus = proficiency + the better of STR and DEX.
 */
export function weaponAttack(s: SheetSummary, weaponName?: unknown): WeaponAttack {
  const a = scores(s);
  const bonus = proficiency(s.level) + Math.max(abilityMod(a.str), abilityMod(a.dex));
  const weapons = Array.isArray(s.quickActions?.weapons) ? s.quickActions!.weapons! : [];
  const wanted = typeof weaponName === 'string' ? weaponName.trim().toLowerCase() : '';
  const usable = weapons
    .map(w => ({ name: typeof w?.name === 'string' ? w.name.trim() : '', dice: parseDice(w?.damage) }))
    .filter((w): w is { name: string; dice: Dice } => !!w.name && !!w.dice);
  const pick = (wanted && usable.find(w => w.name.toLowerCase() === wanted)) || usable[0];
  if (pick) return { name: pick.name, bonus, dice: pick.dice };
  return { name: 'Unarmed strike', bonus, dice: { count: 1, sides: 4, bonus: Math.max(0, abilityMod(a.str)) } };
}

/** The better of INT, WIS and CHA. */
export function castingMod(s: SheetSummary): number {
  const a = scores(s);
  return Math.max(abilityMod(a.int), abilityMod(a.wis), abilityMod(a.cha));
}

export function spellAttackBonus(s: SheetSummary): number {
  return proficiency(s.level) + castingMod(s);
}

/** Damage for a spell by its level. Cantrips: 1d10, growing at character levels 5, 11 and 17. */
export function spellDamageDice(spellLevel: unknown, characterLevel: unknown): Dice {
  const lvl = clampInt(spellLevel, 0, 9, 0);
  if (lvl === 0) {
    const cl = clampInt(characterLevel, 1, 20, 1);
    return { count: 1 + (cl >= 5 ? 1 : 0) + (cl >= 11 ? 1 : 0) + (cl >= 17 ? 1 : 0), sides: 10, bonus: 0 };
  }
  return { count: lvl + 1, sides: 8, bonus: 0 };
}

/** Healing for a spell of level 1 or higher: level × d8 + casting modifier. Null for cantrips. */
export function spellHealDice(spellLevel: unknown, s: SheetSummary): Dice | null {
  const lvl = clampInt(spellLevel, 0, 9, 0);
  if (lvl < 1) return null;
  return { count: lvl, sides: 8, bonus: Math.max(0, castingMod(s)) };
}

/** Medicine check bonus: WIS modifier (the sheet summary has no skill list). */
export function medicineBonus(s: SheetSummary): number {
  return abilityMod(scores(s).wis);
}

// ── Attacks ───────────────────────────────────────────────────────────────────

export interface AttackResult {
  d20: number;
  total: number;
  hit: boolean;
  crit: boolean;
}

/** Natural 20 always hits (critical), natural 1 always misses. */
export function resolveAttack(roll: Roller, bonus: number, ac: number): AttackResult {
  const d20 = roll(20);
  const total = d20 + bonus;
  const crit = d20 === 20;
  const hit = crit || (d20 !== 1 && total >= ac);
  return { d20, total, hit, crit };
}

/** HP after damage (never below 0) and how much was actually lost. */
export function applyDamage(hp: number, damage: number): { hp: number; lost: number } {
  const next = Math.max(0, hp - Math.max(0, damage));
  return { hp: next, lost: hp - next };
}

/** HP after healing (never above max) and how much was actually gained. */
export function applyHealing(hp: number, maxHp: number, amount: number): { hp: number; gained: number } {
  const next = Math.min(maxHp, hp + Math.max(0, amount));
  return { hp: next, gained: next - hp };
}

// ── Targeting ─────────────────────────────────────────────────────────────────

export interface TargetCandidate {
  id: string;
  status: string;
  /** Damage this player has done to this NPC so far. */
  threat: number;
  /** Seconds since this player's phone last pinged the fight. */
  idleSeconds: number;
}

/**
 * Who the NPC attacks: only players who are up and present. Players who hurt it more are
 * more likely to be picked (weight 5 + threat), so it isn't predictable. Null when nobody qualifies.
 */
export function pickTarget(candidates: TargetCandidate[], roll: Roller): string | null {
  const ok = candidates.filter(c => c.status === 'up' && c.idleSeconds <= PRESENT_S);
  if (ok.length === 0) return null;
  const weights = ok.map(c => 5 + Math.max(0, Math.min(500, Math.round(c.threat))));
  const total = weights.reduce((a, b) => a + b, 0);
  let pick = roll(total);
  for (let i = 0; i < ok.length; i++) {
    pick -= weights[i];
    if (pick <= 0) return ok[i].id;
  }
  return ok[ok.length - 1].id;
}

// ── Death saves ───────────────────────────────────────────────────────────────

export type DeathOutcome = 'none' | 'revived' | 'dead';

export interface DeathSaveStep {
  d20: number;
  successes: number;
  failures: number;
  /** revived = back up with 1 HP; dead = 3 failures. */
  outcome: DeathOutcome;
}

/**
 * One death save, Empyrean rules: 10+ success, 9 or lower failure, natural 1 = two failures,
 * natural 20 = back up with 1 HP, 3 successes = back up with 1 HP, 3 failures = dead.
 */
export function deathSave(successes: number, failures: number, roll: Roller): DeathSaveStep {
  const d20 = roll(20);
  if (d20 === 20) return { d20, successes: 0, failures: 0, outcome: 'revived' };
  let s = clampInt(successes, 0, 3, 0);
  let f = clampInt(failures, 0, 3, 0);
  if (d20 === 1) f += 2;
  else if (d20 >= 10) s += 1;
  else f += 1;
  if (f >= 3) return { d20, successes: s, failures: 3, outcome: 'dead' };
  if (s >= 3) return { d20, successes: 0, failures: 0, outcome: 'revived' };
  return { d20, successes: s, failures: f, outcome: 'none' };
}

/** When an NPC acts next, counted from now so a backlog never stacks up attacks. */
export function nextActionAt(nowMs: number, speed: SpeedPreset): string {
  return new Date(nowMs + SPEED_PRESETS[speed] * 1000).toISOString();
}

export function nextDeathSaveAt(nowMs: number): string {
  return new Date(nowMs + DEATH_SAVE_INTERVAL_S * 1000).toISOString();
}

// ── Rage and Stagger: an NPC's pace changes with the damage it deals and takes ──

/** Rage: an NPC that hurts a player acts sooner. Stagger: an NPC that gets hurt acts later. */
export const RAGE_FACTOR = 0.5;
export const STAGGER_FACTOR = 0.5;

/** The Speed preset in milliseconds. */
export const baseIntervalMs = (speed: SpeedPreset): number => SPEED_PRESETS[speed] * 1000;

/** An NPC's interval is kept between half and double its Speed preset. */
export function clampIntervalMs(ms: number, speed: SpeedPreset): number {
  const base = baseIntervalMs(speed);
  const n = Number.isFinite(ms) ? ms : base;
  return Math.round(Math.min(base * 2, Math.max(base * 0.5, n)));
}

/** The interval an NPC acts on right now (its stored value, or its Speed preset). */
export function currentIntervalMs(actEveryMs: number | null | undefined, speed: SpeedPreset): number {
  return clampIntervalMs(typeof actEveryMs === 'number' ? actEveryMs : baseIntervalMs(speed), speed);
}

/**
 * Rage: the NPC dealt `damage` to a player with `targetMaxHp`.
 * New interval = current - base x RAGE_FACTOR x (damage / player's max HP), never below half the base.
 */
export function rageIntervalMs(currentMs: number, speed: SpeedPreset, damage: number, targetMaxHp: number): number {
  const cut = baseIntervalMs(speed) * RAGE_FACTOR * Math.max(0, damage) / Math.max(1, targetMaxHp);
  return clampIntervalMs(currentMs - cut, speed);
}

/**
 * Stagger: a player dealt `damage` to an NPC with `npcMaxHp`.
 * Delay = base x STAGGER_FACTOR x (damage / NPC's max HP). The interval grows by it (never above double
 * the base) and the NPC's current countdown is pushed back by the same delay.
 */
export function stagger(currentMs: number, speed: SpeedPreset, damage: number, npcMaxHp: number): { intervalMs: number; delayMs: number } {
  const delayMs = Math.round(baseIntervalMs(speed) * STAGGER_FACTOR * Math.max(0, damage) / Math.max(1, npcMaxHp));
  return { intervalMs: clampIntervalMs(currentMs + delayMs, speed), delayMs };
}

// ── Resolve, Second Wind, potions and perks ───────────────────────────────────

/** A full Resolve bar pays for one Second Wind. Everyone starts a fight half full. */
export const RESOLVE_MAX = 100;
export const RESOLVE_START = 50;
/** Resolve for landing a damaging hit or spell (Momentum doubles it). */
export const RESOLVE_PER_HIT = 5;

/** Perks bought with gold. A character equips at most 2 (3 with the extra slot). Keep in sync with src/lib/combat-perks.ts. */
export const PERKS = {
  iron_lungs: { name: 'Iron Lungs', cost: 3000 },
  pain_fuel: { name: 'Pain Fuel', cost: 3000 },
  momentum: { name: 'Momentum', cost: 3000 },
  deep_breath: { name: 'Deep Breath', cost: 5000 },
  battle_medic: { name: 'Battle Medic', cost: 5000 },
  last_stand: { name: 'Last Stand', cost: 8000 },
} as const;
export type PerkId = keyof typeof PERKS;
export const BASE_PERK_SLOTS = 2;
export const MAX_PERK_SLOTS = 3;
export const EXTRA_SLOT_COST = 10000;

export const isPerkId = (v: unknown): v is PerkId => typeof v === 'string' && Object.prototype.hasOwnProperty.call(PERKS, v);

/** Known perk ids only, no repeats. */
export function cleanPerks(raw: unknown): PerkId[] {
  return Array.isArray(raw) ? Array.from(new Set(raw.filter(isPerkId))) : [];
}

/** Resolve a healing potion adds: Healing 25, Greater 50, Superior 75, Supreme 100. 0 for anything else. */
export function potionResolve(itemName: unknown): number {
  const n = typeof itemName === 'string' ? itemName.toLowerCase() : '';
  if (!/heal/.test(n) || !/potion|elixir|draught|philter/.test(n)) return 0;
  if (/supreme/.test(n)) return 100;
  if (/superior/.test(n)) return 75;
  if (/greater/.test(n)) return 50;
  return 25;
}

/** Resolve gained per second: 1, +10% per CON modifier point, x1.3 with Iron Lungs. Never below 0.5. */
export function resolveRate(s: SheetSummary, perks: PerkId[]): number {
  const con = abilityMod(scores(s).con);
  const rate = (1 + 0.1 * con) * (perks.includes('iron_lungs') ? 1.3 : 1);
  return Math.max(0.5, Math.round(rate * 100) / 100);
}

/** The bar right now: what was stored, plus time since then at the fill rate. Capped at 100. */
export function resolveNow(stored: unknown, atIso: unknown, rate: unknown, nowMs: number): number {
  const base = typeof stored === 'number' && Number.isFinite(stored) ? stored : 0;
  const at = typeof atIso === 'string' ? Date.parse(atIso) : NaN;
  const r = typeof rate === 'number' && Number.isFinite(rate) ? rate : 1;
  const elapsed = Number.isFinite(at) ? Math.max(0, nowMs - at) / 1000 : 0;
  return Math.min(RESOLVE_MAX, Math.max(0, base + r * elapsed));
}

/** Resolve for taking damage: 1 point per 1% of max HP lost (doubled by Pain Fuel). */
export function damageResolve(lost: number, maxHp: number, perks: PerkId[]): number {
  const pct = (100 * Math.max(0, lost)) / Math.max(1, maxHp);
  return pct * (perks.includes('pain_fuel') ? 2 : 1);
}

/** Resolve for landing a damaging hit or spell. */
export function hitResolve(perks: PerkId[]): number {
  return RESOLVE_PER_HIT * (perks.includes('momentum') ? 2 : 1);
}

/** Hit die by class: d12 barbarian, d10 fighter/paladin/ranger, d6 wizard/sorcerer, d8 everyone else. */
export function hitDieSides(className: unknown): number {
  const c = typeof className === 'string' ? className.toLowerCase() : '';
  if (/barbarian/.test(c)) return 12;
  if (/fighter|paladin|ranger/.test(c)) return 10;
  if (/wizard|sorcerer/.test(c)) return 6;
  return 8;
}

/** Second Wind: one hit die (two with Deep Breath) + CON modifier + half level. */
export function secondWindDice(s: SheetSummary & { className?: unknown }, perks: PerkId[]): Dice {
  const con = abilityMod(scores(s).con);
  const half = Math.floor(clampInt(s.level, 1, 20, 1) / 2);
  return { count: perks.includes('deep_breath') ? 2 : 1, sides: hitDieSides(s.className), bonus: con + half };
}
