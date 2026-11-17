import { describe, expect, it } from 'vitest';
import {
  URGE_RULES, URGE_LINE_MODEL, freshUrge, settleUrge, addReasons, resetUrge, scoreLine,
  spotlightBonus, silenceReasons, effectiveThreshold, urgeStanding, pickWakes, whyBlock,
  URGE_TUNING, mentionsAny, learnTaste, rankFromRole, rankScale, asksQuestion, ignoredQuestionReasons, tableEnergy, energyScale,
  URGE_TIER3, memoryMatch, memoryReason, needsJudge, judgeReasons,
} from '@/lib/npc-urge';
import { TEMPERAMENTS, NEUTRAL_TEMPERAMENT, temperamentFor } from '@/lib/empyreanCanon/castNpcs/temperament';

const T0 = 1_000_000;
/** Past the stage-entry cooldown, so 'speak' is allowed. */
const NOW = T0 + 60_000;

const dain = { key: 'dain-aetos', name: 'Dain Aetos', aliases: ['Dain', 'Aetos'] };
const jack = { key: 'jack-barlowe', name: 'Jack Barlowe', aliases: ['Jack', 'Barlowe'] };
const xaden = { key: 'xaden-riorson', name: 'Xaden Riorson', aliases: ['Xaden', 'Riorson'] };
const aaric = { key: 'aaric-graycastle', name: 'Aaric Graycastle', aliases: ['Aaric', 'Graycastle', 'Cam'] };
const violet = { key: 'violet-sorrengail', name: 'Violet Sorrengail', aliases: ['Violet', 'Violence'] };
const bodhi = { key: 'bodhi-durran', name: 'Bodhi Durran', aliases: ['Bodhi', 'Durran'] };

const total = (rs: Array<{ pts: number }>) => rs.reduce((s, r) => s + r.pts, 0);

describe('temperaments', () => {
  it('ships the 18 approved profiles and a neutral default; Violet and Bodhi whisper', () => {
    expect(Object.keys(TEMPERAMENTS)).toHaveLength(18);
    expect(Object.entries(TEMPERAMENTS).filter(([, t]) => t.intent === 'whisper').map(([k]) => k).sort()).toEqual(['bodhi-durran', 'violet-sorrengail']);
    expect(temperamentFor('dain-aetos').reacts?.authority).toBe(1.5);
    expect(temperamentFor('somebody-else')).toBe(NEUTRAL_TEMPERAMENT);
  });
});

