// npc-build rules (Quick Build): fight stats from the party, the AI's instructions, and reading its answer.
// Pure functions: no database, no network. The AI writes personalities; these numbers set the stats.

export type Difficulty = 'easy' | 'medium' | 'hard' | 'deadly';
export type Role = 'talker' | 'minion' | 'fighter' | 'boss';
export type Speed = 'trivial' | 'easy' | 'medium' | 'hard' | 'deadly';
export type Grudge = 'forgiving' | 'normal' | 'grudge';

export const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'deadly'];
export const ROLES: Role[] = ['talker', 'minion', 'fighter', 'boss'];

/** Share of the party's total HP the NPC group gets, average hit as a share of one player's max HP, speed, attack and AC bumps. */
const DIFF: Record<Difficulty, { hpPool: number; hit: number; speed: Speed; atk: number; ac: number }> = {
  easy: { hpPool: 0.3, hit: 0.10, speed: 'easy', atk: 3, ac: 0 },
  medium: { hpPool: 0.5, hit: 0.15, speed: 'medium', atk: 3, ac: 0 },
  hard: { hpPool: 0.8, hit: 0.20, speed: 'hard', atk: 4, ac: 1 },
  deadly: { hpPool: 1.2, hit: 0.28, speed: 'deadly', atk: 5, ac: 2 },
};

/** How a role changes HP, hit size, attack and AC, and the die it rolls. */
const ROLE: Record<Role, { hp: number; hit: number; atk: number; ac: number; die: number }> = {
  talker: { hp: 0.6, hit: 0.6, atk: 0, ac: -1, die: 6 },
  minion: { hp: 0.5, hit: 0.6, atk: 0, ac: -1, die: 6 },
  fighter: { hp: 1, hit: 1, atk: 0, ac: 0, die: 8 },
  boss: { hp: 1.3, hit: 1.3, atk: 1, ac: 1, die: 10 },
};

export interface PartyStats {
  size: number;
  avgLevel: number;
  avgAc: number;
  avgMaxHp: number;
}

const num = (v: unknown, fallback: number): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
};
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Averages over seated characters (party_members.character_status). Safe defaults when nobody is seated. */
export function partyStats(rows: Array<{ character_status?: Record<string, unknown> | null }>): PartyStats {
  const sheets = rows.map(r => r.character_status).filter((s): s is Record<string, unknown> => !!s && typeof s === 'object');
  if (sheets.length === 0) return { size: 1, avgLevel: 1, avgAc: 12, avgMaxHp: 10 };
  const avg = (key: string, fallback: number, lo: number, hi: number) =>
    sheets.reduce((sum, s) => sum + clamp(num(s[key], fallback), lo, hi), 0) / sheets.length;
  return {
    size: sheets.length,
    avgLevel: Math.round(avg('level', 1, 1, 20) * 10) / 10,
    avgAc: Math.round(avg('ac', 12, 5, 30) * 10) / 10,
    avgMaxHp: Math.round(avg('maxHP', 10, 1, 500)),
  };
}

export interface CombatStats {
  maxHp: number;
  ac: number;
  attackBonus: number;
  damage: string;
  speed: Speed;
  /** v5: what the NPC can do in a fight (type + name). The fight engine sets each skill's numbers. */
  skills?: Skill[];
  /** Combat v2: how many players these stats were built for. The fight scales HP to the players actually there. */
  designedFor?: number;
}

// ── Skills (Live NPC Combat v5). Keep the types in sync with supabase/functions/npc-combat/skills.ts ──

export type SkillType = 'strike' | 'heavy' | 'sweep' | 'signature' | 'mend' | 'shield' | 'rally' | 'pin' | 'retreat';
export const SKILL_TYPES: SkillType[] = ['strike', 'heavy', 'sweep', 'signature', 'mend', 'shield', 'rally', 'pin', 'retreat'];
const OFFENSE: SkillType[] = ['strike', 'heavy', 'sweep', 'signature'];
export interface Skill { type: SkillType; name: string }

