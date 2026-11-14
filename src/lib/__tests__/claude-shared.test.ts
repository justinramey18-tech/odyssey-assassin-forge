import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  askClaudeThenLovable,
  claudeBody,
  claudeText,
  claudeToolInput,
  cleanMessages,
  CLAUDE_MODEL,
  CLAUDE_MODEL_IDS,
  lovableBody,
  streamClaudeThenLovable,
} from '../../../supabase/functions/_shared/claude.ts';

// Server code reads Deno.env; give the test a small stand-in.
const env: Record<string, string> = {};
(globalThis as any).Deno = { env: { get: (k: string) => env[k] } };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const claudeReply = (content: unknown[]) => json({ content });
const lovableReply = (message: unknown) => json({ choices: [{ message }] });

let calls: Array<{ url: string; body: any }>;
function mockFetch(...replies: Array<Response | Error>) {
  calls = [];
  const queue = [...replies];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => {
    calls.push({ url, body: JSON.parse(init.body) });
    const next = queue.shift();
    if (!next) throw new Error('unexpected fetch');
    if (next instanceof Error) throw next;
    return next;
  }));
}

beforeEach(() => { env.LOVABLE_API_KEY = 'lovable-key'; });
afterEach(() => { vi.unstubAllGlobals(); });

const base = { system: 'SYS', messages: [{ role: 'user', content: 'hi' }], maxTokens: 500, tag: '[t]' };
const TOOL = { name: 'brief', description: 'd', input_schema: { type: 'object', properties: { a: { type: 'string' } } } };

describe('Claude request rules (Sonnet 5.5)', () => {
  it('default model is Sonnet 5.5 with between_tools, no temperature, no forced tool', () => {
    const b = claudeBody({ ...base, tools: [TOOL] });
    expect(b.model).toBe('claude-sonnet-5-5');
    expect(b.thinking).toEqual({ type: 'between_tools' });
    expect(b).not.toHaveProperty('temperature');
    expect(b).not.toHaveProperty('top_p');
    expect(b.tool_choice).toEqual({ type: 'auto' });
  });
  it('Haiku 5.5 gets thinking disabled; Sonnet 4.6 gets nothing extra', () => {
    expect(claudeBody({ ...base, model: 'claude-haiku-5-5' }).thinking).toEqual({ type: 'disabled' });
    expect(claudeBody({ ...base, model: 'claude-sonnet-4-6' })).not.toHaveProperty('thinking');
  });
  it('drops a trailing assistant turn (prefill) and turns system turns into user turns', () => {
    expect(cleanMessages([
      { role: 'system', content: 's' }, { role: 'user', content: 'u' }, { role: 'assistant', content: 'pre' },
    ])).toEqual([{ role: 'user', content: 's' }, { role: 'user', content: 'u' }]);
  });
  it('cacheSystem sends the system prompt as a cached text block', () => {
    expect(claudeBody({ ...base, cacheSystem: true }).system)
      .toEqual([{ type: 'text', text: 'SYS', cache_control: { type: 'ephemeral' } }]);
  });
  it('retired app ids move forward', () => {
    expect(CLAUDE_MODEL_IDS['anthropic/claude-sonnet-4']).toBe(CLAUDE_MODEL);
    expect(CLAUDE_MODEL_IDS['anthropic/claude-sonnet-4-5']).toBe(CLAUDE_MODEL);
    expect(CLAUDE_MODEL_IDS['anthropic/claude-haiku-4-5']).toBe('claude-haiku-5-5');
  });
});

describe('reading replies', () => {
  it('reads text even when a thinking block comes first', () => {
    expect(claudeText({ content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: 'A' }, { type: 'text', text: 'B' }] })).toBe('AB');
  });
  it('reads the named tool call', () => {
    expect(claudeToolInput({ content: [{ type: 'text', text: 'x' }, { type: 'tool_use', name: 'brief', input: { a: '1' } }] }, 'brief')).toEqual({ a: '1' });
    expect(claudeToolInput({ content: [{ type: 'tool_use', name: 'other', input: {} }] }, 'brief')).toBeNull();
  });
  it('Lovable body forces the tool and puts the system prompt first', () => {
    const b = lovableBody({ system: 'S', messages: [{ role: 'user', content: 'u' }], tools: [{ type: 'function', function: { name: 'brief', parameters: {} } }], toolName: 'brief' });
    expect(b.model).toBe('google/gemini-2.5-flash');
    expect((b.messages as any[])[0]).toEqual({ role: 'system', content: 'S' });
    expect(b.tool_choice).toEqual({ type: 'function', function: { name: 'brief' } });
  });
});

