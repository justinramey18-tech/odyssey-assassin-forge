// Quest board model shared by the solo DM character sheet and the party quest panel.
// Quests live inside the existing quest_flags map (solo: dm_game_state, party: party_shared_state),
// so older saves that only stored { status, notes } keep working untouched.

export type QuestStatus = 'offered' | 'active' | 'completed' | 'failed' | 'unknown';
export type QuestType = 'main' | 'side';
export type QuestCR = 'easy' | 'moderate' | 'hard' | 'deadly';

export interface QuestStage {
  id: string;
  text: string;
  done: boolean;
}

export interface QuestItemReward {
  name: string;
  quantity?: number;
  gold_value?: number;
  description?: string;
  rarity?: string;
  category?: string;
}

export type QuestEventType = 'offered' | 'accepted' | 'stage' | 'note' | 'status' | 'rewards';

export interface QuestEvent {
  /** ISO timestamp of when this happened. */
  at: string;
  type: QuestEventType;
  text: string;
}

export interface Quest {
  key: string;
  status: QuestStatus;
  title?: string;
  description?: string;
  notes?: string;
  questType?: QuestType;
  challengeRating?: QuestCR;
  xpReward?: number;
  goldReward?: number;
  itemRewards?: QuestItemReward[];
  stages?: QuestStage[];
  /** Set once the completion payout has run, so rewards can never be paid twice. */
  rewardsPaid?: boolean;
  /** Newest-last activity log: stage ticks, notes, status changes, payouts. */
  events?: QuestEvent[];
  updated_at?: string;
}

const EVENT_TYPES: QuestEventType[] = ['offered', 'accepted', 'stage', 'note', 'status', 'rewards'];
const MAX_EVENTS = 40;

/** Append an entry to a quest's activity timeline (immutably, capped). */
export function withQuestEvent(quest: Quest, type: QuestEventType, text: string): Quest {
  const clean = String(text ?? '').trim().slice(0, 240);
  if (!clean) return quest;
  const events = [...(quest.events ?? []), { at: new Date().toISOString(), type, text: clean }];
  return { ...quest, events: events.slice(-MAX_EVENTS) };
}


export const CR_META: Record<QuestCR, { label: string; className: string }> = {
  easy: { label: 'Easy', className: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10' },
  moderate: { label: 'Moderate', className: 'text-amber-300 border-amber-500/40 bg-amber-500/10' },
  hard: { label: 'Hard', className: 'text-orange-300 border-orange-500/40 bg-orange-500/10' },
  deadly: { label: 'Deadly', className: 'text-red-300 border-red-500/40 bg-red-500/10' },
};

const CR_VALUES: QuestCR[] = ['easy', 'moderate', 'hard', 'deadly'];

export function safeCount(value: unknown, max = 1_000_000): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(max, Math.floor(n));
}

export function questTitle(q: Quest): string {
  const t = (q.title || '').trim();
  if (t) return t;
  return q.key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function questPercent(q: Quest): number {
  if (q.status === 'completed') return 100;
  if (q.status === 'failed') return 0;
  const stages = q.stages ?? [];
  if (stages.length === 0) return q.status === 'active' ? 0 : 0;
  const done = stages.filter(s => s.done).length;
  return Math.round((done / stages.length) * 100);
}

export function questKeyFrom(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 60);
}

/** Coerce anything stored (legacy or rich) into a Quest, dropping bad numbers. */
export function normalizeQuest(key: string, raw: any): Quest {
  const statusRaw = String(raw?.status ?? 'unknown');
  const status: QuestStatus =
    (['offered', 'active', 'completed', 'failed', 'unknown'] as string[]).includes(statusRaw)
      ? (statusRaw as QuestStatus)
      : 'unknown';

  const stages: QuestStage[] = Array.isArray(raw?.stages)
    ? raw.stages.slice(0, 6).map((s: any, i: number) => ({
        id: String(s?.id ?? `${key}-s${i}`),
        text: String(s?.text ?? '').slice(0, 200),
        done: Boolean(s?.done),
      })).filter((s: QuestStage) => s.text.length > 0)
    : [];

  const itemRewards: QuestItemReward[] = Array.isArray(raw?.itemRewards)
    ? raw.itemRewards.slice(0, 6).map((it: any) => ({
        name: String(it?.name ?? '').slice(0, 80),
        quantity: safeCount(it?.quantity, 99) || 1,
        gold_value: safeCount(it?.gold_value, 1_000_000) || undefined,
        description: it?.description ? String(it.description).slice(0, 400) : undefined,
        rarity: it?.rarity ? String(it.rarity) : undefined,
        category: it?.category ? String(it.category) : undefined,
      })).filter((it: QuestItemReward) => it.name.length > 0)
    : [];

  const cr = CR_VALUES.includes(raw?.challengeRating) ? (raw.challengeRating as QuestCR) : undefined;
  const type: QuestType | undefined = raw?.questType === 'main' || raw?.questType === 'side' ? raw.questType : undefined;

  return {
    key,
    status,
    title: raw?.title ? String(raw.title).slice(0, 120) : undefined,
    description: raw?.description ? String(raw.description).slice(0, 600) : undefined,
    notes: raw?.notes ? String(raw.notes).slice(0, 600) : undefined,
    questType: type,
    challengeRating: cr,
    xpReward: safeCount(raw?.xpReward, 1_000_000) || undefined,
    goldReward: safeCount(raw?.goldReward, 1_000_000) || undefined,
    itemRewards: itemRewards.length ? itemRewards : undefined,
    stages: stages.length ? stages : undefined,
    rewardsPaid: Boolean(raw?.rewardsPaid),
    updated_at: raw?.updated_at ? String(raw.updated_at) : undefined,
  };
}

