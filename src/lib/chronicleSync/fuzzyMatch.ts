// Chronicle Sync Fuzzy Matching
// Levenshtein distance implementation for consumable name matching

import { Consumable } from '@/lib/consumables/types';
import { ConfidenceLevel } from './types';

/**
 * Calculate Levenshtein distance between two strings
 * Lower distance = more similar
 */
export function levenshteinDistance(a: string, b: string): number {
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();
  
  if (aLower === bLower) return 0;
  if (aLower.length === 0) return bLower.length;
  if (bLower.length === 0) return aLower.length;
  
  // Create distance matrix
  const matrix: number[][] = [];
  
  // Initialize first column
  for (let i = 0; i <= aLower.length; i++) {
    matrix[i] = [i];
  }
  
  // Initialize first row
  for (let j = 0; j <= bLower.length; j++) {
    matrix[0][j] = j;
  }
  
  // Fill in the rest of the matrix
  for (let i = 1; i <= aLower.length; i++) {
    for (let j = 1; j <= bLower.length; j++) {
      const cost = aLower[i - 1] === bLower[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }
  
  return matrix[aLower.length][bLower.length];
}

/**
 * Calculate similarity score between two strings
 * Returns value between 0 (completely different) and 1 (identical)
 */
export function similarityScore(a: string, b: string): number {
  if (!a || !b) return 0;
  
  const aLower = a.toLowerCase().trim();
  const bLower = b.toLowerCase().trim();
  
  if (aLower === bLower) return 1;
  
  const distance = levenshteinDistance(aLower, bLower);
  const maxLength = Math.max(aLower.length, bLower.length);
  
  if (maxLength === 0) return 1;
  
  return 1 - distance / maxLength;
}

/**
 * Check if string contains all words from another string (word-level matching)
 */
function containsAllWords(haystack: string, needle: string): boolean {
  const haystackWords = new Set(haystack.toLowerCase().split(/\s+/));
  const needleWords = needle.toLowerCase().split(/\s+/);
  
  return needleWords.every(word => haystackWords.has(word) || 
    [...haystackWords].some(hw => hw.includes(word) || word.includes(hw)));
}

/**
 * Calculate word-based similarity (more lenient than Levenshtein)
 */
function wordSimilarity(a: string, b: string): number {
  const aWords = a.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const bWords = b.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  
  if (aWords.length === 0 || bWords.length === 0) return 0;
  
  let matches = 0;
  for (const aWord of aWords) {
    for (const bWord of bWords) {
      if (aWord === bWord || aWord.includes(bWord) || bWord.includes(aWord)) {
        matches++;
        break;
      }
    }
  }
  
  return matches / Math.max(aWords.length, bWords.length);
}

// Common aliases for consumable types
const CONSUMABLE_ALIASES: Record<string, string[]> = {
  'potion of healing': ['health potion', 'healing potion', 'hp potion', 'heal pot'],
  'potion of greater healing': ['greater healing potion', 'greater heal', 'big health potion'],
  'potion of superior healing': ['superior healing potion', 'super healing', 'super heal pot'],
  'potion of supreme healing': ['supreme healing potion', 'supreme heal'],
  'antitoxin': ['anti-toxin', 'poison cure', 'cure poison'],
  'potion of invisibility': ['invisibility potion', 'invis potion', 'invis pot'],
  'potion of speed': ['speed potion', 'haste potion', 'haste pot'],
  'potion of flying': ['flying potion', 'flight potion', 'fly pot'],
  'potion of fire resistance': ['fire resist potion', 'fire resistance'],
  'scroll of fireball': ['fireball scroll', 'fire scroll'],
  'scroll of lightning bolt': ['lightning scroll', 'lightning bolt scroll'],
};

export interface ConsumableMatchResult {
  consumable: Consumable;
  confidence: ConfidenceLevel;
  matchScore: number;
  matchedVia: 'exact' | 'alias' | 'fuzzy' | 'word';
}

/**
 * Find the best matching consumable for a detected item name
 * Uses multiple matching strategies with priority:
 * 1. Exact match
 * 2. Alias match
 * 3. Word-based match
 * 4. Fuzzy (Levenshtein) match
 */
export function findBestConsumableMatch(
  detectedName: string,
  consumables: Consumable[]
): ConsumableMatchResult | null {
  if (!detectedName || detectedName.length < 3) return null;
  
  const normalized = detectedName.toLowerCase().trim();
  
  // Remove quantity prefixes like "3x", "3 ", etc.
  const withoutQuantity = normalized.replace(/^\d+\s*x?\s*/, '').trim();
  
  // 1. Exact match
  for (const consumable of consumables) {
    if (consumable.name.toLowerCase() === withoutQuantity) {
      return {
        consumable,
        confidence: 'high',
        matchScore: 1.0,
        matchedVia: 'exact',
      };
    }
  }
  
  // 2. Alias match
  for (const [canonicalName, aliases] of Object.entries(CONSUMABLE_ALIASES)) {
    if (aliases.some(alias => alias.toLowerCase() === withoutQuantity)) {
      const consumable = consumables.find(c => c.name.toLowerCase() === canonicalName);
      if (consumable) {
        return {
          consumable,
          confidence: 'high',
          matchScore: 0.95,
          matchedVia: 'alias',
        };
      }
    }
  }
  
  // 3. Check if detected name contains canonical alias
  for (const [canonicalName, aliases] of Object.entries(CONSUMABLE_ALIASES)) {
    if (aliases.some(alias => withoutQuantity.includes(alias.toLowerCase()))) {
      const consumable = consumables.find(c => c.name.toLowerCase() === canonicalName);
      if (consumable) {
        return {
          consumable,
          confidence: 'medium',
          matchScore: 0.85,
          matchedVia: 'alias',
        };
      }
    }
  }
  
  // 4. Find best fuzzy match
  let bestMatch: ConsumableMatchResult | null = null;
  
  for (const consumable of consumables) {
    const consumableName = consumable.name.toLowerCase();
    
    // Try word-based matching first
    const wordScore = wordSimilarity(withoutQuantity, consumableName);
    if (wordScore >= 0.6) {
      if (!bestMatch || wordScore > bestMatch.matchScore) {
        bestMatch = {
          consumable,
          confidence: wordScore >= 0.8 ? 'high' : wordScore >= 0.7 ? 'medium' : 'low',
          matchScore: wordScore,
          matchedVia: 'word',
        };
      }
    }
    
    // Try Levenshtein similarity
    const similarity = similarityScore(withoutQuantity, consumableName);
    if (similarity >= 0.7 && (!bestMatch || similarity > bestMatch.matchScore)) {
      bestMatch = {
        consumable,
        confidence: similarity >= 0.85 ? 'high' : similarity >= 0.75 ? 'medium' : 'low',
        matchScore: similarity,
        matchedVia: 'fuzzy',
      };
    }
  }
  
  // Only return if above threshold
  if (bestMatch && bestMatch.matchScore >= 0.65) {
    return bestMatch;
  }
  
  return null;
}

/**
 * Parse quantity from detected item string
 * e.g., "3 health potions" -> { quantity: 3, itemName: "health potions" }
 */
export function parseItemQuantity(text: string): { quantity: number; itemName: string } {
  const match = text.match(/^(\d+)\s*x?\s*(.+)$/i);
  if (match) {
    return {
      quantity: parseInt(match[1], 10),
      itemName: match[2].trim(),
    };
  }
  
  // Check for trailing quantity like "potions x3"
  const trailingMatch = text.match(/^(.+?)\s*x\s*(\d+)$/i);
  if (trailingMatch) {
    return {
      quantity: parseInt(trailingMatch[2], 10),
      itemName: trailingMatch[1].trim(),
    };
  }
  
  // Check for "a/an" prefix
  const articleMatch = text.match(/^(?:a|an)\s+(.+)$/i);
  if (articleMatch) {
    return {
      quantity: 1,
      itemName: articleMatch[1].trim(),
    };
  }
  
  return {
    quantity: 1,
    itemName: text.trim(),
  };
}

/**
 * Normalize item name for comparison
 * Removes plurals, common prefixes, etc.
 */
export function normalizeItemName(name: string): string {
  let normalized = name.toLowerCase().trim();
  
  // Remove "potion of" / "scroll of" prefixes for matching
  normalized = normalized.replace(/^(potion|scroll|vial|elixir)\s+of\s+/i, '');
  
  // Remove trailing 's' for simple depluralization
  if (normalized.endsWith('s') && !normalized.endsWith('ss')) {
    normalized = normalized.slice(0, -1);
  }
  
  return normalized;
}
