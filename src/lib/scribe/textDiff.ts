// Text Diff Algorithm for narrative comparison
// Simple word-level diff with paragraph awareness

export interface DiffSegment {
  type: 'unchanged' | 'added' | 'removed';
  text: string;
}

export interface DiffStats {
  addedWords: number;
  removedWords: number;
  unchangedWords: number;
  changePercent: number;
}

/**
 * Compute word-level diff between original and transformed text
 * Optimized for narrative comparison (not character-level like code diffs)
 */
export function computeNarrativeDiff(original: string, transformed: string): DiffSegment[] {
  const originalWords = tokenize(original);
  const transformedWords = tokenize(transformed);
  
  // Use Longest Common Subsequence (LCS) for diff
  const lcs = computeLCS(originalWords, transformedWords);
  
  return buildDiffFromLCS(originalWords, transformedWords, lcs);
}

/**
 * Tokenize text into words while preserving whitespace information
 */
function tokenize(text: string): string[] {
  // Split on word boundaries but keep punctuation with words
  return text.split(/(\s+)/).filter(Boolean);
}

/**
 * Compute Longest Common Subsequence indices
 */
function computeLCS(a: string[], b: string[]): Map<number, number> {
  const m = a.length;
  const n = b.length;
  
  // For very long texts, use a simpler approach to avoid memory issues
  if (m * n > 1000000) {
    return computeSimpleLCS(a, b);
  }
  
  // Standard LCS with backtracking
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  
  // Backtrack to find matching indices
  const matches = new Map<number, number>();
  let i = m, j = n;
  
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      matches.set(i - 1, j - 1);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  
  return matches;
}

/**
 * Simpler LCS for very long texts - uses greedy matching
 */
function computeSimpleLCS(a: string[], b: string[]): Map<number, number> {
  const matches = new Map<number, number>();
  const bMap = new Map<string, number[]>();
  
  // Index all positions of each word in b
  b.forEach((word, idx) => {
    if (!bMap.has(word)) bMap.set(word, []);
    bMap.get(word)!.push(idx);
  });
  
  let lastMatchB = -1;
  
  for (let i = 0; i < a.length; i++) {
    const positions = bMap.get(a[i]);
    if (positions) {
      // Find first position after lastMatchB
      const nextPos = positions.find(p => p > lastMatchB);
      if (nextPos !== undefined) {
        matches.set(i, nextPos);
        lastMatchB = nextPos;
      }
    }
  }
  
  return matches;
}

/**
 * Build diff segments from LCS matches
 */
function buildDiffFromLCS(
  original: string[],
  transformed: string[],
  matches: Map<number, number>
): DiffSegment[] {
  const segments: DiffSegment[] = [];
  let origIdx = 0;
  let transIdx = 0;
  
  // Convert matches to sorted array
  const sortedMatches = Array.from(matches.entries()).sort((a, b) => a[0] - b[0]);
  
  for (const [origMatch, transMatch] of sortedMatches) {
    // Add removed words (in original but not matched)
    if (origIdx < origMatch) {
      const removed = original.slice(origIdx, origMatch).join('');
      if (removed.trim()) {
        segments.push({ type: 'removed', text: removed });
      }
    }
    
    // Add added words (in transformed but not matched)
    if (transIdx < transMatch) {
      const added = transformed.slice(transIdx, transMatch).join('');
      if (added.trim()) {
        segments.push({ type: 'added', text: added });
      }
    }
    
    // Add matched word
    segments.push({ type: 'unchanged', text: original[origMatch] });
    
    origIdx = origMatch + 1;
    transIdx = transMatch + 1;
  }
  
  // Handle remaining words
  if (origIdx < original.length) {
    const removed = original.slice(origIdx).join('');
    if (removed.trim()) {
      segments.push({ type: 'removed', text: removed });
    }
  }
  
  if (transIdx < transformed.length) {
    const added = transformed.slice(transIdx).join('');
    if (added.trim()) {
      segments.push({ type: 'added', text: added });
    }
  }
  
  return consolidateSegments(segments);
}

/**
 * Consolidate adjacent segments of the same type
 */
function consolidateSegments(segments: DiffSegment[]): DiffSegment[] {
  const consolidated: DiffSegment[] = [];
  
  for (const segment of segments) {
    const last = consolidated[consolidated.length - 1];
    if (last && last.type === segment.type) {
      last.text += segment.text;
    } else {
      consolidated.push({ ...segment });
    }
  }
  
  return consolidated;
}

/**
 * Calculate diff statistics
 */
export function getDiffStats(segments: DiffSegment[]): DiffStats {
  let addedWords = 0;
  let removedWords = 0;
  let unchangedWords = 0;
  
  for (const segment of segments) {
    const wordCount = segment.text.split(/\s+/).filter(Boolean).length;
    switch (segment.type) {
      case 'added':
        addedWords += wordCount;
        break;
      case 'removed':
        removedWords += wordCount;
        break;
      case 'unchanged':
        unchangedWords += wordCount;
        break;
    }
  }
  
  const totalOriginal = removedWords + unchangedWords;
  const changePercent = totalOriginal > 0 
    ? Math.round(((addedWords + removedWords) / (totalOriginal + addedWords)) * 100)
    : 0;
  
  return { addedWords, removedWords, unchangedWords, changePercent };
}

/**
 * Format word count with nice display
 */
export function formatWordCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return count.toString();
}
