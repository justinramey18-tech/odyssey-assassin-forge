import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

// A small stand-in for the Supabase client: every query is recorded, and reads of the
// Live Table return the rows set in `table` below.
type Call = { table: string; op: string; args: unknown[]; filters: Array<[string, unknown]> };
const calls: Call[] = [];
let table: Array<Record<string, unknown>> = [];

function query(tableName: string) {
  const call: Call = { table: tableName, op: 'select', args: [], filters: [] };
  const result = () => {
    if (call.op === 'insert') return { data: { id: 'new-line-id' }, error: null };
    if (tableName === 'party_round_chat' && call.op === 'select') return { data: [...table].reverse(), error: null };
    return { data: [], error: null };
  };
  const builder: any = {
    select: (...a: unknown[]) => { if (call.op === 'select') call.args = a; return builder; },
    insert: (...a: unknown[]) => { call.op = 'insert'; call.args = a; return builder; },
    update: (...a: unknown[]) => { call.op = 'update'; call.args = a; return builder; },
    upsert: (...a: unknown[]) => { call.op = 'upsert'; call.args = a; return builder; },
    delete: () => { call.op = 'delete'; return builder; },
    eq: (c: string, v: unknown) => { call.filters.push([`eq:${c}`, v]); return builder; },
    in: (c: string, v: unknown) => { call.filters.push([`in:${c}`, v]); return builder; },
    order: () => builder,
    limit: () => builder,
    single: () => builder,
    maybeSingle: () => builder,
    then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => {
      calls.push(call);
      return Promise.resolve(result()).then(res, rej);
    },
  };
  return builder;
}

vi.mock('@/integrations/supabase/client', () => {
  const channel: any = { on: () => channel, subscribe: () => channel };
  return {
    supabase: {
      from: (t: string) => query(t),
      channel: () => channel,
      removeChannel: () => {},
    },
  };
});

import { useRoundChat } from '@/hooks/use-round-chat';

const HOST = 'host-user';
const KAEL = 'kael-user';
const P1 = 'aaaaaaaa-0000-4000-8000-000000000001';
const G1 = 'aaaaaaaa-0000-4000-8000-000000000002';
const P2 = 'aaaaaaaa-0000-4000-8000-000000000003';
const H1 = 'aaaaaaaa-0000-4000-8000-000000000004';

const line = (id: string, over: Record<string, unknown>) => ({
  id, party_id: 'party', round_id: 'round', in_character: true, consumed: false, selected: false,
  npc_id: null, created_at: `2026-10-10T12:00:0${id.slice(-1)}Z`, ...over,
});

beforeEach(() => {
  calls.length = 0;
  table = [
    line(P1, { user_id: KAEL, character_name: 'Kaelen', content: 'Where is the pup?', selected: true }),
    line(G1, { user_id: HOST, character_name: 'Grukk', npc_id: 'npc-grukk', content: `[reply:${P1}]\n*spits* Not telling.`, selected: true }),
    line(P2, { user_id: KAEL, character_name: 'Kaelen', content: 'Please.', selected: false }),
    line(H1, { user_id: HOST, character_name: 'Hostchar', content: 'I watch.', selected: false }),
  ];
});

async function render(userId = KAEL) {
  const hook = renderHook(() => useRoundChat('party', userId, userId === HOST ? 'Hostchar' : 'Kaelen', 'round', HOST));
  await waitFor(() => expect(hook.result.current.messages).toHaveLength(4));
  return hook;
}

describe('Live Table with NPC lines', () => {
  it("never credits an NPC's sealed line to the host's character", async () => {
    const { result } = await render();
    expect(result.current.selectedParticipants).toEqual([{ userId: KAEL, characterName: 'Kaelen', text: 'Where is the pup?' }]);
    expect(result.current.pendingUserIds).toEqual([KAEL]);
    expect(result.current.selectedNpcLines).toEqual([{ id: G1, npcId: 'npc-grukk', name: 'Grukk', text: '*spits* Not telling.' }]);
    expect(result.current.progress.speakers).toBe(2);
  });

  it('hands the DM the conversation in order, with the NPC marked', async () => {
    const { result } = await render();
    expect(result.current.buildRoundPrompt()).toBe('[Kaelen]: Where is the pup?\n[Grukk (NPC)]: (replying to Kaelen) *spits* Not telling.');
    expect(result.current.liveTableContext.hasNpcLines).toBe(true);
  });

  it('without NPC lines the hand-off text is unchanged', async () => {
    table = table.map(m => (m.id === G1 ? { ...m, selected: false } : m.id === P2 ? { ...m, selected: true } : m));
    const { result } = await render();
    expect(result.current.buildRoundPrompt()).toBe('[Kaelen]: Where is the pup? Please.');
    expect(result.current.liveTableContext.hasNpcLines).toBe(false);
    expect(result.current.selectedNpcLines).toEqual([]);
  });

  it("sealing a player's line also seals the NPC's answer; unsealing changes only the tapped line", async () => {
    table = table.map(m => ({ ...m, selected: false }));
    const { result } = await render();
    await act(async () => { await result.current.toggleSelected(P1); });
    const seal = calls.filter(c => c.op === 'update').pop()!;
    expect(seal.args[0]).toEqual({ selected: true });
    expect(seal.filters).toEqual([['in:id', [P1, G1]]]);
    expect(result.current.messages.filter(m => m.selected).map(m => m.id)).toEqual([P1, G1]);

    await act(async () => { await result.current.toggleSelected(G1); });
    const unseal = calls.filter(c => c.op === 'update').pop()!;
    expect(unseal.args[0]).toEqual({ selected: false });
    expect(unseal.filters).toEqual([['in:id', [G1]]]);
    expect(result.current.messages.filter(m => m.selected).map(m => m.id)).toEqual([P1]);
  });

  it('posts a line as an NPC, and returns the new id', async () => {
    const { result } = await render(HOST);
    let id: string | null = null;
    await act(async () => { id = await result.current.postLine('Back off.', true, { npcId: 'npc-grukk', name: 'Grukk' }); });
    expect(id).toBe('new-line-id');
    const insert = calls.filter(c => c.op === 'insert').pop()!;
    expect(insert.args[0]).toMatchObject({ user_id: HOST, character_name: 'Grukk', content: 'Back off.', in_character: true, npc_id: 'npc-grukk' });
  });

  it("counts an NPC's new lines as unread for the host, though they are stored under the host's account", async () => {
    const { result } = await render(HOST);
    await act(async () => { await result.current.markRead('2026-10-10T12:00:01Z'); });
    // New since then: Grukk's line and Kaelen's line. The host's own line is not unread.
    expect(result.current.myUnreadCount).toBe(2);
  });

  it('a normal post has no NPC marker and still reports success', async () => {
    const { result } = await render();
    let ok = false;
    await act(async () => { ok = await result.current.sendMessage('Hello', false); });
    expect(ok).toBe(true);
    const insert = calls.filter(c => c.op === 'insert').pop()!;
    expect(insert.args[0]).toEqual({ party_id: 'party', user_id: KAEL, character_name: 'Kaelen', content: 'Hello', in_character: false, round_id: 'round' });
  });
});
