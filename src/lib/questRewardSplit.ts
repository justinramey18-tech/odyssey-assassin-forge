import type { Quest } from '@/lib/quests';

/** How quest XP and gold are handed out when a party quest completes. */
export type QuestRewardSplitMode = 'full' | 'equal' | 'weighted' | 'contributors';

export const QUEST_REWARD_SPLIT_MODES: Array<{ id: QuestRewardSplitMode; label: string; description: string }> = [
  { id: 'full', label: 'Full reward each', description: 'Every player receives the listed XP and gold in full.' },
  { id: 'equal', label: 'Equal split', description: 'The listed XP and gold are divided evenly between all party members.' },
  { id: 'weighted', label: 'Level-weighted', description: 'Higher-level characters take a proportionally larger share.' },
  { id: 'contributors', label: 'Contributors only', description: 'Only characters named in the quest log share the reward.' },
];

export const DEFAULT_QUEST_REWARD_SPLIT: QuestRewardSplitMode = 'full';

export function questRewardSplitLabel(mode: QuestRewardSplitMode): string {
  return QUEST_REWARD_SPLIT_MODES.find(m => m.id === mode)?.label ?? 'Full reward each';
}

export interface SplitMember {
  user_id: string;
  character_name: string;
  level?: number;
}

const safeLevel = (lvl: unknown): number => {
  const n = Number(lvl);
  return Number.isFinite(n) && n > 0 ? Math.min(30, Math.floor(n)) : 1;
};

/** Characters mentioned anywhere in the quest's log, notes or objectives. */
export function questContributors(quest: Quest, members: SplitMember[]): SplitMember[] {
  const haystack = [
    ...(quest.events ?? []).map(e => e?.text ?? ''),
    ...(quest.stages ?? []).map((s: any) => `${s?.title ?? ''} ${s?.note ?? ''}`),
    quest.description ?? '',
  ].join(' ').toLowerCase();
  if (!haystack.trim()) return [];
  return members.filter(m => {
    const name = (m.character_name || '').trim().toLowerCase();
    return name.length >= 2 && haystack.includes(name);
  });
}

/**
 * Fraction (0-1) of the quest's listed XP/gold that `userId` should receive.
 * Every client computes this from the same shared member list, so the totals agree.
 */
export function questRewardShare(
  mode: QuestRewardSplitMode,
  quest: Quest,
  members: SplitMember[],
  userId: string,
): number {
  const roster = members.filter(m => m?.user_id);
  if (mode === 'full' || roster.length === 0) return 1;

  if (mode === 'equal') {
    return roster.some(m => m.user_id === userId) ? 1 / roster.length : 0;
  }

  if (mode === 'weighted') {
    const total = roster.reduce((sum, m) => sum + safeLevel(m.level), 0);
    const me = roster.find(m => m.user_id === userId);
    if (!me || total <= 0) return 0;
    return safeLevel(me.level) / total;
  }

  // contributors
  const contributors = questContributors(quest, roster);
  const pool = contributors.length > 0 ? contributors : roster; // nobody named → treat as equal split
  return pool.some(m => m.user_id === userId) ? 1 / pool.length : 0;
}

/** Applies a share to a reward amount, never producing NaN or a negative value. */
export function applyShare(amount: unknown, share: number): number {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (!Number.isFinite(share) || share <= 0) return 0;
  return Math.max(0, Math.floor(n * Math.min(1, share)));
}
