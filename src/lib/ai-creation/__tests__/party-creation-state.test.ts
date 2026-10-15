import { describe, it, expect } from 'vitest';
import { validateAgainstRules, fallbackKey, sanitizeDraft } from '../party-creation-state';

const build: any = { name: 'Tess', level: 3, primaryClass: 'rogue', race: 'Elf', starterAbilities: [],
  abilityScores: { strength: 10, dexterity: 16, constitution: 12, intelligence: 10, wisdom: 10, charisma: 12 } };

describe('party creation rules', () => {
  it('rejects a level that differs from the campaign starting level', () => {
    expect(validateAgainstRules(build, { startingLevel: 1 })).toContain('This party starts at level 1; the build is level 3.');
  });
  it('blocks finishing while campaign rules conflict', () => {
    expect(validateAgainstRules(build, { startingLevel: 3, unresolved: ['Level 1 vs 3'] }).length).toBe(1);
  });
  it('accepts a build that matches the rules', () => {
    expect(validateAgainstRules(build, { startingLevel: 3, allowedClasses: ['rogue'] })).toEqual([]);
  });
  it('rejects NaN ability scores', () => {
    expect(validateAgainstRules({ ...build, abilityScores: { ...build.abilityScores, strength: NaN } }, null).length).toBe(1);
  });
  it('keys the local fallback by user, party and session', () => {
    expect(fallbackKey('u1', 'p1', 's1')).not.toBe(fallbackKey('u2', 'p1', 's1'));
  });
  it('drops malformed messages from a stored draft', () => {
    expect(sanitizeDraft({ messages: [{ role: 'system', content: 'x' }, { role: 'user', content: 'hi' }] })!.messages).toHaveLength(1);
  });
});
