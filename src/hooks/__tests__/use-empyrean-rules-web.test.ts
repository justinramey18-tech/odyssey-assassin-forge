import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({ invoke: vi.fn(), success: vi.fn(), error: vi.fn(), warning: vi.fn(), plain: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: mock.invoke } } }));
vi.mock('@/lib/dragon-record', () => ({ currentRiderKey: () => 'local' }));
vi.mock('sonner', () => ({ toast: Object.assign(mock.plain, { success: mock.success, error: mock.error, warning: mock.warning }) }));
import { useEmpyreanRules, type EmpyreanRulesOptions } from '@/hooks/use-empyrean-rules';
import { bloodCost, webStrainLimit, type RulesWeb } from '@/lib/empyrean-rules-client';

const web = (balance: number, owned: string[] = [], strainLimit = 0): RulesWeb => ({
  xp: { earned: balance + owned.length * 150, spent: owned.length * 150, balance }, owned,
  bonuses: { strainLimit, backlashOff: 0, freeChannel: false }, spokes: [],
});
const snap = (extra: Record<string, unknown> = {}) => ({
  ok: true, version: 1, hasMap: true, minute: 600, clock: 'Day 1, 10:00', timeOfDay: 'morning', traveling: false,
  rules: { shortRestsLeft: 2, longRestReady: true, conditions: [], injuries: [], checkPenalty: 0, unmetNeeds: [], eventLevel: 'normal', eventPending: false },
  mastery: { xp: 0, rank: 0, name: 'Untested', next: 15, checkBonus: 0 }, dragonAssist: 0, unlocks: [], facts: '', inbox: [], ...extra,
});
const options = (over: Partial<EmpyreanRulesOptions> = {}): EmpyreanRulesOptions => ({
  enabled: true, campaignId: 'camp-1', bonded: true, dragonName: 'Gwyn', flying: false,
  getSheet: () => ({ level: 3, maxHp: 24 }), getPlace: () => undefined, getCurrentHP: () => 20,
  onHPChange: vi.fn(), onAddXP: vi.fn(), onGoldChange: vi.fn(), onSheetRest: vi.fn(), onStrain: vi.fn(),
  onDmPost: vi.fn(() => true), onDragonTrust: vi.fn(), onMapChanged: vi.fn(), getStrainLimit: () => 9, ...over,
});
const answer = (fn: (action: string, body: any) => any) =>
  mock.invoke.mockImplementation(async (_name: string, { body }: any) => ({ data: fn(body.action, body), error: null }));

