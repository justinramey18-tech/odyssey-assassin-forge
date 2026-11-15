import { describe, it, expect, vi, beforeEach } from 'vitest';

// A small in-memory stand-in for the two tables and the save function.
const fake = vi.hoisted(() => {
  const s = {
    dragons: [] as any[],
    events: [] as any[],
    rpcFails: false,
    reset() { s.dragons = []; s.events = []; s.rpcFails = false; },
  };
  const query = (table: string) => {
    const filters: Array<[string, unknown]> = [];
    let insertRow: any = null;
    const rows = () => (table === 'empyrean_dragons' ? s.dragons : s.events)
      .filter(r => filters.every(([k, v]) => r[k] === v));
    const q: any = {
      select: () => q,
      eq: (k: string, v: unknown) => { filters.push([k, v]); return q; },
      order: () => q,
      limit: (n: number) => Promise.resolve({ data: [...rows()].reverse().slice(0, n), error: null }),
      maybeSingle: () => Promise.resolve({ data: rows()[0] ?? null, error: null }),
      insert: (row: any) => {
        insertRow = { id: `id-${Math.random().toString(36).slice(2, 8)}`, created_at: new Date().toISOString(), ...row };
        if (table === 'empyrean_dragons') {
          insertRow = { version: 0, state: {}, ...insertRow };
          if (s.dragons.some(d => d.rider_key === row.rider_key && d.dragon_name === row.dragon_name)) {
            const err = { data: null, error: { code: '23505', message: 'duplicate' } };
            return { select: () => ({ single: () => Promise.resolve(err) }) };
          }
          s.dragons.push(insertRow);
        } else {
          s.events.push({ bond_delta: 0, trust_delta: 0, wounds_delta: 0, ...insertRow });
        }
        const done = { data: insertRow, error: null };
        return Object.assign(Promise.resolve(done), { select: () => ({ single: () => Promise.resolve(done) }) });
      },
    };
    return q;
  };
  const rpc = (_name: string, a: any) => {
    if (s.rpcFails) return Promise.reject(new Error('offline'));
    const d = s.dragons.find(r => r.id === a.p_dragon_id);
    if (!d || d.version !== a.p_expected_version) return Promise.resolve({ data: null, error: null });
    Object.assign(d, { bond: a.p_bond, trust: a.p_trust, wounds: a.p_wounds, mood: a.p_mood ?? d.mood, state: a.p_state ?? d.state, version: d.version + 1 });
    if (a.p_source && (a.p_bond_delta || a.p_trust_delta || a.p_wounds_delta)) {
      s.events.push({ id: `e${s.events.length}`, dragon_id: d.id, source: a.p_source, reason: a.p_reason, bond_delta: a.p_bond_delta, trust_delta: a.p_trust_delta, wounds_delta: a.p_wounds_delta, bond_after: d.bond, trust_after: d.trust, wounds_after: d.wounds, created_at: new Date().toISOString() });
    }
    return Promise.resolve({ data: { ...d }, error: null });
  };
  return { s, client: { from: query, rpc } };
});

vi.mock('@/integrations/supabase/client', () => ({ supabase: fake.client }));

import { saveBondState } from '@/lib/dragonBondState';
import {
  __resetDragonRecordForTests,
  commitDragonChange,
  connectDragonRecord,
  dragonSavesSettled,
  loadDragonHistory,
  loadSoloDragonState,
} from '@/lib/dragon-record';

const phone = (over: Record<string, unknown> = {}) => saveBondState({
  bond: 30, trust: 25, mood: 'calm', memories: [], totalChatExchanges: 0, sessionChatCount: 0,
  ruptures: 0, lastContactTimestamp: null, unreadDragonMessages: [], ...over,
} as any);

beforeEach(() => {
  fake.s.reset();
  localStorage.clear();
  localStorage.setItem('odyssey-active-cloud-save-id', 'save-1');
  __resetDragonRecordForTests();
});