describe('askClaudeThenLovable', () => {
  it('Claude answers: no Lovable call', async () => {
    mockFetch(claudeReply([{ type: 'text', text: 'hello' }]));
    const r = await askClaudeThenLovable({ ...base, claudeKey: 'k' });
    expect(r).toEqual({ ok: true, via: 'claude', text: 'hello', toolInput: null });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain('anthropic.com');
  });
  it('Claude error (e.g. retired model, 404) falls back to the Lovable model asked for', async () => {
    mockFetch(json({ error: 'not_found' }, 404), lovableReply({ content: 'from gemini' }));
    const r = await askClaudeThenLovable({ ...base, claudeKey: 'k', fallbackModel: 'google/gemini-2.5-pro' });
    expect(r).toMatchObject({ ok: true, via: 'lovable', text: 'from gemini' });
    expect(calls[1].url).toContain('ai.gateway.lovable.dev');
    expect(calls[1].body.model).toBe('google/gemini-2.5-pro');
  });
  it('no Claude key: straight to Lovable', async () => {
    mockFetch(lovableReply({ content: 'g' }));
    const r = await askClaudeThenLovable({ ...base, claudeKey: undefined });
    expect(r).toMatchObject({ ok: true, via: 'lovable' });
    expect(calls).toHaveLength(1);
  });
  it('network failure on Claude falls back', async () => {
    mockFetch(new Error('boom'), lovableReply({ content: 'g' }));
    expect(await askClaudeThenLovable({ ...base, claudeKey: 'k' })).toMatchObject({ ok: true, via: 'lovable' });
  });
  it('empty Claude text falls back', async () => {
    mockFetch(claudeReply([{ type: 'text', text: '  ' }]), lovableReply({ content: 'g' }));
    expect(await askClaudeThenLovable({ ...base, claudeKey: 'k' })).toMatchObject({ via: 'lovable', text: 'g' });
  });
  it("a player's own key rejected (401) is reported, not hidden", async () => {
    mockFetch(json({}, 401));
    expect(await askClaudeThenLovable({ ...base, claudeKey: 'k', playerKey: true })).toMatchObject({ ok: false, status: 401 });
    expect(calls).toHaveLength(1);
  });
  it('the server key rejected (401) still falls back', async () => {
    mockFetch(json({}, 401), lovableReply({ content: 'g' }));
    expect(await askClaudeThenLovable({ ...base, claudeKey: 'k' })).toMatchObject({ ok: true, via: 'lovable' });
  });
  it('tool: Claude calls it -> tool input', async () => {
    mockFetch(claudeReply([{ type: 'tool_use', name: 'brief', input: { a: 'x' } }]));
    const r = await askClaudeThenLovable({ ...base, claudeKey: 'k', tools: [TOOL], toolName: 'brief' });
    expect(r).toMatchObject({ ok: true, via: 'claude', toolInput: { a: 'x' } });
    expect(calls[0].body.tool_choice).toEqual({ type: 'auto' });
  });
  it('tool: Claude answers in plain text -> Lovable with the tool forced', async () => {
    mockFetch(
      claudeReply([{ type: 'text', text: 'here you go' }]),
      lovableReply({ tool_calls: [{ function: { name: 'brief', arguments: '{"a":"y"}' } }] }),
    );
    const r = await askClaudeThenLovable({ ...base, claudeKey: 'k', tools: [TOOL], toolName: 'brief' });
    expect(r).toMatchObject({ ok: true, via: 'lovable', toolInput: { a: 'y' } });
    expect(calls[1].body.tool_choice).toEqual({ type: 'function', function: { name: 'brief' } });
    expect(calls[1].body.tools[0].function.name).toBe('brief');
  });
  it('both fail: a plain error with the Lovable status (429 stays 429)', async () => {
    mockFetch(json({}, 500), json({}, 429));
    expect(await askClaudeThenLovable({ ...base, claudeKey: 'k' })).toMatchObject({ ok: false, status: 429 });
  });
  it('tool: Lovable returns no tool call -> error, never an empty result', async () => {
    mockFetch(json({}, 500), lovableReply({ content: 'no tool' }));
    expect(await askClaudeThenLovable({ ...base, claudeKey: 'k', tools: [TOOL], toolName: 'brief' })).toMatchObject({ ok: false, status: 502 });
  });
});

describe('streamClaudeThenLovable', () => {
  it('Claude stream opens -> returned as Claude', async () => {
    mockFetch(new Response('data: {}\n\n', { status: 200 }));
    const r = await streamClaudeThenLovable({ ...base, claudeKey: 'k' });
    expect(r.kind).toBe('claude');
    expect(calls[0].body.stream).toBe(true);
    expect(calls[0].body.thinking).toEqual({ type: 'between_tools' });
  });
  it('Claude refuses -> Lovable stream with the fallback model', async () => {
    mockFetch(json({}, 400), new Response('data: [DONE]\n\n', { status: 200 }));
    const r = await streamClaudeThenLovable({ ...base, claudeKey: 'k', fallbackModel: 'google/gemini-2.5-pro' });
    expect(r.kind).toBe('lovable');
    expect(calls[1].body).toMatchObject({ model: 'google/gemini-2.5-pro', stream: true, max_tokens: 500 });
  });
  it('no Lovable key and no Claude key -> error, not a crash', async () => {
    delete env.LOVABLE_API_KEY;
    mockFetch();
    expect(await streamClaudeThenLovable({ ...base })).toMatchObject({ kind: 'error', status: 502 });
  });
});
