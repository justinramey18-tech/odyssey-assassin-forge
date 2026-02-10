import { describe, it, expect } from 'vitest';
import { deduplicateByProximity, deduplicateBySourceText } from '../deduplication';

describe('deduplicateByProximity', () => {
  it('returns empty array for empty input', () => {
    expect(deduplicateByProximity([])).toEqual([]);
  });

  it('returns single item unchanged', () => {
    const items = [{ value: 100, index: 0 }];
    expect(deduplicateByProximity(items)).toEqual(items);
  });

  it('removes duplicate values within proximity range', () => {
    const items = [
      { value: 100, index: 0 },
      { value: 100, index: 50 },
    ];
    const result = deduplicateByProximity(items, 500);
    expect(result).toHaveLength(1);
    expect(result[0].index).toBe(0);
  });

  it('keeps duplicate values outside proximity range', () => {
    const items = [
      { value: 100, index: 0 },
      { value: 100, index: 600 },
    ];
    const result = deduplicateByProximity(items, 500);
    expect(result).toHaveLength(2);
  });

  it('keeps different values within proximity', () => {
    const items = [
      { value: 100, index: 0 },
      { value: 200, index: 50 },
    ];
    const result = deduplicateByProximity(items, 500);
    expect(result).toHaveLength(2);
  });

  it('filters summary-line duplicates when sourceText provided', () => {
    const src = 'Gained 100 XP for the quest.\nSession Summary: Total XP: 100';
    const summaryIndex = src.indexOf('Total XP: 100');
    const items = [
      { value: 100, index: 0 },
      { value: 100, index: summaryIndex },
    ];
    const result = deduplicateByProximity(items, 500, src);
    expect(result).toHaveLength(1);
  });

  it('keeps summary-line value if no other match exists', () => {
    const src = 'Session Summary: Total XP: 100';
    const items = [{ value: 100, index: src.indexOf('Total XP: 100') }];
    const result = deduplicateByProximity(items, 500, src);
    expect(result).toHaveLength(1);
  });

  it('sorts by index before deduplicating (keeps first occurrence)', () => {
    const items = [
      { value: 50, index: 300 },
      { value: 50, index: 100 },
    ];
    const result = deduplicateByProximity(items, 500);
    expect(result).toHaveLength(1);
    expect(result[0].index).toBe(100); // Earlier one kept
  });
});

describe('deduplicateBySourceText', () => {
  it('returns empty array for empty input', () => {
    expect(deduplicateBySourceText([])).toEqual([]);
  });

  it('returns single item unchanged', () => {
    const items = [{ sourceText: 'found 50 gold', amount: 50 }];
    expect(deduplicateBySourceText(items)).toEqual(items);
  });

  it('removes items with identical sourceText and same amount', () => {
    const items = [
      { sourceText: 'found 50 gold', amount: 50 },
      { sourceText: 'found 50 gold', amount: 50 },
    ];
    expect(deduplicateBySourceText(items)).toHaveLength(1);
  });

  it('keeps items with different amounts even if same sourceText', () => {
    const items = [
      { sourceText: 'gold transaction', amount: 50 },
      { sourceText: 'gold transaction', amount: 100 },
    ];
    expect(deduplicateBySourceText(items)).toHaveLength(2);
  });

  it('removes items where one sourceText contains the other', () => {
    const items = [
      { sourceText: 'found 50 gold pieces in the chest', amount: 50 },
      { sourceText: 'found 50 gold', amount: 50 },
    ];
    expect(deduplicateBySourceText(items)).toHaveLength(1);
  });

  it('keeps items with completely different sourceText', () => {
    const items = [
      { sourceText: 'found 50 gold in cave', amount: 50 },
      { sourceText: 'looted 50 gold from bandit', amount: 50 },
    ];
    expect(deduplicateBySourceText(items)).toHaveLength(2);
  });

  it('handles items without amount field', () => {
    const items = [
      { sourceText: 'some event' },
      { sourceText: 'some event' },
    ];
    expect(deduplicateBySourceText(items)).toHaveLength(1);
  });
});
