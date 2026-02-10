import { describe, it, expect } from 'vitest';
import { parseDeathSaveMatches } from '../patterns/deathSaves';

describe('parseDeathSaveMatches', () => {
  it('detects "death save: 15" as success', () => {
    const r = parseDeathSaveMatches('Death save: 15');
    expect(r).toHaveLength(1);
    expect(r[0].outcome).toBe('success');
    expect(r[0].roll).toBe(15);
  });

  it('detects "death save: 8" as failure', () => {
    const r = parseDeathSaveMatches('Death save: 8');
    expect(r).toHaveLength(1);
    expect(r[0].outcome).toBe('failure');
    expect(r[0].roll).toBe(8);
  });

  it('detects natural 20 as critical success', () => {
    const r = parseDeathSaveMatches('Death save: natural 20!');
    expect(r).toHaveLength(1);
    expect(r[0].outcome).toBe('critical_success');
    expect(r[0].roll).toBe(20);
  });

  it('detects natural 1 as critical failure', () => {
    const r = parseDeathSaveMatches('Death save: 1');
    expect(r).toHaveLength(1);
    expect(r[0].outcome).toBe('critical_failure');
  });

  it('detects text-based "death save: success"', () => {
    const r = parseDeathSaveMatches('Death save: success');
    expect(r).toHaveLength(1);
    expect(r[0].outcome).toBe('success');
  });

  it('detects text-based "death save: failure"', () => {
    const r = parseDeathSaveMatches('Death saving throw: failed');
    expect(r).toHaveLength(1);
    expect(r[0].outcome).toBe('failure');
  });

  it('detects "makes a death saving throw and rolls a 12"', () => {
    const r = parseDeathSaveMatches('He makes a death saving throw and rolls a 12.');
    expect(r).toHaveLength(1);
    expect(r[0].outcome).toBe('success');
    expect(r[0].roll).toBe(12);
  });

  it('detects "nat 20 on death save" without double-counting', () => {
    const r = parseDeathSaveMatches('Rolls a nat 20 on death save!');
    // Should produce exactly 1 match, not 2
    expect(r).toHaveLength(1);
    expect(r[0].outcome).toBe('critical_success');
  });

  it('deduplicates overlapping patterns for same event', () => {
    // "death save: natural 20" could match pattern 1 AND pattern 4/5
    const r = parseDeathSaveMatches('Death save: natural 20');
    const critSuccesses = r.filter(m => m.outcome === 'critical_success');
    expect(critSuccesses).toHaveLength(1);
  });

  it('handles multiple death saves in one log', () => {
    const text = 'Death save: 14 (success). Later, death save: 7 (failure).';
    const r = parseDeathSaveMatches(text);
    expect(r).toHaveLength(2);
    expect(r[0].outcome).toBe('success');
    expect(r[1].outcome).toBe('failure');
  });

  it('returns empty for no matches', () => {
    expect(parseDeathSaveMatches('The cleric heals the party.')).toHaveLength(0);
  });
});
