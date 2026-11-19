import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock('@/lib/pendingDmItems', () => ({ addPendingDmItems: vi.fn() }));
vi.mock('@/lib/empyrean-quest-seeker', () => ({ seekQuests: vi.fn() }));

vi.mock('@/lib/empyrean-quest-guide-writer', () => ({ writeQuestGuide: vi.fn() }));
import { useEmpyreanQuests, type UseEmpyreanQuestsOptions } from '@/hooks/use-empyrean-quests';
import { CARDS_KEY, PAYOUTS_KEY, type QuestPayResult } from '@/lib/empyrean-quest-hub';

import { GUIDES_KEY, storedQuestGuides, type QuestGuide } from '@/lib/empyrean-quest-guide';

import { writeQuestGuide } from '@/lib/empyrean-quest-guide-writer';

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

describe('useEmpyreanQuests story cards', () => {

  afterEach(() => { cleanup(); });



  it('records which DM reply offered and finished a quest, and nothing when no reply is named', async () => {

    const h = harness();

    const offer = { title: 'Find the Lost Journal', challenge_rating: 'easy', stages: ['Ask the scribes'] };

    await act(async () => { h.hook.result.current.applyExtraction([offer], []); });

    expect(h.flags()[CARDS_KEY]).toBeUndefined();



    const other = { title: 'Carry the Message', challenge_rating: 'easy' };

    await act(async () => { h.hook.result.current.applyExtraction([other], [{ key: 'study', status: 'completed' }], 'reply-7'); });

    h.hook.rerender();

    const cards = h.hook.result.current.cards;

    expect(cards.map(c => [c.kind, c.messageId])).toEqual([['offered', 'reply-7'], ['completed', 'reply-7']]);

    expect(cards[1]).toMatchObject({ questKey: 'study', xp: 300, gold: 20 });

    expect(h.hook.result.current.quests.some(q => q.key === cards[0].questKey && q.status === 'offered')).toBe(true);

  });

});


// ─── GM guides ───────────────────────────────────────────────────────────────



const mkGuide = (key: string): QuestGuide => ({

  questKey: key, title: key, steps: ['Meet the scribe', 'Search the stores', 'Confront the thief'],

  completeWhen: 'The ledger is home.', failWhen: 'It burns.', text: 'Secret truth. '.repeat(120), model: 'openai/gpt-6-astra', at: '2026-11-19T10:00:00.000Z',

});



function guideHarness(start: Record<string, any>, sendMessage: (text: string) => unknown = vi.fn(async () => true)) {

  let flags = start;

  const pay = vi.fn(async (): Promise<QuestPayResult> => 'paid');

  const opts = (): UseEmpyreanQuestsOptions => ({

    questFlags: flags,

    upsertQuest: (key, patch) => { flags = { ...flags, [key]: { ...(flags[key] ?? {}), ...patch } }; },

    removeQuest: key => { const { [key]: _gone, ...rest } = flags; flags = rest; },

    payQuest: pay, sendMessage, getSeekContext: () => ({ characterName: 'Kylar' }),

  });

  const hook = renderHook(() => useEmpyreanQuests(opts()));

  const settle = async () => { await act(async () => { await Promise.resolve(); }); hook.rerender(); await act(async () => { await Promise.resolve(); }); hook.rerender(); };

  return { hook, settle, pay, sendMessage, flags: () => flags };

}

const offer = { status: 'offered', title: 'The Missing Ledger', challengeRating: 'moderate', xpReward: 300, goldReward: 20, stages: [{ id: 'a', text: 'Find the scribe', done: false }, { id: 'b', text: 'Recover the ledger', done: false }] };

const guided = (key: string) => ({ status: 'active', title: key, challengeRating: 'moderate', xpReward: 300, goldReward: 20, stages: [{ id: `${key}-g1`, text: 'Meet the scribe', done: false }, { id: `${key}-g2`, text: 'Search the stores', done: false }, { id: `${key}-g3`, text: 'Confront the thief', done: false }] });



