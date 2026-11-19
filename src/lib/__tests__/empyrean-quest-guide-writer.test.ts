import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';



vi.mock('@/lib/auth-token', () => ({ getAuthToken: vi.fn(async () => 'token') }));

import { GUIDE_BACKUP_MODEL, GUIDE_MODEL, writeQuestGuide } from '@/lib/empyrean-quest-guide-writer';

import { normalizeQuest } from '@/lib/quests';



const quest = normalizeQuest('the_missing_ledger', { status: 'offered', title: 'The Missing Ledger', challengeRating: 'moderate' });

const good = `===STEPS===\n1. Meet the scribe\n2. Search the stores\n3. Confront the thief\n===COMPLETE WHEN===\nThe ledger is home.\n===FAILED WHEN===\nIt burns.\n===GUIDE===\n${'The ledger was never stolen. '.repeat(80)}`;



/** A streamed ai-dm reply (OpenAI-style chunks), split mid-line to prove the reader joins them. */

function streamed(text: string): Response {

  const parts = text.match(/[\s\S]{1,300}/g);
  if (!parts) throw new Error('Expected streamed text');
  const lines = parts.map(part => `data: ${JSON.stringify({ choices: [{ delta: { content: part } }] })}\n\n`).join('') + 'data: [DONE]\n\n';

  const bytes = new TextEncoder().encode(lines);

  const body = new ReadableStream<Uint8Array>({

    start(c) { for (let i = 0; i < bytes.length; i += 97) c.enqueue(bytes.slice(i, i + 97)); c.close(); },

  });

  return new Response(body, { status: 200 });

}



describe('writeQuestGuide', () => {

  const fetchMock = vi.fn();

  beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); });

  afterEach(() => { vi.unstubAllGlobals(); });

  const models = () => fetchMock.mock.calls.map(c => JSON.parse(c[1].body).model);



  it('asks GPT-6 Astra first and returns its guide', async () => {

    fetchMock.mockResolvedValueOnce(streamed(good));

    const r = await writeQuestGuide(quest, { characterName: 'Kylar', otherQuests: [] });

    expect(r.guide?.steps).toEqual(['Meet the scribe', 'Search the stores', 'Confront the thief']);

    expect(r.guide?.model).toBe(GUIDE_MODEL);

    expect(models()).toEqual(['openai/gpt-6-astra']);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);

    expect(body.systemPromptOverride).toContain('===GUIDE===');

    expect(body.maxTokens).toBe(16000);

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer token');

  });

  it('falls back to Claude when Astra errors or sends nothing usable', async () => {

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: 'AI gateway error' }), { status: 500 }));

    fetchMock.mockResolvedValueOnce(streamed(good));

    const r = await writeQuestGuide(quest, { characterName: 'Kylar', otherQuests: [] });

    expect(r.guide?.model).toBe(GUIDE_BACKUP_MODEL);

    expect(models()).toEqual(['openai/gpt-6-astra', 'anthropic/claude-sonnet-5-5']);



    fetchMock.mockReset();

    fetchMock.mockResolvedValueOnce(streamed('I cannot help with that.'));

    fetchMock.mockResolvedValueOnce(streamed(good));

    expect((await writeQuestGuide(quest, { characterName: 'Kylar', otherQuests: [] })).guide?.model).toBe(GUIDE_BACKUP_MODEL);

  });

  it('never throws: both writers failing gives a reason', async () => {

    fetchMock.mockRejectedValueOnce(new Error('network down'));

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Anthropic API error' }), { status: 500 }));

    const r = await writeQuestGuide(quest, { characterName: 'Kylar', otherQuests: [] });

    expect(r.guide).toBeNull();

    expect(r.error).toBe('Anthropic API error');

  });

});
