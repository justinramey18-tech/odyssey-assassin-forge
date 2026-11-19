import { describe, expect, it } from 'vitest';
import {
  DRAGON_VOICE_RULES, addBondLine, bondNoteForDm, dragonSpeaks, dragonVoiceAsk, dragonVoiceDecision, dragonVoiceSpoke, freshVoiceState,
  quietEnoughToTurn, readDragonVoice, riderIsTyping, type BondLine, type DragonVoiceMoment,
} from '@/lib/dragon-voice';

const LONG = 'The squad files out of the briefing room in silence. '.repeat(6);
const TENSE = `${LONG} A blade flashes, blood on the stones, and someone screams about a traitor.`;
const T0 = new Date('2026-11-19T12:00:00').getTime();

const moment = (over: Partial<DragonVoiceMoment> = {}): DragonVoiceMoment => ({
  now: T0, dmText: LONG, strain: 0, strainMax: 8, hp: 30, hpMax: 30, mode: 'rare', bonded: true, fightOpen: false, ...over,
});

describe('the dragon\'s voice: when he is asked', () => {
  it('asks him about a real DM post, with the normal bar', () => {
    const d = dragonVoiceDecision(freshVoiceState(), moment());
    expect(d.ask).toBe(true);
    expect(d.must).toBeNull();
    expect(d.bar).toBe(DRAGON_VOICE_RULES.feelBar);
  });

  it('lowers the bar after a tense post', () => {
    expect(dragonVoiceDecision(freshVoiceState(), moment({ dmText: TENSE })).bar).toBe(DRAGON_VOICE_RULES.tenseFeelBar);
  });

  it('never asks when switched off, unbonded, in a fight, or after a short post', () => {
    expect(dragonVoiceDecision(freshVoiceState(), moment({ mode: 'off' })).ask).toBe(false);
    expect(dragonVoiceDecision(freshVoiceState(), moment({ bonded: false })).ask).toBe(false);
    expect(dragonVoiceDecision(freshVoiceState(), moment({ fightOpen: true })).ask).toBe(false);
    expect(dragonVoiceDecision(freshVoiceState(), moment({ dmText: 'You nod.' })).ask).toBe(false);
  });

  it('after he speaks: silent for 3 DM posts and 5 minutes, both', () => {
    let s = dragonVoiceSpoke(dragonVoiceDecision(freshVoiceState(), moment()).state, T0, null);
    // Three posts within a minute: the posts are there, the time is not.
    for (let i = 1; i <= 3; i++) {
      const d = dragonVoiceDecision(s, moment({ now: T0 + i * 20_000 }));
      expect(d.ask).toBe(false);
      s = d.state;
    }
    // Time passed, and the posts were counted.
    expect(dragonVoiceDecision(s, moment({ now: T0 + DRAGON_VOICE_RULES.cooldownMs + 1 })).ask).toBe(true);
    // Time alone is not enough.
    const fresh = dragonVoiceSpoke(freshVoiceState(), T0, null);
    expect(dragonVoiceDecision(fresh, moment({ now: T0 + DRAGON_VOICE_RULES.cooldownMs + 1 })).ask).toBe(false);
  });

  it('stops at the daily cap and starts again the next day', () => {
    let s = freshVoiceState();
    let now = T0;
    for (let i = 0; i < DRAGON_VOICE_RULES.perDay; i++) {
      s = dragonVoiceSpoke({ ...s, day: new Date(now).toDateString() }, now, null);
      now += 1000;
    }
    const later = { ...s, postsSince: 10, lastPushAt: 0 };
    expect(dragonVoiceDecision(later, moment({ now })).ask).toBe(false);
    expect(dragonVoiceDecision(later, moment({ now: now + 24 * 3600_000 })).ask).toBe(true);
  });

  it('a big moment: Strain at 75% of the limit, once, until it passes', () => {
    const high = dragonVoiceDecision(freshVoiceState(), moment({ strain: 6, dmText: 'Short.' }));
    expect(high.must).toBe('strain');
    expect(high.ask).toBe(true);
    // He spoke about it: no second push for the same danger, even after the cooldown.
    const spoke = { ...dragonVoiceSpoke(high.state, T0, 'strain'), postsSince: 10, lastPushAt: 0 };
    expect(dragonVoiceDecision(spoke, moment({ strain: 7, dmText: 'Short.' })).must).toBeNull();
    // It passed, then came back: he may speak again.
    const calm = dragonVoiceDecision(spoke, moment({ strain: 2 })).state;
    expect(dragonVoiceDecision({ ...calm, postsSince: 10 }, moment({ strain: 6, dmText: 'Short.' })).must).toBe('strain');
  });

  it('a big moment: Strain jumping by 2, and HP at a quarter or less (HP comes first)', () => {
    const jump = dragonVoiceDecision({ ...freshVoiceState(), lastStrain: 1 }, moment({ strain: 3 }));
    expect(jump.must).toBe('strain');
    expect(dragonVoiceDecision(freshVoiceState(), moment({ hp: 7 })).must).toBe('hp');
    expect(dragonVoiceDecision(freshVoiceState(), moment({ hp: 8 })).must).toBeNull();
    expect(dragonVoiceDecision(freshVoiceState(), moment({ hp: 5, strain: 7 })).must).toBe('hp');
    // At 0 HP the death saves own the moment.
    expect(dragonVoiceDecision(freshVoiceState(), moment({ hp: 0 })).must).toBeNull();
  });

  it('a big moment still waits out the cooldown, and is not lost', () => {
    const s = dragonVoiceSpoke(freshVoiceState(), T0, null);
    const during = dragonVoiceDecision(s, moment({ now: T0 + 30_000, hp: 5 }));
    expect(during.ask).toBe(false);
    const after = dragonVoiceDecision({ ...during.state, postsSince: 5 }, moment({ now: T0 + DRAGON_VOICE_RULES.cooldownMs + 1, hp: 5 }));
    expect(after.must).toBe('hp');
  });
});

