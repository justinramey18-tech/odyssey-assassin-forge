import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock('@/lib/pendingDmItems', () => ({ addPendingDmItems: vi.fn() }));
vi.mock('@/lib/empyrean-quest-seeker', () => ({ seekQuests: vi.fn() }));
import { useEmpyreanQuests, type UseEmpyreanQuestsOptions } from '@/hooks/use-empyrean-quests';
import { PAYOUTS_KEY, type QuestPayResult } from '@/lib/empyrean-quest-hub';

// quest_flags held like useDMGameState holds them (upsertQuest merges into the key).
function harness(payQuest?: UseEmpyreanQuestsOptions['payQuest']) {
  let flags: Record<string, any> = {
    study: { status: 'active', title: 'Study', challengeRating: 'moderate', xpReward: 500, goldReward: 20, stages: [{ id: 's0', text: 'Read', done: false }] },
  };
  const onAddXP = vi.fn();
  const onGoldChange = vi.fn();
  const opts = (): UseEmpyreanQuestsOptions => ({
    questFlags: flags,
    upsertQuest: (key, patch) => { flags = { ...flags, [key]: { ...(flags[key] ?? {}), ...patch } }; },
    removeQuest: key => { const { [key]: _gone, ...rest } = flags; flags = rest; },
    onAddXP, onGoldChange, payQuest, getSeekContext: () => ({ characterName: 'Kylar' }),
  });
  const hook = renderHook(() => useEmpyreanQuests(opts()));
  const finish = async () => {
    await act(async () => { hook.result.current.applyExtraction([], [{ key: 'study', status: 'completed' }]); });
    hook.rerender();
  };
  return { hook, finish, onAddXP, onGoldChange, flags: () => flags };
}

describe('useEmpyreanQuests payouts', () => {
  beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }); });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it('shows the real reward on the card (listed 500 XP on a moderate quest is 300)', () => {
    const { hook } = harness();
    expect(hook.result.current.quests[0]).toMatchObject({ xpReward: 300, goldReward: 20 });
  });

  it('pays on the phone when there is no rules engine', async () => {
    const h = harness();
    await h.finish();
    expect(h.onAddXP).toHaveBeenCalledWith(300, 'Quest: Study');
    expect(h.onGoldChange).toHaveBeenCalledWith(20);
  });

  it('sends the real reward to the server and never pays it on the phone too', async () => {
    const pay = vi.fn(async (): Promise<QuestPayResult> => 'paid');
    const h = harness(pay);
    await h.finish();
    expect(pay).toHaveBeenCalledWith({ questKey: 'study', challenge: 'moderate', title: 'Study', xp: 300, gold: 20 });
    expect(h.onAddXP).not.toHaveBeenCalled();
    expect(h.flags()[PAYOUTS_KEY]).toBeUndefined();
  });

  it('pays on the phone when the engine is off or the server refused (nothing recorded there)', async () => {
    for (const r of ['off', 'refused'] as const) {
      const h = harness(vi.fn(async () => r));
      await h.finish();
      expect(h.onAddXP).toHaveBeenCalledTimes(1);
      cleanup();
    }
  });

  it('keeps an unanswered payout waiting and sends it again until the server answers, never paying it twice', async () => {
    const answers: QuestPayResult[] = ['unconfirmed', 'off', 'unconfirmed', 'paid'];
    const pay = vi.fn(async () => answers.shift() ?? 'paid');
    const h = harness(pay);
    await h.finish();
    expect(h.flags()[PAYOUTS_KEY].pending).toEqual([{ questKey: 'study', challenge: 'moderate', title: 'Study', xp: 300, gold: 20 }]);
    // Retries: the engine off (waits), no answer (waits), then the server takes it.
    for (const ms of [5000, 60000, 60000]) {
      await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
      h.hook.rerender();
    }
    expect(pay).toHaveBeenCalledTimes(4);
    expect(h.flags()[PAYOUTS_KEY].pending).toEqual([]);
    expect(h.onAddXP).not.toHaveBeenCalled();
    expect(h.onGoldChange).not.toHaveBeenCalled();
  });
});
