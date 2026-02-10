import { describe, it, expect } from 'vitest';
import { parseRestMatches, parseDowntimeMatches } from '../patterns/rests';

describe('parseRestMatches', () => {
  it('detects "takes a short rest"', () => {
    const r = parseRestMatches('The party takes a short rest.');
    expect(r).toHaveLength(1);
    expect(r[0].restType).toBe('short');
  });

  it('detects "short rest completed"', () => {
    const r = parseRestMatches('Short rest completed.');
    expect(r).toHaveLength(1);
    expect(r[0].restType).toBe('short');
  });

  it('detects "rests for an hour"', () => {
    const r = parseRestMatches('The fighter rests for an hour.');
    expect(r).toHaveLength(1);
    expect(r[0].restType).toBe('short');
  });

  it('detects "takes a long rest"', () => {
    const r = parseRestMatches('Everyone takes a long rest.');
    expect(r).toHaveLength(1);
    expect(r[0].restType).toBe('long');
  });

  it('detects "long rest completed"', () => {
    const r = parseRestMatches('Long rest completed, spells restored.');
    expect(r).toHaveLength(1);
    expect(r[0].restType).toBe('long');
  });

  it('detects "rests for the night" (long rest)', () => {
    const r = parseRestMatches('The party rests for the night.');
    expect(r).toHaveLength(1);
    expect(r[0].restType).toBe('long');
  });

  it('detects "overnight rest"', () => {
    const r = parseRestMatches('After an overnight rest the party sets out.');
    expect(r).toHaveLength(1);
    expect(r[0].restType).toBe('long');
  });

  it('detects "makes camp for the night"', () => {
    const r = parseRestMatches('They make camp for the night.');
    expect(r).toHaveLength(1);
    expect(r[0].restType).toBe('long');
  });

  it('detects both short and long rests in one log', () => {
    const text = 'Takes a short rest. Later takes a long rest.';
    const r = parseRestMatches(text);
    expect(r).toHaveLength(2);
    expect(r.map(m => m.restType)).toContain('short');
    expect(r.map(m => m.restType)).toContain('long');
  });

  it('returns empty for no matches', () => {
    expect(parseRestMatches('The rogue sneaks ahead.')).toHaveLength(0);
  });
});

describe('parseDowntimeMatches', () => {
  it('detects "spends 5 days crafting"', () => {
    const r = parseDowntimeMatches('She spends 5 days crafting potions.');
    expect(r).toHaveLength(1);
    expect(r[0].duration).toBe(5);
    expect(r[0].unit).toBe('days');
  });

  it('detects "downtime: crafting for 2 weeks"', () => {
    const r = parseDowntimeMatches('Downtime: crafting for 2 weeks.');
    expect(r).toHaveLength(1);
    expect(r[0].duration).toBe(2);
    expect(r[0].unit).toBe('weeks');
  });

  it('returns empty for no matches', () => {
    expect(parseDowntimeMatches('Combat begins.')).toHaveLength(0);
  });
});
