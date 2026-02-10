// Chronicle Sync Deduplication (Gap 6)
// Prevents double-counting XP, gold, etc. from summary lines and proximity matches

import { PatternMatch } from './patterns';

// Summary line patterns that indicate a recap, not a new gain
const SUMMARY_PATTERNS = [
  /total\s+(?:xp|experience|gold|gp)[\s:]+/i,
  /session\s+(?:summary|total|recap)/i,
  /(?:in\s+total|altogether|combined)/i,
  /(?:grand\s+)?total[\s:]+/i,
];

/**
 * Check if a match is within a summary line context
 */
function isInSummaryContext(text: string, matchIndex: number): boolean {
  // Get the line containing this match
  const lineStart = text.lastIndexOf('\n', matchIndex) + 1;
  const lineEnd = text.indexOf('\n', matchIndex);
  const line = text.slice(lineStart, lineEnd === -1 ? text.length : lineEnd);
  
  return SUMMARY_PATTERNS.some(p => p.test(line));
}

/**
 * Deduplicate matches by proximity and value.
 * If two matches have the same numeric value and are within `proximityChars` of each other,
 * keep only the first one. Also filters out summary-line duplicates.
 */
export function deduplicateByProximity<T extends { value: string | number; index: number }>(
  matches: T[],
  proximityChars: number = 500,
  sourceText?: string,
): T[] {
  if (matches.length <= 1) return matches;

  // Sort by index
  const sorted = [...matches].sort((a, b) => a.index - b.index);
  const kept: T[] = [];
  
  // Track which indices to skip (summary lines)
  const summaryIndices = new Set<number>();
  if (sourceText) {
    for (const match of sorted) {
      if (isInSummaryContext(sourceText, match.index)) {
        summaryIndices.add(match.index);
      }
    }
  }

  for (const match of sorted) {
    // If this match is in a summary context and we already have the same value, skip it
    if (summaryIndices.has(match.index)) {
      const hasSameValueElsewhere = kept.some(
        k => String(k.value) === String(match.value)
      );
      if (hasSameValueElsewhere) continue;
    }

    // Check proximity: skip if same value exists within range
    const isDuplicate = kept.some(
      k =>
        String(k.value) === String(match.value) &&
        Math.abs(k.index - match.index) < proximityChars
    );

    if (!isDuplicate) {
      kept.push(match);
    }
  }

  return kept;
}

/**
 * Deduplicate gold/XP arrays that don't have index info,
 * using sourceText overlap detection instead.
 */
export function deduplicateBySourceText<T extends { sourceText: string; amount?: number }>(
  items: T[],
): T[] {
  if (items.length <= 1) return items;

  const kept: T[] = [];

  for (const item of items) {
    // Check if we already have an item with the same amount and overlapping source text
    const isDuplicate = kept.some(k => {
      if (k.amount !== undefined && item.amount !== undefined && k.amount !== item.amount) return false;
      // Check for significant text overlap
      const shorter = k.sourceText.length < item.sourceText.length ? k.sourceText : item.sourceText;
      const longer = k.sourceText.length >= item.sourceText.length ? k.sourceText : item.sourceText;
      return longer.includes(shorter) || shorter.includes(longer);
    });

    if (!isDuplicate) {
      kept.push(item);
    }
  }

  return kept;
}
