// HP Calculation Tests
// Tests for both legacy single-class and multiclass HP calculations

import { describe, it, expect } from 'vitest';
import {
  calculateMaxHP,
  calculateMulticlassMaxHP,
  getHPBreakdown,
  getMulticlassHPBreakdown,
  getHitDicePool,
  HP_CONFIG,
} from './hpCalculation';
import { DnDClass, ClassLevelMap, CLASS_REGISTRY } from './classes';

describe('calculateMaxHP (Legacy Single-Class)', () => {
  it('calculates level 1 HP correctly', () => {
    // Level 1, CON +2, no prestige
    expect(calculateMaxHP(1, 2, 0)).toBe(10); // 8 + 2
  });

  it('calculates multi-level HP correctly', () => {
    // Level 5, CON +3, no prestige
    // = 8 + 3 (level 1) + 4 * (5 + 3) (levels 2-5) = 11 + 32 = 43
    expect(calculateMaxHP(5, 3, 0)).toBe(43);
  });

  it('adds prestige HP bonus', () => {
    // Level 10, CON +2, prestige 5
    // = 8 + 2 + 9 * (5 + 2) + 5 * 2 = 10 + 63 + 10 = 83
    expect(calculateMaxHP(10, 2, 5)).toBe(83);
  });

  it('handles negative CON modifier', () => {
    // Level 3, CON -1, no prestige
    // = 8 + (-1) + 2 * (5 + (-1)) = 7 + 8 = 15
    expect(calculateMaxHP(3, -1, 0)).toBe(15);
  });

  it('ensures minimum 1 HP', () => {
    // Level 1, CON -10 (extreme case)
    expect(calculateMaxHP(1, -10, 0)).toBe(1);
  });

  it('clamps level to valid range', () => {
    // Level 25 should be treated as 20
    const level20HP = calculateMaxHP(20, 0, 0);
    const level25HP = calculateMaxHP(25, 0, 0);
    expect(level25HP).toBe(level20HP);
  });
});

describe('getHPBreakdown', () => {
  it('breaks down HP components correctly', () => {
    const breakdown = getHPBreakdown(5, 2, 1);
    
    expect(breakdown.baseHP).toBe(8);
    expect(breakdown.levelHP).toBe(20); // 4 levels * 5
    expect(breakdown.constitutionHP).toBe(10); // 5 levels * 2
    expect(breakdown.prestigeHP).toBe(2); // 1 prestige * 2
    expect(breakdown.totalHP).toBe(40); // 8 + 20 + 10 + 2
  });

  it('handles level 1 correctly', () => {
    const breakdown = getHPBreakdown(1, 3, 0);
    
    expect(breakdown.baseHP).toBe(8);
    expect(breakdown.levelHP).toBe(0);
    expect(breakdown.constitutionHP).toBe(3);
    expect(breakdown.totalHP).toBe(11);
  });
});

describe('calculateMulticlassMaxHP', () => {
  it('calculates single-class HP using class hit die', () => {
    // Wizard level 5, CON +2
    // d6 class: max 6 + avg 4 for levels 2-5
    // = 6 + 2 + 4 * (4 + 2) = 8 + 24 = 32
    const hp = calculateMulticlassMaxHP('wizard', 5, {}, 2, 0);
    expect(hp).toBe(32);
  });

  it('calculates rogue HP correctly (d8)', () => {
    // Rogue level 5, CON +2
    // = 8 + 2 + 4 * (5 + 2) = 10 + 28 = 38
    const hp = calculateMulticlassMaxHP('rogue', 5, {}, 2, 0);
    expect(hp).toBe(38);
  });

  it('calculates multiclass HP correctly', () => {
    // Wizard 3, Cleric 2, CON +2
    // Wizard primary: 6 + 2 + 2 * (4 + 2) = 8 + 12 = 20
    // Cleric multiclass: 2 * (5 + 2) = 14
    // Total: 20 + 14 = 34
    const hp = calculateMulticlassMaxHP('wizard', 3, { cleric: 2 }, 2, 0);
    expect(hp).toBe(34);
  });

  it('handles multiple multiclasses', () => {
    // Rogue 5, Wizard 2, Warlock 3, CON +1
    // Rogue: 8 + 1 + 4 * (5 + 1) = 9 + 24 = 33
    // Wizard: 2 * (4 + 1) = 10
    // Warlock: 3 * (5 + 1) = 18
    // Total: 33 + 10 + 18 = 61
    const hp = calculateMulticlassMaxHP(
      'rogue', 
      5, 
      { wizard: 2, warlock: 3 }, 
      1, 
      0
    );
    expect(hp).toBe(61);
  });

  it('adds prestige bonus', () => {
    // Wizard 5, CON +2, Prestige 3
    // = 32 (from above) + 3 * 2 = 38
    const hp = calculateMulticlassMaxHP('wizard', 5, {}, 2, 3);
    expect(hp).toBe(38);
  });

  it('ensures minimum 1 HP with extreme negative CON', () => {
    const hp = calculateMulticlassMaxHP('wizard', 1, {}, -20, 0);
    expect(hp).toBe(1);
  });
});

