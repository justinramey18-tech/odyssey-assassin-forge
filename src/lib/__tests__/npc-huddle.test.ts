import { describe, expect, it } from 'vitest';
import {
  HUDDLE_RULES, addPressure, afterNpcLine, afterRiderLine, applyRead, freshTaste, hasFriction, huddleBlock, initialStance,
  joinHuddle, learnPace, leaveHuddle, likedHuddle, nextBeat, nextSpeaker, openHuddle, pairKey, pauseMs, readTaste, readySpark,
  settleHuddle, topicHit, type Huddle, type HuddleNpc, type PairPressure,
} from '@/lib/npc-huddle';
import { TEMPERAMENTS } from '@/lib/empyreanCanon/castNpcs/temperament';

const NOW = 1_700_000_000_000;
const npc = (key: string, name: string, attitude = 0): HuddleNpc => ({ key, name, temperament: TEMPERAMENTS[key], attitude });
const dain = npc('dain-aetos', 'Dain Aetos');
const xaden = npc('xaden-riorson', 'Xaden Riorson');
const rhi = npc('rhiannon-matthias', 'Rhiannon Matthias');
const imogen = npc('imogen-cardulo', 'Imogen Cardulo');
const trina = npc('trina', 'Trina', 2);
const tynan = npc('tynan', 'Tynan', -2);
const DX = pairKey(dain.key, xaden.key);

function open(over: Partial<Huddle> = {}): Huddle {
  const h = openHuddle({ pair: [dain.key, xaden.key], kind: 'friction', about: 'the bad blood between you' }, dain, xaden, freshTaste(), { era: 'fw', now: NOW, hushed: false, id: 'h1' });
  return { ...h, ...over };
}

describe('huddle sparks', () => {
  it('friction: bad blood either way, and pressure builds as they speak or are named', () => {
    expect(hasFriction(dain, xaden, 'fw')).toBe(true);
    expect(hasFriction(rhi, trina, 'fw')).toBe(false);
    let p: Record<string, PairPressure> = {};
    p = addPressure(p, { text: 'Stand down, cadet.', speaker: 'npc', speakerKey: dain.key, stage: [dain, xaden, trina], era: 'fw', now: NOW }, freshTaste());
    expect(p[DX].pts).toBe(HUDDLE_RULES.frictionSpeaks);
    expect(readySpark(p, freshTaste(), { now: NOW, lastHuddleAt: 0, tense: false })).toBeNull();
    p = addPressure(p, { text: 'Xaden, what do you make of that?', speaker: 'rider', stage: [dain, xaden, trina], era: 'fw', now: NOW }, freshTaste());
    p = addPressure(p, { text: 'Careful.', speaker: 'npc', speakerKey: xaden.key, stage: [dain, xaden, trina], era: 'fw', now: NOW }, freshTaste());
    expect(p[DX].pts).toBe(8);
    expect(readySpark(p, freshTaste(), { now: NOW, lastHuddleAt: 0, tense: false })).toEqual({ pair: [dain.key, xaden.key], kind: 'friction', about: 'the bad blood between you' });
  });

  it('a shared topic and a disagreement about the rider both spark; pressure fades; gaps and tense rooms hold it back', () => {
    expect(topicHit('the marked ones again', TEMPERAMENTS['xaden-riorson'], 'fw')).toBe('marked');
    expect(topicHit('talk of venin', TEMPERAMENTS['xaden-riorson'], 'fw')).toBeNull(); // secret topics never spark
    let p = addPressure({}, { text: 'They say the marked ones cannot be trusted', speaker: 'rider', stage: [xaden, imogen], era: 'fw', now: NOW }, freshTaste());
    const XI = pairKey(xaden.key, imogen.key);
    expect(p[XI]).toMatchObject({ pts: HUDDLE_RULES.sharedTopic, kind: 'topic', about: '"marked"' });
    const faded = addPressure(p, { text: '', speaker: 'rider', stage: [xaden, imogen], era: 'fw', now: NOW + 120_000 }, freshTaste());
    expect(faded[XI].pts).toBeCloseTo(HUDDLE_RULES.sharedTopic * 0.49);

    p = addPressure({}, { text: 'They did well today.', speaker: 'npc', speakerKey: trina.key, stage: [trina, tynan], era: 'fw', now: NOW }, freshTaste());
    expect(p[pairKey(trina.key, tynan.key)]).toMatchObject({ pts: HUDDLE_RULES.aboutRider, kind: 'about-rider' });

    const hot = { [DX]: { pts: 7, at: NOW, kind: 'friction' as const, about: 'x' } };
    expect(readySpark(hot, freshTaste(), { now: NOW, lastHuddleAt: NOW - 60_000, tense: false })).toBeNull();
    expect(readySpark(hot, freshTaste(), { now: NOW, lastHuddleAt: 0, tense: true })).toBeNull();
    expect(readySpark(hot, { ...freshTaste(), appetite: 1.5 }, { now: NOW, lastHuddleAt: 0, tense: true })).not.toBeNull();
  });

  it('carried tension makes the next spark land harder, and a pair the rider shut down needs more', () => {
    const taste = { ...freshTaste(), pairs: { [DX]: { tension: 2, taste: 1, topics: [], lastAt: 0 } } };
    const p = addPressure({}, { text: 'Stand down.', speaker: 'npc', speakerKey: dain.key, stage: [dain, xaden], era: 'fw', now: NOW }, taste);
    expect(p[DX].pts).toBe(HUDDLE_RULES.frictionSpeaks + 2);
    const six = { [DX]: { pts: 6, at: NOW, kind: 'friction' as const, about: 'x' } };
    expect(readySpark(six, freshTaste(), { now: NOW, lastHuddleAt: 0, tense: false })).not.toBeNull();
    expect(readySpark(six, { ...freshTaste(), pairs: { [DX]: { tension: 0, taste: 0.7, topics: [], lastAt: 0 } } }, { now: NOW, lastHuddleAt: 0, tense: false })).toBeNull();
  });
});

