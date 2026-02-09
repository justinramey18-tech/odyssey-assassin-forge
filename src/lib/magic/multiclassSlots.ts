// Multiclass Spell Slot Calculator
// Combines full caster levels for slot progression, handles Warlock separately

import { DnDClass, ClassLevelMap, FULL_CASTER_CLASSES } from '@/lib/classes';
import { SpellSlotLevel, getSpellSlotsForLevel } from './fullCasterSlots';
import { PactSlots, getPactSlotsForLevel } from './pactMagicSlots';

/**
 * Combined spell slot result for multiclass characters
 */
export interface MulticlassSpellSlots {
  /** Regular spell slots from full caster levels */
  regularSlots: SpellSlotLevel;
  /** Pact magic slots from Warlock levels (if any) */
  pactSlots: PactSlots | null;
  /** Combined caster level used for slot calculation */
  combinedCasterLevel: number;
  /** Warlock level (for pact slots) */
  warlockLevel: number;
}

/**
 * Calculate multiclass spell slots per 5e rules (PHB p.164)
 * 
 * Rules:
 * - Full casters (Wizard, Sorcerer, Cleric, Druid, Bard): Add full class levels
 * - Half casters (Paladin, Ranger): Add half levels rounded down
 * - Third casters (Eldritch Knight, Arcane Trickster): Add third levels rounded down
 * - Warlock: Pact Magic is SEPARATE - does not combine with other slots
 * 
 * @param primaryClass The character's primary class
 * @param primaryLevel Levels in the primary class
 * @param multiclassLevels Map of additional class levels
 * @returns Combined spell slots
 */
export function getMulticlassSpellSlots(
  primaryClass: DnDClass,
  primaryLevel: number,
  multiclassLevels: ClassLevelMap
): MulticlassSpellSlots {
  let combinedCasterLevel = 0;
  let warlockLevel = 0;
  
  // Check if primary class is a full caster
  if (FULL_CASTER_CLASSES.includes(primaryClass)) {
    combinedCasterLevel += primaryLevel;
  } else if (primaryClass === 'warlock') {
    warlockLevel += primaryLevel;
  }
  // Rogue with MagicPath would be handled by existing system
  
  // Add multiclass levels
  for (const [classId, levels] of Object.entries(multiclassLevels)) {
    if (!levels || levels <= 0) continue;
    
    const classType = classId as DnDClass;
    
    if (FULL_CASTER_CLASSES.includes(classType)) {
      // Full casters: Add full levels
      combinedCasterLevel += levels;
    } else if (classType === 'warlock') {
      // Warlock: Track separately for pact magic
      warlockLevel += levels;
    }
    // Note: Half/third casters would be added here with appropriate multipliers
  }
  
  // Cap at level 20
  combinedCasterLevel = Math.min(combinedCasterLevel, 20);
  warlockLevel = Math.min(warlockLevel, 20);
  
  return {
    regularSlots: getSpellSlotsForLevel(combinedCasterLevel),
    pactSlots: warlockLevel > 0 ? getPactSlotsForLevel(warlockLevel) : null,
    combinedCasterLevel,
    warlockLevel,
  };
}

/**
 * Get the maximum spell level a multiclass character can cast
 */
export function getMulticlassMaxSpellLevel(
  primaryClass: DnDClass,
  primaryLevel: number,
  multiclassLevels: ClassLevelMap
): number {
  const { combinedCasterLevel, warlockLevel } = getMulticlassSpellSlots(
    primaryClass,
    primaryLevel,
    multiclassLevels
  );
  
  // Maximum spell level from regular slots
  let maxLevel = 0;
  if (combinedCasterLevel >= 17) maxLevel = 9;
  else if (combinedCasterLevel >= 15) maxLevel = 8;
  else if (combinedCasterLevel >= 13) maxLevel = 7;
  else if (combinedCasterLevel >= 11) maxLevel = 6;
  else if (combinedCasterLevel >= 9) maxLevel = 5;
  else if (combinedCasterLevel >= 7) maxLevel = 4;
  else if (combinedCasterLevel >= 5) maxLevel = 3;
  else if (combinedCasterLevel >= 3) maxLevel = 2;
  else if (combinedCasterLevel >= 1) maxLevel = 1;
  
  // Warlock pact slots max at 5th level
  if (warlockLevel >= 9) {
    maxLevel = Math.max(maxLevel, 5);
  } else if (warlockLevel >= 7) {
    maxLevel = Math.max(maxLevel, 4);
  } else if (warlockLevel >= 5) {
    maxLevel = Math.max(maxLevel, 3);
  } else if (warlockLevel >= 3) {
    maxLevel = Math.max(maxLevel, 2);
  } else if (warlockLevel >= 1) {
    maxLevel = Math.max(maxLevel, 1);
  }
  
  return maxLevel;
}

/**
 * Check if a character has any spellcasting ability
 */
export function hasSpellcasting(
  primaryClass: DnDClass,
  primaryLevel: number,
  multiclassLevels: ClassLevelMap
): boolean {
  const { combinedCasterLevel, warlockLevel } = getMulticlassSpellSlots(
    primaryClass,
    primaryLevel,
    multiclassLevels
  );
  
  return combinedCasterLevel > 0 || warlockLevel > 0;
}
