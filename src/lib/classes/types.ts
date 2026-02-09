// D&D Class Type Definitions
// Core types for the multiclass spellcaster system

import { AbilityName } from '@/lib/abilityScores/types';

/**
 * All supported D&D classes
 * - 'rogue' is the legacy Odyssey Assassin base class
 * - Other classes are new spellcaster options
 */
export type DnDClass = 
  | 'rogue'     // Odyssey Assassin (legacy)
  | 'wizard'
  | 'sorcerer'
  | 'warlock'
  | 'cleric'
  | 'druid'
  | 'bard';

/**
 * Valid hit dice in D&D 5e
 */
export type HitDie = 'd6' | 'd8' | 'd10' | 'd12';

/**
 * Spellcasting progression type per 5e rules
 * - 'full': Full caster (Wizard, Cleric, etc.) - sum levels directly
 * - 'half': Half caster (Paladin, Ranger) - half levels rounded down
 * - 'third': Third caster (Eldritch Knight, Arcane Trickster)
 * - 'pact': Warlock pact magic - separate slot progression
 * - 'none': No spellcasting
 */
export type SpellcastingType = 'full' | 'half' | 'third' | 'pact' | 'none';

/**
 * Primary spellcasting ability
 */
export type SpellcastingAbility = 'INT' | 'WIS' | 'CHA';

/**
 * Spellcasting configuration for a class
 */
export interface ClassSpellcasting {
  type: SpellcastingType;
  ability: SpellcastingAbility;
  /** true = prepare spells from class list, false = known spells only */
  prepared: boolean;
}

/**
 * Proficiencies granted when multiclassing into a class
 * Note: Per 5e rules, multiclassing does NOT grant saving throw proficiencies
 */
export interface MulticlassProficiencies {
  armor: string[];
  weapons: string[];
  /** Number of skills that can be chosen (usually 0-1) */
  skillCount: number;
}

/**
 * Complete configuration for a D&D class
 */
export interface ClassConfig {
  id: DnDClass;
  name: string;
  hitDie: HitDie;
  hitDieMax: 6 | 8 | 10 | 12;
  /** Average hit die roll per 5e (rounded down): d6=3, d8=4, d10=5, d12=6 */
  hitDieAvg: 3 | 4 | 5 | 6;
  primaryAbility: AbilityName;
  spellcasting: ClassSpellcasting;
  /** Minimum ability scores required to multiclass into this class */
  multiclassRequirements: Partial<Record<AbilityName, number>>;
  /** Proficiencies gained when multiclassing into this class */
  multiclassProficiencies: MulticlassProficiencies;
  /** Lucide icon name */
  iconName: string;
  /** Theme color (CSS variable name or Tailwind class) */
  themeColor: string;
  /** Short flavor description */
  flavorText: string;
}

/**
 * Map of class levels for multiclass characters
 */
export type ClassLevelMap = Partial<Record<DnDClass, number>>;

/**
 * Full caster classes that sum levels directly for multiclass spell slots
 */
export const FULL_CASTER_CLASSES: DnDClass[] = [
  'wizard',
  'sorcerer',
  'cleric',
  'druid',
  'bard',
];

/**
 * Pact magic casters (handled separately from regular spell slots)
 */
export const PACT_CASTER_CLASSES: DnDClass[] = ['warlock'];

/**
 * All spellcaster classes (excluding rogue which uses MagicPath)
 */
export const SPELLCASTER_CLASSES: DnDClass[] = [
  ...FULL_CASTER_CLASSES,
  ...PACT_CASTER_CLASSES,
];

/**
 * Check if a class is a full caster
 */
export function isFullCaster(classId: DnDClass): boolean {
  return FULL_CASTER_CLASSES.includes(classId);
}

/**
 * Check if a class uses pact magic
 */
export function isPactCaster(classId: DnDClass): boolean {
  return PACT_CASTER_CLASSES.includes(classId);
}