describe('scoring a line', () => {
  it('Dain reacts to broken rules: curfew talk gives a tell, naming him makes him speak', () => {
    const t = TEMPERAMENTS['dain-aetos'];
    const first = scoreLine({ text: 'We should sneak out past curfew tonight', speaker: 'rider', npc: dain, temperament: t, era: 'fw' });
    // ignored 1 + authority 2×1.5 + topic "curfew" 3 = 7
    expect(total(first)).toBe(7);
    let s = addReasons(freshUrge(T0), first, NOW);
    expect(urgeStanding(s, t, 'normal', NOW)).toBe('tell');
    const second = scoreLine({ text: 'Dain will not know, forget the codex', speaker: 'rider', npc: dain, temperament: t, era: 'fw' });
    // name 6 + authority "codex" 3 + topic "codex" 3 = 12
    expect(total(second)).toBe(12);
    s = addReasons(s, second, NOW);
    expect(urgeStanding(s, t, 'normal', NOW)).toBe('speak');
  });

  it('an insult to his face sets Jack off at once; Xaden shrugs the same words away', () => {
    const j = scoreLine({ text: 'Jack, you are useless', speaker: 'rider', npc: jack, temperament: TEMPERAMENTS['jack-barlowe'], era: 'fw' });
    // name 6 + insult 4×2 = 14 … plus his "weak/afraid" topic list doesn't match "useless"
    expect(total(j)).toBe(14);
    const sj = addReasons(freshUrge(T0), j, NOW);
    expect(urgeStanding(sj, TEMPERAMENTS['jack-barlowe'], 'normal', NOW)).toBe('speak'); // loud: limit 7.5
    const x = scoreLine({ text: 'Xaden, you are useless', speaker: 'rider', npc: xaden, temperament: TEMPERAMENTS['xaden-riorson'], era: 'fw' });
    // name 6 + insult 4×0.5 = 8, under his quiet limit (14) and under its tell line (9.8)
    expect(total(x)).toBe(8);
    const sx = addReasons(freshUrge(T0), x, NOW);
    expect(urgeStanding(sx, TEMPERAMENTS['xaden-riorson'], 'normal', NOW)).toBeNull();
  });

  it('era gating: royal talk moves Aaric only from year two on', () => {
    const line = { text: 'They say the prince is here', speaker: 'rider' as const, npc: aaric, temperament: TEMPERAMENTS['aaric-graycastle'] };
    expect(total(scoreLine({ ...line, era: 'fw' }))).toBe(1); // ignored only
    const inIf = scoreLine({ ...line, era: 'if' });
    expect(total(inIf)).toBe(1 + 3 * 2); // + secret topic ×2
    expect(inIf.some(r => r.text.includes('keep to yourself'))).toBe(true);
  });

  it('people they care about: Violet hears Dain named, harder from year two', () => {
    const t = TEMPERAMENTS['violet-sorrengail'];
    const fw = scoreLine({ text: 'Dain is coming this way', speaker: 'rider', npc: violet, temperament: t, era: 'fw' });
    expect(total(fw)).toBe(1 + 3); // ignored + person (wary)
    const yr2 = scoreLine({ text: 'Dain is coming this way', speaker: 'rider', npc: violet, temperament: t, era: 'if' });
    expect(total(yr2)).toBe(1 + 4); // the stronger feeling wins, counted once
  });

  it('overheard NPC lines land at half weight, and a rival speaking adds on top', () => {
    const heard = scoreLine({
      text: 'We move at dawn', speaker: 'npc', speakerKey: 'xaden-riorson', speakerName: 'Xaden Riorson',
      npc: dain, temperament: TEMPERAMENTS['dain-aetos'], era: 'fw',
    });
    expect(total(heard)).toBe(1); // rivalSpeaks 2 × 0.5; no ignored for NPC lines
    expect(heard[0].text).toContain('Xaden');
  });

  it('the peacemaker stirs when an argument brews, and nothing scores for the addressed or the speaker', () => {
    const b = scoreLine({ text: 'You are all useless', speaker: 'rider', npc: bodhi, temperament: TEMPERAMENTS['bodhi-durran'], era: 'fw' });
    expect(total(b)).toBe(1 + 2); // ignored + argument
    expect(scoreLine({ text: 'Dain, stand down', speaker: 'rider', npc: dain, temperament: TEMPERAMENTS['dain-aetos'], era: 'fw', addressed: true })).toEqual([]);
    expect(scoreLine({ text: 'Dain this, Dain that', speaker: 'npc', speakerKey: 'dain-aetos', npc: dain, temperament: TEMPERAMENTS['dain-aetos'], era: 'fw' })).toEqual([]);
  });
});

describe('the meter itself', () => {
  it('fades 20% a minute and forgets dust', () => {
    const s = addReasons(freshUrge(T0), [{ pts: 10, text: 'x' }], T0);
    expect(settleUrge(s, T0 + 60_000).urge).toBeCloseTo(8);
    expect(settleUrge(s, T0 + 120_000).urge).toBeCloseTo(6.4);
    expect(settleUrge({ ...s, urge: 0.04 }, T0 + 1000).urge).toBe(0);
  });

  it('cooldown: ready urge shows as a tell right after speaking (or entering the stage)', () => {
    const hot = addReasons(freshUrge(T0), [{ pts: 20, text: 'x' }], T0 + 1000);
    expect(urgeStanding(hot, NEUTRAL_TEMPERAMENT, 'normal', T0 + 1000)).toBe('tell');
    expect(urgeStanding(hot, NEUTRAL_TEMPERAMENT, 'normal', T0 + URGE_RULES.cooldownMs + 1000)).toBe('speak');
    expect(resetUrge(hot, NOW).urge).toBe(0);
  });

  it('talkativeness: spoken-to never wakes, chatty lowers the bar', () => {
    expect(effectiveThreshold(NEUTRAL_TEMPERAMENT, 'spoken-to')).toBeNull();
    expect(effectiveThreshold(NEUTRAL_TEMPERAMENT, 'chatty')).toBeCloseTo(7.5);
    expect(effectiveThreshold(TEMPERAMENTS['xaden-riorson'], 'normal')).toBeCloseTo(14);
    const hot = addReasons(freshUrge(T0), [{ pts: 50, text: 'x' }], NOW);
    expect(urgeStanding(hot, NEUTRAL_TEMPERAMENT, 'spoken-to', NOW)).toBeNull();
  });

  it('silence and the spotlight favor the quiet ones', () => {
    expect(total(silenceReasons(TEMPERAMENTS['ridoc-gamlyn'], 60_000))).toBe(4); // 2 steps × silence ×2
    expect(silenceReasons(NEUTRAL_TEMPERAMENT, 20_000)).toEqual([]);
    expect(spotlightBonus(freshUrge(T0), T0 + 60_000)).toBe(0);
    expect(spotlightBonus(freshUrge(T0), T0 + URGE_RULES.spotlightAfterMs + 1)).toBe(1);
  });

  it('picks at most the cap, most-over-threshold first', () => {
    const mk = (pts: number) => addReasons(freshUrge(T0), [{ pts, text: 'x' }], NOW);
    const picked = pickWakes([
      { key: 'a', state: mk(11), talk: 'normal' },
      { key: 'b', state: mk(30), talk: 'normal' },
      { key: 'c', state: mk(15), talk: 'normal' },
      { key: 'd', state: mk(3), talk: 'normal' },
    ], NOW, URGE_RULES.maxWakesPerLine);
    expect(picked).toEqual(['b', 'c']);
  });
});

