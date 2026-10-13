// npc-combat skills (Live NPC Combat v5): the catalog of things an NPC can do on its turn, their
// numbers, and how an NPC picks one. Pure functions: no database, no network.
// The host or Quick Build gives each NPC up to 4 skills (a type and a name); numbers come from its stats.

import * as R from './rules.ts';

export type SkillType = 'strike' | 'heavy' | 'sweep' | 'signature' | 'mend' | 'shield' | 'rally' | 'pin' | 'retreat';
export const SKILL_TYPES: SkillType[] = ['strike', 'heavy', 'sweep', 'signature', 'mend', 'shield', 'rally', 'pin', 'retreat'];
export const OFFENSE: SkillType[] = ['strike', 'heavy', 'sweep', 'signature'];
export const MAX_SKILLS = 4;

/** Plain words for each type (event log and the NPC's own prompt). */
export const SKILL_LABEL: Record<SkillType, string> = {
  strike: 'attack',
  heavy: 'heavy blow',
  sweep: 'sweeping attack',
  signature: 'signature move',
  mend: 'healing',
  shield: 'protective ward',
  rally: 'rallying call',
  pin: 'pinning move',
  retreat: 'retreat',
};

/** Seconds between the NPC announcing a skill and it happening (the players' window to react). */
export const WINDUP_S: Record<SkillType, number> = {
  strike: 3, heavy: 6, sweep: 6, signature: 8, mend: 3, shield: 3, rally: 4, pin: 4, retreat: 3,
};

/** How long a Pin holds a player (no action) unless they break free in Tug & Slip. */
export const PIN_MS = 30000;
export const WARD_MS = 60_000;
export const RALLY_SHARE = 0.2;
export const RETREAT_AT = 0.2;
export const SWEEP_MAX = 3;
export const SIGNATURE_EVERY = 3;

/** v2: seconds before a skill type can be used again (0 = any time). A skill row can override it with `cooldown`. */
export const COOLDOWN_S: Record<SkillType, number> = {
  strike: 0, heavy: 30, sweep: 45, signature: 0, mend: 60, shield: 75, rally: 90, pin: 45, retreat: 0,
};
/** v2: most times a skill type can be used in one fight. */
export const MAX_USES: Partial<Record<SkillType, number>> = { mend: 2, retreat: 1 };

/** v2: an NPC fighter's skill timers (party_fight_combatants.cooldowns). Keyed by skill type: an NPC has each type once. */
export interface Cooldowns {
  ready?: Partial<Record<SkillType, string>>;
  uses?: Partial<Record<SkillType, number>>;
  /** The player its last Pin went to, so it never pins the same player twice in a row. */
  lastPinned?: string | null;
}

export interface Skill {
  type: SkillType;
  name: string;
  /** Attack bonus (offense). */
  bonus: number;
  /** Damage dice per target (offense). */
  dice: R.Dice;
  /** HP healed (mend) or absorbed (shield). */
  power: number;
  windupMs: number;
  /** v2: time before this skill can be used again. */
  cooldownMs: number;
}

const isType = (v: unknown): v is SkillType => typeof v === 'string' && (SKILL_TYPES as string[]).includes(v);

/** The same dice scaled to `factor` times the average, keeping the die size. */
export function scaleDice(d: R.Dice, factor: number): R.Dice {
  const dieAvg = (d.sides + 1) / 2;
  const target = (d.count * dieAvg + d.bonus) * factor;
  let count = Math.max(1, Math.min(20, Math.round(d.count * factor)));
  let bonus = Math.round(target - count * dieAvg);
  while (bonus < 0 && count > 1) {
    count -= 1;
    bonus = Math.round(target - count * dieAvg);
  }
  return { count, sides: d.sides, bonus: Math.max(0, Math.min(30, bonus)) };
}

/** Default numbers for a skill type from the NPC's base stats. */
function numbersFor(type: SkillType, stats: R.NpcCombatStats, base: R.Dice) {
  switch (type) {
    case 'heavy': return { bonus: stats.attackBonus - 2, dice: scaleDice(base, 1.6), power: 0 };
    case 'sweep': return { bonus: stats.attackBonus - 1, dice: scaleDice(base, 0.6), power: 0 };
    case 'signature': return { bonus: stats.attackBonus, dice: scaleDice(base, 2), power: 0 };
    case 'mend': return { bonus: 0, dice: base, power: Math.max(1, Math.round(stats.maxHp * 0.15)) };
    case 'shield': return { bonus: 0, dice: base, power: Math.max(1, Math.round(stats.maxHp * 0.1)) };
    default: return { bonus: stats.attackBonus, dice: base, power: 0 };
  }
}

/**
 * The NPC's usable skills from its stored combat_stats (raw JSON). Each entry needs a known type;
 * bonus, damage and power are optional overrides. No skills at all = one plain attack.
 */