/** What each type does, for the AI. */
export const SKILL_GUIDE = [
  'strike: their standard attack.',
  'heavy: a slow, hard-hitting blow.',
  'sweep: an attack that hits up to 3 people at once.',
  'signature: their most dangerous move, usable every few turns.',
  'mend: heals themself or an ally.',
  'shield: a ward that protects themself or an ally.',
  'rally: spurs their allies to act sooner.',
  'pin: stops one enemy from acting for a few seconds.',
  'retreat: flees the fight when badly hurt (only for NPCs who would run).',
].join('\n');

/** The skills an NPC fights with: known types only, no repeats, at most 4, and fighters always have an attack. */
export function finalSkills(raw: unknown, role: Role, attackName: string): Skill[] {
  const list = Array.isArray(raw) ? raw : [];
  const out: Skill[] = [];
  for (const item of list) {
    const r = item && typeof item === 'object' ? (item as Record<string, unknown>) : null;
    const type = r && typeof r.type === 'string' ? (r.type.trim().toLowerCase() as SkillType) : null;
    if (!type || !SKILL_TYPES.includes(type) || out.some(s => s.type === type)) continue;
    const name = typeof r!.name === 'string' && r!.name.trim() ? r!.name.trim().slice(0, 40) : '';
    out.push({ type, name: name || type.charAt(0).toUpperCase() + type.slice(1) });
    if (out.length >= 4) break;
  }
  if (role !== 'talker' && !out.some(s => OFFENSE.includes(s.type))) {
    if (out.length >= 4) out.pop();
    out.unshift({ type: 'strike', name: attackName.trim().slice(0, 40) || 'Attack' });
  }
  return out;
}

/** Fight stats for one NPC in a group of `count` with the same role and difficulty. */
export function npcStats(party: PartyStats, difficulty: Difficulty, role: Role, count: number): CombatStats {
  const d = DIFF[difficulty];
  const r = ROLE[role];
  const n = clamp(Math.round(count), 1, 4);
  const maxHp = clamp(Math.round((party.avgMaxHp * party.size * d.hpPool / n) * r.hp), 5, 999);
  const avgHit = Math.max(2, party.avgMaxHp * d.hit * r.hit);
  const dieAvg = (r.die + 1) / 2;
  let dice = clamp(Math.round((avgHit * 0.6) / dieAvg), 1, 20);
  let bonus = Math.round(avgHit - dice * dieAvg);
  while (bonus < 0 && dice > 1) {
    dice -= 1;
    bonus = Math.round(avgHit - dice * dieAvg);
  }
  bonus = clamp(bonus, 0, 30);
  const proficiency = Math.ceil(clamp(party.avgLevel, 1, 20) / 4) + 1;
  return {
    maxHp,
    ac: clamp(11 + Math.floor(party.avgLevel / 3) + d.ac + r.ac, 8, 25),
    attackBonus: clamp(proficiency + d.atk + r.atk, -5, 20),
    damage: `${dice}d${r.die}${bonus > 0 ? `+${bonus}` : ''}`,
    speed: d.speed,
    designedFor: clamp(Math.round(party.size), 1, 12),
  };
}

// ── The AI's part ─────────────────────────────────────────────────────────────

export interface BuildRequest {
  description: string;
  count: number;
  role: Role;
  difficulty: Difficulty;
  /** The latest DM post, when the host tapped "Use current scene". */
  scene: string;
  /** The host's enabled world guides, joined and trimmed. */
  world: string;
  /** Names already on the roster and the players' characters, so nobody is duplicated. */
  takenNames: string[];
}

export const BUILD_SYSTEM = [
  'You design non-player characters (NPCs) for a live tabletop roleplaying campaign. An AI will later voice each NPC from what you write, so make each one specific, playable and consistent with the world.',
  'Answer with JSON only: no prose before or after, no code fences.',
].join('\n');

