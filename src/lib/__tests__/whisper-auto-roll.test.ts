import { describe, expect, it, vi } from 'vitest';

// Fixed d20 so only the modifier math is under test.
vi.mock('@/lib/rollD20', () => ({ rollD20: () => ({ rolls: [10], kept: 10 }) }));

import { performWhisperRoll } from '@/lib/whisperAutoRoll';

const score = (final: number) => ({ base: final, modifier: Math.floor((final - 10) / 2), final });

// Solo shape (PromptDrawerProvider): full ability names, object values, proficiencies.skills.
const solo = {
  name: 'Rider',
  level: 5,
  abilityScores: {
    strength: score(18), dexterity: score(14), constitution: score(12),
    intelligence: score(10), wisdom: score(8), charisma: score(16),
  },
  proficiencies: { skills: ['Athletics'], saves: ['dexterity'] },
} as any;

const hint = (over: Record<string, unknown>) =>
  ({ ability: null, skillId: null, isSave: false, dc: 15, rollMode: 'normal', ...over }) as any;

const roll = (ctx: any, h: any) => performWhisperRoll({ hint: h, actionPhrase: 'try it', characterContext: ctx });

describe('one-tap whisper rolls read the real ability score (CL-050)', () => {
  it('solo object scores: STR 18 gives +4', () => {
    expect(roll(solo, hint({ ability: 'str' })).modifier).toBe(4);
  });
  it('solo object scores: WIS 8 gives -1', () => {
    expect(roll(solo, hint({ ability: 'wis' })).modifier).toBe(-1);
  });
  it('skill proficiency still adds on top (Athletics, level 5: +4 +3)', () => {
    const r = roll(solo, hint({ skillId: 'athletics' }));
    expect(r.modifier).toBe(7);
    expect(r.total).toBe(17);
  });
  it('save proficiency still adds on top (DEX save, level 5: +2 +3)', () => {
    expect(roll(solo, hint({ ability: 'dex', isSave: true })).modifier).toBe(5);
  });
  it('uses the final score (gear included), not the base', () => {
    const geared = { ...solo, abilityScores: { ...solo.abilityScores, strength: { base: 14, modifier: 2, final: 20 } } };
    expect(roll(geared, hint({ ability: 'str' })).modifier).toBe(5);
  });
  it('party seat shape (PartyDMScreen partyMemberDiceContext) reads the score too', () => {
    const seat = { level: 1, abilityScores: { charisma: { base: 16, final: 16, modifier: 3 } }, skillProficiencies: [], savingThrowProficiencies: [] } as any;
    expect(roll(seat, hint({ ability: 'cha' })).modifier).toBe(3);
  });
  it('plain numbers still work', () => {
    expect(roll({ level: 1, abilityScores: { str: 12 } } as any, hint({ ability: 'str' })).modifier).toBe(1);
  });
  it('a missing or broken score falls back to 10 (+0)', () => {
    expect(roll({ level: 1 } as any, hint({ ability: 'str' })).modifier).toBe(0);
    expect(roll({ level: 1, abilityScores: { strength: { final: 'x' } } } as any, hint({ ability: 'str' })).modifier).toBe(0);
  });
});