export function skillsOf(raw: unknown, stats: R.NpcCombatStats): Skill[] {
  const base = R.parseDice(stats.damage) ?? { count: 1, sides: 6, bonus: 0 };
  const list = raw && typeof raw === 'object' && Array.isArray((raw as { skills?: unknown }).skills)
    ? (raw as { skills: unknown[] }).skills : [];
  const out: Skill[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    if (!isType(r.type)) continue;
    const n = numbersFor(r.type, stats, base);
    const name = typeof r.name === 'string' && r.name.trim() ? r.name.trim().slice(0, 40) : SKILL_LABEL[r.type];
    const bonus = Number(r.bonus);
    const power = Number(r.power);
    const cooldown = Number(r.cooldown);
    out.push({
      type: r.type,
      name,
      bonus: Number.isFinite(bonus) && r.bonus !== null && r.bonus !== '' ? Math.max(-5, Math.min(20, Math.round(bonus))) : n.bonus,
      dice: R.parseDice(r.damage) ?? n.dice,
      power: Number.isFinite(power) && power > 0 ? Math.min(999, Math.round(power)) : n.power,
      windupMs: WINDUP_S[r.type] * 1000,
      cooldownMs: (Number.isFinite(cooldown) && r.cooldown !== null && r.cooldown !== '' ? Math.max(0, Math.min(600, Math.round(cooldown))) : COOLDOWN_S[r.type]) * 1000,
    });
    if (out.length >= MAX_SKILLS) break;
  }
  if (out.length === 0) out.push(basicStrike(stats));
  return out;
}

/** A plain attack from the NPC's base stats: used when it has no skills, or when every attack it has is cooling down. */
export function basicStrike(stats: R.NpcCombatStats): Skill {
  const base = R.parseDice(stats.damage) ?? { count: 1, sides: 6, bonus: 0 };
  return { type: 'strike', name: 'Attack', bonus: stats.attackBonus, dice: base, power: 0, windupMs: WINDUP_S.strike * 1000, cooldownMs: 0 };
}

/** A checked copy of a fighter's stored cooldowns. */
export function cleanCooldowns(raw: unknown): Cooldowns {
  if (!raw || typeof raw !== 'object') return {};
  const r = raw as Record<string, unknown>;
  const ready: Partial<Record<SkillType, string>> = {};
  const uses: Partial<Record<SkillType, number>> = {};
  if (r.ready && typeof r.ready === 'object') {
    for (const [k, v] of Object.entries(r.ready as Record<string, unknown>)) {
      if (isType(k) && typeof v === 'string' && Number.isFinite(Date.parse(v))) ready[k] = v;
    }
  }
  if (r.uses && typeof r.uses === 'object') {
    for (const [k, v] of Object.entries(r.uses as Record<string, unknown>)) {
      const n = Number(v);
      if (isType(k) && Number.isFinite(n) && n > 0) uses[k] = Math.round(n);
    }
  }
  return { ready, uses, lastPinned: typeof r.lastPinned === 'string' ? r.lastPinned : null };
}

/**
 * The skills the NPC can use right now: off cooldown and under their per-fight limit. If it has attacks
 * but all of them are cooling down, it falls back to a plain attack, so a fighter never stands idle.
 */
export function readySkills(skills: Skill[], cd: Cooldowns, nowMs: number, stats: R.NpcCombatStats): Skill[] {
  const ready = skills.filter(s => {
    const at = cd.ready?.[s.type];
    if (at && Date.parse(at) > nowMs) return false;
    const max = MAX_USES[s.type];
    return !(max !== undefined && (cd.uses?.[s.type] ?? 0) >= max);
  });
  const hasOffense = skills.some(s => OFFENSE.includes(s.type));
  if (hasOffense && !ready.some(s => s.type !== 'signature' && OFFENSE.includes(s.type))) ready.push(basicStrike(stats));
  return ready;
}

/** Cooldowns after the NPC announces `skill` against `targetIds`. */
export function afterUse(cd: Cooldowns, skill: Skill, nowMs: number, targetIds: string[]): Cooldowns {
  const ready = { ...(cd.ready ?? {}) };
  const uses = { ...(cd.uses ?? {}) };
  if (skill.cooldownMs > 0) ready[skill.type] = new Date(nowMs + skill.cooldownMs).toISOString();
  if (MAX_USES[skill.type] !== undefined) uses[skill.type] = (uses[skill.type] ?? 0) + 1;
  return { ready, uses, lastPinned: skill.type === 'pin' ? (targetIds[0] ?? null) : (cd.lastPinned ?? null) };
}

/** Cooldowns moved later by the length of a pause. */
export function shiftCooldowns(cd: Cooldowns, byMs: number): Cooldowns {
  const ready: Partial<Record<SkillType, string>> = {};
  for (const [k, v] of Object.entries(cd.ready ?? {})) {
    const moved = R.shiftIso(v, byMs);
    if (moved) ready[k as SkillType] = moved;
  }
  return { ...cd, ready };
}

/** True when an NPC's hard lines say it would never run, so Retreat is never used. */
export function forbidsRetreat(hardLines: unknown): boolean {
  return typeof hardLines === 'string' && /\bnever\b[^.!?\n]*\b(flee|flees|run|runs|retreat|retreats|surrender|surrenders|yield|yields|back down|abandon)/i.test(hardLines);
}

