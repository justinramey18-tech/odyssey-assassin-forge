import { describe, it, expect } from 'vitest';
import { parseInitiativeMatches } from '../patterns/initiative';

describe('parseInitiativeMatches', () => {
  it('detects "Initiative: 18"', () => {
    const r = parseInitiativeMatches('Initiative: 18');
    expect(r).toHaveLength(1);
    expect(r[0].singleRoll).toBe(18);
  });

  it('detects "rolls initiative: 15"', () => {
    const r = parseInitiativeMatches('Grak rolls initiative: 15');
    expect(r).toHaveLength(1);
    expect(r[0].singleRoll).toBe(15);
  });

  it('detects "rolls 18 for initiative"', () => {
    const r = parseInitiativeMatches('Elara rolls 18 for initiative.');
    expect(r).toHaveLength(1);
    expect(r[0].singleRoll).toBe(18);
    expect(r[0].rolls[0]?.name).toBe('Elara');
  });

  it('parses initiative order with multiple entries', () => {
    const r = parseInitiativeMatches('Initiative order: Elara 18, Goblin 12, Orc 8');
    expect(r).toHaveLength(1);
    expect(r[0].rolls).toHaveLength(3);
    expect(r[0].rolls.map(e => e.name)).toEqual(['Elara', 'Goblin', 'Orc']);
    expect(r[0].rolls.map(e => e.roll)).toEqual([18, 12, 8]);
  });

  it('rejects rolls outside 1-40', () => {
    const r = parseInitiativeMatches('Initiative: 0. Also Initiative: 50.');
    expect(r).toHaveLength(0);
  });

  it('does not double-count overlapping patterns', () => {
    // "rolls initiative: 15" could match pattern 1 AND pattern 3 overlap area
    const r = parseInitiativeMatches('The rogue rolls initiative: 15');
    expect(r).toHaveLength(1);
  });

  it('handles multiple separate initiative rolls', () => {
    const text = 'Elara rolls 18 for initiative. The Goblin gets initiative: 12.';
    const r = parseInitiativeMatches(text);
    expect(r).toHaveLength(2);
  });

  it('detects named roller from preceding text', () => {
    const r = parseInitiativeMatches('Thordak rolls 22 for initiative');
    expect(r.length).toBeGreaterThanOrEqual(1);
    const named = r.find(m => m.rolls.length > 0);
    expect(named?.rolls[0]?.name).toBe('Thordak');
  });

  it('returns empty for no matches', () => {
    expect(parseInitiativeMatches('The party rests for the night.')).toHaveLength(0);
  });
});
