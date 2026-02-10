import { describe, it, expect } from 'vitest';
import { applyCrossCategoryValidation } from '../crossCategoryValidation';
import { ChronicleParseResult } from '../types';

function emptyResult(): ChronicleParseResult {
  return {
    xpChanges: [],
    hpChanges: [],
    itemChanges: [],
    achievementTriggers: [],
    goldChanges: [],
    shopItems: [],
    conditions: [],
    combatEvents: [],
    enemies: [],
    levelUp: null,
    parseMode: 'offline',
    parsedAt: new Date().toISOString(),
    inputLength: 0,
  };
}

describe('applyCrossCategoryValidation', () => {
  // Rule 1: XP near combat
  it('boosts XP confidence when near a combat event', () => {
    const src = 'The party defeated the goblin chief. Gained 500 XP for the encounter.';
    const result = emptyResult();
    result.xpChanges.push({ amount: 500, context: '', confidence: 'low', sourceText: 'Gained 500 XP' });
    result.combatEvents.push({ type: 'kill', sourceText: 'defeated the goblin chief' });

    const boosted = applyCrossCategoryValidation(result, src);
    expect(boosted.xpChanges[0].confidence).toBe('medium'); // low → medium
  });

  it('boosts XP from low to medium (not directly to high) for single corroboration', () => {
    const src = 'Killed the dragon. Earned 5000 XP.';
    const result = emptyResult();
    result.xpChanges.push({ amount: 5000, context: '', confidence: 'low', sourceText: 'Earned 5000 XP' });
    result.combatEvents.push({ type: 'kill', sourceText: 'Killed the dragon' });

    const boosted = applyCrossCategoryValidation(result, src);
    expect(boosted.xpChanges[0].confidence).toBe('medium');
  });

  // Rule 2: Healing near item use
  it('boosts consumed healing item confidence when near healing event', () => {
    const src = 'Drinks a healing potion and recovers 10 hit points.';
    const result = emptyResult();
    result.itemChanges.push({
      name: 'healing potion', quantity: 1, action: 'consumed',
      confidence: 'low', sourceText: 'healing potion',
    });
    result.hpChanges.push({
      amount: 10, type: 'healing', source: 'potion', sourceText: 'recovers 10 hit points',
    });

    const boosted = applyCrossCategoryValidation(result, src);
    expect(boosted.itemChanges[0].confidence).toBe('medium');
  });

  it('does not boost non-healing consumed items', () => {
    const src = 'Uses a scroll of fireball. Heals 10 HP later.';
    const result = emptyResult();
    result.itemChanges.push({
      name: 'scroll of fireball', quantity: 1, action: 'consumed',
      confidence: 'low', sourceText: 'scroll of fireball',
    });
    result.hpChanges.push({
      amount: 10, type: 'healing', source: 'spell', sourceText: 'Heals 10 HP',
    });

    const boosted = applyCrossCategoryValidation(result, src);
    expect(boosted.itemChanges[0].confidence).toBe('low'); // no boost
  });

  // Rule 3: Item acquired near gold spent (purchase)
  it('boosts acquired item confidence when near gold spent', () => {
    const src = 'Buys a longsword for 15 gold pieces at the shop.';
    const result = emptyResult();
    result.itemChanges.push({
      name: 'longsword', quantity: 1, action: 'acquired',
      confidence: 'low', sourceText: 'longsword',
    });
    result.goldChanges.push({ amount: 15, action: 'spent', sourceText: '15 gold pieces' });

    const boosted = applyCrossCategoryValidation(result, src);
    expect(boosted.itemChanges[0].confidence).toBe('medium');
  });

  // Rule 5: Gold gained near combat (loot)
  it('boosts XP when gold gained and combat are nearby', () => {
    const src = 'Defeated the bandits. Found 50 gold. Earned 200 XP.';
    const result = emptyResult();
    result.xpChanges.push({ amount: 200, context: '', confidence: 'low', sourceText: 'Earned 200 XP' });
    result.combatEvents.push({ type: 'kill', sourceText: 'Defeated the bandits' });
    result.goldChanges.push({ amount: 50, action: 'gained', sourceText: 'Found 50 gold' });

    const boosted = applyCrossCategoryValidation(result, src);
    // Both rule 1 (XP near combat) and rule 5 (gold near combat) fire
    expect(boosted.xpChanges[0].confidence).toBe('high'); // low → medium → high
  });

  // Rule 6: Cure near condition removal
  it('boosts consumed cure item near condition removal', () => {
    const src = 'Uses antitoxin. The poisoned condition is removed.';
    const result = emptyResult();
    result.itemChanges.push({
      name: 'antitoxin', quantity: 1, action: 'consumed',
      confidence: 'low', sourceText: 'antitoxin',
    });
    result.conditions.push({ name: 'poisoned', action: 'removed', sourceText: 'poisoned condition is removed' });

    const boosted = applyCrossCategoryValidation(result, src);
    expect(boosted.itemChanges[0].confidence).toBe('medium');
  });

  // No boost when snippets are far apart
  it('does not boost when events are far apart in text', () => {
    const padding = 'x'.repeat(700);
    const src = `Gained 100 XP. ${padding} Defeated the goblin.`;
    const result = emptyResult();
    result.xpChanges.push({ amount: 100, context: '', confidence: 'low', sourceText: 'Gained 100 XP' });
    result.combatEvents.push({ type: 'kill', sourceText: 'Defeated the goblin' });

    const boosted = applyCrossCategoryValidation(result, src);
    expect(boosted.xpChanges[0].confidence).toBe('low'); // no boost
  });

  // Does not mutate original
  it('returns a new object without mutating the original', () => {
    const src = 'Defeated goblin. Gained 100 XP.';
    const result = emptyResult();
    result.xpChanges.push({ amount: 100, context: '', confidence: 'low', sourceText: 'Gained 100 XP' });
    result.combatEvents.push({ type: 'kill', sourceText: 'Defeated goblin' });

    const boosted = applyCrossCategoryValidation(result, src);
    expect(result.xpChanges[0].confidence).toBe('low'); // original unchanged
    expect(boosted.xpChanges[0].confidence).toBe('medium');
  });

  // Rule 8: Saving throw near condition → boost XP
  it('boosts XP confidence when near a condition application', () => {
    const src = 'The enemy is poisoned. The party earns 150 XP.';
    const result = emptyResult();
    result.xpChanges.push({ amount: 150, context: '', confidence: 'low', sourceText: 'earns 150 XP' });
    result.conditions.push({ name: 'poisoned', action: 'applied', sourceText: 'enemy is poisoned' });

    const boosted = applyCrossCategoryValidation(result, src);
    expect(boosted.xpChanges[0].confidence).toBe('medium');
  });

  // Rule 10: Spell slot near XP
  it('boosts XP when spell casting is near', () => {
    const src = 'The wizard casts a spell at the ogre. The party gains 300 XP.';
    const result = emptyResult();
    result.xpChanges.push({ amount: 300, context: '', confidence: 'low', sourceText: 'gains 300 XP' });
    result.combatEvents.push({ type: 'kill', sourceText: 'casts a spell at the ogre' });

    const boosted = applyCrossCategoryValidation(result, src);
    // Rule 1 (combat near XP) and Rule 10 (spell near XP) both fire
    expect(boosted.xpChanges[0].confidence).not.toBe('low');
  });

  // Empty result passes through
  it('handles empty result gracefully', () => {
    const result = emptyResult();
    const boosted = applyCrossCategoryValidation(result, '');
    expect(boosted.xpChanges).toHaveLength(0);
    expect(boosted.itemChanges).toHaveLength(0);
  });
});
