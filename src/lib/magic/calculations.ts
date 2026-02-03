// ============================================
// D&D 5e MAGIC CALCULATIONS
// ============================================

import { MagicPath, SlotProgression } from './types';
import { getPathConfig } from './paths';

// ============================================
// PROFICIENCY BONUS
// ============================================

/**
 * Calculate proficiency bonus based on character level
 * D&D 5e: +2 at level 1, increasing by +1 every 4 levels
 */
export function getProficiencyBonus(characterLevel: number): number {
  if (characterLevel < 1) return 2;
  if (characterLevel > 20) return 6;
  return Math.floor((characterLevel - 1) / 4) + 2;
}

// ============================================
// SPELLCASTER LEVEL
// ============================================

/**
 * Calculate effective spellcaster level for slot progression
 * - Third casters: character level ÷ 3 (rounded down)
 * - Half casters: character level ÷ 2 (rounded down)
 * - Pact magic: full character level
 */
export function getSpellcasterLevel(
  characterLevel: number,
  progression: SlotProgression
): number {
  switch (progression) {
    case 'third':
      return Math.floor(characterLevel / 3);
    case 'half':
      return Math.floor(characterLevel / 2);
    case 'pact':
      return characterLevel;
    default:
      return 0;
  }
}

// ============================================
// SPELL PREPARATION
// ============================================

export interface SpellPreparationInfo {
  /** Number of cantrips known (fixed by path/level) */
  cantripsKnown: number;
  /** Total spells that can be prepared */
  maxPreparedSpells: number;
  /** Spellcaster level for this path */
  spellcasterLevel: number;
  /** Highest spell level accessible */
  maxSpellLevel: number;
  /** Whether ritual casting is available */
  hasRitualCasting: boolean;
}

/**
 * Calculate spell preparation limits based on path, level, and ability modifier
 * 
 * For D&D 5e:
 * - Arcane Trickster / Eldritch Knight: Spells known (not prepared), limited selection
 * - Shadow Blade (Ranger-style): Spells known, not prepared
 * - Hexblade: Spells known, not prepared (but Warlock-style)
 * 
 * For this system, we use a "spells prepared" approach for simplicity
 */
export function getSpellPreparationInfo(
  path: MagicPath,
  characterLevel: number,
  abilityModifier: number
): SpellPreparationInfo {
  const pathConfig = getPathConfig(path);
  const progression = pathConfig.slotProgression;
  const spellcasterLevel = getSpellcasterLevel(characterLevel, progression);
  
  // Cantrips known by spellcaster level
  let cantripsKnown = 2;
  if (spellcasterLevel >= 4) cantripsKnown = 3;
  if (spellcasterLevel >= 10) cantripsKnown = 4;
  if (spellcasterLevel >= 14) cantripsKnown = 5;
  
  // Max spell level accessible
  let maxSpellLevel = 0;
  if (progression === 'pact') {
    // Pact magic: faster progression
    if (characterLevel >= 1) maxSpellLevel = 1;
    if (characterLevel >= 3) maxSpellLevel = 2;
    if (characterLevel >= 5) maxSpellLevel = 3;
    if (characterLevel >= 7) maxSpellLevel = 4;
    if (characterLevel >= 9) maxSpellLevel = 5;
  } else if (progression === 'third') {
    // Third casters
    if (characterLevel >= 3) maxSpellLevel = 1;
    if (characterLevel >= 7) maxSpellLevel = 2;
    if (characterLevel >= 13) maxSpellLevel = 3;
    if (characterLevel >= 19) maxSpellLevel = 4;
  } else {
    // Half casters
    if (characterLevel >= 2) maxSpellLevel = 1;
    if (characterLevel >= 5) maxSpellLevel = 2;
    if (characterLevel >= 9) maxSpellLevel = 3;
    if (characterLevel >= 13) maxSpellLevel = 4;
    if (characterLevel >= 17) maxSpellLevel = 5;
  }
  
  // Spells prepared = ability modifier + spellcaster level (minimum 1)
  const maxPreparedSpells = Math.max(1, abilityModifier + Math.max(1, spellcasterLevel));
  
  // Ritual casting available for Arcane Trickster
  const hasRitualCasting = path === 'arcane_trickster';
  
  return {
    cantripsKnown,
    maxPreparedSpells,
    spellcasterLevel,
    maxSpellLevel,
    hasRitualCasting,
  };
}

