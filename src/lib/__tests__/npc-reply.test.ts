import { describe, it, expect } from 'vitest';
import {
  NPC_FALLBACK_MODEL,
  addressedText,
  buildNpcSystemPrompt,
  buildNpcUserMessage,
  cleanNpcReply,
  paragraphsAbout,
  readableText,
  type NpcPromptInput,
} from '../../../supabase/functions/npc-reply/prompt.ts';
import { createModelCaller } from '../../../supabase/functions/npc-reply/models.ts';
import { generateWithFallback, speak, regenerate, type Deps } from '../../../supabase/functions/npc-reply/handler.ts';
import type { NpcRepo, RoundLine } from '../../../supabase/functions/npc-reply/repo.ts';

const LINE = '11111111-1111-4111-8111-111111111111';
const NPC = '22222222-2222-4222-8222-222222222222';
const PLAYER = '33333333-3333-4333-8333-333333333333';
const HOST = '44444444-4444-4444-8444-444444444444';
const PARTY = '55555555-5555-4555-8555-555555555555';
const NOW = Date.parse('2026-10-10T12:00:00Z');

const input = (over: Partial<NpcPromptInput> = {}): NpcPromptInput => ({
  npcName: 'Grukk',
  guide: 'A gruff orc smith. Speaks in short growls.',
  secrets: 'He hid the pup in the well.',
  cast: ['Mira'],
  worldBible: 'The town of Varn sits on a river.\n\nGrukk owes the guild money.\n\nThe guild is corrupt.',
  anchors: '[NPC] Grukk: distrusts elves',
  summary: 'The party reached Varn.',
  latestPost: 'Rain falls.<!--WHISPER:Mira-->Secret for Mira<!--/WHISPER:Mira--> [VOICE:Grukk]"Who goes?"[/VOICE]',
  roster: [{ name: 'Kaelen', race: 'Elf', className: 'Rogue', level: 5 }],
  table: [
    { speaker: 'Kaelen', npc: false, inCharacter: true, content: 'We should find the pup.' },
    { speaker: 'Brannoc', npc: false, inCharacter: false, content: 'brb pizza' },
    { speaker: 'Mira', npc: true, inCharacter: true, content: '[reply:aaaaaaaa-aaaa]\nAsk the smith.' },
  ],
  speakerName: 'Kaelen',
  line: '@Grukk, where is the pup?',
  ...over,
});

describe('what the NPC reads', () => {
  it('cleans stored text: no whispers, hidden tags, reply markers or voice tags', () => {
    expect(readableText('Rain.<!--WHISPER:Mira-->secret<!--/WHISPER:Mira--><!--BURNOUT:2--> [VOICE:Grukk]"Hi"[/VOICE]')).toBe('Rain. "Hi"');
    expect(readableText('[reply:aaaaaaaa-aaaa]\nAsk the smith.')).toBe('Ask the smith.');
    expect(readableText('⟪AC⟫{"action":"Fireball"}⟪/AC⟫\nI cast Fireball')).toBe('I cast Fireball');
    expect(readableText('[image:https://x/y.png]')).toBe('(shares a picture)');
  });

  it("drops the @name the player used, and finds the World Bible's paragraphs about the NPC", () => {
    expect(addressedText('@Grukk, where is the pup?', 'Grukk')).toBe('where is the pup?');
    expect(addressedText('@grukk where?', 'Grukk')).toBe('where?');
    expect(paragraphsAbout('Grukk owes money.\n\nGrukkson is another orc.\n\nNothing here.', 'Grukk', 1000)).toBe('Grukk owes money.');
  });

  it('builds the instructions with the guide, secrets, limits, cast, party and canon', () => {
    const sp = buildNpcSystemPrompt(input());
    expect(sp).toContain('You are Grukk');
    expect(sp).toContain('YOUR SECRETS');
    expect(sp).toContain('He hid the pup in the well.');
    expect(sp).toContain('Adults only.');
    expect(sp).toContain('OTHER NPCs PRESENT\nMira.');
    expect(sp).toContain('- Kaelen (Elf Rogue, level 5)');
    expect(sp).toContain('WHAT THE WORLD BIBLE SAYS ABOUT GRUKK\nGrukk owes the guild money.');
    expect(sp).toContain('[NPC] Grukk: distrusts elves');
    expect(sp).toContain('Rain falls.');
    expect(sp).not.toContain('Secret for Mira');
    expect(buildNpcSystemPrompt(input({ secrets: '' }))).not.toContain('YOUR SECRETS');
  });

  it('shows the recent table and the line to answer', () => {
    const um = buildNpcUserMessage(input());
    expect(um).toContain('Kaelen: We should find the pup.');
    expect(um).toContain('Brannoc (table talk): brb pizza');
    expect(um).toContain('Mira (NPC): Ask the smith.');
    expect(um).toContain('Now Kaelen says to Grukk: "where is the pup?"');
  });
});