describe('what the AI is told', () => {
  it('whyBlock names the reason and bends to the intent', () => {
    const s = addReasons(freshUrge(T0), [{ pts: 8, text: 'you were called "useless" to your face' }, { pts: 3, text: 'the silence is stretching' }], NOW);
    const speech = whyBlock('Jack Barlowe', 'Xeyle', s, 'speech');
    expect(speech).toContain('you were called "useless" to your face');
    expect(speech).toContain('unprompted');
    expect(whyBlock('Xaden Riorson', 'Xeyle', s, 'action')).toContain('physical beat');
    expect(whyBlock('Jesinia Neilwart', 'Xeyle', s, 'whisper')).toContain('*(quietly, to Xeyle)*');
    expect(whyBlock('Anyone', '', freshUrge(T0), 'speech')).toContain('pulls a reaction out of you');
  });

  it('unprompted lines run on the cheap model', () => {
    expect(URGE_LINE_MODEL).toBe('google/gemini-2.5-flash');
  });
});

describe('Tier 1: phrases and synonyms', () => {
  it('phrases match whole, and synonyms reach the same NPCs', () => {
    const d = scoreLine({ text: 'Nobody checks the halls after hours', speaker: 'rider', npc: dain, temperament: TEMPERAMENTS['dain-aetos'], era: 'fw' });
    expect(total(d)).toBe(1 + 3); // ignored + topic "after hours"
    const a = scoreLine({ text: 'They serve the crown, not His Majesty himself', speaker: 'rider', npc: aaric, temperament: TEMPERAMENTS['aaric-graycastle'], era: 'if' });
    expect(total(a)).toBe(1 + 3 * 2); // ignored + secret topic ×2, counted once
    const j = scoreLine({ text: 'Jack, you are dead weight', speaker: 'rider', npc: jack, temperament: TEMPERAMENTS['jack-barlowe'], era: 'fw' });
    expect(total(j)).toBe(6 + 4 * 2); // name + phrase insult ×2
    expect(mentionsAny('ask Dain about it', ['Dain Aetos', 'Dain'])).toBe(true);
    expect(mentionsAny('a disdainful look', ['Dain'])).toBe(false);
  });
});

describe('Tier 2: taste, rank, questions, energy', () => {
  it('learned taste moves the bar, annoyance twice as fast, within limits', () => {
    expect(learnTaste(undefined, true)).toBeCloseTo(0.95);
    expect(learnTaste(undefined, false)).toBeCloseTo(1.1);
    let f: number | undefined;
    for (let i = 0; i < 30; i++) f = learnTaste(f, true);
    expect(f).toBe(URGE_TUNING.learnedMin);
    for (let i = 0; i < 30; i++) f = learnTaste(f, false);
    expect(f).toBe(URGE_TUNING.learnedMax);
    expect(effectiveThreshold(NEUTRAL_TEMPERAMENT, 'normal', 1.5)).toBeCloseTo(15);
    const s = addReasons(freshUrge(T0), [{ pts: 12, text: 'x' }], NOW);
    expect(urgeStanding(s, NEUTRAL_TEMPERAMENT, 'normal', NOW)).toBe('speak');
    expect(urgeStanding(s, NEUTRAL_TEMPERAMENT, 'normal', NOW, 1.5)).toBe('tell');
    expect(pickWakes([{ key: 'a', state: s, talk: 'normal', scale: 1.5 }], NOW, 2)).toEqual([]);
  });

  it('rank: cadets (leaders included) defer to officers and command', () => {
    expect(rankFromRole('Commanding General of Basgiath')).toBe('command');
    expect(rankFromRole('Vice commandant of the Riders')).toBe('command');
    expect(rankFromRole('Lieutenant at Montserrat')).toBe('officer');
    expect(rankFromRole('Wingleader of Fourth Wing (third-year)')).toBe('cadet');
    expect(rankFromRole('Squad leader, Second Squad')).toBe('cadet');
    expect(rankFromRole(undefined)).toBe('cadet');
    expect(rankFromRole('Physical training instructor', 'Professor Emetterio')).toBe('command');
    expect(rankFromRole("Prince Halden's guard", 'Captain Anna Winshire')).toBe('officer');
    expect(rankFromRole('Crown prince of Navarre', 'Prince Halden')).toBe('command');
    expect(rankScale('cadet', ['cadet', 'command'])).toBe(URGE_TUNING.outrankedScale);
    expect(rankScale('officer', ['cadet'])).toBe(1);
    expect(rankScale('command', ['command'])).toBe(1);
  });

  it('an ignored question pushes after two missed lines, then a little more each line', () => {
    expect(asksQuestion('**Dain:** "Where were you last night?"')).toBe(true);
    expect(asksQuestion('**Dain:** "Stand down."')).toBe(false);
    expect(ignoredQuestionReasons(1)).toEqual([]);
    expect(total(ignoredQuestionReasons(2))).toBe(4);
    expect(total(ignoredQuestionReasons(3))).toBe(2);
  });

  it('table energy: a tense post lowers the bar for five minutes, a calm one raises it', () => {
    expect(tableEnergy('Blood on the flagstones. A scream. Someone is dead.')).toBe('tense');
    expect(tableEnergy('You walk the quiet corridor to class.')).toBe('calm');
    expect(tableEnergy('A dagger lies on the desk.')).toBe('normal');
    expect(tableEnergy('')).toBe('normal');
    expect(energyScale('tense', 60_000)).toBe(URGE_TUNING.tenseScale);
    expect(energyScale('tense', URGE_TUNING.tenseForMs + 1)).toBe(1);
    expect(energyScale('calm', 999_999_999)).toBe(URGE_TUNING.calmScale);
    expect(energyScale('normal', 0)).toBe(1);
  });
});

