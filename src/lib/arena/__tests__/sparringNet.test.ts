import { describe, it, expect } from 'vitest';
import { cleanPlayer } from '../sparringNet';

describe('sparring player from the network', () => {
  it('refuses a player with a broken number', () => {
    expect(cleanPlayer({ userId: 'u', name: 'A', maxHp: NaN, ac: 12, level: 3, atk: 5 })).toBeNull();
  });
  it('clamps health and armor to sane limits', () => {
    const p = cleanPlayer({ userId: 'u', name: 'A', maxHp: 99999, ac: 99, level: 3, atk: 5 });
    expect(p?.maxHp).toBe(999);
    expect(p?.ac).toBe(30);
  });
});
