// Hit Dice Constants and Utilities
// D&D 5e hit die values for each die type

import { HitDie } from './types';

/**
 * Maximum value for each hit die type
 */
export const HIT_DIE_MAX: Record<HitDie, number> = {
  'd6': 6,
  'd8': 8,
  'd10': 10,
  'd12': 12,
};

/**
 * Average value for each hit die type (rounded down per 5e)
 * Used for HP calculation at levels 2+
 */
export const HIT_DIE_AVG: Record<HitDie, number> = {
  'd6': 4,   // Actually 3.5, but 5e uses 4 for player convenience
  'd8': 5,   // Actually 4.5, but 5e uses 5
  'd10': 6,  // Actually 5.5, but 5e uses 6
  'd12': 7,  // Actually 6.5, but 5e uses 7
};

/**
 * Get the maximum value for a hit die
 */
export function getHitDieMax(hitDie: HitDie): number {
  return HIT_DIE_MAX[hitDie];
}

/**
 * Get the average value for a hit die (per 5e rules)
 */
export function getHitDieAvg(hitDie: HitDie): number {
  return HIT_DIE_AVG[hitDie];
}

/**
 * Format hit dice pool for display (e.g., "5d6 + 3d8")
 */
export function formatHitDicePool(pool: Record<HitDie, number>): string {
  const parts: string[] = [];
  
  // Sort by die size descending
  const diceOrder: HitDie[] = ['d12', 'd10', 'd8', 'd6'];
  
  for (const die of diceOrder) {
    const count = pool[die];
    if (count && count > 0) {
      parts.push(`${count}${die}`);
    }
  }
  
  return parts.length > 0 ? parts.join(' + ') : '0';
}
