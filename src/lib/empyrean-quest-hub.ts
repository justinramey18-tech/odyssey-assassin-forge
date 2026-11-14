// Empyrean quest hub: the rules (pure, no React, no network).
// Quests live in the solo game state's quest_flags map like every other quest board
// (see quests.ts). The hub adds a category per quest, a standing rank per category
// (stored under a reserved key in the same map), category rewards, and the
// instruction sheet for "Seek a quest" offers.
import {
  applyQuestProgress,
  questFromOffer,
  rewardSummary,
  toStored,
  withQuestEvent,
  type Quest,
  type QuestCR,
  type RawQuestOffer,
} from '@/lib/quests';

// ─── Categories ──────────────────────────────────────────────────────────────

export type HubCategoryId =
  | 'academics'
  | 'combat'
  | 'dragon'
  | 'signet'
  | 'squad'
  | 'intrigue'
  | 'missions'
  | 'personal';

export interface HubCategory {
  id: HubCategoryId;
  label: string;
  emoji: string;
  /** One line shown in the hub and given to the quest writer. */
  blurb: string;
  /** Five rank names, lowest first. */
  ranks: [string, string, string, string, string];
  /** Words that sort a DM-offered quest into this category. */
  keywords: string[];
}

export const HUB_CATEGORIES: HubCategory[] = [
  {
    id: 'academics', label: 'Academics', emoji: '📚',
    blurb: 'Classes, briefings, exams and the Archives.',
    ranks: ['Novice', 'Student', 'Scholar', 'Archivist', 'Sage'],
    keywords: ['class', 'lecture', 'exam', 'test', 'professor', 'study', 'archive', 'archives', 'library', 'book', 'history', 'briefing', 'brief', 'lesson', 'scribe', 'assignment', 'essay', 'physics', 'map', 'maps'],
  },
  {
    id: 'combat', label: 'Combat & Training', emoji: '⚔️',
    blurb: 'The mat, challenges, the Gauntlet and sparring rivals.',
    ranks: ['Recruit', 'Sparring Partner', 'Duelist', 'Champion', 'Legend of the Mat'],
    keywords: ['spar', 'sparring', 'mat', 'challenge', 'duel', 'fight', 'gauntlet', 'training', 'train', 'weapon', 'weapons', 'blade', 'dagger', 'daggers', 'combat', 'opponent', 'drill', 'obstacle'],
  },
  {
    id: 'dragon', label: 'Dragon & Bond', emoji: '🐉',
    blurb: 'Flights, hunts and earning your dragon\'s respect.',
    ranks: ['Fledgling Bond', 'Trusted Rider', 'Wing-Sworn', 'Soul-Bound', 'Dragon-Kin'],
    keywords: ['dragon', 'dragons', 'flight', 'fly', 'flying', 'hunt', 'hunting', 'bond', 'scales', 'saddle', 'talons', 'vale', 'den', 'mated', 'dragonkind'],
  },
  {
    id: 'signet', label: 'Signet', emoji: '✨',
    blurb: 'Learning control, testing limits and handling strain.',
    ranks: ['Spark', 'Steady Hand', 'Channeler', 'Master of Power', 'Unbreakable'],
    keywords: ['signet', 'power', 'magic', 'channel', 'channeling', 'strain', 'burnout', 'control', 'relic', 'wield', 'wielding', 'lesser magic'],
  },
  {
    id: 'squad', label: 'Squad & Wing', emoji: '🛡️',
    blurb: 'Orders from leaders, helping squadmates and wing rivalries.',
    ranks: ['Cadet', 'Squadmate', 'Respected', 'Trusted Voice', "Wingleader's Choice"],
    keywords: ['squad', 'squadmate', 'squadmates', 'wing', 'section', 'wingleader', 'leader', 'formation', 'orders', 'order', 'roll call', 'duty', 'quadrant', 'cadets'],
  },
  {
    id: 'intrigue', label: 'Intrigue & Secrets', emoji: '🕯️',
    blurb: 'Hidden truths, contraband and whispers in the halls.',
    ranks: ['Unaware', 'Curious', 'Keeper of Secrets', 'Shadow Walker', 'Truth-Seeker'],
    keywords: ['secret', 'secrets', 'rumor', 'rumour', 'whisper', 'whispers', 'hidden', 'spy', 'contraband', 'conspiracy', 'smuggle', 'smuggled', 'lie', 'lies', 'truth', 'cover-up', 'mystery', 'rebellion', 'rebel', 'stolen', 'missing'],
  },
  {
    id: 'missions', label: 'Missions & the Border', emoji: '🗺️',
    blurb: 'Patrols, outposts and war games.',
    ranks: ['Untested', 'Patroller', 'Veteran', 'Border Hawk', 'Sentinel'],
    keywords: ['patrol', 'border', 'outpost', 'ward', 'wards', 'raid', 'war games', 'mission', 'scout', 'scouting', 'escort', 'venin', 'wyvern', 'wyverns', 'frontier', 'defend', 'attack', 'village'],
  },
  {
    id: 'personal', label: 'Personal', emoji: '💬',
    blurb: 'Friendships, rivals, romance and letters from home.',
    ranks: ['Stranger', 'Familiar Face', 'Friend', 'Confidant', 'Heart of the Quadrant'],
    keywords: ['friend', 'friends', 'friendship', 'letter', 'letters', 'family', 'mother', 'father', 'sister', 'brother', 'romance', 'love', 'rival', 'apologize', 'apology', 'heart', 'home', 'promise', 'favor'],
  },
];

