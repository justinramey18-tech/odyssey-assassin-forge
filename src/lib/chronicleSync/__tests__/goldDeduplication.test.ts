import { describe, it, expect } from 'vitest';
import { parseGoldMatches } from '../patterns';
import { deduplicateByProximity, deduplicateBySourceText } from '../deduplication';

describe('parseGoldMatches', () => {
  it('parses basic gold gains', () => {
    const result = parseGoldMatches('You find 75 gold in the chest.');
    expect(result.gained.length).toBe(1);
    expect(result.gained[0].value).toBe(75);
    expect(result.spent.length).toBe(0);
  });

  it('parses gold spending', () => {
    const result = parseGoldMatches('You spend 50 gold at the shop.');
    expect(result.spent.length).toBe(1);
    expect(result.spent[0].value).toBe(50);
  });

  it('separates gains from spending in same text', () => {
    const text = 'You find 100 gold in the dungeon. Later you spend 30 gold on supplies.';
    const result = parseGoldMatches(text);
    expect(result.gained.length).toBeGreaterThanOrEqual(1);
    expect(result.spent.length).toBeGreaterThanOrEqual(1);
    expect(result.gained.some(g => g.value === 100)).toBe(true);
    expect(result.spent.some(g => g.value === 30)).toBe(true);
  });

  // === Bug fix: GOLD_PATTERNS[6] double-counting was removed ===
  it('does not double-count gold in comma-separated currency lists', () => {
    const text = 'You find 15 gp, 30 sp, and 200 cp in the treasure hoard.';
    const result = parseGoldMatches(text);
    // Should only have ONE entry for 15 gp, not two
    const fifteenGoldEntries = result.gained.filter(g => g.value === 15);
    expect(fifteenGoldEntries.length).toBeLessThanOrEqual(1);
  });

  it('parses treasure hoard gold', () => {
    const result = parseGoldMatches('The chest holds 500 gp and various gems.');
    expect(result.gained.length).toBeGreaterThanOrEqual(1);
    expect(result.gained.some(g => g.value === 500)).toBe(true);
  });

  it('parses reward gold', () => {
    const result = parseGoldMatches('The quest reward of 300 gold is presented to you.');
    expect(result.gained.length).toBeGreaterThanOrEqual(1);
    expect(result.gained.some(g => g.value === 300)).toBe(true);
  });

  it('parses informal gold giving', () => {
    const result = parseGoldMatches('The merchant hands you 250 gp for the goods.');
    expect(result.gained.length).toBeGreaterThanOrEqual(1);
    expect(result.gained.some(g => g.value === 250)).toBe(true);
  });
});

describe('deduplicateByProximity', () => {
  it('removes duplicate values within proximity range', () => {
    const matches = [
      { value: 100, index: 10, fullMatch: 'gain 100 XP', context: '' },
      { value: 100, index: 50, fullMatch: '100 XP gained', context: '' },
    ];
    const result = deduplicateByProximity(matches, 500);
    expect(result.length).toBe(1);
  });

  it('keeps different values even if nearby', () => {
    const matches = [
      { value: 100, index: 10, fullMatch: 'gain 100 XP', context: '' },
      { value: 200, index: 50, fullMatch: 'gain 200 XP', context: '' },
    ];
    const result = deduplicateByProximity(matches, 500);
    expect(result.length).toBe(2);
  });

  it('keeps same values if far apart', () => {
    const matches = [
      { value: 100, index: 10, fullMatch: 'gain 100 XP', context: '' },
      { value: 100, index: 1000, fullMatch: 'gain 100 XP', context: '' },
    ];
    const result = deduplicateByProximity(matches, 500);
    expect(result.length).toBe(2);
  });

  it('filters out summary-line duplicates', () => {
    const sourceText = 'You gain 100 gold from the quest.\n\nSession total: 100 gold earned.';
    const matches = [
      { value: 100, index: sourceText.indexOf('100 gold from'), fullMatch: '100 gold', context: '' },
      { value: 100, index: sourceText.indexOf('100 gold earned'), fullMatch: '100 gold', context: '' },
    ];
    const result = deduplicateByProximity(matches, 500, sourceText);
    // The summary-line match should be filtered if same value exists elsewhere
    expect(result.length).toBe(1);
  });

  it('returns single-element arrays unchanged', () => {
    const matches = [{ value: 50, index: 0, fullMatch: 'test', context: '' }];
    expect(deduplicateByProximity(matches, 500)).toEqual(matches);
  });

  it('returns empty arrays unchanged', () => {
    expect(deduplicateByProximity([], 500)).toEqual([]);
  });
});

describe('deduplicateBySourceText', () => {
  it('removes items with identical sourceText and same amount', () => {
    const items = [
      { sourceText: 'gain 50 gold', amount: 50 },
      { sourceText: 'gain 50 gold', amount: 50 },
    ];
    expect(deduplicateBySourceText(items).length).toBe(1);
  });

  it('keeps items with different amounts', () => {
    const items = [
      { sourceText: 'gain 50 gold', amount: 50 },
      { sourceText: 'gain 100 gold', amount: 100 },
    ];
    expect(deduplicateBySourceText(items).length).toBe(2);
  });

  it('removes items where one sourceText contains the other', () => {
    const items = [
      { sourceText: 'gain 50 gold from quest', amount: 50 },
      { sourceText: 'gain 50 gold', amount: 50 },
    ];
    expect(deduplicateBySourceText(items).length).toBe(1);
  });
});
