// Initiative Utilities - DEX Modifier Estimates by Creature Type

import { CreatureType } from './creatureTypes';

/**
 * Estimated DEX modifiers by creature type based on D&D 5e Monster Manual averages.
 * These are rough estimates for when exact stats aren't known.
 */
export const CREATURE_DEX_ESTIMATES: Record<CreatureType, number> = {
  aberration: +1,      // Varies wildly, slightly above average
  beast: +2,           // Animals tend to be nimble
  celestial: +2,       // Divine grace
  construct: -1,       // Typically slow and rigid
  dragon: +1,          // Surprisingly agile for size
  elemental: +2,       // Air/fire elementals are fast
  fey: +3,             // Very nimble and quick
  fiend: +2,           // Devils are precise, demons chaotic but fast
  giant: -1,           // Large and slow
  humanoid: +1,        // Average human dexterity
  monstrosity: +1,     // Highly variable
  ooze: -3,            // Very slow, amorphous
  plant: -2,           // Generally immobile
  undead: +0,          // Zombies slow, ghosts fast - averages out
};

/**
 * Get estimated DEX modifier for a creature type.
 * Returns 0 if type is unknown.
 */
export function getEstimatedDexModifier(creatureType?: CreatureType): number {
  if (!creatureType) return 0;
  return CREATURE_DEX_ESTIMATES[creatureType] ?? 0;
}

/**
 * Roll initiative with estimated DEX modifier.
 * Returns { roll, modifier, total }
 */
export function rollInitiativeWithEstimate(creatureType?: CreatureType): {
  roll: number;
  modifier: number;
  total: number;
} {
  const roll = Math.floor(Math.random() * 20) + 1;
  const modifier = getEstimatedDexModifier(creatureType);
  return {
    roll,
    modifier,
    total: roll + modifier,
  };
}

/**
 * Display info for creature DEX estimates
 */
export const CREATURE_DEX_LABELS: Record<CreatureType, string> = {
  aberration: '+1 (variable)',
  beast: '+2 (nimble)',
  celestial: '+2 (graceful)',
  construct: '-1 (rigid)',
  dragon: '+1 (agile)',
  elemental: '+2 (swift)',
  fey: '+3 (quick)',
  fiend: '+2 (fast)',
  giant: '-1 (slow)',
  humanoid: '+1 (average)',
  monstrosity: '+1 (variable)',
  ooze: '-3 (sluggish)',
  plant: '-2 (rooted)',
  undead: '+0 (mixed)',
};