export const DEFAULT_HUB_CATEGORY: HubCategoryId = 'missions';

const CATEGORY_IDS = HUB_CATEGORIES.map(c => c.id);

export function isHubCategory(id: unknown): id is HubCategoryId {
  return typeof id === 'string' && (CATEGORY_IDS as string[]).includes(id);
}

export function hubCategory(id: HubCategoryId): HubCategory {
  return HUB_CATEGORIES.find(c => c.id === id) ?? HUB_CATEGORIES[0];
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Sort a quest into a category by its words. Title words count double. No match → Missions. */
export function classifyQuest(title: string, description?: string, stages?: string[]): HubCategoryId {
  const head = String(title ?? '').toLowerCase();
  const body = [description ?? '', ...(stages ?? [])].join(' ').toLowerCase();
  let best: HubCategoryId = DEFAULT_HUB_CATEGORY;
  let bestScore = 0;
  for (const cat of HUB_CATEGORIES) {
    let score = 0;
    for (const word of cat.keywords) {
      const re = new RegExp(`\\b${escapeRe(word)}\\b`, 'g');
      score += (head.match(re)?.length ?? 0) * 2 + (body.match(re)?.length ?? 0);
    }
    if (score > bestScore) {
      best = cat.id;
      bestScore = score;
    }
  }
  return best;
}

/** The category a stored quest belongs to: its own when valid, otherwise sorted by its words. */
export function questCategory(q: Quest): HubCategoryId {
  if (isHubCategory(q.category)) return q.category;
  return classifyQuest(q.title ?? q.key, q.description ?? q.notes, (q.stages ?? []).map(s => s.text));
}

// ─── Standing ranks ──────────────────────────────────────────────────────────

/** Reserved quest_flags key for the hub's standing points (skipped by normalizeQuestMap). */
export const HUB_KEY = '__empyrean_quest_hub__';

/** Standing points needed for ranks 1–5. */
export const RANK_THRESHOLDS = [0, 3, 8, 15, 25] as const;

/** Standing points a finished quest earns, by challenge. */
export const CR_POINTS: Record<QuestCR, number> = { easy: 1, moderate: 2, hard: 3, deadly: 5 };

export interface HubState {
  points: Record<HubCategoryId, number>;
}

export function emptyHubState(): HubState {
  return { points: Object.fromEntries(CATEGORY_IDS.map(id => [id, 0])) as Record<HubCategoryId, number> };
}

export function normalizeHubState(raw: unknown): HubState {
  const state = emptyHubState();
  const pts = (raw as { points?: Record<string, unknown> } | null)?.points;
  if (pts && typeof pts === 'object') {
    for (const id of CATEGORY_IDS) {
      const n = Number(pts[id]);
      state.points[id] = Number.isFinite(n) && n > 0 ? Math.min(10_000, Math.floor(n)) : 0;
    }
  }
  return state;
}

export function storedHubState(state: HubState): Record<string, unknown> {
  // status 'unknown' keeps panels that count quest_flags by status from treating this as a quest.
  return { status: 'unknown', points: { ...state.points }, updated_at: new Date().toISOString() };
}

export interface RankInfo {
  /** 0–4. */
  index: number;
  name: string;
  points: number;
  /** Points where this rank starts. */
  floor: number;
  /** Points needed for the next rank, or null at the top rank. */
  next: number | null;
  /** 0–100 progress toward the next rank (100 at the top). */
  progress: number;
}

export function rankInfo(category: HubCategoryId, points: number): RankInfo {
  const p = Math.max(0, Math.floor(Number(points) || 0));
  let index = 0;
  for (let i = 0; i < RANK_THRESHOLDS.length; i++) if (p >= RANK_THRESHOLDS[i]) index = i;
  const floor = RANK_THRESHOLDS[index];
  const next = index < RANK_THRESHOLDS.length - 1 ? RANK_THRESHOLDS[index + 1] : null;
  const progress = next === null ? 100 : Math.round(((p - floor) / (next - floor)) * 100);
  return { index, name: hubCategory(category).ranks[index], points: p, floor, next, progress };
}

/** Challenges "Seek a quest" may offer at a rank: harder work unlocks as standing grows. */
export function allowedChallenges(rankIndex: number): QuestCR[] {
  if (rankIndex >= 3) return ['moderate', 'hard', 'deadly'];
  if (rankIndex >= 1) return ['easy', 'moderate', 'hard'];
  return ['easy', 'moderate'];
}

// ─── Category rewards ────────────────────────────────────────────────────────

/** Dragon & Bond: bond and trust gained when one is finished, by challenge. */
export const DRAGON_REWARDS: Record<QuestCR, { bond: number; trust: number }> = {
  easy: { bond: 3, trust: 2 },
  moderate: { bond: 4, trust: 3 },
  hard: { bond: 5, trust: 4 },
  deadly: { bond: 6, trust: 5 },
};

/** Dragon & Bond: trust lost when one is failed. */
export const DRAGON_FAILURE_TRUST = -2;

/** Signet: strain cleared when one is finished. */
export const SIGNET_STRAIN_RELIEF = 2;

/** Solo Signet Strain ceiling: 8, +1 at Signet rank 3, +1 more at rank 5 (max 10 from quests). */
export function signetStrainCeiling(signetPoints: number): number {
  const { index } = rankInfo('signet', signetPoints);
  return 8 + (index >= 2 ? 1 : 0) + (index >= 4 ? 1 : 0);
}

/** XP and gold ranges for hub offers, by challenge. Values outside are clamped; missing ones use the middle. */
export const REWARD_RANGES: Record<QuestCR, { xp: [number, number]; gold: [number, number] }> = {
  easy: { xp: [50, 150], gold: [5, 25] },
  moderate: { xp: [100, 300], gold: [15, 60] },
  hard: { xp: [250, 600], gold: [40, 150] },
  deadly: { xp: [500, 1200], gold: [100, 400] },
};

function clampReward(value: unknown, [lo, hi]: [number, number]): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return Math.round((lo + hi) / 2);
  return Math.min(hi, Math.max(lo, Math.round(n)));
}

