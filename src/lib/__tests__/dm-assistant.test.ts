import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseAssistantReply,
  visibleWhileStreaming,
  draftFromText,
  draftToText,
  buildAssistantMessages,
  buildAssistantSystemPrompt,
  hashText,
  isDigestCurrent,
  loadAssistantState,
  saveAssistantState,
  parseEditBlock,
  applyDraftEdits,
  draftToNumberedText,
  splitParagraphs,
  parseSuggestions,
  npcLineToStory,
  buildWeavePrompt,
  type AssistantChatMessage,
  type AssistantLiveContext,
} from '@/lib/dm-assistant';

const msg = (role: 'host' | 'assistant', text: string, draftUpdated = false): AssistantChatMessage =>
  ({ id: Math.random().toString(36), role, text, draftUpdated, createdAt: '' });

describe('parseAssistantReply', () => {
  it('splits chat text from a draft block', () => {
    const r = parseAssistantReply('Here you go.\n[[DRAFT]]\nThe door creaks open.\n[[/DRAFT]]');
    expect(r.chatText).toBe('Here you go.');
    expect(r.draftText).toBe('The door creaks open.');
  });

  it('returns no draft when the reply only answers a question', () => {
    const r = parseAssistantReply('Grapple is an Athletics check.');
    expect(r.draftText).toBeNull();
    expect(r.chatText).toBe('Grapple is an Athletics check.');
  });

  it('takes everything after an unclosed draft marker as the draft', () => {
    const r = parseAssistantReply('Drafted.\n[[DRAFT]]\nRain hammers the roof');
    expect(r.chatText).toBe('Drafted.');
    expect(r.draftText).toBe('Rain hammers the roof');
  });

  it('removes code fences around the draft', () => {
    const r = parseAssistantReply('[[DRAFT]]\n```\nThe torch gutters.\n```\n[[/DRAFT]]');
    expect(r.draftText).toBe('The torch gutters.');
  });

  it('uses the last complete draft block', () => {
    const r = parseAssistantReply('[[DRAFT]]one[[/DRAFT]] then [[DRAFT]]two[[/DRAFT]]');
    expect(r.draftText).toBe('two');
  });
});

describe('visibleWhileStreaming', () => {
  it('hides an unfinished draft from the chat bubble', () => {
    const v = visibleWhileStreaming('Working on it.\n[[DRAFT]]\nThe gate');
    expect(v.text).toBe('Working on it.');
    expect(v.writingDraft).toBe(true);
  });

  it('shows text after a finished draft', () => {
    const v = visibleWhileStreaming('Done.\n[[DRAFT]]x[[/DRAFT]]\nWant a roll too?');
    expect(v.text).toContain('Want a roll too?');
    expect(v.text).not.toContain('x');
    expect(v.writingDraft).toBe(false);
  });
});

describe('draft round trip', () => {
  it('keeps story text, roll requests and whispers', () => {
    const text = [
      'The ogre swings. Kaelen takes 7 bludgeoning damage.',
      '<!--ACTION-->Kaelen: roll a DC 14 Dexterity saving throw<!--/ACTION-->',
      '<!--WHISPER:Mira-->You recognize the sigil.<!--/WHISPER:Mira-->',
    ].join('\n\n');
    const draft = draftFromText(text);
    expect(draft.narrative).toBe('The ogre swings. Kaelen takes 7 bludgeoning damage.');
    expect(draft.whispers).toHaveLength(2);
    expect(draft.whispers[1]).toMatchObject({ type: 'whisper', target: 'Mira' });
    expect(draftFromText(draftToText(draft))).toEqual(draft);
  });
});

describe('buildAssistantMessages', () => {
  it('starts with the host and alternates', () => {
    const out = buildAssistantMessages([msg('assistant', 'hi'), msg('host', 'a'), msg('host', 'b')], 'c');
    expect(out[0].role).toBe('user');
    for (let i = 1; i < out.length; i++) expect(out[i].role).not.toBe(out[i - 1].role);
    expect(out[out.length - 1].content).toContain('c');
  });

  it('never re-sends old drafts, only a note that one was made', () => {
    const out = buildAssistantMessages([msg('host', 'draft it'), msg('assistant', 'Done.', true)], 'shorter');
    expect(out[1].content).toContain('(I updated the draft.)');
  });
});