export function normalizeQuestMap(raw: Record<string, any> | undefined | null): Quest[] {
  if (!raw || typeof raw !== 'object') return [];
  return Object.entries(raw).map(([key, value]) => normalizeQuest(key, value));
}

/** A quest offer as produced by the background extractor. */
export interface RawQuestOffer {
  key?: string;
  title?: string;
  description?: string;
  quest_type?: string;
  challenge_rating?: string;
  xp_reward?: number;
  gold_reward?: number;
  item_rewards?: Array<{ name?: string; quantity?: number; gold_value?: number; description?: string; rarity?: string; category?: string }>;
  stages?: string[];
}

export function questFromOffer(offer: RawQuestOffer): Quest | null {
  const title = String(offer?.title ?? '').trim();
  const key = questKeyFrom(offer?.key || title);
  if (!key || !title) return null;

  const stages: QuestStage[] = (Array.isArray(offer.stages) ? offer.stages : [])
    .slice(0, 6)
    .map((text, i) => ({ id: `${key}-s${i}`, text: String(text ?? '').slice(0, 200), done: false }))
    .filter(s => s.text.length > 0);

  return normalizeQuest(key, {
    status: 'offered',
    title,
    description: offer.description,
    questType: offer.quest_type === 'main' ? 'main' : 'side',
    challengeRating: CR_VALUES.includes(offer.challenge_rating as QuestCR) ? offer.challenge_rating : 'moderate',
    xpReward: offer.xp_reward,
    goldReward: offer.gold_reward,
    itemRewards: (offer.item_rewards ?? []).map(it => ({ ...it })),
    stages,
    updated_at: new Date().toISOString(),
  });
}

/** Mark stages done by fuzzy text match, and apply an explicit status if the DM gave one. */
export function applyQuestProgress(
  quest: Quest,
  update: { stages_completed?: string[]; status?: string | null; notes?: string | null },
): Quest {
  let stages = quest.stages ? quest.stages.map(s => ({ ...s })) : [];
  for (const raw of update.stages_completed ?? []) {
    const needle = String(raw ?? '').toLowerCase().trim();
    if (!needle) continue;
    const hit = stages.find(s => {
      const hay = s.text.toLowerCase();
      return hay === needle || hay.includes(needle) || needle.includes(hay);
    });
    if (hit) hit.done = true;
  }

  let status = quest.status;
  if (update.status === 'completed' || update.status === 'failed' || update.status === 'active') {
    status = update.status;
  }
  // Every stage ticked completes the quest even if the DM forgot to say so.
  if (status === 'active' && stages.length > 0 && stages.every(s => s.done)) {
    status = 'completed';
  }
  if (status === 'completed') {
    stages = stages.map(s => ({ ...s, done: true }));
  }

  return {
    ...quest,
    stages: stages.length ? stages : quest.stages,
    status,
    notes: update.notes ? String(update.notes).slice(0, 600) : quest.notes,
    updated_at: new Date().toISOString(),
  };
}

/** Serialise back into the stored quest_flags shape. */
export function toStored(quest: Quest): Record<string, any> {
  const { key, ...rest } = quest;
  return { ...rest, updated_at: rest.updated_at ?? new Date().toISOString() };
}

/** One-line summary used in the AI prompt context. */
export function questContextLine(q: Quest): string {
  const bits = [`${questTitle(q)} (${q.questType === 'main' ? 'main' : 'side'}${q.challengeRating ? `, ${q.challengeRating}` : ''}) — ${questPercent(q)}%`];
  const open = (q.stages ?? []).filter(s => !s.done).map(s => s.text).slice(0, 4);
  if (open.length) bits.push(`remaining: ${open.join('; ')}`);
  if (q.xpReward || q.goldReward) {
    bits.push(`reward: ${q.xpReward ? `${q.xpReward} XP` : ''}${q.xpReward && q.goldReward ? ', ' : ''}${q.goldReward ? `${q.goldReward} gp` : ''}`);
  }
  return bits.join(' | ');
}