function crOf(q: Quest): QuestCR {
  return q.challengeRating ?? 'moderate';
}

// ─── Applying the story extractor's results ──────────────────────────────────

export interface QuestPayout {
  quest: Quest;
  category: HubCategoryId;
  xp: number;
  gold: number;
  points: number;
}

export interface RankUp {
  category: HubCategoryId;
  from: string;
  to: string;
}

export interface QuestUpdatePlan {
  /** Quests to write back to quest_flags (stored shape via toStored). */
  upserts: Array<{ key: string; stored: Record<string, unknown> }>;
  /** Newly offered quests. */
  offered: Quest[];
  /** Quests finished in this update, paid exactly once. */
  payouts: QuestPayout[];
  /** Quests failed in this update. */
  failed: Quest[];
  /** Hub standing after this update; null when it didn't change. */
  hub: HubState | null;
  rankUps: RankUp[];
  /** Dragon bond and trust to apply (0 when none). */
  bondDelta: number;
  trustDelta: number;
  /** Signet strain to clear (0 when none). */
  strainRelief: number;
  /** Quests whose final status should be recorded as world state. */
  settled: Quest[];
}

/**
 * Turn the extractor's offers and progress into what should change. Pure: the caller
 * writes the upserts, pays XP/gold, applies bond/trust/strain and shows the toasts.
 * Rewards are paid only on the active → completed step and only when rewardsPaid is unset.
 */
