import { describe, expect, it } from 'vitest';
import {
  HANDOFF_WORDS, directionsSig, liveNpcDmGuide, parseDirections, parseHandoffScene, soloHandoffFormat, stripLiveTags, tableStateForDm,
} from '@/lib/live-npc-tandem';

describe('DM directions', () => {
  const post = [
    'Dain steps between you and the door. Somewhere far off, Xaden is still at Samara.',
    '',
    '<!--LIVE:STAGE Dain Aetos; Rhiannon Matthias-->',
    '<!--LIVE:ROOM tense-->',
    '<!--LIVE:CUE Dain Aetos | he wants to know where you were last night-->',
    '<!--LIVE:HUDDLE Dain Aetos + Rhiannon Matthias | whether to report it-->',
  ].join('\n');

  it('reads the stage, the room, cues and a huddle, and the story hides them', () => {
    expect(parseDirections(post)).toEqual({
      stage: ['Dain Aetos', 'Rhiannon Matthias'],
      room: 'tense',
      cues: [{ name: 'Dain Aetos', reason: 'he wants to know where you were last night' }],
      huddle: { a: 'Dain Aetos', b: 'Rhiannon Matthias', about: 'whether to report it' },
    });
    expect(stripLiveTags(post)).not.toContain('LIVE:');
    expect(stripLiveTags(post)).toContain('still at Samara');
  });

  it('an empty stage is a stage; no STAGE direction means fall back; bad directions are ignored', () => {
    expect(parseDirections('Alone at last.\n<!--LIVE:STAGE none-->').stage).toEqual([]);
    expect(parseDirections('Dain waits.').stage).toBeNull();
    const odd = parseDirections('<!--LIVE:ROOM spooky--><!--LIVE:CUE Dain Aetos--><!--LIVE:HUDDLE Dain + Dain | x--><!--LIVE:CUE A | one--><!--LIVE:CUE B | two--><!--LIVE:CUE C | three-->');
    expect(odd.room).toBeNull();
    expect(odd.huddle).toBeNull();
    expect(odd.cues.map(c => c.name)).toEqual(['A', 'B']);
    expect(directionsSig(post)).not.toBe(directionsSig(`${post} `));
  });

  it('the guide teaches the DM the directions and to leave room', () => {
    const guide = liveNpcDmGuide('Kylar');
    for (const part of ['<!--LIVE:STAGE', '<!--LIVE:ROOM', '<!--LIVE:CUE', '<!--LIVE:HUDDLE', 'LEAVE ROOM', 'END ON AN OPENING', 'whispered to Kylar alone']) expect(guide).toContain(part);
  });
});

describe('what the table tells the DM', () => {
  it('reports who is there, whispers, the last huddle, tension and ignored questions', () => {
    const note = tableStateForDm({
      riderName: 'Kylar',
      onStage: [{ name: 'Dain Aetos', wants: 'you were insulted' }, { name: 'Xaden Riorson' }],
      whispered: true,
      pairs: [{ a: 'Dain Aetos', b: 'Xaden Riorson', tension: 2, lastAbout: '"marked"' }, { a: 'A', b: 'B', tension: 0 }],
      lastHuddle: { names: ['Dain Aetos', 'Xaden Riorson'], about: 'the bad blood between you', heat: 4, end: 'dropped', ally: 'Xaden Riorson', riderSpoke: true },
      ignored: ['Dain Aetos'],
    });
    expect(note).toContain('## LIVE TABLE STATE');
    expect(note).toContain('Dain Aetos (holding something back: you were insulted); Xaden Riorson');
    expect(note).toContain('whispered to Kylar alone');
    expect(note).toContain("It ended heated and unfinished. Kylar took Xaden Riorson's side.");
    expect(note).toContain('Between Dain Aetos and Xaden Riorson: bad and getting worse (last over "marked")');
    expect(note).not.toContain('Between A and B');
    expect(note).toContain('Dain Aetos asked Kylar a question and got no answer.');
    expect(tableStateForDm({ riderName: 'Kylar', onStage: [], whispered: false, pairs: [], ignored: [] })).toBe('');
  });

  it('the note also carries what NPCs are after, what they hide, and what they did', () => {
    const note = tableStateForDm({
      riderName: 'Kylar',
      onStage: [{ name: 'Dain Aetos', aim: 'an honest answer', hiding: 'he read her file' }],
      whispered: false, pairs: [], ignored: [],
      actions: ['Xaden Riorson walked out.', 'Dain Aetos handed Kylar: a folded order.'],
    });
    expect(note).toContain('Dain Aetos (is after: an honest answer; is hiding from Kylar: he read her file)');
    expect(note).toContain('- Xaden Riorson walked out.');
    expect(note).toContain('- Dain Aetos handed Kylar: a folded order.');
    expect(tableStateForDm({ riderName: 'Kylar', onStage: [], whispered: false, pairs: [], ignored: [], actions: ['Jack Barlowe squared up to Kylar.'] })).toContain('squared up');
    expect(tableStateForDm({ riderName: 'Kylar', onStage: [], whispered: false, pairs: [], ignored: [], companions: ['Dain Aetos'] })).toContain('Dain Aetos set out with Kylar and is travelling with them');
  });

  it('a hand-off asks for a full scene and carries the note', () => {
    const format = soloHandoffFormat('Kylar', '## LIVE TABLE STATE\n- x');
    expect(format).toContain(`${HANDOFF_WORDS.min} to ${HANDOFF_WORDS.max} words`);
    expect(format).toContain('outranks any shorter length setting');
    expect(format).toContain('## LIVE TABLE STATE');
    expect(soloHandoffFormat('Kylar', '')).not.toContain('LIVE TABLE STATE');
  });
});

describe('the story feed scene', () => {
  it('reads a hand-off back into its lines, in order, with NPCs, whispers, table talk and notes', () => {
    const scene = parseHandoffScene([
      '[Kylar]: I step up to the mat.',
      'Then I wait.',
      '[Dain Aetos (NPC)]: **Dain:** "Stand down, cadet."',
      '[Violet Sorrengail (NPC)]: 🤫 **Violet:** "He is bluffing."',
      '[Kylar]: "No."',
      '',
      'TABLE TALK (out of character)',
      'brb, coffee',
      '',
      '[SIGNET CHANNELED — intensity 3/8. Narrate the signet.]',
    ].join('\n'));
    expect(scene?.lines).toEqual([
      { name: 'Kylar', npc: false, whisper: false, text: 'I step up to the mat.\nThen I wait.' },
      { name: 'Dain Aetos', npc: true, whisper: false, text: '"Stand down, cadet."' },
      { name: 'Violet Sorrengail', npc: true, whisper: true, text: '"He is bluffing."' },
      { name: 'Kylar', npc: false, whisper: false, text: '"No."' },
    ]);
    expect(scene?.tableTalk).toEqual(['brb, coffee']);
    expect(scene?.notes).toHaveLength(1);
  });

  it('anything that is not a hand-off is left alone', () => {
    expect(parseHandoffScene('I walk to the Parapet and look down.')).toBeNull();
    expect(parseHandoffScene('Begin the adventure. Here is the opening scene:\n\n[Kylar]: hello')).toBeNull();
    expect(parseHandoffScene('')).toBeNull();
  });
});