describe('a running huddle', () => {
  it('opens with stances from how they feel, the one with the grudge first', () => {
    const h = open();
    expect(h.members).toHaveLength(2);
    expect(h.steam).toBe(HUDDLE_RULES.startSteam);
    expect(h.heat).toBe(2);
    expect(nextBeat(h)).toBe('open');
    expect(nextSpeaker(h, {})).toBe(h.pair[0]);
    expect(initialStance(rhi, dain, 'friction', 'fw', true)).toBe(TEMPERAMENTS['rhiannon-matthias'].peacemaker ? 'calming' : 'pressing');
    const hushed = openHuddle({ pair: [dain.key, xaden.key], kind: 'topic', about: '"marked"' }, dain, xaden, { ...freshTaste(), appetite: 1.5 }, { era: 'fw', now: NOW, hushed: true, id: 'h2' });
    expect(hushed.steam).toBe(Math.round(HUDDLE_RULES.startSteam * 1.5 * HUDDLE_RULES.hushedSteam));
  });

  it('the urge meter picks who speaks next, never the same voice twice, and a named NPC answers first', () => {
    let h = afterNpcLine(open(), dain.key, 'You broke formation.');
    expect(nextSpeaker(h, { [dain.key]: 99, [xaden.key]: 1 })).toBe(xaden.key);
    h = joinHuddle(h, rhi);
    expect(h.members).toHaveLength(3);
    expect(nextSpeaker(h, {})).toBe(rhi.key); // whoever steps in speaks next
    h = afterNpcLine(h, rhi.key, 'Both of you, breathe.');
    expect(nextSpeaker(h, { [dain.key]: 2, [xaden.key]: 5 })).toBe(xaden.key);
    h = afterRiderLine(h, { named: [dain.key] });
    expect(nextSpeaker(h, { [xaden.key]: 50 })).toBe(dain.key);
    expect(joinHuddle(h, trina).members).toHaveLength(3); // never more than three voices
  });

  it('steam runs down a line at a time, the rider adds to it, and it closes when it runs out', () => {
    let h = open();
    h = afterNpcLine(h, dain.key, 'One.');
    h = afterNpcLine(h, xaden.key, 'Two.');
    expect(h.steam).toBe(2);
    expect(nextBeat(h)).toBe('build');
    h = afterNpcLine(h, dain.key, 'Three.');
    expect(nextBeat(h)).toBe('close');
    h = afterRiderLine(h, { named: [] });
    expect(h.steam).toBe(3);
    expect(nextBeat(h)).toBe('answer-rider');
    expect(afterRiderLine({ ...h, steam: 6 }, { named: [] }).steam).toBe(HUDDLE_RULES.maxSteam);
    expect(nextBeat({ ...open(), npcLines: HUDDLE_RULES.maxNpcLines - 1, steam: 5 })).toBe('close');
  });

  it('a silent rider gets turned to, once', () => {
    let h = open({ steam: 6 });
    for (const k of [dain.key, xaden.key, dain.key]) h = afterNpcLine(h, k, 'Line.');
    expect(nextBeat(h)).toBe('turn-to-rider');
    expect(nextBeat({ ...h, turnedToRider: true })).toBe('build');
  });

  it('heat follows the words, the tone and the stances, and at the top it must break', () => {
    let h = open({ steam: 6 });
    h = afterNpcLine(h, dain.key, 'You are a liar and a traitor!');
    expect(h.heat).toBe(3);
    h = afterNpcLine(h, xaden.key, 'Fine. Forget it.');
    expect(h.heat).toBe(2);
    h = afterRiderLine(h, { named: [], tone: 'heated' });
    expect(h.heat).toBe(3);
    expect(applyRead(h, { tone: 'joking' }).heat).toBe(2);
    expect(nextBeat({ ...h, heat: HUDDLE_RULES.maxHeat })).toBe('break');
  });

  it('taking a side makes the ally bolder and the other one turn', () => {
    const h = applyRead(open(), { sidesWith: xaden.key });
    expect(h.ally).toBe(xaden.key);
    expect(h.stances[xaden.key]).toBe('pressing');
    expect(['defending', 'mocking']).toContain(h.stances[dain.key]);
    expect(applyRead(open(), { sidesWith: 'nobody-here' }).ally).toBeNull();
  });

  it('someone leaving ends it only when fewer than two remain', () => {
    const three = joinHuddle(open(), rhi);
    expect(leaveHuddle(three, rhi.key)?.members).toHaveLength(2);
    expect(leaveHuddle(open(), dain.key)).toBeNull();
  });

  it('the instruction block carries stance, heat, sides, rank, old ground, memory and the beat', () => {
    const h = applyRead(afterNpcLine(open(), dain.key, 'You broke formation.'), { sidesWith: xaden.key });
    const block = huddleBlock({
      h, self: xaden, others: ['Dain Aetos'], riderName: 'Kylar', beat: 'answer-rider', lastName: 'Kylar',
      lowVoice: true, doneBefore: ['"marked"'], tension: 2, memory: 'Kylar kept quiet about the Gauntlet.',
    });
    expect(block).toContain('## HUDDLE');
    expect(block).toContain('pressing');
    expect(block).toContain('Kylar has taken your side');
    expect(block).toContain('keep your voice down');
    expect(block).toContain('already been over: "marked"');
    expect(block).toContain('more than once');
    expect(block).toContain('Kylar kept quiet about the Gauntlet.');
    expect(block).toContain('just cut in');
    expect(block).toContain('Never speak or act for Kylar');
    const other = huddleBlock({ h, self: dain, others: ['Xaden Riorson'], riderName: 'Kylar', beat: 'turn-to-rider', lastName: null, lowVoice: false, doneBefore: [], tension: 0 });
    expect(other).toContain('taken the other side against you');
    expect(other).toContain('Turn to them now');
    expect(other).not.toContain('keep your voice down');
    expect(huddleBlock({ h: { ...h, stances: { ...h.stances, [dain.key]: 'calming' } }, self: dain, others: ['Xaden Riorson'], riderName: 'Kylar', beat: 'break', lastName: null, lowVoice: false, doneBefore: [], tension: 0 })).toContain('Step between them');
  });
});