describe('useEmpyreanRules: the progression web', () => {
  beforeEach(() => { localStorage.clear(); mock.invoke.mockReset(); mock.success.mockReset(); mock.error.mockReset(); mock.warning.mockReset(); mock.plain.mockReset(); });
  afterEach(() => cleanup());

  it('shows the web the server sent, and none from an older server', async () => {
    answer(() => snap({ web: web(150) }));
    const { result } = renderHook(() => useEmpyreanRules(options()));
    await waitFor(() => expect(result.current.web?.xp.balance).toBe(150));
    cleanup();
    answer(() => snap());
    const older = renderHook(() => useEmpyreanRules(options()));
    await waitFor(() => expect(older.result.current.active).toBe(true));
    expect(older.result.current.web).toBeNull();
  });

  it('asks the server to buy a node, shows the new web and names the upgrade', async () => {
    answer(action => (action === 'web_buy'
      ? snap({ web: web(0, ['channel-1'], 1), bought: { id: 'channel-1', name: 'First Reserve', effect: 'Signet Strain limit +1.' } })
      : snap({ web: web(150) })));
    const { result } = renderHook(() => useEmpyreanRules(options()));
    await waitFor(() => expect(result.current.web?.xp.balance).toBe(150));
    let ok = false;
    await act(async () => { ok = await result.current.buyNode('channel-1'); });
    expect(ok).toBe(true);
    const sent = mock.invoke.mock.calls.find(([, { body }]: any) => body.action === 'web_buy');
    expect(sent?.[1].body.nodeId).toBe('channel-1');
    // The phone still sends its own limit; the server adds the bonus.
    expect(sent?.[1].body.strainLimit).toBe(9);
    expect(result.current.web?.owned).toEqual(['channel-1']);
    expect(mock.success).toHaveBeenCalledWith('First Reserve unlocked', { description: 'Signet Strain limit +1.' });
  });

  it('a refused purchase returns false and shows the reason the server gave', async () => {
    answer(action => (action === 'web_buy' ? snap({ ok: false, error: 'You need 100 more XP.', web: web(50) }) : snap({ web: web(50) })));
    const { result } = renderHook(() => useEmpyreanRules(options()));
    await waitFor(() => expect(result.current.active).toBe(true));
    let ok = true;
    await act(async () => { ok = await result.current.buyNode('channel-1'); });
    expect(ok).toBe(false);
    expect(mock.error).toHaveBeenCalledWith('You need 100 more XP.');
    expect(mock.success).not.toHaveBeenCalled();
  });

  it('says so when a channel was the free one', async () => {
    answer(action => (action === 'signet_used' ? snap({ strain: 0, strainCost: 0, freeChannel: true }) : snap({ strain: 0 })));
    const { result } = renderHook(() => useEmpyreanRules(options()));
    await waitFor(() => expect(result.current.active).toBe(true));
    await act(async () => { result.current.signetUsed(4); });
    await waitFor(() => expect(mock.success).toHaveBeenCalledWith('Deep Well: this channel cost no strain'));
  });

  it('the meter limit is the phone limit plus the web bonus, capped at 20, and 0 stays 0', () => {
    expect(webStrainLimit(9, web(0, [], 2))).toBe(11);
    expect(webStrainLimit(19, web(0, [], 7))).toBe(20);
    expect(webStrainLimit(0, web(0, [], 7))).toBe(0);
    expect(webStrainLimit(9, null)).toBe(9);
  });
  it('shows the Ward and the price of blood the server keeps, and none from an older server', async () => {
    answer(() => snap({ ward: { now: 5, max: 8 }, bloodPrice: 3 }));
    const { result } = renderHook(() => useEmpyreanRules(options()));
    await waitFor(() => expect(result.current.ward).toEqual({ now: 5, max: 8 }));
    expect(result.current.bloodPrice).toBe(3);
    cleanup();
    answer(() => snap({ ward: { now: 0, max: 0 } }));
    const none = renderHook(() => useEmpyreanRules(options()));
    await waitFor(() => expect(none.result.current.active).toBe(true));
    expect(none.result.current.ward).toBeNull();
    expect(none.result.current.bloodPrice).toBe(0);
  });

  it('sends the rider\'s HP with every call, and tells the server what the Ward soaked', async () => {
    answer(action => (action === 'ward_soak' ? snap({ ward: { now: 2, max: 8 }, wardSoaked: 3 }) : snap({ ward: { now: 5, max: 8 } })));
    const { result } = renderHook(() => useEmpyreanRules(options({ getSheet: () => ({ level: 3, maxHp: 24, hp: 17 }) })));
    await waitFor(() => expect(result.current.ward?.now).toBe(5));
    await act(async () => { result.current.wardSoak(3); });
    await waitFor(() => expect(result.current.ward?.now).toBe(2));
    const sent = mock.invoke.mock.calls.find(([, { body }]: any) => body.action === 'ward_soak');
    expect(sent?.[1].body.amount).toBe(3);
    expect(sent?.[1].body.sheet.hp).toBe(17);
  });

  it('says what a channel cost in blood', async () => {
    answer(action => (action === 'signet_used' ? snap({ strain: 8, strainCost: 2, blood: { points: 2, hp: 8 } }) : snap({ strain: 6 })));
    const { result } = renderHook(() => useEmpyreanRules(options()));
    await waitFor(() => expect(result.current.active).toBe(true));
    await act(async () => { result.current.signetUsed(4); });
    await waitFor(() => expect(mock.warning).toHaveBeenCalledWith('Lifeblood: 8 HP paid to push 2 past your limit'));
  });

  it('applies regeneration and names it; says when the Ward took damage', async () => {
    const onHPChange = vi.fn();
    answer(action => (action === 'ack' ? snap() : snap({ inbox: [
      { id: 'e1', kind: 'regen', reason: 'Regeneration: 4 HP over 2 hours', xp: 0, gold: 0, hp: 4, payload: { hours: 2, heal: 4, ward: 0 }, created_at: 'x' },
      { id: 'e2', kind: 'check', reason: 'Climb: Critical failure', xp: 0, gold: 0, hp: -2, payload: { wardSoaked: 3 }, created_at: 'x' },
    ] })));
    renderHook(() => useEmpyreanRules(options({ onHPChange })));
    await waitFor(() => expect(onHPChange).toHaveBeenCalledWith(4, 'healing'));
    expect(onHPChange).toHaveBeenCalledWith(-2, 'damage');
    expect(mock.success).toHaveBeenCalledWith('Regeneration: 4 HP over 2 hours');
    expect(mock.plain).toHaveBeenCalledWith('Your Ward absorbed 3 damage');
  });

  it('the fight screen\'s blood price matches the server\'s rule', () => {
    expect(bloodCost(4, 4, 2, 30)).toBe(0);
    expect(bloodCost(4, 1, 2, 30)).toBe(6);
    expect(bloodCost(4, 1, 0, 30)).toBeNull();
    expect(bloodCost(4, 1, undefined, 30)).toBeNull();
    expect(bloodCost(4, 0, 4, 16)).toBeNull();
    expect(bloodCost(4, 0, 4, 17)).toBe(16);
  });
});