export function planQuestUpdates(
  quests: Quest[],
  hub: HubState,
  offers: RawQuestOffer[] | null | undefined,
  progress: Array<{ key?: string; stages_completed?: string[]; status?: string | null; notes?: string | null }> | null | undefined,
): QuestUpdatePlan {
  const plan: QuestUpdatePlan = {
    upserts: [], offered: [], payouts: [], failed: [], hub: null, rankUps: [],
    bondDelta: 0, trustDelta: 0, strainRelief: 0, settled: [],
  };
  const known = new Set(quests.map(q => q.key));
  let points = { ...hub.points };
  let hubChanged = false;

  for (const offer of offers ?? []) {
    const quest = questFromOffer(offer);
    if (!quest || known.has(quest.key)) continue; // never re-offer
    const category = isHubCategory(offer.category)
      ? offer.category
      : classifyQuest(quest.title ?? quest.key, quest.description, (quest.stages ?? []).map(s => s.text));
    const withCat: Quest = { ...quest, category };
    known.add(withCat.key);
    plan.offered.push(withCat);
    plan.upserts.push({ key: withCat.key, stored: toStored(withCat) });
  }

  for (const update of progress ?? []) {
    const key = String(update?.key ?? '');
    const existing = quests.find(q => q.key === key);
    if (!existing || existing.status !== 'active') continue;
    const category = questCategory(existing);
    let next = applyQuestProgress(existing, update);
    if (!isHubCategory(next.category)) next = { ...next, category };
    if (next.status === 'completed' && !existing.rewardsPaid) {
      const cr = crOf(next);
      const earned = CR_POINTS[cr];
      const before = rankInfo(category, points[category]);
      points = { ...points, [category]: points[category] + earned };
      hubChanged = true;
      const after = rankInfo(category, points[category]);
      if (after.index > before.index) plan.rankUps.push({ category, from: before.name, to: after.name });
      const xp = Number(next.xpReward) > 0 ? Math.floor(Number(next.xpReward)) : 0;
      const gold = Number(next.goldReward) > 0 ? Math.floor(Number(next.goldReward)) : 0;
      plan.payouts.push({ quest: next, category, xp, gold, points: earned });
      const extras: string[] = [`+${earned} ${hubCategory(category).label} standing`];
      if (category === 'dragon') {
        const r = DRAGON_REWARDS[cr];
        plan.bondDelta += r.bond;
        plan.trustDelta += r.trust;
        extras.push(`bond +${r.bond}, trust +${r.trust}`);
      }
      if (category === 'signet') {
        plan.strainRelief += SIGNET_STRAIN_RELIEF;
        extras.push(`${SIGNET_STRAIN_RELIEF} strain cleared`);
      }
      next = { ...next, rewardsPaid: true };
      next = withQuestEvent(next, 'rewards', `Rewards paid out: ${rewardSummary(next)}; ${extras.join('; ')}.`);
      plan.settled.push(next);
    } else if (next.status === 'failed') {
      plan.failed.push(next);
      if (category === 'dragon') {
        plan.trustDelta += DRAGON_FAILURE_TRUST;
        next = withQuestEvent(next, 'note', `Your dragon felt that failure (trust ${DRAGON_FAILURE_TRUST}).`);
      }
      plan.settled.push(next);
    }
    plan.upserts.push({ key, stored: toStored(next) });
  }

  if (hubChanged) plan.hub = { points };
  return plan;
}

// ─── "Seek a quest" ──────────────────────────────────────────────────────────

export interface SeekContext {
  characterName: string;
  dragonName?: string;
  signetType?: string;
  yearAtBasgiath?: string;
  /** The running campaign summary (trimmed by the caller). */
  campaignSummary?: string;
  /** The end of the latest DM post, so offers fit where the rider is now. */
  latestScene?: string;
  /** Titles of quests already on the board (any status), so offers don't repeat them. */
  existingTitles: string[];
}

