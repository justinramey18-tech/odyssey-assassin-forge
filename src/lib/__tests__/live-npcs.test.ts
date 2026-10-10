import { describe, it, expect } from 'vitest';
import {
  NPC_DEFAULT_MODEL,
  cleanNpcName,
  computeNpcScorecard,
  exchangeIds,
  inCharacterBlock,
  mentionedNpcs,
  npcModelChoices,
  npcModelLabel,
  npcNameProblem,
  npcStoryContent,
  npcsToAsk,
  readableFunctionError,
  thinkingLabel,
  type HandoffLine,
  type TableLineLike,
} from '@/lib/live-npcs';

const grukk = { id: 'n-grukk', name: 'Grukk', on_stage: true, archived: false };
const mira = { id: 'n-mira', name: 'Mira', on_stage: true, archived: false };
const mirabel = { id: 'n-mirabel', name: 'Mirabel Vane', on_stage: true, archived: false };
const offstage = { id: 'n-ollie', name: 'Ollie', on_stage: false, archived: false };

describe('NPC names', () => {
  it('cleans spaces and caps the length', () => {
    expect(cleanNpcName('  Old   Mira  ')).toBe('Old Mira');
    expect(cleanNpcName('x'.repeat(60))).toHaveLength(40);
  });

  it('explains why a name cannot be saved', () => {
    expect(npcNameProblem('   ', [])).toBe('Give the NPC a name.');
    expect(npcNameProblem('x'.repeat(41), [])).toBe('Names can be up to 40 characters.');
    expect(npcNameProblem('grukk', [grukk])).toBe('You already have an NPC called grukk.');
    expect(npcNameProblem('Grukk', [grukk], grukk.id)).toBeNull();
    expect(npcNameProblem('Grukk', [{ ...grukk, archived: true }])).toBeNull();
    expect(npcNameProblem('Brannoc', [grukk, mira])).toBeNull();
  });
});

