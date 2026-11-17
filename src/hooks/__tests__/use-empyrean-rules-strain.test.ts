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
  onDmPost: vi.fn(() => true), onDragonTrust: vi.fn(), onMapChanged: vi.fn(), onStrainLimit: vi.fn(),
});
const options = (c: ReturnType<typeof calls>, over: Partial<EmpyreanRulesOptions> = {}): EmpyreanRulesOptions => ({
  enabled: true, campaignId: 'camp-1', bonded: true, dragonName: 'Gwyn', flying: false,
  getSheet: () => ({ level: 3, maxHp: 24 }), getPlace: () => ({ name: 'Basgiath', kind: 'fort' }), getCurrentHP: () => 20,
  getStrainLimit: () => 9, ...c, ...over,
});
const answer = (fn: (action: string, body: any) => any) =>
  mock.invoke.mockImplementation(async (_name: string, { body }: any) => ({ data: fn(body.action, body), error: null }));

describe('useEmpyreanRules: Signet Strain kept on the server', () => {
  beforeEach(() => { localStorage.clear(); mock.invoke.mockReset(); });
  afterEach(() => cleanup());

  it('sends the strain limit with every call and shows the server strain', async () => {
    answer(() => snap([], { strain: 5 }));
    const { result } = renderHook(() => useEmpyreanRules(options(calls())));
    await waitFor(() => expect(result.current.serverStrain).toBe(5));
    expect(mock.invoke.mock.calls[0][1].body.strainLimit).toBe(9);
    await act(async () => { result.current.strain('ground'); });
    await waitFor(() => expect(mock.invoke.mock.calls.some(([, { body }]: any) => body.action === 'strain' && body.reason === 'ground' && body.strainLimit === 9)).toBe(true));
  });

  it('passes the reply id and whether the rider channeled for the after-reply cool-down', async () => {
    answer(() => snap([], { strain: 3 }));
    const { result } = renderHook(() => useEmpyreanRules(options(calls())));
    await waitFor(() => expect(result.current.active).toBe(true));
    await act(async () => { result.current.strain('cool', { messageId: 'm7', channeled: true }); });
    await waitFor(() => expect(mock.invoke.mock.calls.some(([, { body }]: any) => body.action === 'strain' && body.messageId === 'm7' && body.channeled === true)).toBe(true));
  });

  it('does not apply a rest or a backlash to strain again when the server keeps it', async () => {
    const c = calls();
    answer(action => snap(action === 'state' ? [
      ev('r1', { kind: 'rest', payload: { rest: 'short', strainDelta: -2 } }),
      ev('r2', { kind: 'rest', payload: { rest: 'long', strainReset: true } }),
      ev('k1', { kind: 'check', payload: { strain: 2 } }),
    ] : [], { strain: 1 }));
    renderHook(() => useEmpyreanRules(options(c)));
    await waitFor(() => expect(c.onSheetRest).toHaveBeenCalledTimes(2));
    expect(c.onStrain).not.toHaveBeenCalled();
  });

  it('an older server (no strain in its answer) keeps the old phone behaviour', async () => {
    const c = calls();
    answer(action => snap(action === 'state' ? [
      ev('r1', { kind: 'rest', payload: { rest: 'short', strainDelta: -2 } }),
      ev('k1', { kind: 'check', payload: { strain: 2 } }),
    ] : []));
    const { result } = renderHook(() => useEmpyreanRules(options(c)));
    await waitFor(() => expect(c.onStrain).toHaveBeenCalledTimes(2));
    expect(c.onStrain).toHaveBeenCalledWith(-2);
    expect(c.onStrain).toHaveBeenCalledWith(2);
    expect(result.current.serverStrain).toBeNull();
  });

  it('a strain_limit event costs bond once, even if it is offered again', async () => {
    const c = calls();
    const limitEv = ev('s1', { kind: 'strain_limit', reason: 'Channeled to the limit', payload: { strain: 9, limit: 9 } });
    answer(() => snap([limitEv], { strain: 9 }));
    const { result } = renderHook(() => useEmpyreanRules(options(c)));
    await waitFor(() => expect(c.onStrainLimit).toHaveBeenCalledTimes(1));
    expect(c.onStrainLimit).toHaveBeenCalledWith('Channeled to the limit');
    await act(async () => { await result.current.refresh(); });
    expect(c.onStrainLimit).toHaveBeenCalledTimes(1);
  });

  it('no strain while the engine is off', async () => {
    const { result } = renderHook(() => useEmpyreanRules(options(calls(), { enabled: false })));
    expect(result.current.serverStrain).toBeNull();
    expect(mock.invoke).not.toHaveBeenCalled();
  });
});
