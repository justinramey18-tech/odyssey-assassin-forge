import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
  invoke: vi.fn(),
}));

vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));
vi.mock('@/integrations/supabase/client', () => {
  const table = () => {
    let pending: Record<string, unknown> | null = null;
    const chain: Record<string, unknown> = {};
    chain.select = () => chain;
    chain.eq = () => chain;
    chain.delete = () => chain;
    chain.upsert = (r: Record<string, unknown>) => {
      pending = { ...r, id: `id-${r.npc_key}` };
      h.rows = [...h.rows.filter(x => x.npc_key !== r.npc_key), pending];
      return chain;
    };
    chain.single = () => Promise.resolve({ data: pending, error: null });
    chain.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: h.rows, error: null }).then(res);
    return chain;
  };
  return { supabase: { from: table, functions: { invoke: (...a: unknown[]) => h.invoke(...a) } } };
});

import { useSoloNpcs } from '@/hooks/use-solo-npcs';

const CAMPAIGN = '1393b23b-9efd-449f-ac00-5052c7cfc33a';

describe('useSoloNpcs (D-38)', () => {
  beforeEach(() => { h.rows = []; h.invoke.mockReset(); localStorage.clear(); });

  it('a DM post that names canon people marks them met, then their memories and feelings update', async () => {
    h.invoke.mockResolvedValue({ data: { memories: [{ key: 'dain-aetos', memory: 'Kylar held the line.', attitudeChange: 1 }] }, error: null });
    const { result } = renderHook(() => useSoloNpcs({ campaignId: CAMPAIGN, riderName: 'Kylar Stern', enabled: true }));
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => result.current.onStory('Dain Aetos stops in front of you. Violet watches from the second row.', 'I hold my ground.'));
    await waitFor(() => expect(result.current.entry('dain-aetos')?.memories).toEqual(['Kylar held the line.']));
    expect(result.current.entry('dain-aetos')?.attitude).toBe(1);
    expect(result.current.entry('violet-sorrengail')?.status).toBe('met');

    const [fn, opts] = h.invoke.mock.calls[0] as [string, { body: { action: string; npcs: Array<{ key: string }>; scene: string } }];
    expect(fn).toBe('solo-npc');
    expect(opts.body.action).toBe('remember');
    expect(opts.body.npcs.map(n => n.key).sort()).toEqual(['dain-aetos', 'violet-sorrengail']);
    expect(opts.body.scene).toContain('PLAYER (Kylar Stern): I hold my ground.');
  });

  it('a post naming nobody on the roster costs nothing', async () => {
    const { result } = renderHook(() => useSoloNpcs({ campaignId: CAMPAIGN, riderName: 'Kylar', enabled: true }));
    await waitFor(() => expect(result.current.ready).toBe(true));
    act(() => result.current.onStory('The wind howls across the courtyard.', ''));
    await new Promise(r => setTimeout(r, 20));
    expect(h.invoke).not.toHaveBeenCalled();
  });

  it('nothing is written before the campaign has its cloud id', async () => {
    const { result } = renderHook(() => useSoloNpcs({ campaignId: null, riderName: 'Kylar', enabled: true }));
    act(() => result.current.onStory('Dain Aetos nods.', ''));
    await new Promise(r => setTimeout(r, 20));
    expect(h.rows).toEqual([]);
    expect(result.current.roster.length).toBeGreaterThan(50);
  });

  it('@mention gives the NPC\'s voice block, with the era and their memories', async () => {
    h.rows = [{ id: 'x', campaign_id: CAMPAIGN, npc_key: 'dain-aetos', name: 'Dain Aetos', attitude: -2, memories: ['Kylar mouthed off at formation.'], status: 'met' }];
    const { result } = renderHook(() => useSoloNpcs({ campaignId: CAMPAIGN, riderName: 'Kylar Stern', enabled: true }));
    await waitFor(() => expect(result.current.entry('dain-aetos')?.status).toBe('met'));
    const hit = result.current.mention('@Dain Aetos, permission to speak?');
    if (!hit) throw new Error("Expected valid result");
    expect(hit.name).toBe('Dain Aetos');
    expect(hit.line).toBe('permission to speak?');
    expect(hit.voice).toContain('cold (-2');
    expect(hit.voice).toContain('Kylar mouthed off at formation.');
    expect(hit.voice).toContain("Violet's first year");
    expect(result.current.mention('plain text')).toBeNull();
  });

  it('switching the era changes who is around and is remembered for the campaign', async () => {
    const { result } = renderHook(() => useSoloNpcs({ campaignId: CAMPAIGN, riderName: 'Kylar', enabled: true }));
    expect(result.current.entry('sloane-mairi')).toBeUndefined();
    act(() => result.current.setEra('if'));
    expect(result.current.entry('sloane-mairi')?.status).toBe('unmet');
    expect(localStorage.getItem(`empyrean-npc-era::${CAMPAIGN}`)).toBe('if');
  });

  it('Quick Build adds a custom NPC to the roster', async () => {
    h.invoke.mockResolvedValue({ data: { npc: { name: 'Corin Vale', role: 'Second-year', look: 'Tall', personality: 'Gruff.', voice: 'Low', wants: 'Respect', facts: [], secrets: [], attitude: 1, fight: null } }, error: null });
    const { result } = renderHook(() => useSoloNpcs({ campaignId: CAMPAIGN, riderName: 'Kylar', enabled: true }));
    await waitFor(() => expect(result.current.ready).toBe(true));
    await act(async () => { await result.current.build('a gruff second-year'); });
    const corin = result.current.roster.find(e => e.name === 'Corin Vale');
    expect(corin?.custom).toBe(true);
    expect(corin?.status).toBe('met');
  });
});