describe('cleaning what the NPC says', () => {
  it('removes thinking, labels, fences and tags', () => {
    expect(cleanNpcReply('<think>plan</think>*spits* Not telling.', 'Grukk')).toBe('*spits* Not telling.');
    expect(cleanNpcReply('reasoning here</think>Go away.', 'Grukk')).toBe('Go away.');
    expect(cleanNpcReply('**Grukk:** "Go away."', 'Grukk')).toBe('"Go away."');
    expect(cleanNpcReply('Grukk says: Fine.', 'Grukk')).toBe('Fine.');
    expect(cleanNpcReply('```\nHm.\n```', 'Grukk')).toBe('Hm.');
    expect(cleanNpcReply('<think>never closed', 'Grukk')).toBe('');
    expect(cleanNpcReply('   ', 'Grukk')).toBe('');
  });

  it('keeps long answers to about 1,500 characters, ending on a sentence', () => {
    const long = 'Word word word. '.repeat(200);
    const out = cleanNpcReply(long, 'Grukk');
    expect(out.length).toBeLessThanOrEqual(1500);
    expect(out.endsWith('.')).toBe(true);
  });
});

describe('falling back to Gemini Flash', () => {
  it("uses the NPC's model when it works", async () => {
    const r = await generateWithFallback('venice/qwen-3-6-plus', 's', 'u', 'Grukk', async () => ({ ok: true, text: 'Hm.', costUsd: 0.001 }));
    expect(r).toMatchObject({ ok: true, text: 'Hm.', modelUsed: 'venice/qwen-3-6-plus', fellBack: false, costUsd: 0.001 });
  });

  it('falls back when Venice is out of credit, or answers with nothing', async () => {
    const calls: string[] = [];
    const out = await generateWithFallback('venice/qwen-3-6-plus', 's', 'u', 'Grukk', async (m) => {
      calls.push(m);
      return m === NPC_FALLBACK_MODEL ? { ok: true, text: 'Fine.', costUsd: null } : { ok: false, reason: 'Venice is out of credit' };
    });
    expect(calls).toEqual(['venice/qwen-3-6-plus', 'google/gemini-2.5-flash']);
    expect(out).toMatchObject({ ok: true, modelUsed: 'google/gemini-2.5-flash', fellBack: true, fallbackReason: 'Venice is out of credit' });
    const empty = await generateWithFallback('venice/qwen-3-6-plus', 's', 'u', 'Grukk', async (m) =>
      ({ ok: true, text: m === NPC_FALLBACK_MODEL ? 'Fine.' : '<think>only thinking</think>', costUsd: null }));
    expect(empty).toMatchObject({ ok: true, fellBack: true, fallbackReason: 'venice/qwen-3-6-plus gave an empty answer' });
  });

  it('reports both failures instead of posting nothing', async () => {
    const out = await generateWithFallback('venice/qwen-3-6-plus', 's', 'u', 'Grukk', async (m) =>
      ({ ok: false, reason: m === NPC_FALLBACK_MODEL ? 'Lovable AI credits are out' : 'Venice is out of credit' }));
    expect(out).toEqual({ ok: false, error: 'Venice is out of credit; the backup model also failed (Lovable AI credits are out)' });
  });
});

describe('calling the models with server keys', () => {
  const fakeFetch = (status: number, body: unknown, seen: Array<{ url: string; body: any; headers: any }>) =>
    (async (url: string, init: RequestInit) => {
      seen.push({ url, body: JSON.parse(String(init.body)), headers: init.headers });
      return new Response(JSON.stringify(body), { status });
    }) as unknown as typeof fetch;

  it('asks Venice without its own system prompt, thinking or web search', async () => {
    const seen: any[] = [];
    const call = createModelCaller({ VENICE_API_KEY: 'v' }, fakeFetch(200, { choices: [{ message: { content: 'Hm.' } }], cost: { usd: 0.0004 } }, seen));
    expect(await call('venice/qwen-3-6-plus', 'S', 'U')).toEqual({ ok: true, text: 'Hm.', costUsd: 0.0004 });
    expect(seen[0].url).toBe('https://api.venice.ai/api/v1/chat/completions');
    expect(seen[0].body).toMatchObject({
      model: 'qwen-3-6-plus',
      stream: false,
      messages: [{ role: 'system', content: 'S' }, { role: 'user', content: 'U' }],
      venice_parameters: { include_venice_system_prompt: false, disable_thinking: true, enable_web_search: 'off' },
    });
  });

  it('turns provider errors into plain reasons', async () => {
    const seen: any[] = [];
    expect(await createModelCaller({ VENICE_API_KEY: 'v' }, fakeFetch(402, {}, seen))('venice/qwen-3-6-plus', 'S', 'U'))
      .toEqual({ ok: false, reason: 'Venice is out of credit' });
    expect(await createModelCaller({}, fakeFetch(200, {}, seen))('venice/qwen-3-6-plus', 'S', 'U'))
      .toEqual({ ok: false, reason: 'no Venice key on the server (VENICE_API_KEY)' });
    expect(await createModelCaller({ LOVABLE_API_KEY: 'l' }, fakeFetch(402, {}, seen))('google/gemini-2.5-flash', 'S', 'U'))
      .toEqual({ ok: false, reason: 'Lovable AI credits are out' });
    expect(await createModelCaller({}, fakeFetch(200, {}, seen))('openai-direct/gpt-5', 'S', 'U'))
      .toEqual({ ok: false, reason: "the model openai-direct/gpt-5 can't run on the server" });
  });

  it('reads the gateway and Claude answers, including text-part lists', async () => {
    const seen: any[] = [];
    expect(await createModelCaller({ LOVABLE_API_KEY: 'l' }, fakeFetch(200, { choices: [{ message: { content: [{ type: 'text', text: 'A' }, { type: 'text', text: 'B' }] } }] }, seen))('google/gemini-2.5-flash', 'S', 'U'))
      .toEqual({ ok: true, text: 'AB', costUsd: null });
    expect(await createModelCaller({ ANTHROPIC_API_KEY: 'a' }, fakeFetch(200, { content: [{ type: 'thinking', thinking: 'x' }, { type: 'text', text: 'Hi.' }] }, seen))('anthropic/claude-haiku-5-5', 'S', 'U'))
      .toEqual({ ok: true, text: 'Hi.', costUsd: null });
    const claude = seen[seen.length - 1];
    expect(claude.body).toMatchObject({ model: 'claude-haiku-5-5', system: 'S', thinking: { type: 'disabled' }, output_config: { effort: 'low' } });
  });
});

