import { describe, it, expect } from 'vitest';
import { diceAverage, foeFromNpc } from '@/lib/arena/arenaFoe';
import { gauntletFoe } from '@/components/arena/ArenaPractice';

describe('arena opponents', () => {
  it('averages dice damage', () => {
    expect(diceAverage('2d6+3')).toBe(10);
    expect(diceAverage('7')).toBeNull();
  });
  it('turns a saved NPC into a practice foe', () => {
    expect(foeFromNpc('Vex', { maxHp: 40, ac: 14, attackBonus: 5, damage: '1d8+2', speed: 'hard' }))
      .toEqual({ name: 'Vex', maxHp: 40, ac: 14, attackBonus: 5, damageAvg: 6.5, speed: 'hard' });
  });
  it('skips NPCs without usable stats', () => {
    expect(foeFromNpc('X', { maxHp: NaN, ac: 10, attackBonus: 1 })).toBeNull();
  });
  it('gauntlet waves get tougher', () => {
    expect(gauntletFoe(3).maxHp).toBeGreaterThan(gauntletFoe(1).maxHp);
    expect(gauntletFoe(1).maxHp).toBe(32);
  });
});
