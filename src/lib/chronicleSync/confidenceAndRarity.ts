// Chronicle Sync: Confidence Refinement & Price-Based Rarity
// Weighted scoring based on word boundaries, context quality, and pattern specificity

import { ConfidenceLevel, ParsedShopItem } from './types';

// ===== CONFIDENCE REFINEMENT =====

export interface ConfidenceFactors {
  hasWordBoundary: boolean;     // Match is at word boundaries (not mid-word)
  hasExplicitKeyword: boolean;  // Uses exact game terms (e.g., "XP", "damage", "gold")
  hasDC: boolean;               // Contains a DC value
  hasNumericValue: boolean;     // Contains a specific number
  nearRelatedEvent: boolean;    // Cross-category corroboration (set externally)
  inNarrativeContext: boolean;  // Surrounded by narrative text (not a table/list)
  isInQuotes: boolean;          // Inside quoted dialogue (may be flavor, not mechanics)
}

/**
 * Calculate a refined confidence level from multiple signal factors.
 * More signals = higher confidence.
 */
export function calculateRefinedConfidence(factors: ConfidenceFactors): ConfidenceLevel {
  let score = 0;

  if (factors.hasWordBoundary) score += 2;
  if (factors.hasExplicitKeyword) score += 3;
  if (factors.hasDC) score += 2;
  if (factors.hasNumericValue) score += 1;
  if (factors.nearRelatedEvent) score += 2;
  if (factors.inNarrativeContext) score += 1;
  if (factors.isInQuotes) score -= 1; // Quoted text is less reliable

  if (score >= 6) return 'high';
  if (score >= 3) return 'medium';
  return 'low';
}

/**
 * Analyze a match's surrounding text to determine confidence factors
 */
export function analyzeMatchContext(
  matchText: string,
  fullText: string,
  matchIndex: number
): Omit<ConfidenceFactors, 'nearRelatedEvent'> {
  // Check word boundaries
  const charBefore = matchIndex > 0 ? fullText[matchIndex - 1] : ' ';
  const charAfter = matchIndex + matchText.length < fullText.length 
    ? fullText[matchIndex + matchText.length] 
    : ' ';
  const hasWordBoundary = /[\s.,;:!?\-—([]/.test(charBefore) && /[\s.,;:!?\-—)\]]/.test(charAfter);

  // Check for explicit game keywords
  const hasExplicitKeyword = /\b(?:xp|experience|damage|healing|gold|gp|hp|hit\s*points?|level|save|check|ac|dc)\b/i.test(matchText);

  // Check for DC
  const hasDC = /DC\s*\d+/i.test(matchText);

  // Check for numeric value
  const hasNumericValue = /\d+/.test(matchText);

  // Check surrounding context for narrative vs table
  const surroundingStart = Math.max(0, matchIndex - 100);
  const surroundingEnd = Math.min(fullText.length, matchIndex + matchText.length + 100);
  const surrounding = fullText.slice(surroundingStart, surroundingEnd);
  const inNarrativeContext = !/^[\s|+\-=]+$/m.test(surrounding); // Not a table border

  // Check if inside quotes
  const textBeforeMatch = fullText.slice(Math.max(0, matchIndex - 200), matchIndex);
  const openQuotes = (textBeforeMatch.match(/"/g) || []).length;
  const isInQuotes = openQuotes % 2 === 1;

  return {
    hasWordBoundary,
    hasExplicitKeyword,
    hasDC,
    hasNumericValue,
    inNarrativeContext,
    isInQuotes,
  };
}

// ===== PRICE-BASED RARITY =====

/**
 * D&D 5e rarity thresholds by gold cost (DMG guidelines)
 */
const RARITY_THRESHOLDS: Array<{ maxGold: number; rarity: string }> = [
  { maxGold: 100, rarity: 'common' },
  { maxGold: 500, rarity: 'uncommon' },
  { maxGold: 5000, rarity: 'rare' },
  { maxGold: 50000, rarity: 'very rare' },
  { maxGold: Infinity, rarity: 'legendary' },
];

/**
 * Estimate item rarity from its gold cost using DMG price ranges.
 * Only overrides if the existing rarity is 'common' (default).
 */
export function estimateRarityFromPrice(item: ParsedShopItem): string {
  // If rarity was already determined from name keywords, keep it
  if (item.rarity && item.rarity !== 'common') return item.rarity;

  // Consumables are typically cheaper — adjust thresholds
  const isConsumable = item.itemType === 'consumable';
  const cost = item.costGold;

  if (isConsumable) {
    if (cost <= 50) return 'common';
    if (cost <= 250) return 'uncommon';
    if (cost <= 2500) return 'rare';
    if (cost <= 25000) return 'very rare';
    return 'legendary';
  }

  for (const threshold of RARITY_THRESHOLDS) {
    if (cost <= threshold.maxGold) return threshold.rarity;
  }

  return 'common';
}

/**
 * Apply price-based rarity estimation to all shop items
 */
export function applyPriceBasedRarity(items: ParsedShopItem[]): ParsedShopItem[] {
  return items.map(item => ({
    ...item,
    rarity: estimateRarityFromPrice(item),
  }));
}