export interface ChoiceContext {
  skills: Skill[];
  selfId: string;
  turnNo: number;
  signatureTurn: number;
  canRetreat: boolean;
  /** NPC fighters in the fight, this one included. */
  npcs: Array<{ id: string; hp: number; maxHp: number; status: string; ward: number }>;
  /** Player fighters; `present` = their phone is in the fight. */
  players: Array<{ id: string; status: string; present: boolean; threat: number }>;
  /** v2: the player this NPC pinned last time (never pinned twice in a row). */
  lastPinned?: string | null;
}

export type Choice =
  | { kind: 'idle' }
  | { kind: 'beat' }
  | { kind: 'skill'; skill: Skill; targetIds: string[] };

const ratio = (n: { hp: number; maxHp: number }) => n.hp / Math.max(1, n.maxHp);

/**
 * What the NPC does this turn. Situation first (retreat when nearly beaten, mend a hurt ally, shield a
 * focused one, rally), then its signature move when ready, a pin now and then, else a weighted attack.
 * About 1 turn in 5 it only talks. Idle when no player is present to act against.
 */
export function chooseSkill(ctx: ChoiceContext, roll: R.Roller): Choice {
  const has = (t: SkillType) => ctx.skills.find(s => s.type === t);
  const self = ctx.npcs.find(n => n.id === ctx.selfId);
  const allies = ctx.npcs.filter(n => n.status === 'up');
  const present = ctx.players.filter(p => p.status === 'up' && p.present);
  if (present.length === 0) return { kind: 'idle' };

  const retreat = has('retreat');
  if (retreat && ctx.canRetreat && self && ratio(self) <= RETREAT_AT && roll(10) <= 6) {
    return { kind: 'skill', skill: retreat, targetIds: [ctx.selfId] };
  }
  const mend = has('mend');
  if (mend) {
    const hurt = allies.filter(n => ratio(n) < 0.5).sort((a, b) => ratio(a) - ratio(b));
    if (hurt.length) return { kind: 'skill', skill: mend, targetIds: [hurt[0].id] };
  }
  const shield = has('shield');
  // v2: at most one live ward for every two standing NPCs, and never on an ally that already has one.
  const wardsLive = allies.filter(n => n.ward > 0).length;
  if (shield && wardsLive < Math.max(1, Math.floor(allies.length / 2)) && roll(2) === 1) {
    const focused = allies.filter(n => ratio(n) < 0.75 && n.ward <= 0).sort((a, b) => ratio(a) - ratio(b));
    if (focused.length) return { kind: 'skill', skill: shield, targetIds: [focused[0].id] };
  }
  const rally = has('rally');
  if (rally && allies.length >= 2 && roll(4) === 1) {
    return { kind: 'skill', skill: rally, targetIds: allies.filter(n => n.id !== ctx.selfId).map(n => n.id) };
  }

  if (roll(5) === 1) return { kind: 'beat' };

  const single = (): string[] => {
    const id = R.pickTarget(present.map(p => ({ id: p.id, status: p.status, threat: p.threat, idleSeconds: 0 })), roll);
    return id ? [id] : [];
  };
  const signature = has('signature');
  if (signature && ctx.turnNo - ctx.signatureTurn >= SIGNATURE_EVERY && roll(2) === 1) {
    return { kind: 'skill', skill: signature, targetIds: single() };
  }
  const pin = has('pin');
  const pinnable = present.filter(p => p.id !== ctx.lastPinned);
  if (pin && pinnable.length && roll(5) === 1) {
    const top = Math.max(...pinnable.map(p => p.threat));
    const pool = pinnable.filter(p => p.threat === top);
    return { kind: 'skill', skill: pin, targetIds: [pool[roll(pool.length) - 1].id] };
  }

  const weighted: Array<{ skill: Skill; w: number }> = [];
  for (const s of ctx.skills) {
    if (s.type === 'strike') weighted.push({ skill: s, w: 3 });
    else if (s.type === 'heavy') weighted.push({ skill: s, w: 1 });
    else if (s.type === 'sweep' && present.length >= 2) weighted.push({ skill: s, w: 1 });
  }
  if (weighted.length === 0) {
    // No everyday attack (a talker, a healer): use the signature if ready, else just talk.
    if (signature && ctx.turnNo - ctx.signatureTurn >= SIGNATURE_EVERY) return { kind: 'skill', skill: signature, targetIds: single() };
    return { kind: 'beat' };
  }
  let pick = roll(weighted.reduce((sum, x) => sum + x.w, 0));
  let chosen = weighted[weighted.length - 1].skill;
  for (const x of weighted) {
    pick -= x.w;
    if (pick <= 0) { chosen = x.skill; break; }
  }
  if (chosen.type === 'sweep') {
    const order = [...present];
    for (let i = order.length - 1; i > 0; i--) {
      const j = roll(i + 1) - 1;
      [order[i], order[j]] = [order[j], order[i]];
    }
    return { kind: 'skill', skill: chosen, targetIds: order.slice(0, SWEEP_MAX).map(p => p.id) };
  }
  return { kind: 'skill', skill: chosen, targetIds: single() };
}