describe('who may ask', () => {
  const line = (over: Partial<RoundLine> = {}): RoundLine => ({
    id: LINE, party_id: PARTY, user_id: PLAYER, character_name: 'Kaelen', content: '@Grukk hi', in_character: true,
    round_id: 'r', consumed: false, selected: false, created_at: new Date(NOW - 60_000).toISOString(), npc_id: null, ...over,
  });
  const repo = (over: Partial<NpcRepo> = {}): NpcRepo => ({
    getLine: async () => line(),
    getPartyHost: async () => HOST,
    isMember: async () => true,
    getNpc: async () => ({ id: NPC, party_id: PARTY, name: 'Grukk', model: 'venice/qwen-3-6-plus', on_stage: true, archived: false }),
    getGuide: async () => ({ guide: 'g', secrets: '' }),
    listStageNames: async () => ['Grukk'],
    loadContext: async () => ({ guides: [], anchors: [], summary: '', latestPost: '', roster: [], table: [] }),
    claim: async () => 'claimed',
    insertNpcLine: async () => 'reply-id',
    updateNpcLine: async () => {},
    finish: async () => {},
    findReplyRecord: async () => null,
    ...over,
  });
  const deps = (r: NpcRepo): Deps => ({ repo: r, callModel: async () => ({ ok: true, text: 'Hm.', costUsd: null }), now: () => NOW });
  const ask = (r: NpcRepo, userId = PLAYER) => speak({ userId, messageId: LINE, npcId: NPC }, deps(r));

  it('answers a seated player about their own in-character line', async () => {
    let posted: any;
    const r = await ask(repo({ insertNpcLine: async (row) => { posted = row; return 'reply-id'; } }));
    expect(r.status).toBe(200);
    expect(posted).toMatchObject({ user_id: HOST, character_name: 'Grukk', npc_id: NPC, in_character: true, content: `[reply:${LINE}]\nHm.` });
  });

  it('refuses everything else with a plain reason', async () => {
    expect((await speak({ userId: PLAYER, messageId: 'nope', npcId: NPC }, deps(repo()))).status).toBe(400);
    expect((await ask(repo(), HOST)).status).toBe(403);
    expect((await ask(repo({ getLine: async () => line({ in_character: false }) }))).status).toBe(409);
    expect((await ask(repo({ getLine: async () => line({ consumed: true }) }))).status).toBe(409);
    expect((await ask(repo({ getLine: async () => line({ created_at: new Date(NOW - 16 * 60_000).toISOString() }) }))).status).toBe(409);
    expect((await ask(repo({ isMember: async () => false }))).status).toBe(403);
    expect((await ask(repo({ getNpc: async () => ({ id: NPC, party_id: PARTY, name: 'Grukk', model: 'm', on_stage: false, archived: false }) }))).body.error)
      .toBe("Grukk isn't on stage right now.");
    expect((await ask(repo({ getNpc: async () => ({ id: NPC, party_id: 'other', name: 'Grukk', model: 'm', on_stage: true, archived: false }) }))).status).toBe(404);
    expect((await ask(repo({ claim: async () => 'taken' }))).status).toBe(409);
  });

  it('lets only the host regenerate', async () => {
    const record = { id: 'x', party_id: PARTY, npc_id: NPC, prompt_message_id: LINE, reply_message_id: '66666666-6666-4666-8666-666666666666' };
    const r = repo({ findReplyRecord: async () => record });
    expect((await regenerate({ userId: PLAYER, replyMessageId: record.reply_message_id }, deps(r))).status).toBe(403);
    expect((await regenerate({ userId: HOST, replyMessageId: record.reply_message_id }, deps(r))).status).toBe(200);
  });
});
