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

/** The first objective that is still outstanding, or undefined when all are done. */
export function nextObjective(q: Quest): QuestStage | undefined {
  return (q.stages ?? []).find(s => !s.done);
}

/**
 * Prompt sent to the DM the moment a quest is accepted: start the quest and
 * narrate the opening beat that moves the party toward the next objective.
 */
export function buildQuestKickoffPrompt(q: Quest, opts?: { party?: boolean; styleLine?: string }): string {
  const who = opts?.party ? 'The party accepts' : 'I accept';
  const title = questTitle(q);
  const next = nextObjective(q);
  const stages = (q.stages ?? []).slice(0, 8);
  const lines: string[] = [];

  lines.push(`(${who} the quest "${title}". It is now ACTIVE — track our progress on it from here.)`);
  if (q.description) lines.push(`Brief: ${q.description}`);
  if (stages.length > 0) {
    lines.push(`Objectives: ${stages.map((s, i) => `${i + 1}. ${s.text}${s.done ? ' [done]' : ''}`).join(' ')}`);
  }
  if (next) {
    lines.push(`Current objective: ${next.text}`);
    lines.push(`Narrate the scene that starts this quest and moves us toward that objective — who approaches us or what changes around us, where we go next, and one clear opening for us to act on. Do not resolve the objective for us.`);
  } else {
    lines.push(`Narrate the scene that starts this quest and give us a clear first move.`);
  }
  if (opts?.styleLine) lines.push(opts.styleLine);
  return lines.join('\n');
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

  const events: QuestEvent[] = Array.isArray(raw?.events)
    ? raw.events.slice(-MAX_EVENTS).map((e: any) => ({
        at: e?.at ? String(e.at) : new Date().toISOString(),
        type: EVENT_TYPES.includes(e?.type) ? (e.type as QuestEventType) : 'note',
        text: String(e?.text ?? '').slice(0, 240),
      })).filter((e: QuestEvent) => e.text.length > 0)
    : [];

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
    events: events.length ? events : undefined,
    updated_at: raw?.updated_at ? String(raw.updated_at) : undefined,
  };
}

