// Class Proficiency Utilities
// Handles proficiency aggregation for multiclass characters

import { DnDClass, ClassConfig, MulticlassProficiencies } from './types';

/**
 * Armor proficiency levels (higher includes lower)
 */
export type ArmorProficiency = 'none' | 'light' | 'medium' | 'heavy' | 'shields';

/**
 * Aggregated proficiencies from all classes
 */
export interface AggregatedProficiencies {
  armor: Set<string>;
  weapons: Set<string>;
  availableSkillChoices: number;
}

/**
 * Aggregate proficiencies from multiple classes
 * Note: Primary class grants full starting proficiencies
 * Multiclass levels only grant limited proficiencies per 5e rules
 */
export function aggregateProficiencies(
  primaryClass: ClassConfig,
  multiclassConfigs: ClassConfig[]
): AggregatedProficiencies {
  const armor = new Set<string>();
  const weapons = new Set<string>();
  let skillChoices = 0;
  
  // Primary class would grant full starting proficiencies
  // (This would be handled separately in character creation)
  
  // Multiclass proficiencies
  for (const config of multiclassConfigs) {
    const mc = config.multiclassProficiencies;
    
    mc.armor.forEach(a => armor.add(a));
    mc.weapons.forEach(w => weapons.add(w));
    skillChoices += mc.skillCount;
  }
  
  return {
    armor,
    weapons,
    availableSkillChoices: skillChoices,
  };
}

/**
 * Check if character has proficiency with a specific armor type
 */
export function hasArmorProficiency(
  proficiencies: AggregatedProficiencies,
  armorType: string
): boolean {
  return proficiencies.armor.has(armorType.toLowerCase());
}

/**
 * Check if character has proficiency with a specific weapon
 */
export function hasWeaponProficiency(
  proficiencies: AggregatedProficiencies,
  weaponName: string
): boolean {
  const normalized = weaponName.toLowerCase();
  
  // Check exact match
  if (proficiencies.weapons.has(normalized)) {
    return true;
  }
  
  // Check category matches (e.g., "simple weapons", "martial weapons")
  if (proficiencies.weapons.has('simple weapons') && isSimpleWeapon(normalized)) {
    return true;
  }
  if (proficiencies.weapons.has('martial weapons') && isMartialWeapon(normalized)) {
    return true;
  }
  
  return false;
}

// Weapon categorization helpers
const SIMPLE_WEAPONS = new Set([
  'club', 'dagger', 'greatclub', 'handaxe', 'javelin', 'light hammer',
  'mace', 'quarterstaff', 'sickle', 'spear', 'light crossbow', 'dart',
  'shortbow', 'sling',
]);

const MARTIAL_WEAPONS = new Set([
  'battleaxe', 'flail', 'glaive', 'greataxe', 'greatsword', 'halberd',
  'lance', 'longsword', 'maul', 'morningstar', 'pike', 'rapier',
  'scimitar', 'shortsword', 'trident', 'war pick', 'warhammer', 'whip',
  'blowgun', 'hand crossbow', 'heavy crossbow', 'longbow', 'net',
]);

function isSimpleWeapon(name: string): boolean {
  return SIMPLE_WEAPONS.has(name.toLowerCase());
}

function isMartialWeapon(name: string): boolean {
  return MARTIAL_WEAPONS.has(name.toLowerCase());
}