describe('dragon record', () => {
  it('first connect moves the phone bond to the server, ruptures becoming wounds', async () => {
    phone({ bond: 33, trust: 27, ruptures: 2, memories: [{ id: 'm1', text: 'We flew the Gauntlet', source: 'campaign', createdAt: 'x' }] });
    const state = await connectDragonRecord({ dragonName: 'Tairn', riderName: 'Ramey' });
    expect(fake.s.dragons).toHaveLength(1);
    expect(fake.s.dragons[0]).toMatchObject({ rider_key: 'save-1', dragon_name: 'Tairn', bond: 33, trust: 27, wounds: 2 });
    expect(fake.s.dragons[0].state.memories).toHaveLength(1);
    expect(fake.s.events[0]).toMatchObject({ source: 'start', bond_after: 33, wounds_after: 2 });
    expect(state?.wounds).toBe(2);
  });

  it('server meters win on connect; an empty phone gets its memories back', async () => {
    fake.s.dragons.push({ id: 'd1', rider_key: 'save-1', dragon_name: 'Tairn', bond: 52, trust: 44, wounds: 1, mood: 'protective', version: 3,
      state: { memories: [{ id: 'm1', text: 'Saved me at the parapet', source: 'campaign', createdAt: 'x' }], totalChatExchanges: 9, lastContactTimestamp: '2026-11-10T00:00:00.000Z' } });
    phone({ bond: 15, trust: 10 }); // a new campaign reset the phone
    const state = await connectDragonRecord({ dragonName: 'Tairn' });
    expect(state).toMatchObject({ bond: 52, trust: 44, wounds: 1, mood: 'protective', totalChatExchanges: 9 });
    expect(state?.memories).toHaveLength(1);
    expect(fake.s.events).toHaveLength(0);
  });

  it('a change shows on the phone at once and reaches the server with its reason', async () => {
    phone();
    await connectDragonRecord({ dragonName: 'Tairn' });
    const r = commitDragonChange({ trust: -5 }, 'dm', 'Ignored the warning');
    expect(r.woundOpened).toBe(true);
    expect(loadSoloDragonState()).toMatchObject({ trust: 20, wounds: 1 });
    await dragonSavesSettled();
    expect(fake.s.dragons[0]).toMatchObject({ trust: 20, wounds: 1, version: 1 });
    const history = await loadDragonHistory();
    expect(history[0]).toMatchObject({ source: 'dm', reason: 'Ignored the warning', trust_delta: -5, wounds_delta: 1 });
  });

  it('a change made offline waits and is replayed on the server numbers next time', async () => {
    phone();
    await connectDragonRecord({ dragonName: 'Tairn' });
    fake.s.rpcFails = true;
    commitDragonChange({ bond: 3 }, 'dm', 'Held the line together');
    await dragonSavesSettled();
    expect(fake.s.dragons[0].bond).toBe(30);
    fake.s.rpcFails = false;
    fake.s.dragons[0].bond = 40; fake.s.dragons[0].version = 5; // another phone moved it meanwhile
    __resetDragonRecordForTests();
    const state = await connectDragonRecord({ dragonName: 'Tairn' });
    expect(fake.s.dragons[0].bond).toBe(43);
    expect(state?.bond).toBe(43);
    expect(fake.s.events.filter(e => e.source === 'dm')).toHaveLength(1);
  });

  it('a version clash reloads and applies the change on the newer numbers', async () => {
    phone();
    await connectDragonRecord({ dragonName: 'Tairn' });
    fake.s.dragons[0].trust = 50; fake.s.dragons[0].version = 9;
    commitDragonChange({ trust: 4 }, 'chat', 'Asked how it was');
    await dragonSavesSettled();
    expect(fake.s.dragons[0]).toMatchObject({ trust: 54, version: 10 });
    expect(loadSoloDragonState().trust).toBe(54);
  });

  it('changes made before the record loads are kept for that dragon', async () => {
    phone();
    const pending = connectDragonRecord({ dragonName: 'Tairn' });
    commitDragonChange({ bond: 2 }, 'fight', 'Shared danger');
    await pending;
    await dragonSavesSettled();
    expect(fake.s.dragons[0].bond).toBe(32);
  });

  it('a new campaign that resets the phone copy never wipes the dragon\'s memories', async () => {
    phone({ bond: 50, trust: 40, totalChatExchanges: 4, memories: [{ id: 'm1', text: 'The night at the Gauntlet', source: 'campaign', createdAt: 'x' }] });
    await connectDragonRecord({ dragonName: 'Tairn' });
    phone({ bond: 15, trust: 10 }); // campaign launch writes the defaults (no record stamp)
    commitDragonChange({ bond: 2 }, 'fight', 'Shared danger');
    await dragonSavesSettled();
    expect(fake.s.dragons[0].bond).toBe(52);
    expect(fake.s.dragons[0].state.memories).toHaveLength(1);
    expect(loadSoloDragonState()).toMatchObject({ bond: 52, trust: 40, totalChatExchanges: 4 });
    expect(loadSoloDragonState().memories).toHaveLength(1);
  });

  it('no dragon name means no record', async () => {
    phone();
    expect(await connectDragonRecord({ dragonName: '  ' })).toBeNull();
    expect(fake.s.dragons).toHaveLength(0);
  });
});