describe('Tier 3: memories as triggers, and the judge', () => {
  const memories = [
    'Kylar kept quiet when Dain asked who broke formation.',
    'Kylar shared her rations on the Gauntlet.',
    'Kylar lied to the Commandant about the missing daggers.',
  ];

  it('a line that shares distinctive words with a memory finds it; names and common words never count', () => {
    expect(memoryMatch('I never told anyone who broke formation that day', memories, ['Kylar', 'Dain Aetos'])?.index).toBe(0);
    expect(memoryMatch('Remember the Gauntlet? I still owe you rations', memories, ['Kylar'])?.index).toBe(1);
    // One long shared word (8+ letters) is enough; one short one is not.
    expect(memoryMatch('What did the commandant want?', memories, ['Kylar'])?.index).toBe(2);
    expect(memoryMatch('Who has my daggers?', memories, ['Kylar'])).toBeNull();
    expect(memoryMatch('Kylar and Dain should talk about something', memories, ['Kylar', 'Dain Aetos'])).toBeNull();
    expect(memoryMatch('', memories, [])).toBeNull();
    const r = memoryReason(memories[1]);
    expect(r.pts).toBe(URGE_TIER3.memoryPts);
    expect(r.text).toContain('shared her rations');
  });

  it('the judge is asked only for real sentences, aimed at somebody, that the word lists made little of', () => {
    expect(needsJudge('Oh, what a fine leader you make', 1, [])).toBe(true);
    expect(needsJudge('Oh, what a fine leader you make', 6, [])).toBe(false);
    expect(needsJudge('Fine. Whatever.', 0, [])).toBe(false);
    // Not aimed at anybody: nothing to judge.
    expect(needsJudge('What a lovely quiet morning this is', 0, ['Dain'])).toBe(false);
    expect(needsJudge('Funny how Dain always knows the rules', 0, ['Dain'])).toBe(true);
  });

  it('judge reads become urge, weighted by temperament and strength, plus the memory it names', () => {
    const jackT = TEMPERAMENTS['jack-barlowe'];
    expect(total(judgeReasons({ key: 'jack-barlowe', read: 'insult', strength: 3, memory: 0 }, jackT, []))).toBe(4 * 2);
    expect(total(judgeReasons({ key: 'jack-barlowe', read: 'insult', strength: 1, memory: 0 }, jackT, []))).toBe(4 * 2 * 0.5);
    expect(total(judgeReasons({ key: 'x', read: 'flirt', strength: 2, memory: 0 }, undefined, []))).toBeCloseTo(2.25);
    const withMemory = judgeReasons({ key: 'x', read: 'none', strength: 1, memory: 2 }, undefined, memories);
    expect(withMemory).toHaveLength(1);
    expect(withMemory[0].text).toContain('rations');
    expect(judgeReasons({ key: 'x', read: 'none', strength: 1, memory: 9 }, undefined, memories)).toEqual([]);
  });
});
