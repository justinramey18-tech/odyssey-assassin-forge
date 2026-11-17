import { describe, expect, it } from 'vitest';
import {
  URGE_RULES, URGE_LINE_MODEL, freshUrge, settleUrge, addReasons, resetUrge, scoreLine,
  spotlightBonus, silenceReasons, effectiveThreshold, urgeStanding, pickWakes, whyBlock,
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
  it('ships the 15 approved profiles and a neutral default', () => {
    expect(Object.keys(TEMPERAMENTS)).toHaveLength(15);
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
