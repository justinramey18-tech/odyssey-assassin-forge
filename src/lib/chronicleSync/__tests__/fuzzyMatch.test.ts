import { describe, it, expect } from 'vitest';
import {
  levenshteinDistance,
  similarityScore,
  findBestConsumableMatch,
  parseItemQuantity,
  normalizeItemName,
} from '../fuzzyMatch';
import { Consumable } from '@/lib/consumables/types';

// Helper to create a minimal consumable for testing
function makeConsumable(name: string, id?: string): Consumable {
  return {
    id: id ?? name.toLowerCase().replace(/\s+/g, '-'),
    name,
    type: 'potion',
    rarity: 'common',
    effect: 'test',
    duration: 'instant',
    description: 'test',
    usageType: 'drink',
    icon: '🧪',
  };
}

// ===== levenshteinDistance =====

describe('levenshteinDistance', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshteinDistance('potion', 'potion')).toBe(0);
  });

  it('is case-insensitive', () => {
    expect(levenshteinDistance('Potion', 'potion')).toBe(0);
  });

  it('returns correct distance for single edit', () => {
    expect(levenshteinDistance('potion', 'potions')).toBe(1);
  });

  it('returns length for empty vs non-empty', () => {
    expect(levenshteinDistance('', 'abc')).toBe(3);
    expect(levenshteinDistance('abc', '')).toBe(3);
  });

  it('handles completely different strings', () => {
    expect(levenshteinDistance('abc', 'xyz')).toBe(3);
  });
});

// ===== similarityScore =====

describe('similarityScore', () => {
  it('returns 1 for identical strings', () => {
    expect(similarityScore('healing potion', 'healing potion')).toBe(1);
  });

  it('returns 0 for empty input', () => {
    expect(similarityScore('', 'test')).toBe(0);
    expect(similarityScore('test', '')).toBe(0);
  });

  it('returns high similarity for close strings', () => {
    const score = similarityScore('potion of healing', 'potion of healng');
    expect(score).toBeGreaterThan(0.9);
  });

  it('returns low similarity for different strings', () => {
    const score = similarityScore('sword', 'potion');
    expect(score).toBeLessThan(0.5);
  });
});

// ===== findBestConsumableMatch =====

describe('findBestConsumableMatch', () => {
  const consumables: Consumable[] = [
    makeConsumable('Potion of Healing'),
    makeConsumable('Potion of Greater Healing'),
    makeConsumable('Antitoxin'),
    makeConsumable('Potion of Invisibility'),
    makeConsumable('Potion of Speed'),
  ];

  it('returns exact match with high confidence', () => {
    const result = findBestConsumableMatch('potion of healing', consumables);
    expect(result).not.toBeNull();
    expect(result!.consumable.name).toBe('Potion of Healing');
    expect(result!.confidence).toBe('high');
    expect(result!.matchedVia).toBe('exact');
  });

  it('matches aliases (health potion → Potion of Healing)', () => {
    const result = findBestConsumableMatch('health potion', consumables);
    expect(result).not.toBeNull();
    expect(result!.consumable.name).toBe('Potion of Healing');
    expect(result!.matchedVia).toBe('alias');
  });

  it('matches alias "hp potion" to Potion of Healing', () => {
    const result = findBestConsumableMatch('hp potion', consumables);
    expect(result).not.toBeNull();
    expect(result!.consumable.name).toBe('Potion of Healing');
  });

  it('strips quantity prefix before matching', () => {
    const result = findBestConsumableMatch('3x potion of healing', consumables);
    expect(result).not.toBeNull();
    expect(result!.consumable.name).toBe('Potion of Healing');
  });

  it('returns null for very short input', () => {
    expect(findBestConsumableMatch('po', consumables)).toBeNull();
  });

  it('returns null for completely unrelated text', () => {
    expect(findBestConsumableMatch('longsword +1', consumables)).toBeNull();
  });

  it('uses fuzzy matching for typos', () => {
    const result = findBestConsumableMatch('potion of healng', consumables);
    expect(result).not.toBeNull();
    expect(result!.consumable.name).toBe('Potion of Healing');
    expect(result!.matchedVia).toBe('fuzzy');
  });

  it('matches anti-toxin alias to Antitoxin', () => {
    const result = findBestConsumableMatch('anti-toxin', consumables);
    expect(result).not.toBeNull();
    expect(result!.consumable.name).toBe('Antitoxin');
  });

  it('differentiates greater from regular healing', () => {
    const result = findBestConsumableMatch('greater healing potion', consumables);
    expect(result).not.toBeNull();
    expect(result!.consumable.name).toBe('Potion of Greater Healing');
  });
});

// ===== parseItemQuantity =====

describe('parseItemQuantity', () => {
  it('parses "3 health potions"', () => {
    const { quantity, itemName } = parseItemQuantity('3 health potions');
    expect(quantity).toBe(3);
    expect(itemName).toBe('health potions');
  });

  it('parses "3x potion of healing"', () => {
    const { quantity, itemName } = parseItemQuantity('3x potion of healing');
    expect(quantity).toBe(3);
    expect(itemName).toBe('potion of healing');
  });

  it('parses trailing "potions x3"', () => {
    const { quantity, itemName } = parseItemQuantity('potions x3');
    expect(quantity).toBe(3);
    expect(itemName).toBe('potions');
  });

  it('parses "a potion of healing" as quantity 1', () => {
    const { quantity, itemName } = parseItemQuantity('a potion of healing');
    expect(quantity).toBe(1);
    expect(itemName).toBe('potion of healing');
  });

  it('parses "an antitoxin" as quantity 1', () => {
    const { quantity, itemName } = parseItemQuantity('an antitoxin');
    expect(quantity).toBe(1);
    expect(itemName).toBe('antitoxin');
  });

  it('defaults to quantity 1 for bare name', () => {
    const { quantity, itemName } = parseItemQuantity('healing potion');
    expect(quantity).toBe(1);
    expect(itemName).toBe('healing potion');
  });
});

// ===== normalizeItemName =====

describe('normalizeItemName', () => {
  it('removes "potion of" prefix', () => {
    expect(normalizeItemName('Potion of Healing')).toBe('healing');
  });

  it('removes "scroll of" prefix', () => {
    expect(normalizeItemName('Scroll of Fireball')).toBe('fireball');
  });

  it('removes trailing s for depluralization', () => {
    expect(normalizeItemName('potions')).toBe('potion');
  });

  it('does not remove ss ending', () => {
    expect(normalizeItemName('bless')).toBe('bless');
  });

  it('lowercases and trims', () => {
    expect(normalizeItemName('  Antitoxin  ')).toBe('antitoxin');
  });
});