describe('the dragon\'s voice: his answer', () => {
  it('reads the number and the line, without hidden tags or quotes', () => {
    expect(readDragonVoice('FEEL: 9\nLINE: "You are a fool to trust him." <!--DRAGON_MOOD:alert-->')).toEqual({ feel: 9, line: 'You are a fool to trust him.' });
    expect(readDragonVoice('feel: 3\nline: NONE')).toEqual({ feel: 3, line: '' });
    expect(readDragonVoice('I have nothing to say.')).toBeNull();
    expect(readDragonVoice('')).toBeNull();
    expect(readDragonVoice('FEEL: 14\nLINE: Enough.')?.feel).toBe(10);
  });

  it('cuts a rambling line at a sentence end', () => {
    const long = `${'He lies to you and you know it. '.repeat(30)}`;
    const said = readDragonVoice(`FEEL: 9\nLINE: ${long}`);
    expect(said!.line.length).toBeLessThanOrEqual(DRAGON_VOICE_RULES.maxLineChars);
    expect(said!.line.endsWith('.')).toBe(true);
  });

  it('he speaks at the bar or above, or whenever it is a big moment, and never with nothing to say', () => {
    expect(dragonSpeaks({ feel: 8, line: 'No.' }, { must: null, bar: 8 })).toBe(true);
    expect(dragonSpeaks({ feel: 7, line: 'No.' }, { must: null, bar: 8 })).toBe(false);
    expect(dragonSpeaks({ feel: 2, line: 'Breathe.' }, { must: 'strain', bar: 8 })).toBe(true);
    expect(dragonSpeaks({ feel: 10, line: '' }, { must: 'hp', bar: 8 })).toBe(false);
    expect(dragonSpeaks(null, { must: 'hp', bar: 8 })).toBe(false);
  });

  it('the question tells him what he can know, and that a big moment needs a line', () => {
    const plain = dragonVoiceAsk(null);
    expect(plain).toContain('FEEL:');
    expect(plain).toContain('If you were not there');
    expect(plain).not.toContain('You WILL speak');
    expect(dragonVoiceAsk('strain')).toContain('You WILL speak');
    expect(dragonVoiceAsk('hp')).toContain('badly hurt');
  });
});

describe('the dragon\'s voice: the forced turn waits for typing', () => {
  it('typing in the last 3 seconds delays the turn until 2 quiet seconds', () => {
    expect(riderIsTyping(T0 - 1000, T0)).toBe(true);
    expect(riderIsTyping(T0 - 3000, T0)).toBe(false);
    expect(quietEnoughToTurn(T0 - 1500, T0)).toBe(false);
    expect(quietEnoughToTurn(T0 - 2000, T0)).toBe(true);
  });
});

describe('the dragon\'s voice: what the DM is told', () => {
  it('nothing said, nothing sent', () => {
    expect(bondNoteForDm([], 'Tairn', 'Violet')).toBe('');
  });

  it('names both, marks it private, and keeps the order', () => {
    let log: BondLine[] = [];
    log = addBondLine(log, { who: 'dragon', text: 'You are a fool to trust him. <!--DRAGON_MOOD:alert-->' });
    log = addBondLine(log, { who: 'rider', text: '  He saved my life.  ' });
    log = addBondLine(log, { who: 'dragon', text: '<!--DRAGON_MOOD:calm-->' });
    expect(log).toHaveLength(2);
    const note = bondNoteForDm(log, 'Tairn', 'Violet');
    expect(note).toContain('PRIVATE');
    expect(note).toContain('no other character may know it');
    expect(note.indexOf('Tairn: You are a fool to trust him.')).toBeGreaterThan(0);
    expect(note.indexOf('Violet: He saved my life.')).toBeGreaterThan(note.indexOf('Tairn: You are a fool'));
    expect(note).not.toContain('DRAGON_MOOD');
  });

  it('keeps only the last 8 lines and trims long ones', () => {
    let log: BondLine[] = [];
    for (let i = 0; i < 12; i++) log = addBondLine(log, { who: i % 2 ? 'rider' : 'dragon', text: `line ${i} ${'x'.repeat(400)}` });
    expect(log).toHaveLength(DRAGON_VOICE_RULES.noteLines);
    expect(log[0].text.startsWith('line 4')).toBe(true);
    const note = bondNoteForDm(log, 'Tairn', 'Violet');
    expect(note.split('\n').every(l => l.length <= 400)).toBe(true);
  });
});
