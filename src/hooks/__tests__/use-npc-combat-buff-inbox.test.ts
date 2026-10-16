import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const state = vi.hoisted(() => ({ events: [] as any[], calls: [] as any[] }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  from: (table: string) => {
    const builder: any = {
      select: () => builder, eq: () => builder, is: () => builder, order: () => builder, limit: () => builder,
      then: (resolve: any) => Promise.resolve({ error: null, data: table === 'party_fights'
        ? [{ id: 'fight', party_id: 'party', status: 'active', started_at: new Date().toISOString() }]
        : table === 'party_fight_combatants' ? [{ id: 'fighter', fight_id: 'fight', kind: 'player', user_id: 'me', hp: 25, status: 'up' }]
        : table === 'party_fight_events' ? state.events : [] }).then(resolve),
    }; return builder;
  },
  channel: () => { const c: any = { on: () => c, subscribe: () => c }; return c; },
  removeChannel: vi.fn(),
  functions: { invoke: async (_: string, options: any) => { state.calls.push(options.body); return { data: { ok: true }, error: null }; } },
} }));

import { useNpcCombat } from '@/hooks/use-npc-combat';

beforeEach(() => {
  localStorage.removeItem('odyssey-fight-applied-fight-me');
  state.events = []; state.calls = [];
});

describe('temporary-HP changes through the existing inbox', () => {
  it('applies separate pools once and survives reload/remount before server acknowledgement arrives', async () => {
    state.events = [
      { id: 'grant', fight_id: 'fight', target_user_id: 'me', hp_delta: 0, temp_hp_delta: 10, applied_at: null },
      { id: 'absorb', fight_id: 'fight', target_user_id: 'me', hp_delta: 0, temp_hp_delta: -10, applied_at: null },
      { id: 'damage', fight_id: 'fight', target_user_id: 'me', hp_delta: -5, temp_hp_delta: 0, applied_at: null },
      { id: 'other', fight_id: 'fight', target_user_id: 'other', hp_delta: 0, temp_hp_delta: 20, applied_at: null },
    ];
    let hp = 30, temp = 0;
    const apply = vi.fn((hpDelta: number, tempDelta: number) => { hp += hpDelta; temp += tempDelta; });
    const options = { partyId: 'party', currentUserId: 'me', isHost: false, sheetHp: 25, onCombatHPChange: apply };
    const first = renderHook(() => useNpcCombat(options));
    await waitFor(() => expect(apply).toHaveBeenCalledTimes(3));
    expect({ hp, temp }).toEqual({ hp: 25, temp: 0 });
    expect(state.calls).toContainEqual({ action: 'ack', eventIds: ['grant', 'absorb', 'damage'] });
    await act(async () => { await first.result.current.reload(); });
    expect(apply).toHaveBeenCalledTimes(3); first.unmount();
    const second = renderHook(() => useNpcCombat(options));
    await waitFor(() => expect(second.result.current.events).toHaveLength(4));
    expect(apply).toHaveBeenCalledTimes(3); expect(hp).toBe(25); second.unmount();
  });
  it('does not acknowledge temporary HP when the sheet callback is absent', async () => {
    state.events = [{ id: 'temp', fight_id: 'fight', target_user_id: 'me', hp_delta: 0, temp_hp_delta: 10, applied_at: null }];
    const ordinary = vi.fn();
    const hook = renderHook(() => useNpcCombat({ partyId: 'party', currentUserId: 'me', isHost: false, sheetHp: 25, onHPChange: ordinary }));
    await waitFor(() => expect(hook.result.current.inbox).toHaveLength(1));
    expect(ordinary).not.toHaveBeenCalled(); expect(state.calls.some(c => c.action === 'ack')).toBe(false); hook.unmount();
  });
});