describe('what carries over between huddles', () => {
  it('a break or a hot ending leaves tension, a cool one clears it, and old ground is remembered', () => {
    let t = settleHuddle(freshTaste(), { end: 'broke', h: open({ npcLines: 5, heat: 5, riderLines: 1 }) }, NOW);
    expect(t.pairs[DX]).toMatchObject({ tension: 2, topics: ['the bad blood between you'], lastAt: NOW });
    t = settleHuddle(t, { end: 'dropped', h: open({ npcLines: 4, heat: 4, riderLines: 1 }) }, NOW);
    expect(t.pairs[DX].tension).toBe(HUDDLE_RULES.maxTension);
    t = settleHuddle(t, { end: 'dropped', h: open({ npcLines: 4, heat: 1, riderLines: 1, about: '"marked"' }) }, NOW);
    expect(t.pairs[DX].tension).toBe(2);
    expect(t.pairs[DX].topics).toEqual(['the bad blood between you', '"marked"']);
  });

  it('learns the rider: joining grows appetite, ignoring shrinks it a little, Enough shrinks it a lot, sealing grows it', () => {
    const joined = settleHuddle(freshTaste(), { end: 'dropped', h: open({ npcLines: 4, riderLines: 2 }) }, NOW);
    expect(joined.appetite).toBeCloseTo(1.05);
    expect(joined.pairs[DX].taste).toBeCloseTo(1.05);
    expect(settleHuddle(freshTaste(), { end: 'dropped', h: open({ npcLines: 4 }) }, NOW).appetite).toBeCloseTo(0.95);
    const enough = settleHuddle(freshTaste(), { end: 'enough', h: open({ npcLines: 2 }) }, NOW);
    expect(enough.appetite).toBeCloseTo(0.85);
    expect(enough.pairs[DX].taste).toBeCloseTo(0.85);
    expect(settleHuddle(freshTaste(), { end: 'interrupted', h: open({ npcLines: 1 }) }, NOW).appetite).toBe(1);
    expect(likedHuddle(freshTaste(), [dain.key, xaden.key]).appetite).toBeCloseTo(1.05);
    let t = freshTaste();
    for (let i = 0; i < 40; i++) t = settleHuddle(t, { end: 'enough', h: open() }, NOW);
    expect(t.appetite).toBe(HUDDLE_RULES.appetiteMin);
  });

  it('pace: pauses follow how fast the rider answers, within limits, and answers to the rider come quickly', () => {
    expect(pauseMs(freshTaste(), true)).toBe(HUDDLE_RULES.afterRiderMs);
    expect(pauseMs(freshTaste(), false)).toBe(7_000);
    let t = freshTaste();
    for (let i = 0; i < 20; i++) t = learnPace(t, 4_000);
    expect(pauseMs(t, false)).toBe(HUDDLE_RULES.pauseMinMs);
    for (let i = 0; i < 20; i++) t = learnPace(t, 60_000);
    expect(pauseMs(t, false)).toBe(HUDDLE_RULES.pauseMaxMs);
    expect(learnPace(freshTaste(), 999_999).paceMs).toBe(HUDDLE_RULES.defaultPaceMs);
  });

  it('reads saved taste safely', () => {
    expect(readTaste(null)).toEqual(freshTaste());
    const t = readTaste({ appetite: 99, paceMs: 'x', pairs: { [DX]: { tension: 9, taste: 0, topics: ['a', 1, 'b', 'c', 'd'], lastAt: 5 }, bad: null } });
    expect(t.appetite).toBe(HUDDLE_RULES.appetiteMax);
    expect(t.paceMs).toBe(HUDDLE_RULES.defaultPaceMs);
    expect(t.pairs[DX]).toEqual({ tension: HUDDLE_RULES.maxTension, taste: 1, topics: ['b', 'c', 'd'], lastAt: 5 });
    expect(t.pairs.bad).toBeUndefined();
  });
});
