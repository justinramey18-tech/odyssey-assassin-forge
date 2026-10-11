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

export const PIN_MS = 6000;
export const WARD_MS = 60_000;
export const RALLY_SHARE = 0.2;
export const RETREAT_AT = 0.2;
export const SWEEP_MAX = 3;
export const SIGNATURE_EVERY = 3;

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
    out.push({
      type: r.type,
      name,
      bonus: Number.isFinite(bonus) && r.bonus !== null && r.bonus !== '' ? Math.max(-5, Math.min(20, Math.round(bonus))) : n.bonus,
      dice: R.parseDice(r.damage) ?? n.dice,
      power: Number.isFinite(power) && power > 0 ? Math.min(999, Math.round(power)) : n.power,
      windupMs: WINDUP_S[r.type] * 1000,
    });
    if (out.length >= MAX_SKILLS) break;
  }
  if (out.length === 0) {
    out.push({ type: 'strike', name: 'Attack', bonus: stats.attackBonus, dice: base, power: 0, windupMs: WINDUP_S.strike * 1000 });
  }
  return out;
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
  if (shield && roll(2) === 1) {
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
  if (pin && roll(5) === 1) {
    const top = Math.max(...present.map(p => p.threat));
    const pool = present.filter(p => p.threat === top);
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
