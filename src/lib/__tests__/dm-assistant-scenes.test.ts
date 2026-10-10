import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildAssistantSystemPrompt,
  buildSessionMessages,
  loadAssistantState,
  parseAssistantReply,
  saveAssistantState,
  type AssistantChatMessage,
  type AssistantLiveContext,
} from '@/lib/dm-assistant';
import {
  buildSceneWeavePrompt,
  castLabel,
  isOutOfCharacter,
  sceneToStory,
  splitSpeaker,
  type SceneLine,
} from '@/lib/dm-assistant-scenes';

const msg = (role: 'host' | 'assistant', text: string, extra: Partial<AssistantChatMessage> = {}): AssistantChatMessage =>
  ({ id: Math.random().toString(36), role, text, createdAt: '', ...extra });

const scene: SceneLine[] = [
  { speaker: '', npc: false, text: 'Kaelen: where is the pup?' },
  { speaker: 'Grukk', npc: true, text: '*backs away* Not telling!' },
  { speaker: '', npc: false, text: '(make Mira cut in)' },
  { speaker: 'Mira', npc: true, text: 'He hid it in the well.' },
  { speaker: '', npc: false, text: 'We should hurry.' },
];

describe('whole-session memory', () => {
  it('sends every turn since the last post, not just the last 16', () => {
    const history: AssistantChatMessage[] = [];
    for (let i = 0; i < 40; i++) history.push(msg(i % 2 ? 'assistant' : 'host', `turn ${i}`));
    const out = buildSessionMessages(history, 'next');
    expect(out.omittedTurns).toBe(0);
    expect(out.messages).toHaveLength(41);
    expect(out.messages[0].content).toBe('turn 0');
  });

  it('counts what it had to leave out when a session is huge', () => {
    const history = [msg('host', 'a'.repeat(100)), msg('assistant', 'b'.repeat(100)), msg('host', 'c'.repeat(100))];
    const out = buildSessionMessages(history, 'next', 150);
    expect(out.omittedTurns).toBe(2);
    expect(out.messages[0].role).toBe('user');
  });

  it('saves the whole session on the phone', () => {
    localStorage.clear();
    const many = Array.from({ length: 60 }, (_, i) => msg('host', `m${i}`));
    expect(saveAssistantState('p1', { messages: many, draft: { narrative: '', whispers: [] } })).toBe(true);
    expect(loadAssistantState('p1').messages).toHaveLength(60);
  });
});

describe('edits the app cannot read', () => {
  it('lists them instead of dropping them', () => {
    const r = parseAssistantReply('Merged.\n[[EDIT]]\nREPLACE ¶4, ¶9\nX\n[[/EDIT]]\n[[EDIT]]\nINSERT AFTER ¶2\nC\n[[/EDIT]]');
    expect(r.edits.map(e => e.label)).toEqual(['INSERT AFTER ¶2']);
    expect(r.unreadableEdits).toEqual(['REPLACE ¶4, ¶9']);
  });

  it('reads the range a merge needs', () => {
    const r = parseAssistantReply('Merged.\n[[EDIT]]\nREPLACE ¶4-¶6\nA\n\nB\n[[/EDIT]]');
    expect(r.edits[0]).toMatchObject({ op: 'replace', index: 4, end: 6 });
    expect(r.unreadableEdits).toEqual([]);
  });
});

describe('scenes with several NPCs', () => {
  it('names the cast', () => {
    expect(castLabel(['Grukk'])).toBe('Grukk');
    expect(castLabel(['Grukk', 'Mira', 'Tobb'])).toBe('Grukk, Mira and Tobb');
  });

  it('splits a named speaker and spots notes to the assistant', () => {
    expect(splitSpeaker('Kaelen: where is it?')).toEqual({ name: 'Kaelen', words: 'where is it?' });
    expect(splitSpeaker('We should go: now.')).toEqual({ name: '', words: 'We should go: now.' });
    expect(isOutOfCharacter('(make him nervous)')).toBe(true);
    expect(isOutOfCharacter('OOC: shorter')).toBe(true);
    expect(isOutOfCharacter('Kaelen: hi')).toBe(false);
  });

  it('adds every line as-is, in order, with both sides of the talk', () => {
    expect(sceneToStory(scene).split('\n\n')).toEqual([
      '[VOICE:Kaelen]"where is the pup?"[/VOICE]',
      'Grukk backs away. [VOICE:Grukk]"Not telling!"[/VOICE]',
      '[VOICE:Mira]"He hid it in the well."[/VOICE]',
      'We should hurry.',
    ]);
  });

  it('asks the weave to keep every line word for word', () => {
    const p = buildSceneWeavePrompt(['Grukk', 'Mira'], scene, 3);
    expect(p).toContain('with Grukk and Mira');
    expect(p).toContain('word for word and in this order');
    expect(p).toContain('INSERT AFTER ¶3');
    expect(p).toContain('Kaelen: where is the pup?\nGrukk: *backs away* Not telling!\nMira: He hid it in the well.\nParty: We should hurry.');
    expect(p).not.toContain('make Mira cut in');
  });

  it('tells the NPC who else is in the scene', () => {
    const ctx: AssistantLiveContext = { roster: [], story: [], tableLines: [], sealedOrder: [], guides: '' };
    const sp = buildAssistantSystemPrompt(ctx, { mode: 'none', text: '' }, { narrative: '', whispers: [] }, 'brainstorm', { npc: 'Mira', cast: ['Grukk', 'Mira'] }).systemPrompt;
    expect(sp).toContain('MODE: NPC REHEARSAL WITH MIRA');
    expect(sp).toContain('This scene also has Grukk.');
  });

  it('flags a draft too long to see whole', () => {
    const ctx: AssistantLiveContext = { roster: [], story: [], tableLines: [], sealedOrder: [], guides: '' };
    const long = { narrative: 'x'.repeat(33_000), whispers: [] };
    expect(buildAssistantSystemPrompt(ctx, { mode: 'none', text: '' }, long).draftTrimmed).toBe(true);
    expect(buildAssistantSystemPrompt(ctx, { mode: 'none', text: '' }, { narrative: 'short', whispers: [] }).draftTrimmed).toBe(false);
  });
});