describe('buildAssistantSystemPrompt', () => {
  const longPost = 'A'.repeat(40_000) + ' THE END';
  const ctx: AssistantLiveContext = {
    roster: [{ user_id: 'u1', character_name: 'Kaelen', character_status: { level: 5, className: 'Rogue', currentHP: 30, maxHP: 38 } }],
    campaignSummary: 'The party reached Varn.',
    memoryAnchors: '',
    quests: [],
    worldState: [],
    story: [
      { role: 'assistant', content: 'old post' },
      { role: 'user', content: '[Kaelen]: I sneak in', sender_name: 'Kaelen' },
      { role: 'user', content: 'secret', team: 'whisper:u1:u2' },
      { role: 'assistant', content: longPost },
    ],
    tableLines: [
      { id: 'a', characterName: 'Kaelen', content: 'I pick the lock', inCharacter: true, sealed: true, sent: false, createdAt: '' },
      { id: 'b', characterName: 'Mira', content: 'lol', inCharacter: false, sealed: false, sent: true, createdAt: '' },
    ],
    sealedOrder: ['a'],
    guides: 'RULE ONE',
  };

  it('sends the latest post trimmed from the front, not the whole story', () => {
    const { systemPrompt } = buildAssistantSystemPrompt(ctx, { mode: 'digest', text: 'digest' }, { narrative: '', whispers: [] });
    expect(systemPrompt).toContain('THE END');
    expect(systemPrompt).not.toContain('old post');
    expect(systemPrompt.length).toBeLessThan(30_000);
  });

  it('never includes private player whispers', () => {
    const { systemPrompt } = buildAssistantSystemPrompt(ctx, { mode: 'none', text: '' }, { narrative: '', whispers: [] });
    expect(systemPrompt).not.toContain('secret');
  });

  it('marks sealed lines and counts them', () => {
    const built = buildAssistantSystemPrompt(ctx, { mode: 'none', text: '' }, { narrative: '', whispers: [] });
    expect(built.sealedCount).toBe(1);
    expect(built.systemPrompt).toContain('[SEALED #1] Kaelen: I pick the lock');
    expect(built.systemPrompt).toContain('1. Kaelen: I pick the lock');
  });
});

describe('digest cache', () => {
  it('is current only for the exact same guides', () => {
    const rec = { hash: hashText('rules'), text: 'd', builtAt: '', model: 'm' };
    expect(isDigestCurrent(rec, 'rules')).toBe(true);
    expect(isDigestCurrent(rec, 'rules changed')).toBe(false);
    expect(isDigestCurrent(null, 'rules')).toBe(false);
  });
});

describe('saved state', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips per party and ignores junk', () => {
    saveAssistantState('p1', { messages: [msg('host', 'hi')], draft: { narrative: 'n', whispers: [] } });
    expect(loadAssistantState('p1').messages).toHaveLength(1);
    expect(loadAssistantState('p2').messages).toHaveLength(0);
    localStorage.setItem('odyssey-dm-assistant:p3', '{bad json');
    expect(loadAssistantState('p3').draft.narrative).toBe('');
  });
});

