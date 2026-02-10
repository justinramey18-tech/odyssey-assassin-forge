import { describe, it, expect } from 'vitest';
import { parseSkillCheckMatches, parseSavingThrowMatches } from '../patterns/checks';

describe('parseSkillCheckMatches', () => {
  it('detects "Athletics check: 18"', () => {
    const r = parseSkillCheckMatches('Athletics check: 18');
    expect(r).toHaveLength(1);
    expect(r[0].skill).toBe('athletics');
    expect(r[0].roll).toBe(18);
  });

  it('detects "Stealth check: 14 (success)"', () => {
    const r = parseSkillCheckMatches('Stealth check: 14 (success)');
    expect(r).toHaveLength(1);
    expect(r[0].skill).toBe('stealth');
    expect(r[0].roll).toBe(14);
    expect(r[0].outcome).toBe('success');
  });

  it('detects "Perception check: 5 (failure)"', () => {
    const r = parseSkillCheckMatches('Perception check: 5 (failure)');
    expect(r).toHaveLength(1);
    expect(r[0].outcome).toBe('failure');
  });

  it('detects "rolls 15 for Perception"', () => {
    const r = parseSkillCheckMatches('She rolls 15 for Perception.');
    expect(r).toHaveLength(1);
    expect(r[0].skill).toBe('perception');
    expect(r[0].roll).toBe(15);
  });

  it('detects "rolls a 22 for investigation"', () => {
    const r = parseSkillCheckMatches('He rolls a 22 for investigation.');
    expect(r).toHaveLength(1);
    expect(r[0].skill).toBe('investigation');
    expect(r[0].roll).toBe(22);
  });

  it('detects multi-word skills like "animal handling"', () => {
    const r = parseSkillCheckMatches('Animal handling check: 12');
    expect(r).toHaveLength(1);
    expect(r[0].skill).toBe('animal handling');
  });

  it('detects "sleight of hand" check', () => {
    const r = parseSkillCheckMatches('Sleight of hand check: 19');
    expect(r).toHaveLength(1);
    expect(r[0].skill).toBe('sleight of hand');
  });

  it('rejects rolls outside 1-40 range', () => {
    const r = parseSkillCheckMatches('Athletics check: 0');
    expect(r).toHaveLength(0);
  });

  it('handles multiple checks in one log', () => {
    const text = 'Stealth check: 14. Perception check: 18.';
    const r = parseSkillCheckMatches(text);
    expect(r).toHaveLength(2);
  });

  it('returns empty for no matches', () => {
    expect(parseSkillCheckMatches('The party enters the cave.')).toHaveLength(0);
  });
});

describe('parseSavingThrowMatches', () => {
  it('detects "CON save: 12"', () => {
    const r = parseSavingThrowMatches('CON save: 12');
    expect(r).toHaveLength(1);
    expect(r[0].ability).toBe('constitution');
    expect(r[0].roll).toBe(12);
  });

  it('detects "Dexterity saving throw: 18"', () => {
    const r = parseSavingThrowMatches('Dexterity saving throw: 18');
    expect(r).toHaveLength(1);
    expect(r[0].ability).toBe('dexterity');
    expect(r[0].roll).toBe(18);
  });

  it('detects "DEX save: 16 vs DC 14" with auto-outcome', () => {
    const r = parseSavingThrowMatches('DEX save: 16 vs DC 14');
    expect(r).toHaveLength(1);
    expect(r[0].roll).toBe(16);
    expect(r[0].dc).toBe(14);
    expect(r[0].outcome).toBe('success');
  });

  it('detects failure when roll < DC', () => {
    const r = parseSavingThrowMatches('WIS save: 8 vs DC 15');
    expect(r).toHaveLength(1);
    expect(r[0].outcome).toBe('failure');
  });

  it('detects "makes a Wisdom save: 14"', () => {
    const r = parseSavingThrowMatches('She makes a Wisdom save: 14');
    expect(r.length).toBeGreaterThanOrEqual(1);
    const wis = r.find(m => m.ability === 'wisdom');
    expect(wis).toBeDefined();
    expect(wis!.roll).toBe(14);
  });

  it('normalizes abbreviations to full names', () => {
    const r = parseSavingThrowMatches('STR save: 10');
    expect(r[0].ability).toBe('strength');
  });

  it('handles multiple saves in one log', () => {
    const text = 'CON save: 12. DEX save: 18.';
    const r = parseSavingThrowMatches(text);
    expect(r).toHaveLength(2);
  });

  it('returns empty for no matches', () => {
    expect(parseSavingThrowMatches('No saves here.')).toHaveLength(0);
  });
});
