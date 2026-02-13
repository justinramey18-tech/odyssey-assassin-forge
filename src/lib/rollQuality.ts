// Centralized roll quality evaluation for D&D 5e AI DM prompts
// Uses NATURAL die values (before modifiers) for accurate narrative descriptions

import { RollMode, getEffectiveDie } from './diceRoller';
import type { DieType } from './diceRoller';

export type RollQualityTier = 
  | 'critical_hit' 
  | 'critical_miss' 
  | 'excellent' 
  | 'strong' 
  | 'average' 
  | 'poor';

export interface RollQuality {
  label: string;
  tier: RollQualityTier;
  narrativeGuide: string;
}

/**
 * Get roll quality for d20-based rolls (attacks, checks, saves).
 * Uses the NATURAL die value for critical hit/miss detection.
 * Uses the TOTAL (after modifiers) for narrative quality tiers when provided.
 * 
 * Tiers based on total (or natural die if no total provided):
 * - Natural 20: Critical Hit
 * - Natural 1: Critical Miss
 * - 18+: Excellent
 * - 14-17: Strong
 * - 8-13: Average
 * - 2-7: Poor
 */
export function getD20RollQuality(
  rolls: number[],
  rollMode: RollMode = 'normal',
  total?: number
): RollQuality {
  const naturalDie = getEffectiveDie(rolls, rollMode);

  // Crits/fumbles always use natural die
  if (naturalDie === 20) {
    return {
      label: 'CRITICAL HIT!',
      tier: 'critical_hit',
      narrativeGuide: 'The strike lands with devastating, supernatural precision. Double all damage dice. Describe something exceptionally brutal — the weapon finds a vital point, armor shatters, or the target is staggered by the sheer force.',
    };
  }

  if (naturalDie === 1) {
    return {
      label: 'CRITICAL MISS!',
      tier: 'critical_miss',
      narrativeGuide: 'The attack goes wildly astray. Describe an embarrassing or dangerous miss — the weapon slips, footing is lost, or an opening is left for the enemy.',
    };
  }

  // Narrative quality uses total when available, natural die as fallback
  const qualityValue = total ?? naturalDie;

  if (qualityValue >= 18) {
    return {
      label: 'Excellent',
      tier: 'excellent',
      narrativeGuide: 'Near-perfect precision. The attack strikes with confidence and deadly accuracy — describe a clean, powerful hit that leaves no doubt of the attacker\'s skill.',
    };
  }

  if (qualityValue >= 14) {
    return {
      label: 'Strong',
      tier: 'strong',
      narrativeGuide: 'A well-executed strike. The attacker\'s training shows clearly — describe a confident, effective attack that connects solidly.',
    };
  }

  if (qualityValue >= 8) {
    return {
      label: 'Average',
      tier: 'average',
      narrativeGuide: 'A competent but unremarkable attack. It connects adequately — describe a workmanlike strike without particular flourish, leaving the situation open.',
    };
  }

  return {
    label: 'Poor',
    tier: 'poor',
    narrativeGuide: 'A clumsy or strained attempt. The attack barely threatens — describe visible effort, poor positioning, or the target easily deflecting the blow.',
  };
}

/**
 * Get roll quality for ability dice (d6/d8/d10).
 * Uses percentage of maximum possible roll.
 * 
 * Tiers:
 * - Max on any die: Critical Success
 * - All 1s: Critical Failure
 * - 75%+ of max: Strong
 * - 40-74% of max: Average
 * - Below 40%: Weak
 */
export function getAbilityRollQuality(
  rolls: number[],
  die: DieType
): RollQuality {
  const maxDieValue = parseInt(die.slice(1));
  const maxTotal = rolls.length * maxDieValue;
  const total = rolls.reduce((sum, r) => sum + r, 0);
  const percentage = total / maxTotal;

  const hasCrit = rolls.some(r => r === maxDieValue);
  const allOnes = rolls.every(r => r === 1);

  if (hasCrit) {
    return {
      label: 'CRITICAL SUCCESS',
      tier: 'critical_hit',
      narrativeGuide: 'The ability surges with maximum potency! Describe a dramatic, awe-inspiring activation — the effect manifests at peak power with an unexpected bonus or narrative advantage.',
    };
  }

  if (allOnes) {
    return {
      label: 'CRITICAL FAILURE',
      tier: 'critical_miss',
      narrativeGuide: 'The ability misfires or backfires. Describe a complication — partial backfire, unintended targets alerted, or momentary vulnerability. Keep it recoverable, not catastrophic.',
    };
  }

  if (percentage >= 0.75) {
    return {
      label: 'Strong',
      tier: 'strong',
      narrativeGuide: 'The ability works as intended with notable effectiveness. Describe the action with confidence and impact — the character\'s mastery is clearly on display.',
    };
  }

  if (percentage >= 0.4) {
    return {
      label: 'Average',
      tier: 'average',
      narrativeGuide: 'The ability functions competently but without particular flourish. Describe standard execution with room for the situation to develop in either direction.',
    };
  }

  return {
    label: 'Weak',
    tier: 'poor',
    narrativeGuide: 'The ability activates with visible effort or strain. Describe a rough, clumsy, or underpowered activation — it works, but barely.',
  };
}
