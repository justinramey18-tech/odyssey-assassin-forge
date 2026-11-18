import { describe, expect, it } from 'vitest';
import {
  DELIVERY_RULES, SHAPE_BANDS, bandOf, deliveryBlock, fitToShape, isKeyLine, measureLine, moodFacts, partsNote, planTurn, readNotes, readShapes,
  readTurn, samenessNote, shapeAsk, stripSpeaker, type LengthBand, type LineShape, type ShapeInput, type TurnShape,
} from '@/lib/npc-delivery';
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
    expect(readTurn('**A:** "Come on. The Archives."\n⟪ACT travel: The Archives⟫', NOW).action).toEqual({ kind: 'travel', place: 'The Archives' });
    expect(readTurn('**A:** "Come on."\n⟪ACT travel⟫', NOW).action).toBeNull();
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
    expect(block).not.toContain('⟪ACT travel');
    expect(deliveryBlock({ ...base, actions: { leave: false, between: false, squareUp: false, give: false, travel: ['Archives', 'Montserrat'] } })).toContain('⟪ACT travel: place name⟫ you want Kylar to come with you there, now (only one of: Archives; Montserrat)');
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

describe('the shape of a turn is chosen by the app', () => {
  // A fixed sequence of random numbers, so the runs below are the same every time.
  const seeded = (seed: number) => () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const base = (over: Partial<ShapeInput> = {}): ShapeInput => ({
    key: 'ridoc', history: [], style: 'normal', stir: 0.3, directQuestion: false, closing: false, whisper: false, riderWords: 12, needsRoom: false, roll: seeded(7), ...over,
  });
  /** One NPC speaking n turns in a row, each turn written to the middle of the shape it was given. */
  const run = (n: number, over: Partial<ShapeInput> = {}): TurnShape[] => {
    const roll = seeded(11);
    let history: LineShape[] = [];
    const shapes: TurnShape[] = [];
    for (let i = 0; i < n; i++) {
      const shape = planTurn(base({ ...over, history, roll }));
      shapes.push(shape);
      history = [...history, { key: 'ridoc', words: Math.round((shape.minWords + shape.maxWords) / 2), beat: shape.beat, parts: [] }].slice(-12);
    }
    return shapes;
  };

  it('over many turns one NPC uses every length, never the same length three times running, and moves the movement around', () => {
    const shapes = run(300);
    const bands = new Set(shapes.map(s => s.band));
    expect([...bands].sort()).toEqual(['couple', 'few', 'long', 'one', 'silent']);
    for (let i = 2; i < shapes.length; i++) {
      expect(shapes[i].band === shapes[i - 1].band && shapes[i].band === shapes[i - 2].band).toBe(false);
      const b = shapes[i].beat;
      if (b !== 'only') expect(b === shapes[i - 1].beat && b === shapes[i - 2].beat).toBe(false);
    }
    const share = (band: LengthBand) => shapes.filter(s => s.band === band).length / shapes.length;
    expect(share('long')).toBeLessThan(0.3);
    expect(share('few') + share('one')).toBeGreaterThan(0.4);
    expect(new Set(shapes.filter(s => s.band !== 'silent').map(s => s.beat)).size).toBe(4);
    for (const s of shapes) {
      expect(s.minWords).toBe(SHAPE_BANDS[s.band].min);
      expect(s.maxWords).toBe(SHAPE_BANDS[s.band].max);
      expect(s.band === 'silent' ? s.beat === 'only' : s.beat !== 'only').toBe(true);
    }
  });

  it('the moment bends the odds: a direct question always gets words, a closing line or a whisper is never long, quiet people say less than loud ones', () => {
    expect(run(200, { directQuestion: true }).some(s => s.band === 'silent')).toBe(false);
    expect(run(200, { needsRoom: true }).some(s => s.band === 'silent')).toBe(false);
    expect(run(200, { closing: true }).some(s => s.band === 'long')).toBe(false);
    expect(run(200, { whisper: true }).some(s => s.band === 'long')).toBe(false);
    const mean = (shapes: TurnShape[]) => shapes.reduce((sum, s) => sum + (s.minWords + s.maxWords) / 2, 0) / shapes.length;
    expect(mean(run(300, { style: 'quiet' }))).toBeLessThan(mean(run(300, { style: 'loud' })) - 5);
  });

  it('steers away from what this NPC and the table just did', () => {
    const long = (key: string): LineShape => ({ key, words: 60, beat: 'mid', parts: [] });
    // Two long turns in a row: a third long one is impossible, whatever the dice say.
    for (const r of [0, 0.25, 0.5, 0.75, 0.999]) {
      const s = planTurn(base({ history: [long('ridoc'), long('ridoc')], roll: () => r }));
      expect(s.band).not.toBe('long');
      expect(s.beat).not.toBe('mid');
    }
    expect(bandOf(0)).toBe('silent');
    expect(bandOf(6)).toBe('few');
    expect(bandOf(18)).toBe('one');
    expect(bandOf(40)).toBe('couple');
    expect(bandOf(41)).toBe('long');
  });

  it('tells the NPC the shape in plain numbers, in place of the free-length rule', () => {
    const few: TurnShape = { band: 'few', minWords: 1, maxWords: 6, beat: 'none' };
    expect(shapeAsk(few)).toContain('between 1 and 6 spoken words');
    expect(shapeAsk(few)).toContain('words only, nothing in italics');
    expect(shapeAsk({ band: 'silent', minWords: 0, maxWords: 0, beat: 'only' })).toContain('no spoken words at all');
    expect(shapeAsk({ band: 'long', minWords: 41, maxWords: 90, beat: 'after' })).toContain('41 to 90 spoken words');
    const d = { name: 'Ridoc Gamlyn', riderName: 'Kylar', voice: { rhythm: 'quick', register: 'jokes', shows: 'hands', tell: 'too many jokes' }, mood: 'calm', note: null, sameness: '', directQuestion: false, riderWords: 9, whisper: false, outranked: false, condition: '', closing: false, actions: { leave: false, between: false, squareUp: false, give: false }, insight: false };
    const shaped = deliveryBlock({ ...d, shape: few });
    expect(shaped).toContain("THIS TURN'S SHAPE");
    expect(shaped).toContain('never the shape of their past lines');
    expect(shaped).not.toContain('Length is whatever is true to the moment');
    expect(shaped).not.toContain(`At most ${DELIVERY_RULES.maxWords} words`);
    expect(deliveryBlock(d)).toContain('Length is whatever is true to the moment');
  });

  it('trims a turn that badly overshoots its shape at the end of a sentence, and leaves the rest alone', () => {
    const ridoc = '*He pops up from his ridiculous stealth crouch, dusting off his knees.* "Distraction it is. Prepare to witness a masterclass in pathetic desperation. I am going to ask him where the latrines are, and if he does not buy it, I will just start crying. Nobody wants to deal with a weeping first-year." *He flashes a quick, brittle grin.* "You have got maybe ten seconds once I start talking. If I die for this, tell my mother I was magnificent."';
    const one: TurnShape = { band: 'one', minWords: 7, maxWords: 18, beat: 'before' };
    const cut = fitToShape(ridoc, one);
    expect(cut.startsWith('*He pops up from his ridiculous stealth crouch, dusting off his knees.* "Distraction it is.')).toBe(true);
    expect(measureLine('ridoc', cut).words).toBeLessThanOrEqual(21);
    expect(measureLine('ridoc', cut).words).toBeGreaterThanOrEqual(3);
    expect((cut.match(/"/g) || []).length % 2).toBe(0);
    expect(cut).not.toContain('magnificent');
    // Inside the shape, or only a little over: untouched.
    expect(fitToShape(ridoc, { band: 'long', minWords: 41, maxWords: 90, beat: 'mid' })).toBe(ridoc);
    const short = '"Sunset bell. Do not be late."';
    expect(fitToShape(short, { band: 'few', minWords: 1, maxWords: 6, beat: 'none' })).toBe(short);
    expect(fitToShape(ridoc, null)).toBe(ridoc);
    // One very long sentence is never cut in half.
    const breathless = '"I went down there and I looked and I counted every crate twice and I swear on my mother there was nothing in any of them but dust and one very old boot"';
    expect(fitToShape(breathless, { band: 'few', minWords: 1, maxWords: 6, beat: 'none' })).toBe(breathless);
  });

  it('never trims away the sense line or a roll request that follows the turn', () => {
    const body = '"No. I was nowhere near the armory. I was in the mess hall the whole evening with half the squad. Ask any of them. Ask Rhiannon. Ask the cook, he will remember me, I dropped a whole tray."';
    const few: TurnShape = { band: 'few', minWords: 1, maxWords: 6, beat: 'none' };
    const withSense = fitToShape(`${body}\n*(You sense: he is lying about the mess hall)*`, few);
    expect(withSense.startsWith('"No.')).toBe(true);
    expect(withSense).not.toContain('Rhiannon');
    expect(withSense.endsWith('*(You sense: he is lying about the mess hall)*')).toBe(true);
    const withRoll = fitToShape(`${body} ⟪ROLL⟫{"check":"Insight","dc":12}⟪/ROLL⟫`, few);
    expect(withRoll).not.toContain('Rhiannon');
    expect(withRoll.endsWith('⟪ROLL⟫{"check":"Insight","dc":12}⟪/ROLL⟫')).toBe(true);
  });

  it('drops the bold name from the start of a turn, reports worn body parts only, and reads saved shapes safely', () => {
    expect(stripSpeaker('**Ridoc Gamlyn:** "I swear to the gods."')).toBe('"I swear to the gods."');
    expect(stripSpeaker('"No name here."')).toBe('"No name here."');
    const h: LineShape[] = [
      { key: 'a', words: 60, beat: 'mid', parts: ['hands'] }, { key: 'a', words: 60, beat: 'mid', parts: ['hands'] }, { key: 'a', words: 60, beat: 'mid', parts: [] },
    ];
    expect(partsNote('a', h)).toContain('hands');
    expect(partsNote('a', h)).not.toContain('shorter');
    expect(partsNote('b', h)).toBe('');
    expect(readShapes(h)).toEqual(h);
    expect(readShapes([{ key: 'a', words: 'many' }, null, { key: 'a', words: 3.6, beat: 'sideways', parts: 'x' }])).toEqual([{ key: 'a', words: 4, beat: 'none', parts: [] }]);
    expect(readShapes('nope')).toEqual([]);
  });
});