describe('useEmpyreanQuests GM guides', () => {

  const writer = vi.mocked(writeQuestGuide);

  beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }); writer.mockReset(); });

  afterEach(() => { cleanup(); vi.useRealTimers(); });



  it('accepting waits for the guide, then starts the quest with the guide\'s steps and sends the opening', async () => {

    let finish: (r: { guide: QuestGuide | null; error?: string }) => void = () => {};

    writer.mockImplementation(() => new Promise(res => { finish = res; }));

    const h = guideHarness({ ledger: offer });

    act(() => { h.hook.result.current.accept('ledger'); });

    expect(h.hook.result.current.preparing).toEqual(['ledger']);

    expect(h.flags().ledger.status).toBe('offered');

    expect(h.sendMessage).not.toHaveBeenCalled();

    expect(writer.mock.calls[0][0]).toMatchObject({ key: 'ledger', status: 'offered' });

    act(() => { h.hook.result.current.accept('ledger'); });

    expect(writer).toHaveBeenCalledTimes(1);



    await act(async () => { finish({ guide: mkGuide('ledger') }); });

    await h.settle();

    expect(h.hook.result.current.preparing).toEqual([]);

    expect(h.flags().ledger.status).toBe('active');

    expect(h.flags().ledger.stages.map((s: any) => s.id)).toEqual(['ledger-g1', 'ledger-g2', 'ledger-g3']);

    expect(h.flags()[GUIDES_KEY].guides.ledger.text).toContain('Secret truth.');

    expect(h.hook.result.current.guidedKeys).toEqual(['ledger']);

    expect(h.sendMessage).toHaveBeenCalledTimes(1);

    expect(vi.mocked(h.sendMessage as any).mock.calls[0][0]).toContain('Current objective: Meet the scribe');

  });



  it('starts the quest the old way when both writers fail', async () => {

    writer.mockResolvedValue({ guide: null, error: 'The guide writer took too long.' });

    const h = guideHarness({ ledger: offer });

    await act(async () => { h.hook.result.current.accept('ledger'); });

    await h.settle();

    expect(h.flags().ledger.status).toBe('active');

    expect(h.flags().ledger.stages.map((s: any) => s.text)).toEqual(['Find the scribe', 'Recover the ledger']);

    expect(h.flags()[GUIDES_KEY]).toBeUndefined();

    expect(h.sendMessage).toHaveBeenCalledTimes(1);

  });



  it('does not ask the writer when three active quests already have a guide', async () => {

    const h = guideHarness({ ledger: offer, a: guided('a'), b: guided('b'), c: guided('c'), [GUIDES_KEY]: storedQuestGuides({ a: mkGuide('a'), b: mkGuide('b'), c: mkGuide('c') }) });

    await act(async () => { h.hook.result.current.accept('ledger'); });

    expect(writer).not.toHaveBeenCalled();

    expect(h.flags().ledger.status).toBe('active');

    expect(h.flags()[GUIDES_KEY].guides.ledger).toBeUndefined();

  });



  it('starts nothing when the offer was declined while its guide was being written', async () => {

    let finish: (r: { guide: QuestGuide | null }) => void = () => {};

    writer.mockImplementation(() => new Promise(res => { finish = res; }));

    const h = guideHarness({ ledger: offer });

    act(() => { h.hook.result.current.accept('ledger'); });

    act(() => { h.hook.result.current.decline('ledger'); });

    h.hook.rerender();

    await act(async () => { finish({ guide: mkGuide('ledger') }); });

    await h.settle();

    expect(h.flags().ledger).toBeUndefined();

    expect(h.flags()[GUIDES_KEY]).toBeUndefined();

    expect(h.sendMessage).not.toHaveBeenCalled();

  });



  it('sends the opening again while the DM is busy', async () => {

    writer.mockResolvedValue({ guide: mkGuide('ledger') });

    const answers = [false, false, true];

    const send = vi.fn(async () => answers.shift() ?? true);

    const h = guideHarness({ ledger: offer }, send);

    await act(async () => { h.hook.result.current.accept('ledger'); });

    await h.settle();

    expect(send).toHaveBeenCalledTimes(1);

    await act(async () => { await vi.advanceTimersByTimeAsync(3100); });

    await act(async () => { await vi.advanceTimersByTimeAsync(3100); });

    expect(send).toHaveBeenCalledTimes(3);

    await act(async () => { await vi.advanceTimersByTimeAsync(10000); });

    expect(send).toHaveBeenCalledTimes(3);

  });



  it('the DM\'s tags tick steps; the done tag pays once and deletes the guide', async () => {

    const h = guideHarness({ ledger: guided('ledger'), [GUIDES_KEY]: storedQuestGuides({ ledger: mkGuide('ledger') }) });

    await act(async () => { h.hook.result.current.applyQuestTags('He talks.\n<!--QUEST_STEP:ledger:1-->', 'm1'); });

    h.hook.rerender();

    expect(h.flags().ledger.stages.map((s: any) => s.done)).toEqual([true, false, false]);

    expect(h.flags().ledger.status).toBe('active');

    await act(async () => { h.hook.result.current.applyQuestTags('Again.\n<!--QUEST_STEP:ledger:1-->', 'm2'); });

    expect(h.pay).not.toHaveBeenCalled();



    await act(async () => { h.hook.result.current.applyQuestTags('It ends.\n<!--QUEST_DONE:ledger-->', 'm3'); });

    await h.settle();

    expect(h.flags().ledger.status).toBe('completed');

    expect(h.pay).toHaveBeenCalledTimes(1);

    expect(h.flags()[GUIDES_KEY].guides.ledger).toBeUndefined();

    expect(h.hook.result.current.guidedKeys).toEqual([]);

    expect(h.flags()[CARDS_KEY].cards.some((c: any) => c.kind === 'completed' && c.messageId === 'm3')).toBe(true);

    await act(async () => { h.hook.result.current.applyQuestTags('<!--QUEST_DONE:ledger-->', 'm4'); });

    expect(h.pay).toHaveBeenCalledTimes(1);

  });



  it('ignores tags for a quest that has no guide', async () => {

    const h = guideHarness({ ledger: guided('ledger') });

    await act(async () => { h.hook.result.current.applyQuestTags('<!--QUEST_DONE:ledger-->'); });

    expect(h.flags().ledger.status).toBe('active');

  });



  it('writes a guide for a quest already under way and keeps its objectives', async () => {

    writer.mockResolvedValue({ guide: { ...mkGuide('study'), steps: ['Read', 'Recite'] } });

    const h = guideHarness({ study: { status: 'active', title: 'Study', challengeRating: 'easy', stages: [{ id: 's0', text: 'Read', done: true }, { id: 's1', text: 'Recite', done: false }] } });

    await act(async () => { h.hook.result.current.prepareGuide('study'); });

    await h.settle();

    expect(h.flags().study.stages).toEqual([{ id: 's0', text: 'Read', done: true }, { id: 's1', text: 'Recite', done: false }]);

    expect(h.flags()[GUIDES_KEY].guides.study.steps).toEqual(['Read', 'Recite']);

    expect(h.sendMessage).not.toHaveBeenCalled();

    await act(async () => { h.hook.result.current.prepareGuide('study'); });

    expect(writer).toHaveBeenCalledTimes(1);

  });

});
