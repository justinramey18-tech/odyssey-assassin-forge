import { describe, expect, it } from 'vitest';
import { DELIVERY_RULES, deliveryBlock, isKeyLine, measureLine, moodFacts, readNotes, readTurn, samenessNote, type LineShape } from '@/lib/npc-delivery';
import { VOICES, voiceFor } from '@/lib/empyreanCanon/castNpcs/voice';
import { TEMPERAMENTS } from '@/lib/empyreanCanon/castNpcs/temperament';

const NOW = 1_700_000_000_000;

describe('voice fingerprints', () => {
  it('every profiled NPC has a voice, and everyone else gets one from their style', () => {
    expect(Object.keys(VOICES).sort()).toEqual(Object.keys(TEMPERAMENTS).sort());
    for (const v of Object.values(VOICES)) for (const f of [v.rhythm, v.register, v.shows, v.tell]) expect(f.length).toBeGreaterThan(5);
    expect(voiceFor('dain-aetos').tell).toContain('regulations');
    expect(voiceFor('someone-new', 'quiet').rhythm).toContain('few words');
    expect(voiceFor('someone-new')).toBeDefined();
  });
});

describe('the private mind and actions', () => {
  it('splits a reply into the shown turn, the note and an action', () => {
    const out = readTurn('**Dain:** "Where were you?" *He does not step aside.*\n⟪ACT give: a folded order⟫\n⟪MIND want: an honest answer | unsaid: I already know | body: in the doorway, arms loose | truth: nothing ⟫', NOW);
    expect(out.text).toBe('**Dain:** "Where were you?" *He does not step aside.*');
    expect(out.note).toEqual({ want: 'an honest answer', unsaid: 'I already know', body: 'in the doorway, arms loose', truth: '', at: NOW });
    expect(out.action).toEqual({ kind: 'give', what: 'a folded order' });
  });

  it('reads each action, keeps a lie, and never shows a cut-off or odd marker', () => {
    expect(readTurn('**A:** "Fine."\n⟪ACT leave⟫', NOW).action).toEqual({ kind: 'leave' });
    expect(readTurn('**A:** "Enough."\n⟪ACT between⟫', NOW).action).toEqual({ kind: 'between' });
    expect(readTurn('**A:** "Mat. Now."\n⟪ACT square-up⟫', NOW).action).toEqual({ kind: 'square-up' });
    expect(readTurn('**A:** "Here."\n⟪ACT dance⟫', NOW).action).toBeNull();
    expect(readTurn('**A:** "I was asleep."\n⟪MIND want: to be believed | truth: I was at the vault ⟫', NOW).note?.truth).toBe('I was at the vault');
    const cutOff = readTurn('**A:** "I was asleep."\n⟪MIND want: to be belie', NOW);
    expect(cutOff.text).toBe('**A:** "I was asleep."');
    expect(cutOff.note).toBeNull();
    expect(readTurn('**A:** "Plain."', NOW)).toEqual({ text: '**A:** "Plain."', note: null, action: null });
    // The roll and join controls are somebody else's markers: left alone.
    expect(readTurn('**A:** "Roll."⟪ROLL⟫{"dc":12}⟪/ROLL⟫\n⟪MIND want: x ⟫', NOW).text).toContain('⟪ROLL⟫{"dc":12}⟪/ROLL⟫');
  });

  it('saved notes are read safely and old ones are dropped', () => {
    const notes = readNotes({
      a: { want: 'w', unsaid: 'u', body: 'b', truth: 't', at: NOW - 1000 },
      old: { want: 'w', at: NOW - DELIVERY_RULES.noteMaxAgeMs - 1 },
      bad: null,
      odd: { want: 5, at: NOW },
    }, NOW);
    expect(Object.keys(notes).sort()).toEqual(['a', 'odd']);
    expect(notes.odd.want).toBe('');
    expect(readNotes('nope', NOW)).toEqual({});
  });
});