// ============================================
// CANTRIP SCALING
// ============================================

export interface CantripScaling {
  /** Current damage dice count */
  diceCount: number;
  /** Scaled damage formula (e.g., "2d10") */
  scaledFormula: string;
  /** Character level thresholds for scaling */
  nextScalingLevel: number | null;
}

/**
 * Get cantrip damage scaling based on character level
 * D&D 5e: Cantrips scale at levels 5, 11, and 17
 * 
 * @param baseDiceCount The base number of dice (usually 1)
 * @param dieType The die type (e.g., "d10")
 * @param characterLevel The character's current level
 */
export function getCantripScaling(
  baseDiceCount: number,
  dieType: string,
  characterLevel: number
): CantripScaling {
  let diceCount = baseDiceCount;
  let nextScalingLevel: number | null = null;
  
  if (characterLevel >= 17) {
    diceCount = baseDiceCount * 4;
    nextScalingLevel = null; // Max scaling reached
  } else if (characterLevel >= 11) {
    diceCount = baseDiceCount * 3;
    nextScalingLevel = 17;
  } else if (characterLevel >= 5) {
    diceCount = baseDiceCount * 2;
    nextScalingLevel = 11;
  } else {
    diceCount = baseDiceCount;
    nextScalingLevel = 5;
  }
  
  return {
    diceCount,
    scaledFormula: `${diceCount}${dieType}`,
    nextScalingLevel,
  };
}

/**
 * Parse a damage formula and apply cantrip scaling
 * Input: "1d10" → Output at level 5: "2d10"
 */
export function scaleCantrip(
  damageFormula: string | undefined,
  characterLevel: number
): string | undefined {
  if (!damageFormula) return undefined;
  
  // Parse formula like "1d10" or "2d8"
  const match = damageFormula.match(/^(\d+)(d\d+)(.*)$/);
  if (!match) return damageFormula;
  
  const [, baseDice, dieType, suffix] = match;
  const scaling = getCantripScaling(parseInt(baseDice), dieType, characterLevel);
  
  return `${scaling.scaledFormula}${suffix}`;
}

// ============================================
// CONCENTRATION CHECK
// ============================================

/**
 * Calculate the DC for a concentration saving throw
 * DC = 10 OR half the damage taken (whichever is higher)
 */
export function getConcentrationCheckDC(damageTaken: number): number {
  return Math.max(10, Math.floor(damageTaken / 2));
}

// ============================================
// SPELL SLOT RECOVERY
// ============================================

export interface ArcaneRecoveryResult {
  slotsRecovered: Record<number, number>;
  totalLevelsRecovered: number;
}

/**
 * Calculate Arcane Recovery slots (for paths that have this feature)
 * Recovers spell slots with combined levels ≤ half wizard level (rounded up)
 * No slot can be 6th level or higher
 */
export function calculateArcaneRecovery(
  spellcasterLevel: number,
  availableSlotLevels: number[]
): number {
  // Max total levels that can be recovered
  return Math.ceil(spellcasterLevel / 2);
}

// ============================================
// BONUS ACTION SPELL RESTRICTION
// ============================================

export interface BonusActionRestriction {
  /** Whether a bonus action spell was cast this turn */
  bonusActionSpellCast: boolean;
  /** If true, only cantrips can be cast as an action */
  restrictedToCantrips: boolean;
}

/**
 * Check if a spell can be cast given bonus action restrictions
 * D&D 5e Rule: If you cast a bonus action spell, you can only cast a cantrip as your action
 */
export function canCastSpell(
  spellLevel: number,
  castingTime: string,
  bonusActionSpellCast: boolean
): { allowed: boolean; reason?: string } {
  // If a bonus action spell was already cast this turn
  if (bonusActionSpellCast && castingTime === 'action' && spellLevel > 0) {
    return {
      allowed: false,
      reason: 'You cast a bonus action spell this turn. Only cantrips can be cast as an action.',
    };
  }
  
  return { allowed: true };
}