export function buildUserMessage(req: BuildRequest): string {
  const parts: string[] = [];
  if (req.world.trim()) parts.push(`WORLD (the campaign's canon; stay consistent with it)\n${req.world.trim()}`);
  if (req.scene.trim()) parts.push(`THE SCENE RIGHT NOW (latest Dungeon Master post). Prefer NPCs who appear in it, keeping their names and details exactly.\n${req.scene.trim()}`);
  if (req.takenNames.length) parts.push(`NAMES ALREADY USED (do not reuse): ${req.takenNames.join(', ')}`);
  parts.push(`WHAT THE HOST WANTS: ${req.description.trim() || (req.scene.trim() ? 'the NPCs in the scene above' : 'a memorable NPC who fits the world')}`);
  parts.push(`Make exactly ${req.count} NPC${req.count === 1 ? '' : 's'}. Role: ${req.role}. Fight difficulty: ${req.difficulty}.`);
  parts.push([
    'Return: {"npcs":[{"name":"","guide":"","secrets":"","wants":"","levers":"","hardLines":"","moodRange":"","grudgeStyle":"normal","attack":"","skills":[{"type":"strike","name":""}]}]}',
    'name: their name as people would say it (under 40 characters).',
    'guide: 4 to 7 sentences in plain words: who they are, their job or place in the world, how they look, how they talk (word choice, tics, accent), and how they treat strangers.',
    'secrets: 1 to 3 things they hide, which can surface in play.',
    'wants: what they want right now. levers: what works on them (bribes, respect, fear, humour...). hardLines: what they will never do.',
    'moodRange: the moods they swing between, one sentence. grudgeStyle: exactly "forgiving", "normal" or "grudge".',
    'attack: a short name for how they fight, like "rifle burst" or "rusty cleaver".',
    'skills: the 1 to 4 things this NPC does in a fight, chosen to fit who they are (a medic mends, a veteran shields allies, a brute uses heavy blows, a coward may retreat, a sniper pins). Give each a vivid in-world name. Allowed types, use each at most once:',
    SKILL_GUIDE,
    `Role guide: talker 0 to 1 skills; minion 1 to 2 (mostly strike); fighter 2 to 3 with at least one attack type; boss 3 to 4 including a signature.`,
    'If there are several NPCs, make them clearly different from each other.',
  ].join('\n'));
  return parts.join('\n\n');
}

export interface NpcDraft {
  name: string;
  guide: string;
  secrets: string;
  wants: string;
  levers: string;
  hardLines: string;
  moodRange: string;
  grudgeStyle: Grudge;
  attack: string;
  skills: unknown;
}

const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/\s+\n/g, '\n').trim().slice(0, max) : '');

/** The NPCs in the AI's answer, cleaned and trimmed, or [] when it can't be read. */
export function parseDrafts(raw: string, count: number): NpcDraft[] {
  const cleaned = (raw || '').replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/```(?:json)?/gi, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end <= start) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return [];
  }
  const list = Array.isArray((parsed as { npcs?: unknown })?.npcs) ? (parsed as { npcs: unknown[] }).npcs : [];
  const drafts: NpcDraft[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    const name = text(r.name, 40).replace(/\s+/g, ' ');
    const guide = text(r.guide, 3000);
    if (!name || !guide) continue;
    const g = text(r.grudgeStyle, 20).toLowerCase();
    drafts.push({
      name,
      guide,
      secrets: text(r.secrets, 1500),
      wants: text(r.wants, 600),
      levers: text(r.levers, 600),
      hardLines: text(r.hardLines, 600),
      moodRange: text(r.moodRange, 300),
      grudgeStyle: g === 'forgiving' || g === 'grudge' ? g : 'normal',
      attack: text(r.attack, 60),
      skills: r.skills,
    });
    if (drafts.length >= count) break;
  }
  return drafts;
}
