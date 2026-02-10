import { describe, it, expect } from 'vitest';
import { attributeHealing } from '../patterns/healingAttribution';

describe('attributeHealing', () => {
  // ===== Spells =====

  it('attributes Cure Wounds as a spell with correct level', () => {
    const result = attributeHealing(8, 'The cleric casts Cure Wounds on the fighter', 'source');
    expect(result.sourceType).toBe('spell');
    expect(result.source).toBe('Cure Wounds');
    expect(result.spellLevel).toBe(1);
    expect(result.confidence).toBe('high');
  });

  it('attributes Mass Cure Wounds as level 5 (longest-first ordering)', () => {
    const result = attributeHealing(20, 'The cleric uses mass cure wounds', 'source');
    expect(result.sourceType).toBe('spell');
    expect(result.spellLevel).toBe(5);
  });

  it('attributes Heal spell as level 6', () => {
    const result = attributeHealing(70, 'casts Heal on the barbarian', 'source');
    expect(result.sourceType).toBe('spell');
    expect(result.spellLevel).toBe(6);
  });

  it('attributes Healing Word as level 1', () => {
    const result = attributeHealing(5, 'uses a healing word as a bonus action', 'source');
    expect(result.sourceType).toBe('spell');
    expect(result.spellLevel).toBe(1);
  });

  // ===== Class features =====

  it('attributes Lay on Hands as a feature', () => {
    const result = attributeHealing(15, 'The paladin uses Lay on Hands', 'source');
    expect(result.sourceType).toBe('feature');
    expect(result.source).toBe('Lay On Hands');
    expect(result.confidence).toBe('high');
  });

  it('attributes Second Wind as a feature', () => {
    const result = attributeHealing(10, 'The fighter uses Second Wind', 'source');
    expect(result.sourceType).toBe('feature');
    expect(result.source).toBe('Second Wind');
  });

  it('attributes Hit Dice as a feature (rest checked first, but no rest keyword → feature)', () => {
    const result = attributeHealing(6, 'rolls hit dice', 'source');
    expect(result.sourceType).toBe('feature');
  });

  // ===== Potions =====

  it('attributes "potion of healing" as potion (potions checked before spells)', () => {
    const result = attributeHealing(10, 'drinks a potion of healing', 'source');
    expect(result.sourceType).toBe('potion');
    expect(result.confidence).toBe('medium');
  });

  it('attributes "potion of greater healing" as potion', () => {
    const result = attributeHealing(14, 'drinks a potion of greater healing', 'source');
    expect(result.sourceType).toBe('potion');
    expect(result.source).toContain('potion of greater healing');
  });

  it('matches elixir as a potion type', () => {
    const result = attributeHealing(10, 'drinks an elixir of vitality', 'source');
    expect(result.sourceType).toBe('potion');
  });

  // ===== Rest =====

  it('attributes long rest', () => {
    const result = attributeHealing(30, 'recovers HP after a long rest', 'source');
    expect(result.sourceType).toBe('rest');
    expect(result.source).toBe('Long Rest');
    expect(result.confidence).toBe('medium');
  });

  it('attributes short rest (rest checked before spells)', () => {
    const result = attributeHealing(8, 'heals during a short rest', 'source');
    expect(result.sourceType).toBe('rest');
    expect(result.source).toBe('Short Rest');
  });

  it('attributes overnight sleep as long rest', () => {
    const result = attributeHealing(40, 'the party sleeps overnight at the inn', 'source');
    expect(result.sourceType).toBe('rest');
    expect(result.source).toBe('Long Rest');
  });

  // ===== Unknown =====

  it('returns unknown for unrecognized source', () => {
    const result = attributeHealing(5, 'gains some hit points back', 'source');
    expect(result.sourceType).toBe('unknown');
    expect(result.source).toBe('Unknown');
    expect(result.confidence).toBe('low');
  });

  // ===== Priority: spells before features =====

  it('prioritizes spell over feature when both match', () => {
    // "aura of vitality" is in both HEALING_SPELLS (level 3) and HEALING_FEATURES
    const result = attributeHealing(10, 'uses aura of vitality', 'source');
    expect(result.sourceType).toBe('spell');
    expect(result.spellLevel).toBe(3);
  });

  // ===== Amount passthrough =====

  it('preserves the amount in the result', () => {
    const result = attributeHealing(42, 'casts heal', 'src text');
    expect(result.amount).toBe(42);
    expect(result.sourceText).toBe('src text');
  });
});
