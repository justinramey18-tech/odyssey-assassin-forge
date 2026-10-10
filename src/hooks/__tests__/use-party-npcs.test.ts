import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

// Stand-ins for Supabase and the toasts, recording what the hook does.
const toasts: Array<{ kind: string; message: string; opts?: any }> = [];
vi.mock('sonner', () => ({
  toast: {
    error: (message: string, opts?: unknown) => toasts.push({ kind: 'error', message, opts }),
    info: (message: string, opts?: unknown) => toasts.push({ kind: 'info', message, opts }),
    success: (message: string, opts?: unknown) => toasts.push({ kind: 'success', message, opts }),
  },
}));

const sent: Array<{ event: string; payload: any }> = [];
let invokeResult: { data: unknown; error: unknown } = { data: { ok: true }, error: null };
let invokeCalls: Array<{ name: string; body: unknown }> = [];
let roster: Array<Record<string, unknown>> = [];
let nextError: { code?: string; message?: string } | null = null;

function query() {
  let op = 'select';
  let payload: any = null;
  const builder: any = {
    select: () => builder,
    insert: (row: unknown) => { op = 'insert'; payload = row; return builder; },
    update: (patch: unknown) => { op = 'update'; payload = patch; return builder; },
    upsert: (row: unknown) => { op = 'upsert'; payload = row; return builder; },
    eq: () => builder,
    order: () => builder,
    single: () => builder,
    maybeSingle: () => builder,
    then: (res: (v: unknown) => unknown) => {
      if (nextError) { const error = nextError; nextError = null; return Promise.resolve({ data: null, error }).then(res); }
      if (op === 'select') return Promise.resolve({ data: roster, error: null }).then(res);
      if (op === 'insert') return Promise.resolve({ data: { id: 'npc-new', sort_order: 1, created_at: '2026-10-10T12:00:00Z', on_stage: false, archived: false, ...payload }, error: null }).then(res);
      if (op === 'update') return Promise.resolve({ data: { ...roster[0], ...payload }, error: null }).then(res);
      return Promise.resolve({ data: null, error: null }).then(res);
    },
  };
  return builder;
}

vi.mock('@/integrations/supabase/client', () => {
  const channel: any = {
    on: () => channel,
    subscribe: () => channel,
    send: (msg: { event: string; payload: unknown }) => { sent.push({ event: msg.event, payload: msg.payload }); return Promise.resolve('ok'); },
  };
  return {
    supabase: {
      from: () => query(),
      channel: () => channel,
      removeChannel: () => {},
      functions: {
        invoke: async (name: string, opts: { body: unknown }) => {
          invokeCalls.push({ name, body: opts.body });
          return invokeResult;
        },
      },
      storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: () => ({ data: { publicUrl: 'https://x/p.jpg' } }) }) },
    },
  };
});

import { usePartyNpcs } from '@/hooks/use-party-npcs';

const failure = (status: number, error: string) => ({ data: null, error: { context: new Response(JSON.stringify({ error }), { status }) } });

beforeEach(() => {
  toasts.length = 0;
  sent.length = 0;
  invokeCalls = [];
  invokeResult = { data: { ok: true }, error: null };
  nextError = null;
  roster = [
    { id: 'npc-grukk', party_id: 'party', name: 'Grukk', portrait_url: null, model: 'venice/qwen-3-6-plus', on_stage: true, archived: false, sort_order: 1, created_at: '2026-10-10T10:00:00Z', updated_at: '' },
    { id: 'npc-mira', party_id: 'party', name: 'Mira', portrait_url: null, model: 'venice/qwen-3-6-plus', on_stage: false, archived: false, sort_order: 2, created_at: '2026-10-10T10:01:00Z', updated_at: '' },
  ];
});

async function render() {
  const hook = renderHook(() => usePartyNpcs('party'));
  await waitFor(() => expect(hook.result.current.loaded).toBe(true));
  return hook;
}

describe('NPC roster and asking NPCs', () => {
  it('loads the roster and knows who is on stage', async () => {
    const { result } = await render();
    expect(result.current.npcs.map(n => n.name)).toEqual(['Grukk', 'Mira']);
    expect(result.current.onStage.map(n => n.name)).toEqual(['Grukk']);
  });

  it('asks the server, and tells the other phones Grukk is thinking, then done', async () => {
    const { result } = await render();
    let ok = false;
    await act(async () => { ok = await result.current.askNpc('line-1', 'npc-grukk'); });
    expect(ok).toBe(true);
    expect(invokeCalls).toEqual([{ name: 'npc-reply', body: { messageId: 'line-1', npcId: 'npc-grukk' } }]);
    expect(sent.map(s => s.event)).toEqual(['npc-thinking', 'npc-done']);
    expect(sent[0].payload).toMatchObject({ npcId: 'npc-grukk', name: 'Grukk', messageId: 'line-1', kind: 'answer' });
    expect(result.current.thinking).toEqual([]);
    expect(toasts).toEqual([]);
  });

  it('a failed answer is never silent: the reason, with Retry', async () => {
    invokeResult = failure(502, "Grukk couldn't answer right now (Venice is out of credit; the backup model also failed). Try again in a moment.");
    const { result } = await render();
    let ok = true;
    await act(async () => { ok = await result.current.askNpc('line-1', 'npc-grukk'); });
    expect(ok).toBe(false);
    expect(toasts).toHaveLength(1);
    expect(toasts[0].kind).toBe('error');
    expect(toasts[0].message).toContain('Venice is out of credit');
    expect(toasts[0].opts.action.label).toBe('Retry');
    expect(result.current.thinking).toEqual([]);
  });

  it('a refusal (already answered, off stage) explains itself without Retry', async () => {
    invokeResult = failure(409, "Grukk isn't on stage right now.");
    const { result } = await render();
    await act(async () => { await result.current.askNpc('line-1', 'npc-grukk'); });
    expect(toasts).toEqual([{ kind: 'info', message: "Grukk isn't on stage right now.", opts: { duration: 8000 } }]);
  });

  it('several NPCs answer one after another', async () => {
    const { result } = await render();
    await act(async () => { await result.current.askNpcs('line-1', ['npc-grukk', 'npc-mira']); });
    expect(invokeCalls.map(c => (c.body as any).npcId)).toEqual(['npc-grukk', 'npc-mira']);
  });

  it('the host can regenerate a line, and a failure keeps the old line and says so', async () => {
    invokeResult = failure(502, "Grukk couldn't answer right now (both models failed). The old line was kept.");
    const { result } = await render();
    await act(async () => { await result.current.regenerateLine('reply-1', 'npc-grukk'); });
    expect(invokeCalls).toEqual([{ name: 'npc-reply', body: { action: 'regenerate', replyMessageId: 'reply-1' } }]);
    expect(toasts[0]).toMatchObject({ kind: 'error', message: expect.stringContaining('The old line was kept') });
  });

  it('a duplicate name gets a plain message', async () => {
    const { result } = await render();
    nextError = { code: '23505', message: 'duplicate key value violates unique constraint' };
    await expect(result.current.addNpc({ name: ' Grukk ' })).rejects.toThrow('You already have an NPC called Grukk.');
  });

  it('a failed stage change is put back and explained', async () => {
    const { result } = await render();
    nextError = { code: '42501', message: 'permission denied' };
    let message = '';
    await act(async () => {
      try { await result.current.setOnStage('npc-grukk', false); } catch (err) { message = (err as Error).message; }
    });
    expect(message).toBe("Only the party's host can change NPCs.");
    expect(result.current.onStage.map(n => n.name)).toEqual(['Grukk']);
  });
});