describe('small edits', () => {
  const draft = {
    narrative: 'One.\n\nTwo.\n\nThree.',
    whispers: [
      { type: 'action' as const, content: 'Kaelen: roll a DC 14 Perception check' },
      { type: 'whisper' as const, target: 'Mira', content: 'You know this sigil.' },
    ],
  };

  it('numbers paragraphs and whispers for the assistant', () => {
    const text = draftToNumberedText(draft);
    expect(text).toContain('¶1 One.');
    expect(text).toContain('¶3 Three.');
    expect(text).toContain('W2 <!--WHISPER:Mira-->You know this sigil.<!--/WHISPER:Mira-->');
  });

  it('reads edit commands in loose forms', () => {
    expect(parseEditBlock('REPLACE ¶2\nNew two.')).toMatchObject({ op: 'replace', target: 'paragraph', index: 2, body: 'New two.' });
    expect(parseEditBlock('insert after paragraph 0\nStart.')).toMatchObject({ op: 'insert', index: 0 });
    expect(parseEditBlock('**DELETE W1**')).toMatchObject({ op: 'delete', target: 'whisper', index: 1 });
    expect(parseEditBlock('ADD W\n<!--TACTICS-->Flank left<!--/TACTICS-->')).toMatchObject({ op: 'add', target: 'whisper' });
    expect(parseEditBlock('REPLACE ¶2')).toBeNull(); // no new text
    expect(parseEditBlock('MAKE IT BETTER')).toBeNull();
  });

  it('changes only the paragraph asked for', () => {
    const out = applyDraftEdits(draft, [parseEditBlock('REPLACE ¶2\nA scarier two.')!]);
    expect(splitParagraphs(out.draft.narrative)).toEqual(['One.', 'A scarier two.', 'Three.']);
    expect(out.draft.whispers).toEqual(draft.whispers);
    expect(out.changedParagraphs).toEqual([1]);
  });

  it('uses the original numbers for every edit in one reply', () => {
    const out = applyDraftEdits(draft, [
      parseEditBlock('DELETE ¶1')!,
      parseEditBlock('REPLACE ¶3\nNew three.')!,
      parseEditBlock('INSERT AFTER ¶0\nOpening.')!,
    ]);
    expect(splitParagraphs(out.draft.narrative)).toEqual(['Opening.', 'Two.', 'New three.']);
    expect(out.changedParagraphs).toEqual([0, 2]);
  });

  it('edits whispers and skips bad numbers without touching the draft', () => {
    const out = applyDraftEdits(draft, [
      parseEditBlock('DELETE W1')!,
      parseEditBlock('ADD W\n<!--WHISPER:Kaelen-->Behind you.<!--/WHISPER:Kaelen-->')!,
      parseEditBlock('REPLACE ¶9\nNope.')!,
    ]);
    expect(out.draft.whispers.map(w => w.content)).toEqual(['You know this sigil.', 'Behind you.']);
    expect(out.skipped).toEqual(['¶9']);
    expect(out.applied).toEqual(['removed W1', 'added a roll or whisper']);
    expect(out.draft.narrative).toBe(draft.narrative);
  });

  it('pulls edit blocks out of the chat text', () => {
    const r = parseAssistantReply('Made the ogre meaner.\n[[EDIT]]\nREPLACE ¶2\nThe ogre snarls.\n[[/EDIT]]');
    expect(r.chatText).toBe('Made the ogre meaner.');
    expect(r.draftText).toBeNull();
    expect(r.edits).toHaveLength(1);
    expect(visibleWhileStreaming('Made it.\n[[EDIT]]\nREPLACE ¶2\nThe og').writingDraft).toBe(true);
  });
});

describe('modes', () => {
  const ctx: AssistantLiveContext = {
    roster: [], story: [], tableLines: [], sealedOrder: [], guides: '',
  };
  it('puts the mode last and forbids drafting while brainstorming', () => {
    const b = buildAssistantSystemPrompt(ctx, { mode: 'none', text: '' }, { narrative: '', whispers: [] }, 'brainstorm').systemPrompt;
    expect(b.trimEnd().endsWith('Tapping it switches to Draft mode.')).toBe(true);
    expect(b).toContain('MODE: BRAINSTORM');
    const d = buildAssistantSystemPrompt(ctx, { mode: 'none', text: '' }, { narrative: '', whispers: [] }, 'draft').systemPrompt;
    expect(d).toContain('REPLACE ¶n');
  });
});

describe('tap-to-reply suggestions', () => {
  it('pulls up to 3 suggestions out of the reply', () => {
    const r = parseAssistantReply('Three ideas.\n[[NEXT]]\n- Go with option 2\n2. "Make it darker"\nDraft: go with 1\nOne too many\n[[/NEXT]]');
    expect(r.chatText).toBe('Three ideas.');
    expect(r.suggestions).toEqual(['Go with option 2', 'Make it darker', 'Draft: go with 1']);
  });

  it('works after edit blocks and when the closing marker is missing', () => {
    const r = parseAssistantReply('Done.\n[[EDIT]]\nREPLACE ¶1\nNew.\n[[/EDIT]]\n[[NEXT]]\nShorten ¶2\nAdd a roll');
    expect(r.edits).toHaveLength(1);
    expect(r.suggestions).toEqual(['Shorten ¶2', 'Add a roll']);
    expect(r.chatText).toBe('Done.');
  });

  it('hides the list while streaming and skips junk lines', () => {
    expect(visibleWhileStreaming('Sure.\n[[NEXT]]\nGo').text).toBe('Sure.');
    expect(parseSuggestions('\n\n' + 'x'.repeat(90) + '\nok\nOK')).toEqual(['ok']);
  });
});