describe('getMulticlassHPBreakdown', () => {
  it('breaks down multiclass HP correctly', () => {
    const breakdown = getMulticlassHPBreakdown('rogue', 3, { wizard: 2 }, 2, 1);
    
    // Primary (rogue): 8 + 2 * 5 = 18 (die only)
    expect(breakdown.primaryClassHP).toBe(18);
    
    // Wizard multiclass: 2 * 4 = 8 (die only)
    expect(breakdown.multiclassHP['wizard']).toBe(8);
    
    // CON: 5 total levels * 2 = 10
    expect(breakdown.constitutionHP).toBe(10);
    
    // Prestige: 1 * 2 = 2
    expect(breakdown.prestigeHP).toBe(2);
    
    // Total: 18 + 8 + 10 + 2 = 38
    expect(breakdown.totalHP).toBe(38);
  });
});

describe('getHitDicePool', () => {
  it('returns correct pool for single class', () => {
    const pool = getHitDicePool('rogue', 5, {});
    expect(pool['d8']).toBe(5);
    expect(pool['d6']).toBeUndefined();
  });

  it('returns correct pool for multiclass', () => {
    const pool = getHitDicePool('rogue', 5, { wizard: 3 });
    expect(pool['d8']).toBe(5); // Rogue
    expect(pool['d6']).toBe(3); // Wizard
  });

  it('aggregates same die types', () => {
    // Cleric (d8) and Warlock (d8)
    const pool = getHitDicePool('cleric', 3, { warlock: 2 });
    expect(pool['d8']).toBe(5); // Both use d8
  });

  it('handles multiple different dice', () => {
    const pool = getHitDicePool('rogue', 2, { wizard: 2, druid: 2 });
    expect(pool['d8']).toBe(4); // Rogue 2 + Druid 2
    expect(pool['d6']).toBe(2); // Wizard 2
  });
});

describe('Class Hit Die Configurations', () => {
  it('all classes have valid hit die values', () => {
    const expectedHitDice: Record<DnDClass, { die: string; max: number; avg: number }> = {
      rogue: { die: 'd8', max: 8, avg: 5 },
      wizard: { die: 'd6', max: 6, avg: 4 },
      sorcerer: { die: 'd6', max: 6, avg: 4 },
      warlock: { die: 'd8', max: 8, avg: 5 },
      cleric: { die: 'd8', max: 8, avg: 5 },
      druid: { die: 'd8', max: 8, avg: 5 },
      bard: { die: 'd8', max: 8, avg: 5 },
    };

    for (const [classId, expected] of Object.entries(expectedHitDice)) {
      const config = CLASS_REGISTRY[classId as DnDClass];
      expect(config.hitDie, `${classId} hitDie`).toBe(expected.die);
      expect(config.hitDieMax, `${classId} hitDieMax`).toBe(expected.max);
      expect(config.hitDieAvg, `${classId} hitDieAvg`).toBe(expected.avg);
    }
  });
});
