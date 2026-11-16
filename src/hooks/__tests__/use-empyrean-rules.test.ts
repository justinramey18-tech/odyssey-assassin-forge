import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: mock.invoke } } }));
vi.mock('@/lib/dragon-record', () => ({ currentRiderKey: () => 'local' }));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
import { useEmpyreanRules, type EmpyreanRulesOptions } from '@/hooks/use-empyrean-rules';

const snap = (inbox: any[] = [], extra: Record<string, unknown> = {}) => ({
  ok: true, version: 1, hasMap: true, minute: 600, clock: 'Day 1, 10:00', timeOfDay: 'morning', traveling: false,
  rules: { shortRestsLeft: 2, longRestReady: true, conditions: [], injuries: [], checkPenalty: 0, unmetNeeds: [], eventLevel: 'normal', eventPending: false },
  mastery: { xp: 0, rank: 0, name: 'Untested', next: 15, checkBonus: 0 }, dragonAssist: 0, unlocks: [], facts: 'Time: Day 1, 10:00', inbox, ...extra,
});
const ev = (id: string, over: Record<string, unknown>) => ({ id, kind: 'check', reason: 'r', xp: 0, gold: 0, hp: 0, payload: {}, created_at: 't', ...over });
const calls = () => ({
  onHPChange: vi.fn(), onAddXP: vi.fn(), onGoldChange: vi.fn(), onSheetRest: vi.fn(), onStrain: vi.fn(),
  onDmPost: vi.fn(() => true), onDragonTrust: vi.fn(), onMapChanged: vi.fn(),
});
const options = (c: ReturnType<typeof calls>, over: Partial<EmpyreanRulesOptions> = {}): EmpyreanRulesOptions => ({
  enabled: true, campaignId: 'camp-1', bonded: true, dragonName: 'Gwyn', flying: false,
  getSheet: () => ({ level: 3, maxHp: 24 }), getPlace: () => ({ name: 'Basgiath', kind: 'fort' }), getCurrentHP: () => 20, ...c, ...over,
});
const answer = (fn: (action: string, body: any) => any) =>
  mock.invoke.mockImplementation(async (_name: string, { body }: any) => ({ data: fn(body.action, body), error: null }));

