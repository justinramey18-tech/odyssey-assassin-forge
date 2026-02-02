// D&D Ability Scores Utilities
export * from './types';

/**
 * Roll 4d6, drop the lowest die (standard D&D ability score generation)
 */
export function roll4d6DropLowest(): number {
  const rolls = [
    Math.floor(Math.random() * 6) + 1,
    Math.floor(Math.random() * 6) + 1,
    Math.floor(Math.random() * 6) + 1,
    Math.floor(Math.random() * 6) + 1,
  ];
  // Sort descending and take top 3
  rolls.sort((a, b) => b - a);
  return rolls[0] + rolls[1] + rolls[2];
}

/**
 * Generate 6 ability scores using 4d6 drop lowest
 * Returns scores sorted from highest to lowest
 */
export function generateAbilityScores(): number[] {
  const scores = Array.from({ length: 6 }, () => roll4d6DropLowest());
  return scores.sort((a, b) => b - a);
}

/**
 * Point buy calculation (optional - for future enhancement)
 * Returns the point cost for a given score
 */
export function getPointBuyCost(score: number): number {
  if (score < 8) return 0;
  if (score <= 13) return score - 8;
  if (score === 14) return 7;
  if (score === 15) return 9;
  return Infinity; // Scores above 15 not allowed in point buy
}

/**
 * Calculate total point buy spent for a set of scores
 */
export function calculatePointBuyTotal(scores: number[]): number {
  return scores.reduce((total, score) => total + getPointBuyCost(score), 0);
}

/**
 * Reverse-engineer base score from modifier (for migration)
 * Returns the most likely base score for a given modifier
 */
export function modifierToBaseScore(modifier: number): number {
  // modifier = floor((score - 10) / 2)
  // score = (modifier * 2) + 10 or + 11
  // We'll use the lower bound
  const baseScore = modifier * 2 + 10;
  return Math.max(8, Math.min(18, baseScore));
}