export function buildSeekPrompt(category: HubCategoryId, rankIndex: number, ctx: SeekContext): { system: string; user: string } {
  const cat = hubCategory(category);
  const allowed = allowedChallenges(rankIndex);
  const rank = cat.ranks[Math.max(0, Math.min(4, rankIndex))];
  const system = [
    'You write quest offers for a solo dragon-rider campaign set at Basgiath War College, where cadets train, bond dragons and wield signet powers.',
    'Return ONLY a JSON array of 2 or 3 quest objects. No prose before or after it, no code fences.',
    'Each object has exactly these fields:',
    '{"title": string (max 8 words), "description": string (1-2 sentences: who asks, what is at stake), "challenge_rating": one of ' + allowed.map(c => `"${c}"`).join(', ') + ', "stages": array of 2 to 4 short concrete objectives in order, "xp_reward": number, "gold_reward": number}',
    `Category: ${cat.label} (${cat.blurb}) Every quest must clearly belong to it.`,
    `The rider's standing in this category is "${rank}" (rank ${rankIndex + 1} of 5). Fit the difficulty to it.`,
    'Fit the quests to the current story: use places, people and threads that already exist where you can. Never resolve a quest, never kill or permanently change an established character, never invent world-changing events. Each quest is a hook the DM will narrate.',
    'Do not repeat or closely copy a quest that is already on the board.',
    'Write in plain words; no mechanics or dice inside the text.',
  ].join('\n');
  const lines = [
    `Rider: ${ctx.characterName || 'the rider'}${ctx.yearAtBasgiath ? `, ${ctx.yearAtBasgiath}` : ''}.`,
    ctx.dragonName ? `Bonded dragon: ${ctx.dragonName}.` : 'Not bonded to a dragon right now.',
    ctx.signetType ? `Signet: ${ctx.signetType}.` : '',
    ctx.campaignSummary ? `Story so far:\n${ctx.campaignSummary}` : '',
    ctx.latestScene ? `Latest scene:\n${ctx.latestScene}` : '',
    ctx.existingTitles.length ? `Already on the board: ${ctx.existingTitles.slice(0, 30).join('; ')}` : 'The board is empty.',
    `Write 2 or 3 ${cat.label} quest offers now.`,
  ].filter(Boolean);
  return { system, user: lines.join('\n\n') };
}

/**
 * Read the model's reply into offers. Forces the category, keeps the challenge inside
 * what the rank allows (rounding to the nearest allowed), clamps rewards, keeps 2–4
 * stages, drops titles already on the board, and returns at most 3.
 */
export function parseSeekReply(text: string, category: HubCategoryId, rankIndex: number, existingTitles: string[]): RawQuestOffer[] {
  const raw = String(text ?? '');
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start === -1 || end <= start) return [];
  let parsed: unknown;
  try { parsed = JSON.parse(raw.slice(start, end + 1)); } catch { return []; }
  if (!Array.isArray(parsed)) return [];
  const allowed = allowedChallenges(rankIndex);
  const order: QuestCR[] = ['easy', 'moderate', 'hard', 'deadly'];
  const taken = new Set(existingTitles.map(t => t.trim().toLowerCase()));
  const out: RawQuestOffer[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const title = String(o.title ?? '').trim().slice(0, 120);
    if (!title || taken.has(title.toLowerCase())) continue;
    let cr = String(o.challenge_rating ?? '') as QuestCR;
    if (!allowed.includes(cr)) {
      const idx = order.indexOf(cr);
      cr = idx === -1 ? allowed[0] : idx < order.indexOf(allowed[0]) ? allowed[0] : allowed[allowed.length - 1];
    }
    const stages = (Array.isArray(o.stages) ? o.stages : [])
      .map(s => String(s ?? '').trim().slice(0, 200))
      .filter(Boolean)
      .slice(0, 4);
    if (stages.length < 2) continue;
    const range = REWARD_RANGES[cr];
    out.push({
      title,
      category,
      description: String(o.description ?? '').trim().slice(0, 600) || undefined,
      quest_type: 'side',
      challenge_rating: cr,
      xp_reward: clampReward(o.xp_reward, range.xp),
      gold_reward: clampReward(o.gold_reward, range.gold),
      item_rewards: [],
      stages,
    });
    taken.add(title.toLowerCase());
    if (out.length === 3) break;
  }
  return out;
}

// ─── Board helpers ───────────────────────────────────────────────────────────

/** The quest the objective strip shows: an active main quest first, then the most recently updated active one. */
export function currentQuest(quests: Quest[]): Quest | null {
  const active = quests.filter(q => q.status === 'active');
  if (active.length === 0) return null;
  const byRecent = [...active].sort((a, b) => String(b.updated_at ?? '').localeCompare(String(a.updated_at ?? '')));
  return byRecent.find(q => q.questType === 'main') ?? byRecent[0];
}
