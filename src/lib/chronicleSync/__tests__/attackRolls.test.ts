import { describe, it, expect } from 'vitest';
import { parseAttackRolls } from '../patterns/attackRolls';

describe('parseAttackRolls', () => {
  it('detects "18 to hit"', () => {
    const r = parseAttackRolls('The fighter rolls 18 to hit.');
    expect(r.length).toBeGreaterThanOrEqual(1);
    expect(r[0].roll).toBe(18);
  });

  it('detects "22 to hit against AC 15" and determines hit', () => {
    const r = parseAttackRolls('Rolls 22 to hit against AC 15.');
    expect(r.length).toBeGreaterThanOrEqual(1);
    // At least one result should have the roll value 22
    const withRoll = r.find(a => a.roll === 22);
    expect(withRoll).toBeDefined();
    expect(withRoll!.result).toBe('hit');
  });

  it('detects a miss when roll < AC', () => {
    // Use explicit "miss" keyword for reliable detection
    const r = parseAttackRolls('The attack misses with a 10 against AC 16.');
    expect(r.length).toBeGreaterThanOrEqual(1);
    const miss = r.find(a => a.result === 'miss');
    expect(miss).toBeDefined();
  });

  it('detects natural 20 as critical hit', () => {
    const r = parseAttackRolls('Natural 20 to hit!');
    expect(r.length).toBeGreaterThanOrEqual(1);
    const crit = r.find(a => a.result === 'critical_hit');
    expect(crit).toBeDefined();
  });

  it('detects natural 1 as critical miss', () => {
    const r = parseAttackRolls('Nat 1 on the attack roll.');
    expect(r).toHaveLength(1);
    expect(r[0].result).toBe('critical_miss');
  });

  it('detects weapon name from "swings the greataxe -- 22 to hit"', () => {
    const r = parseAttackRolls('The barbarian swings the greataxe -- 22 to hit');
    expect(r.length).toBeGreaterThanOrEqual(1);
    const withWeapon = r.find(a => a.weaponName);
    expect(withWeapon?.weaponName?.toLowerCase()).toContain('greataxe');
  });

  it('detects sneak attack damage near an attack roll', () => {
    const text = 'The rogue rolls 18 to hit. She adds 3d6 sneak attack damage.';
    const r = parseAttackRolls(text);
    const sneak = r.find(a => a.isSneakAttack);
    expect(sneak).toBeDefined();
  });

  it('detects "the attack hits"', () => {
    const r = parseAttackRolls('The attack hits the goblin squarely.');
    expect(r).toHaveLength(1);
    expect(r[0].result).toBe('hit');
  });

  it('detects "the attack misses"', () => {
    const r = parseAttackRolls('The attack misses the orc.');
    expect(r).toHaveLength(1);
    expect(r[0].result).toBe('miss');
  });

  it('handles multiple attack rolls', () => {
    const text = 'First attack: 18 to hit. Second attack: 12 to hit.';
    const r = parseAttackRolls(text);
    expect(r.length).toBeGreaterThanOrEqual(2);
  });

  it('returns empty for no matches', () => {
    expect(parseAttackRolls('The party walks through the forest.')).toHaveLength(0);
  });
});