describe('alternate versions and dice requests', () => {
  it('reads a TAKES block and leaves the draft alone', () => {
    const r = parseAssistantReply('Three ways.\n[[TAKES ¶2]]\nVersion 1: Grim.\n---\nVersion 2: Wry.\n---\nTender.\n[[/TAKES]]\n[[NEXT]]\nKeep the grim one\n[[/NEXT]]');
    expect(r.takes).toEqual({ paragraph: 2, options: ['Grim.', 'Wry.', 'Tender.'] });
    expect(r.edits).toHaveLength(0);
    expect(r.draftText).toBeNull();
    expect(r.chatText).toBe('Three ways.');
    expect(r.suggestions).toEqual(['Keep the grim one']);
  });

  it('collects roll requests and hides them while streaming', () => {
    const r = parseAssistantReply("Grukk swings.\n[[ROLL]]\nGrukk's attack: 1d20+5\nDamage: 2d8+3\n[[/ROLL]]");
    expect(r.rolls).toEqual(["Grukk's attack: 1d20+5", 'Damage: 2d8+3']);
    expect(r.chatText).toBe('Grukk swings.');
    expect(visibleWhileStreaming('Grukk swings.\n[[ROLL]]\nGru').text).toBe('Grukk swings.');
  });
});

describe('NPC rehearsal', () => {
  it('turns a rehearsed line into tagged story text', () => {
    expect(npcLineToStory('Grukk', '*backs away* "Who wakes Grukk?" *clutches the pup*'))
      .toBe('Grukk backs away. [VOICE:Grukk]"Who wakes Grukk?"[/VOICE] Grukk clutches the pup.');
    expect(npcLineToStory('Grukk', '*He sighs* Fine.')).toBe('He sighs. [VOICE:Grukk]"Fine."[/VOICE]');
  });

  it('asks to weave only what was picked, at the aimed spot', () => {
    const p = buildWeavePrompt('Grukk', [{ who: 'party', text: 'Kaelen: easy, big guy' }, { who: 'npc', text: 'Go away!' }], 3);
    expect(p).toContain('Insert it after ¶3.');
    expect(p).toContain('Grukk: Go away!');
    expect(p).toContain('Party: Kaelen: easy, big guy');
  });

  it('becomes the NPC in the brief and keeps persona last', () => {
    const ctx: AssistantLiveContext = { roster: [], story: [], tableLines: [], sealedOrder: [], guides: '' };
    const sp = buildAssistantSystemPrompt(ctx, { mode: 'none', text: '' }, { narrative: '', whispers: [] }, 'brainstorm', { npc: 'Grukk', persona: 'editor' }).systemPrompt;
    expect(sp).toContain('MODE: NPC REHEARSAL WITH GRUKK');
    expect(sp).not.toContain('MODE: BRAINSTORM');
    expect(sp.trimEnd().endsWith('always say how to fix it.')).toBe(true);
  });

  it('labels rehearsal lines and dice results in the history', () => {
    const out = buildAssistantMessages([
      { id: 'a', role: 'host', text: 'Where is the pup?', npc: 'Grukk', createdAt: '' },
      { id: 'b', role: 'assistant', text: 'Not telling!', npc: 'Grukk', createdAt: '' },
      { id: 'c', role: 'host', text: '', roll: { label: 'Insight', expr: '1d20+3', spec: { count: 1, sides: 20, modifier: 3, mode: 'normal' }, rolls: [12], kept: [12], total: 15, crit: null }, createdAt: '' },
    ], 'Continue.');
    expect(out[0].content).toBe('[to Grukk] Where is the pup?');
    expect(out[1].content).toBe('[as Grukk] Not telling!');
    expect(out[2].content).toContain('Dice (rolled by the app): Insight: 1d20+3 → 12 + 3 = 15');
  });
});