describe('NPC models', () => {
  it('offers only models the server can run, default first', () => {
    const choices = npcModelChoices();
    expect(choices[0].id).toBe(NPC_DEFAULT_MODEL);
    expect(choices.some(c => c.id === 'google/gemini-2.5-flash')).toBe(true);
    expect(choices.some(c => c.id === 'anthropic/claude-haiku-5-5')).toBe(true);
    expect(choices.some(c => /^(openai-direct|perplexity|xai-direct)\//.test(c.id))).toBe(false);
    expect(new Set(choices.map(c => c.id)).size).toBe(choices.length);
  });

  it('labels known and unknown models', () => {
    expect(npcModelLabel(NPC_DEFAULT_MODEL)).toBe('Qwen 3.6 Plus Uncensored');
    expect(npcModelLabel('venice/some-old-model')).toBe('venice/some-old-model');
  });
});

describe('who a line is for', () => {
  it('finds @mentions in the order they appear, ignoring case', () => {
    expect(mentionedNpcs('@mira and @Grukk, look', [grukk, mira]).map(n => n.name)).toEqual(['Mira', 'Grukk']);
    expect(mentionedNpcs('Hey @GRUKK!', [grukk]).map(n => n.name)).toEqual(['Grukk']);
    expect(mentionedNpcs('(@Grukk) fine', [grukk]).map(n => n.name)).toEqual(['Grukk']);
  });

  it('does not match names inside other words or e-mail addresses', () => {
    expect(mentionedNpcs('@Grukksson', [grukk])).toEqual([]);
    expect(mentionedNpcs('mail me at bob@grukk.com', [grukk])).toEqual([]);
    expect(mentionedNpcs('Grukk, no at sign', [grukk])).toEqual([]);
  });

  it('prefers the longer name when two start the same way', () => {
    expect(mentionedNpcs('@Mirabel Vane, and you @Mira', [mira, mirabel]).map(n => n.name)).toEqual(['Mirabel Vane', 'Mira']);
    expect(mentionedNpcs('@Mirabel Vane only', [mira, mirabel]).map(n => n.name)).toEqual(['Mirabel Vane']);
  });

  it('lists an NPC once even when named twice', () => {
    expect(mentionedNpcs('@Grukk? @Grukk!', [grukk]).map(n => n.id)).toEqual([grukk.id]);
  });

  it('mentions win over a reply, and a reply wins over the chips', () => {
    const onStage = [grukk, mira];
    expect(npcsToAsk({ text: '@Mira what now?', onStage, chosenIds: [grukk.id], replyToNpcId: grukk.id }).map(n => n.name)).toEqual(['Mira']);
    expect(npcsToAsk({ text: 'what now?', onStage, chosenIds: [mira.id], replyToNpcId: grukk.id }).map(n => n.name)).toEqual(['Grukk']);
    expect(npcsToAsk({ text: 'what now?', onStage, chosenIds: [mira.id, grukk.id] }).map(n => n.name)).toEqual(['Grukk', 'Mira']);
    expect(npcsToAsk({ text: 'what now?', onStage, chosenIds: [] })).toEqual([]);
  });

  it('never asks an NPC that is off stage or archived', () => {
    const onStage = [grukk, offstage, { ...mira, archived: true }];
    expect(npcsToAsk({ text: '@Ollie hi', onStage, chosenIds: [] })).toEqual([]);
    expect(npcsToAsk({ text: 'hi', onStage, chosenIds: [offstage.id, mira.id] })).toEqual([]);
    expect(npcsToAsk({ text: 'hi', onStage, chosenIds: [], replyToNpcId: offstage.id })).toEqual([]);
  });
});

describe('sealing an exchange', () => {
  // Live Table ids are uuids; the reply marker only accepts ids like these.
  const P1 = 'aaaaaaaa-0000-4000-8000-000000000001';
  const G1 = 'aaaaaaaa-0000-4000-8000-000000000002';
  const M1 = 'aaaaaaaa-0000-4000-8000-000000000003';
  const P2 = 'aaaaaaaa-0000-4000-8000-000000000004';
  const G2 = 'aaaaaaaa-0000-4000-8000-000000000005';
  const P3 = 'aaaaaaaa-0000-4000-8000-000000000006';
  const G3 = 'aaaaaaaa-0000-4000-8000-000000000007';
  const G4 = 'aaaaaaaa-0000-4000-8000-000000000008';
  const lines: TableLineLike[] = [
    { id: P1, user_id: 'kael', content: 'Where is the pup?' },
    { id: G1, user_id: 'host', npc_id: grukk.id, content: `[reply:${P1}]\nNot telling.` },
    { id: M1, user_id: 'host', npc_id: mira.id, content: `[reply:${P1}]\nAsk the well.` },
    { id: P2, user_id: 'bran', content: 'Unrelated line.' },
    { id: G2, user_id: 'host', npc_id: grukk.id, content: 'A line the host typed as Grukk.' },
    { id: P3, user_id: 'kael', content: `[reply:${G1}]\nYou will tell me.` },
    { id: G3, user_id: 'host', npc_id: grukk.id, content: `[reply:${P3}]\nMake me.`, consumed: true },
    { id: G4, user_id: 'host', npc_id: grukk.id, content: `[reply:${M1}]\nShe lies.` },
  ];

  it("tapping a player's line seals every NPC answer to it", () => {
    expect(exchangeIds(lines, P1)).toEqual([P1, G1, M1]);
  });

  it('tapping an NPC answer seals the question and the other answers', () => {
    expect(exchangeIds(lines, G1)).toEqual([G1, P1, M1]);
  });

  it('a line with no NPC answers seals alone (unchanged behaviour)', () => {
    expect(exchangeIds(lines, P2)).toEqual([P2]);
    expect(exchangeIds(lines, G2)).toEqual([G2]);
    expect(exchangeIds(lines, 'aaaaaaaa-0000-4000-8000-000000000999')).toEqual(['aaaaaaaa-0000-4000-8000-000000000999']);
  });

  it('leaves out lines already sent to the DM', () => {
    expect(exchangeIds(lines, P3)).toEqual([P3]);
  });

  it('an NPC line answering another NPC line seals alone', () => {
    expect(exchangeIds(lines, G4)).toEqual([G4]);
  });
});

describe('the hand-off text', () => {
  // The grouping buildRoundPrompt used before Live NPCs, kept here to prove nothing changed.
  const before = (lines: HandoffLine[]) => {
    const order: string[] = [];
    const grouped = new Map<string, string[]>();
    for (const m of lines) {
      const key = m.name;
      if (!grouped.has(key)) { grouped.set(key, []); order.push(key); }
      grouped.get(key)!.push(m.text);
    }
    return order.map(name => `[${name}]: ${grouped.get(name)!.join(' ')}`).join('\n');
  };

  it('without NPC lines, the text is exactly what it was before', () => {
    const cases: HandoffLine[][] = [
      [],
      [{ name: 'Kaelen', npc: false, text: 'I draw my bow.' }],
      [
        { name: 'Kaelen', npc: false, text: 'I draw.' },
        { name: 'Brannoc', npc: false, text: '(replying to Kaelen) I charge.' },
        { name: 'Kaelen', npc: false, text: 'I fire.' },
        { name: 'Player', npc: false, text: '' },
      ],
    ];
    for (const c of cases) expect(inCharacterBlock(c)).toBe(before(c));
  });

  it('with NPC lines, every answer stays after its question', () => {
    const text = inCharacterBlock([
      { name: 'Kaelen', npc: false, text: 'Where is the pup?' },
      { name: 'Grukk', npc: true, text: '(replying to Kaelen) Not telling.' },
      { name: 'Kaelen', npc: false, text: 'Please.' },
      { name: 'Kaelen', npc: false, text: 'I mean it.' },
      { name: 'Grukk', npc: true, text: '(replying to Kaelen) Fine. The well.' },
    ]);
    expect(text).toBe([
      '[Kaelen]: Where is the pup?',
      '[Grukk (NPC)]: (replying to Kaelen) Not telling.',
      '[Kaelen]: Please. I mean it.',
      '[Grukk (NPC)]: (replying to Kaelen) Fine. The well.',
    ].join('\n'));
  });

  it("names the NPC inside its story row, because the DM's history reads only the text", () => {
    expect(npcStoryContent(' Grukk ', ' *spits* Not telling. ')).toBe('**Grukk:** *spits* Not telling.');
  });
});

describe('server errors', () => {
  const failed = (status: number, body: string) => ({ context: new Response(body, { status }) });

  it("reads the function's own message", async () => {
    expect(await readableFunctionError(failed(409, JSON.stringify({ error: "Grukk isn't on stage right now." })), 'fallback'))
      .toEqual({ message: "Grukk isn't on stage right now.", status: 409 });
  });

  it('falls back when there is no readable message', async () => {
    expect(await readableFunctionError(failed(500, 'not json'), 'Try again.')).toEqual({ message: 'Try again.', status: 500 });
    expect(await readableFunctionError(new Error('Failed to send a request'), 'Try again.')).toEqual({ message: 'Try again.', status: null });
    expect(await readableFunctionError(null, 'Try again.')).toEqual({ message: 'Try again.', status: null });
  });
});

describe('thinking label', () => {
  it('reads naturally for one, two or three NPCs', () => {
    expect(thinkingLabel([])).toBe('');
    expect(thinkingLabel(['Grukk'])).toBe('Grukk is thinking…');
    expect(thinkingLabel(['Grukk', 'Mira', 'Grukk'])).toBe('Grukk and Mira are thinking…');
    expect(thinkingLabel(['Grukk', 'Mira', 'Ollie'])).toBe('Grukk, Mira and Ollie are thinking…');
  });
});

describe('scorecard', () => {
  it('counts lines, reactions, answers, fallbacks and failures per NPC', () => {
    const P1 = 'bbbbbbbb-0000-4000-8000-000000000001';
    const G1 = 'bbbbbbbb-0000-4000-8000-000000000002';
    const G2 = 'bbbbbbbb-0000-4000-8000-000000000003';
    const P2 = 'bbbbbbbb-0000-4000-8000-000000000004';
    const P3 = 'bbbbbbbb-0000-4000-8000-000000000005';
    const P4 = 'bbbbbbbb-0000-4000-8000-000000000006';
    const score = computeNpcScorecard({
      npcs: [{ id: grukk.id, name: 'Grukk' }, { id: mira.id, name: 'Mira' }],
      lines: [
        { id: P1, npc_id: null, content: 'Where is the pup?', consumed: true },
        { id: G1, npc_id: grukk.id, content: `[reply:${P1}]\nNot telling.`, consumed: true },
        { id: G2, npc_id: grukk.id, content: 'Typed by the host.', consumed: false },
        { id: P2, npc_id: null, content: `[reply:${G1}]\nYou will.`, consumed: false },
        { id: P3, npc_id: null, content: `[reply:${G2}]\nHa.`, consumed: false },
        { id: P4, npc_id: null, content: `[reply:${P1}]\nA player answering a player.`, consumed: false },
      ],
      reactions: [
        { message_id: G1, emoji: '🤣' },
        { message_id: G1, emoji: '🤣' },
        { message_id: G1, emoji: '😈' },
        { message_id: G2, emoji: '😈' },
        { message_id: G2, emoji: '🤣' },
        { message_id: P1, emoji: '💯' },
      ],
      records: [
        { npc_id: grukk.id, reply_message_id: G1, fell_back: true, error: null, latency_ms: 3000, cost_usd: null },
        { npc_id: grukk.id, reply_message_id: null, fell_back: false, error: 'both models failed', latency_ms: 9000, cost_usd: '0.000400' },
        { npc_id: mira.id, reply_message_id: null, fell_back: false, error: null, latency_ms: null, cost_usd: 0.0012 },
      ],
    });
    expect(score[0]).toEqual({
      npcId: grukk.id,
      name: 'Grukk',
      lines: 2,
      aiLines: 1,
      asked: 2,
      fellBack: 1,
      failed: 1,
      reactions: 5,
      reactionsPerLine: 2.5,
      topEmojis: [{ emoji: '🤣', count: 3 }, { emoji: '😈', count: 2 }],
      answeredBack: 2,
      sentToDm: 1,
      sentPercent: 50,
      avgLatencyMs: 3000,
      costUsd: 0.0004,
    });
    expect(score[1]).toMatchObject({ name: 'Mira', lines: 0, asked: 1, failed: 0, reactions: 0, reactionsPerLine: 0, answeredBack: 0, sentPercent: 0, avgLatencyMs: null, costUsd: 0.0012 });
  });
});
