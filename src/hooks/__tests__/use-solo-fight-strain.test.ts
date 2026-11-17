import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: mock.invoke } } }));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
import { useSoloFight, type SoloFightOptions } from '@/hooks/use-solo-fight';
import type { RulesContext } from '@/lib/empyrean-rules-client';

const ctx: RulesContext = { campaignId: 'camp-1', riderKey: 'local', bonded: true, dragonName: 'Gwyn', strainLimit: 8 };
const view = { id: 'f1', status: 'active', outcome: null, lethal: true, arena: 'ground', challenge: 'easy', serverNow: 0, nextDueAt: null,
  rider: { id: 'r', name: 'Violet', hp: 30, maxHp: 30, level: 5, readyAt: 0, weapons: [], clash: null }, dragon: null, enemies: [], log: [], dragonDied: false, riderDown: false };
const options = (over: Partial<SoloFightOptions> = {}): SoloFightOptions => ({
  getContext: () => ctx, getSheet: () => ({ level: 5, maxHp: 30, hp: 30 }), riderName: 'Violet', resume: false,
  onInbox: vi.fn(), onStrain: vi.fn(), onStrainNow: vi.fn(), ...over,
});

describe('useSoloFight: strain after a signet move', () => {
  beforeEach(() => mock.invoke.mockReset());
  afterEach(() => cleanup());

  it('takes the strain the server keeps, and never adds the cost on top', async () => {
    mock.invoke.mockResolvedValue({ data: { serverNow: Date.now(), ok: true, fight: view, strain: 4, strainNow: 7 }, error: null });
    const o = options();
    const { result } = renderHook(() => useSoloFight(o));
    await act(async () => { await result.current.act({ type: 'signet', targetId: 'e1', intensity: 4, strainRoom: 4 }); });
    expect(o.onStrainNow).toHaveBeenCalledWith(7);
    expect(o.onStrain).not.toHaveBeenCalled();
    expect(mock.invoke.mock.calls[0][1].body.strainLimit).toBe(8);
  });

  it('a refused channel still brings the phone in step with the server', async () => {
    mock.invoke.mockResolvedValue({ data: { serverNow: Date.now(), ok: false, error: 'That much power would burn you out. Channel less.', fight: view, strainNow: 6 }, error: null });
    const o = options();
    const { result } = renderHook(() => useSoloFight(o));
    let ok = true;
    await act(async () => { ok = await result.current.act({ type: 'signet', targetId: 'e1', intensity: 4, strainRoom: 8 }); });
    expect(ok).toBe(false);
    expect(o.onStrainNow).toHaveBeenCalledWith(6);
  });

  it('an older server (no strainNow) still adds the cost on the phone', async () => {
    mock.invoke.mockResolvedValue({ data: { serverNow: Date.now(), ok: true, fight: view, strain: 4 }, error: null });
    const o = options();
    const { result } = renderHook(() => useSoloFight(o));
    await act(async () => { await result.current.act({ type: 'signet', targetId: 'e1', intensity: 4, strainRoom: 4 }); });
    expect(o.onStrain).toHaveBeenCalledWith(4);
    expect(o.onStrainNow).not.toHaveBeenCalled();
  });
});