export function normalizeQuestMap(raw: Record<string, any> | undefined | null): Quest[] {
  if (!raw || typeof raw !== 'object') return [];
  return Object.entries(raw)
    // Reserved buckets (world state log) live in the same map but are not quests.
    .filter(([key]) => !key.startsWith('__'))
    .map(([key, value]) => normalizeQuest(key, value));
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

  const quest = normalizeQuest(key, {
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
  return withQuestEvent(quest, 'offered', `Quest offered by the DM${stages.length ? ` with ${stages.length} objective${stages.length === 1 ? '' : 's'}` : ''}.`);
}

/** Mark stages done by fuzzy text match, and apply an explicit status if the DM gave one. */
export function applyQuestProgress(
  quest: Quest,
  update: { stages_completed?: string[]; status?: string | null; notes?: string | null },
): Quest {
  let stages = quest.stages ? quest.stages.map(s => ({ ...s })) : [];
  const newlyDone: string[] = [];
  for (const raw of update.stages_completed ?? []) {
    const needle = String(raw ?? '').toLowerCase().trim();
    if (!needle) continue;
    const hit = stages.find(s => {
      const hay = s.text.toLowerCase();
      return hay === needle || hay.includes(needle) || needle.includes(hay);
    });
    if (hit && !hit.done) {
      hit.done = true;
      newlyDone.push(hit.text);
    }
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

  let next: Quest = {
    ...quest,
    stages: stages.length ? stages : quest.stages,
    status,
    notes: update.notes ? String(update.notes).slice(0, 600) : quest.notes,
    updated_at: new Date().toISOString(),
  };

  for (const text of newlyDone) next = withQuestEvent(next, 'stage', `Objective completed: ${text}`);
  const newNote = update.notes ? String(update.notes).trim() : '';
  if (newNote && newNote !== (quest.notes ?? '').trim()) next = withQuestEvent(next, 'note', newNote);
  if (status !== quest.status) {
    next = withQuestEvent(
      next,
      'status',
      status === 'completed' ? 'Quest completed.' : status === 'failed' ? 'Quest failed.' : `Status changed to ${status}.`,
    );
  }
  return next;
}

/** Human summary of what a quest pays out, used in the activity timeline. */
export function rewardSummary(q: Quest): string {
  const parts: string[] = [];
  if (q.xpReward) parts.push(`${q.xpReward} XP`);
  if (q.goldReward) parts.push(`${q.goldReward} gold`);
  for (const it of q.itemRewards ?? []) parts.push(`${it.name}${(it.quantity ?? 1) > 1 ? ` x${it.quantity}` : ''}`);
  return parts.length ? parts.join(', ') : 'no material rewards';
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

// ─── World state / plot impact ────────────────────────────────────────────────
// Major, irreversible outcomes of the story ("the Ring was destroyed", "Lord
// Varn is dead", "the bridge is burned"). Stored inside the same quest_flags
// map under a reserved key so no migration is needed; normalizeQuestMap skips it.

export const WORLD_STATE_KEY = '__world_state__';

export type WorldImpact = 'minor' | 'major' | 'seismic';
export type WorldScope = 'world' | 'faction' | 'location' | 'npc' | 'party' | 'item';

export interface WorldStateEntry {
  id: string;
  /** ISO timestamp of when it was recorded. */
  at: string;
  /** Short headline, e.g. "The One Ring is destroyed". */
  title: string;
  /** What it means going forward. */
  consequence?: string;
  scope: WorldScope;
  impact: WorldImpact;
  /** Quest this outcome came out of, when it came from one. */
  questKey?: string;
}

const IMPACTS: WorldImpact[] = ['minor', 'major', 'seismic'];
const SCOPES: WorldScope[] = ['world', 'faction', 'location', 'npc', 'party', 'item'];
const MAX_WORLD_ENTRIES = 60;

export const IMPACT_META: Record<WorldImpact, { label: string; className: string }> = {
  minor: { label: 'Minor', className: 'text-sky-300 border-sky-500/40 bg-sky-500/10' },
  major: { label: 'Major', className: 'text-amber-300 border-amber-500/40 bg-amber-500/10' },
  seismic: { label: 'Seismic', className: 'text-fuchsia-300 border-fuchsia-500/40 bg-fuchsia-500/10' },
};

export const SCOPE_LABEL: Record<WorldScope, string> = {
  world: 'World',
  faction: 'Faction',
  location: 'Location',
  npc: 'Character',
  party: 'Party',
  item: 'Artifact',
};

function worldIdFrom(title: string): string {
  return `ws_${questKeyFrom(title) || Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeWorldEntry(raw: any): WorldStateEntry | null {
  const title = String(raw?.title ?? '').trim().slice(0, 140);
  if (!title) return null;
  return {
    id: String(raw?.id ?? worldIdFrom(title)),
    at: raw?.at ? String(raw.at) : new Date().toISOString(),
    title,
    consequence: raw?.consequence ? String(raw.consequence).slice(0, 400) : undefined,
    scope: SCOPES.includes(raw?.scope) ? (raw.scope as WorldScope) : 'world',
    impact: IMPACTS.includes(raw?.impact) ? (raw.impact as WorldImpact) : 'major',
    questKey: raw?.questKey ? String(raw.questKey).slice(0, 60) : undefined,
  };
}

/** Read the world-state log out of a stored quest_flags map. */
export function normalizeWorldState(rawMap: Record<string, any> | undefined | null): WorldStateEntry[] {
  const bucket = rawMap?.[WORLD_STATE_KEY];
  const list = Array.isArray(bucket?.entries) ? bucket.entries : [];
  return list
    .map(normalizeWorldEntry)
    .filter((e: WorldStateEntry | null): e is WorldStateEntry => !!e)
    .slice(-MAX_WORLD_ENTRIES);
}

/** Serialise entries back into the reserved quest_flags bucket. */
export function toStoredWorldState(entries: WorldStateEntry[]): Record<string, any> {
  return {
    status: 'unknown',
    entries: entries.slice(-MAX_WORLD_ENTRIES),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Fold new outcomes into the log, skipping anything already recorded.
 * Returns the merged list plus only the entries that were genuinely new.
 */
export function mergeWorldState(
  existing: WorldStateEntry[],
  incoming: any[],
): { entries: WorldStateEntry[]; added: WorldStateEntry[] } {
  const seen = new Set(existing.map(e => e.title.toLowerCase().trim()));
  const added: WorldStateEntry[] = [];
  for (const raw of Array.isArray(incoming) ? incoming.slice(0, 6) : []) {
    const entry = normalizeWorldEntry(raw);
    if (!entry) continue;
    const fingerprint = entry.title.toLowerCase().trim();
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    added.push(entry);
  }
  if (added.length === 0) return { entries: existing, added };
  return { entries: [...existing, ...added].slice(-MAX_WORLD_ENTRIES), added };
}

/** The outcome of a finished quest, recorded as a plot impact. */
export function worldEntryFromQuest(quest: Quest): WorldStateEntry {
  const done = quest.status === 'completed';
  return {
    id: `ws_${quest.key}_${done ? 'done' : 'failed'}`,
    at: new Date().toISOString(),
    title: `${done ? 'Completed' : 'Failed'}: ${questTitle(quest)}`,
    consequence: done
      ? `The party saw this through${quest.xpReward || quest.goldReward ? ` and was paid ${rewardSummary(quest)}` : ''}.`
      : 'This job ended badly and will not be paid out.',
    scope: quest.questType === 'main' ? 'world' : 'party',
    impact: quest.questType === 'main' ? 'major' : 'minor',
    questKey: quest.key,
  };
}

/** Lines fed to the AI DM so it never contradicts an established outcome. */
export function worldStateContextLines(entries: WorldStateEntry[]): string[] {
  return entries
    .slice(-8)
    .map(e => `${e.title}${e.consequence ? ` — ${e.consequence}` : ''} [${e.impact}]`);
}
