import { describe, it, expect } from 'vitest';
import { parseInspirationMatches } from '../patterns/inspiration';

describe('parseInspirationMatches', () => {
  it('detects "DM grants inspiration"', () => {
    const r = parseInspirationMatches('The DM grants inspiration for clever roleplay.');
    expect(r).toHaveLength(1);
    expect(r[0].inspirationType).toBe('granted');
  });

  it('detects "uses inspiration"', () => {
    const r = parseInspirationMatches('Elara uses inspiration to reroll the attack.');
    expect(r).toHaveLength(1);
    expect(r[0].inspirationType).toBe('used');
  });

  it('detects bardic inspiration with die size', () => {
    const r = parseInspirationMatches('The bard grants bardic inspiration d8 to the fighter.');
    const bardic = r.filter(m => m.inspirationType === 'bardic_granted');
    expect(bardic.length).toBeGreaterThanOrEqual(1);
    expect(bardic[0].bardicDie).toBe(8);
  });

  it('detects bardic inspiration used', () => {
    const r = parseInspirationMatches('The fighter adds bardic inspiration d10 to the attack roll.');
    const bardic = r.filter(m => m.inspirationType === 'bardic_used');
    expect(bardic).toHaveLength(1);
    expect(bardic[0].bardicDie).toBe(10);
  });

  it('does NOT double-count "grants bardic inspiration" as both granted + bardic', () => {
    const r = parseInspirationMatches('The bard grants bardic inspiration to the rogue.');
    // Should only produce ONE result (bardic_granted), not two
    const types = r.map(m => m.inspirationType);
    expect(types.filter(t => t === 'granted')).toHaveLength(0);
    expect(types.filter(t => t === 'bardic_granted')).toHaveLength(1);
  });

  it('detects Lucky feat usage', () => {
    const r = parseInspirationMatches('The halfling uses Lucky to reroll.');
    expect(r).toHaveLength(1);
    expect(r[0].inspirationType).toBe('lucky_used');
  });

  it('detects hero point usage', () => {
    const r = parseInspirationMatches('She spends a hero point on the saving throw.');
    expect(r).toHaveLength(1);
    expect(r[0].inspirationType).toBe('hero_point_used');
  });

  it('detects narrative inspiration', () => {
    const r = parseInspirationMatches('The paladin finds inspiration in the sunrise.');
    expect(r).toHaveLength(1);
    expect(r[0].inspirationType).toBe('narrative');
  });

  it('handles multiple distinct inspiration events', () => {
    const text = 'DM grants inspiration. Later, the rogue uses inspiration on a stealth check.';
    const r = parseInspirationMatches(text);
    expect(r).toHaveLength(2);
    expect(r.map(m => m.inspirationType)).toContain('granted');
    expect(r.map(m => m.inspirationType)).toContain('used');
  });

  it('returns empty for no matches', () => {
    expect(parseInspirationMatches('The party explores the cave.')).toHaveLength(0);
  });
});