describe('useEmpyreanRules', () => {
  beforeEach(() => { localStorage.clear(); mock.invoke.mockReset(); });
  afterEach(() => cleanup());

  it('stays off when the server cannot be reached, so the app behaves as before', async () => {
    mock.invoke.mockResolvedValue({ data: null, error: { message: 'not deployed' } });
    const c = calls();
    const { result } = renderHook(() => useEmpyreanRules(options(c)));
    await waitFor(() => expect(mock.invoke).toHaveBeenCalled());
    expect(result.current.active).toBe(false);
    expect(await result.current.questPayout('q', 'easy', 'Quest')).toBe(false);
  });

  it("applies a fight's result as damage (a negative number, the way the sheet takes it) and reports it once", async () => {
    const fightEv = ev('f1', { kind: 'fight', hp: -14, xp: 90, reason: 'VICTORY: Wyvern', payload: { outcome: 'victory', riderDown: false, dragonDied: false, line: '[FIGHT RESULT, binding: VICTORY.]' } });
    answer((action) => (action === 'ack' ? snap([]) : snap([])));
    const c = { ...calls(), onFightResult: vi.fn() };
    const { result } = renderHook(() => useEmpyreanRules(options(c)));
    await waitFor(() => expect(result.current.active).toBe(true));
    expect(result.current.context()).toMatchObject({ campaignId: 'camp-1', bonded: true, dragonName: 'Gwyn' });
    await act(async () => { result.current.absorbInbox([fightEv]); });
    await waitFor(() => expect(c.onFightResult).toHaveBeenCalledTimes(1));
    expect(c.onHPChange).toHaveBeenCalledWith(-14, 'damage');
    expect(c.onAddXP).toHaveBeenCalledWith(90, 'VICTORY: Wyvern');
    expect(c.onFightResult.mock.calls[0][0]).toMatchObject({ outcome: 'victory', line: '[FIGHT RESULT, binding: VICTORY.]' });
    // The same result arriving again (the next snapshot still lists it) is not applied twice.
    await act(async () => { result.current.absorbInbox([fightEv]); });
    expect(c.onHPChange).toHaveBeenCalledTimes(1);
    expect(c.onFightResult).toHaveBeenCalledTimes(1);
  });

  it('is off without a campaign and makes no calls', async () => {
    const c = calls();
    const { result } = renderHook(() => useEmpyreanRules(options(c, { campaignId: null })));
    await act(async () => { await result.current.refresh(); });
    expect(mock.invoke).not.toHaveBeenCalled();
    expect(result.current.active).toBe(false);
  });

  it('applies each waiting result once, confirms it, and never re-applies it', async () => {
    const inbox = [
      ev('e1', { hp: -5, payload: { strain: 1 } }),
      ev('e2', { kind: 'quest_payout', xp: 120, gold: 30, reason: 'Quest: Run the Gauntlet' }),
      ev('e3', { kind: 'rest', payload: { rest: 'long', strainReset: true } }),
      ev('e4', { kind: 'dragon_need', payload: { trust: -1 } }),
      ev('e5', { kind: 'story_gold', gold: -40 }),
    ];
    let acked: string[] = [];
    let ackWorks = false;
    answer((action, body) => {
      if (action === 'ack') { if (!ackWorks) return null; acked = body.ids; return snap([]); }
      return snap(acked.length ? [] : inbox);
    });
    const c = calls();
    const { result } = renderHook(() => useEmpyreanRules(options(c)));
    await waitFor(() => expect(c.onAddXP).toHaveBeenCalled());
    await waitFor(() => expect(mock.invoke.mock.calls.some(([, o]) => o.body.action === 'ack')).toBe(true));
    expect(result.current.active).toBe(true);
    expect(c.onHPChange).toHaveBeenCalledWith(-5, 'damage'); // the sheet adds what it is given: damage is negative
    expect(c.onStrain).toHaveBeenCalledWith(1);
    expect(c.onStrain).toHaveBeenCalledWith('reset');
    expect(c.onAddXP).toHaveBeenCalledWith(120, 'Quest: Run the Gauntlet');
    expect(c.onGoldChange.mock.calls.map(x => x[0])).toEqual([30, -40]);
    expect(c.onSheetRest).toHaveBeenCalledWith('long');
    expect(c.onDragonTrust).toHaveBeenCalledWith(-1, 'r');

    // The confirmation was lost: the same results come back and must not be applied again.
    ackWorks = true;
    await act(async () => { await result.current.refresh(); });
    await waitFor(() => expect(acked).toEqual(['e1', 'e2', 'e3', 'e4', 'e5']));
    expect(c.onHPChange).toHaveBeenCalledTimes(1);
    expect(c.onAddXP).toHaveBeenCalledTimes(1);
    expect(c.onSheetRest).toHaveBeenCalledTimes(1);
    expect(c.onGoldChange).toHaveBeenCalledTimes(2);
  });

  it('holds a DM post until the story can take it, then adds it once and reloads the map', async () => {
    const post = ev('p1', { kind: 'dm_post', payload: { content: 'The storm breaks over the ridge.' } });
    let acked = false;
    answer((action) => { if (action === 'ack') { acked = true; return snap([]); } return snap(acked ? [] : [post]); });
    const c = calls();
    c.onDmPost.mockReturnValueOnce(false);
    const { result } = renderHook(() => useEmpyreanRules(options(c)));
    await waitFor(() => expect(c.onDmPost).toHaveBeenCalledTimes(1));
    expect(acked).toBe(false);
    await act(async () => { await result.current.refresh(); });
    await waitFor(() => expect(acked).toBe(true));
    expect(c.onDmPost).toHaveBeenLastCalledWith('p1', 'The storm breaks over the ridge.');
    expect(c.onDmPost).toHaveBeenCalledTimes(2);
    expect(c.onMapChanged).toHaveBeenCalled();
  });

  it('rest reloads the map and reports the server refusal', async () => {
    answer((action) => (action === 'rest' ? snap([], { ok: false, error: 'You have already taken 2 short rests today.' }) : snap([])));
    const c = calls();
    const { result } = renderHook(() => useEmpyreanRules(options(c)));
    await waitFor(() => expect(result.current.active).toBe(true));
    let ok = true;
    await act(async () => { ok = await result.current.rest('short'); });
    expect(ok).toBe(false);
    expect(c.onMapChanged).not.toHaveBeenCalled();
    answer(() => snap([], { summary: 'Short rest: 1 hour passes.' }));
    await act(async () => { ok = await result.current.rest('short'); });
    expect(ok).toBe(true);
    expect(c.onMapChanged).toHaveBeenCalledTimes(1);
  });

  it('sends the sheet, place and dragon with every call', async () => {
    answer(() => snap([]));
    const c = calls();
    const { result } = renderHook(() => useEmpyreanRules(options(c)));
    await waitFor(() => expect(result.current.active).toBe(true));
    expect(mock.invoke).toHaveBeenCalledWith('empyrean-rules', { body: {
      action: 'state', campaignId: 'camp-1', riderKey: 'local', dragonName: 'Gwyn', bonded: true,
      sheet: { level: 3, maxHp: 24 }, place: { name: 'Basgiath', kind: 'fort' },
    } });
  });
});