describe('measuring what came out', () => {
  it('counts spoken words and finds where the movement sits', () => {
    expect(measureLine('a', '**Dain:** "Stand down, cadet."')).toMatchObject({ words: 3, beat: 'none' });
    expect(measureLine('a', '**Dain:** "Stand down." *His jaw works.*')).toMatchObject({ words: 2, beat: 'after', parts: ['jaw'] });
    expect(measureLine('a', '**Dain:** *He steps into the doorway.* "Stand down."')).toMatchObject({ beat: 'before' });
    expect(measureLine('a', '**Dain:** "Stand" *his hand lifts, his eyes on yours* "down."')).toMatchObject({ beat: 'mid', parts: ['eyes', 'hands'] });
    expect(measureLine('a', '🤫 **Violet:** *She only shakes her head.*')).toMatchObject({ words: 0, beat: 'only', parts: ['head'] });
  });

  it('says so when lines are the same length, the same layout, or the same body part, and stays quiet otherwise', () => {
    const same: LineShape[] = [1, 2, 3].map(() => ({ key: 'a', words: 10, beat: 'after', parts: ['jaw'] }));
    const note = samenessNote('a', same);
    expect(note).toContain('were all one sentence');
    expect(note).toContain('movement after the words');
    expect(note).toContain('your jaw');
    const varied: LineShape[] = [
      { key: 'a', words: 2, beat: 'none', parts: [] },
      { key: 'b', words: 30, beat: 'before', parts: ['hands'] },
      { key: 'a', words: 12, beat: 'after', parts: ['eyes'] },
    ];
    expect(samenessNote('a', varied)).toBe('');
    expect(samenessNote('a', same.slice(0, 2))).toContain('your jaw');
    // The table as a whole can be samey even when this NPC is new to it.
    expect(samenessNote('z', same)).toContain('at the table');
  });
});

describe('what the NPC is told', () => {
  const base = {
    name: 'Dain Aetos', riderName: 'Kylar', voice: voiceFor('dain-aetos'), mood: 'worked up; cool toward Kylar; keeping yourself in check',
    note: null, sameness: '', directQuestion: false, riderWords: 0, whisper: false, outranked: false, condition: '', closing: false,
    actions: { leave: false, between: false, squareUp: false, give: false }, insight: false,
  };

  it('mood is three plain facts', () => {
    expect(moodFacts({ urgeRatio: 0, attitude: 2, style: 'loud', outranked: false }, 'Kylar')).toBe('calm; warm toward Kylar; close to letting it all out');
    expect(moodFacts({ urgeRatio: 1.5, heat: 5, attitude: -2, style: 'quiet', outranked: true }, 'Kylar')).toBe('badly rattled; hostile toward Kylar; keeping yourself in check');
    expect(moodFacts({ urgeRatio: 0.5, attitude: 0, style: 'quiet', outranked: true }, 'Kylar')).toContain('holding everything in');
  });

  it('a first line asks them to decide what they want; later lines carry their own note forward', () => {
    const first = deliveryBlock(base);
    expect(first).toContain('**Dain Aetos:** exactly');
    expect(first).toContain('You have no private note yet');
    expect(first).toContain('⟪MIND want:');
    expect(first).toContain('quotes regulations');
    expect(first).not.toContain('ACTIONS');
    expect(first).not.toContain('EXACTLY');
    const later = deliveryBlock({ ...base, note: { want: 'an honest answer', unsaid: 'I already know', body: 'in the doorway', truth: 'I read her file', at: NOW } });
    expect(later).toContain('- You want: an honest answer');
    expect(later).toContain('- The truth you are keeping: I read her file');
    expect(later).not.toContain('no private note yet');
  });

  it('the moment adds its own lines: a direct question, a closing line, a correction, actions, insight', () => {
    const block = deliveryBlock({
      ...base, directQuestion: true, closing: true, sameness: 'Your last 3 lines were all one sentence.', riderWords: 22, whisper: true, outranked: true,
      condition: 'knocked out and only just coming round', actions: { leave: true, between: false, squareUp: true, give: true }, insight: true,
    });
    expect(block).toContain('put a direct question to you');
    expect(block).toContain('last line of this conversation');
    expect(block).toContain('Your last 3 lines were all one sentence.');
    expect(block).toContain('about 22 words');
    expect(block).toContain("for Kylar's ears only");
    expect(block).toContain('outranks you');
    expect(block).toContain('knocked out');
    expect(block).toContain('⟪ACT leave⟫');
    expect(block).toContain('⟪ACT square-up⟫');
    expect(block).not.toContain('⟪ACT between⟫');
    expect(block).toContain('(You sense:');
  });

  it('lines that matter are marked for the better model', () => {
    expect(isKeyLine({ reasons: ['the talk keeps passing you by'] })).toBe(false);
    expect(isKeyLine({ reasons: ['this touches something you remember: "x"'] })).toBe(true);
    expect(isKeyLine({ reasons: [], heat: 4 })).toBe(true);
    expect(isKeyLine({ reasons: [], beat: 'turn-to-rider' })).toBe(true);
    expect(isKeyLine({ reasons: [], memory: true })).toBe(true);
  });
});
