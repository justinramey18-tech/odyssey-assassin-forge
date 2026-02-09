import { SpellDefinition, MagicPath, SpellSchool } from '../types';
import { DnDClass } from '@/lib/classes/types';
import { CANTRIPS, getCantripsByPath } from './cantrips';
import { FIRST_LEVEL_SPELLS, getFirstLevelSpellsByPath } from './1st-level';
import { SECOND_LEVEL_SPELLS, getSecondLevelSpellsByPath } from './2nd-level';
import { THIRD_LEVEL_SPELLS, getThirdLevelSpellsByPath } from './3rd-level';
import { FOURTH_LEVEL_SPELLS, getFourthLevelSpellsByPath } from './4th-level';
import { FIFTH_LEVEL_SPELLS, getFifthLevelSpellsByPath } from './5th-level';
import { WIZARD_SPELLS } from './wizard-spells';
import { SORCERER_SPELLS } from './sorcerer-spells';
import { WARLOCK_SPELLS } from './warlock-spells';
import { CLERIC_SPELLS } from './cleric-spells';
import { DRUID_SPELLS } from './druid-spells';
import { SpellFilter, SpellListResult, SpellRegistry } from './types';

// ============================================
// SPELL REGISTRY
// ============================================

export const ALL_SPELLS: SpellDefinition[] = [
  // Rogue Magic Path spells
  ...CANTRIPS,
  ...FIRST_LEVEL_SPELLS,
  ...SECOND_LEVEL_SPELLS,
  ...THIRD_LEVEL_SPELLS,
  ...FOURTH_LEVEL_SPELLS,
  ...FIFTH_LEVEL_SPELLS,
  // Full caster class spells
  ...WIZARD_SPELLS,
  ...SORCERER_SPELLS,
  ...WARLOCK_SPELLS,
  ...CLERIC_SPELLS,
  ...DRUID_SPELLS,
];

export const SPELL_REGISTRY: SpellRegistry = ALL_SPELLS.reduce((acc, spell) => {
  acc[spell.id] = spell;
  return acc;
}, {} as SpellRegistry);

// ============================================
// SPELL LOOKUP
// ============================================

export function getSpellById(id: string): SpellDefinition | undefined {
  return SPELL_REGISTRY[id];
}

export function getSpellsByLevel(level: number): SpellDefinition[] {
  return ALL_SPELLS.filter(s => s.level === level);
}

export function getSpellsBySchool(school: SpellSchool): SpellDefinition[] {
  return ALL_SPELLS.filter(s => s.school === school);
}

export function getSpellsByPath(path: MagicPath): SpellDefinition[] {
  return ALL_SPELLS.filter(
    spell => !spell.pathRestrictions || spell.pathRestrictions.includes(path)
  );
}

// ============================================
// CLASS-BASED SPELL LOOKUP (NEW)
// ============================================

/**
 * Get all spells available to a specific D&D class
 */
export function getSpellsByClass(classId: DnDClass): SpellDefinition[] {
  return ALL_SPELLS.filter(spell => spell.classes?.includes(classId) ?? false);
}

/**
 * Get spells for a class filtered by spell level
 */
export function getClassSpellsByLevel(classId: DnDClass, level: number): SpellDefinition[] {
  return ALL_SPELLS.filter(spell => 
    spell.level === level && (spell.classes?.includes(classId) ?? false)
  );
}

/**
 * Get cantrips available to a specific class
 */
export function getClassCantrips(classId: DnDClass): SpellDefinition[] {
  return getClassSpellsByLevel(classId, 0);
}

// ============================================
// FILTERED SPELL LISTS
// ============================================

export function filterSpells(filter: SpellFilter): SpellDefinition[] {
  return ALL_SPELLS.filter(spell => {
    // Level filter
    if (filter.level !== undefined) {
      const levels = Array.isArray(filter.level) ? filter.level : [filter.level];
      if (!levels.includes(spell.level)) return false;
    }

    // School filter
    if (filter.school !== undefined) {
      const schools = Array.isArray(filter.school) ? filter.school : [filter.school];
      if (!schools.includes(spell.school)) return false;
    }

    // Path filter
    if (filter.path !== undefined) {
      const paths = Array.isArray(filter.path) ? filter.path : [filter.path];
      if (spell.pathRestrictions) {
        if (!spell.pathRestrictions.some(p => paths.includes(p))) return false;
      }
    }

    // Concentration filter
    if (filter.concentration !== undefined) {
      if (spell.concentration !== filter.concentration) return false;
    }

    // Ritual filter
    if (filter.ritual !== undefined) {
      if (spell.ritual !== filter.ritual) return false;
    }

    // Search term filter
    if (filter.searchTerm) {
      const term = filter.searchTerm.toLowerCase();
      const matchesName = spell.name.toLowerCase().includes(term);
      const matchesDescription = spell.description.toLowerCase().includes(term);
      const matchesSchool = spell.school.toLowerCase().includes(term);
      if (!matchesName && !matchesDescription && !matchesSchool) return false;
    }

    return true;
  });
}

// ============================================
// SPELL LISTS FOR PATHS
// ============================================

export function getAvailableSpells(
  path: MagicPath,
  characterLevel: number
): { cantrips: SpellDefinition[]; spells: SpellDefinition[] } {
  const pathSpells = getSpellsByPath(path);
  
  // Determine max spell level based on character level and path
  let maxSpellLevel = 0;
  if (path === 'hexblade') {
    // Warlock: gets spells earlier
    if (characterLevel >= 1) maxSpellLevel = 1;
    if (characterLevel >= 3) maxSpellLevel = 2;
  } else {
    // Third-casters: spellcasting at level 3
    if (characterLevel >= 3) maxSpellLevel = 1;
    if (characterLevel >= 7) maxSpellLevel = 2;
  }

  const cantrips = pathSpells.filter(s => s.level === 0);
  const spells = pathSpells.filter(s => s.level > 0 && s.level <= maxSpellLevel);

  return { cantrips, spells };
}

export function getSpellsForPreparation(
  path: MagicPath,
  knownSpells: string[],
  preparedSpells: string[],
  favoriteSpells: string[]
): SpellListResult[] {
  const pathSpells = getSpellsByPath(path);
  
  return pathSpells.map(spell => ({
    spell,
    isKnown: knownSpells.includes(spell.id),
    isPrepared: preparedSpells.includes(spell.id),
    isFavorite: favoriteSpells.includes(spell.id),
    canLearn: !knownSpells.includes(spell.id),
  }));
}

// ============================================
// SPELL UTILITIES
// ============================================

export function getSpellLevelLabel(level: number): string {
  if (level === 0) return 'Cantrip';
  if (level === 1) return '1st';
  if (level === 2) return '2nd';
  if (level === 3) return '3rd';
  return `${level}th`;
}

export function getCastingTimeLabel(castingTime: string): string {
  switch (castingTime) {
    case 'action': return '1 Action';
    case 'bonus_action': return '1 Bonus Action';
    case 'reaction': return '1 Reaction';
    case 'ritual': return '10 Minutes (Ritual)';
    case '1_minute': return '1 Minute';
    case '10_minutes': return '10 Minutes';
    default: return castingTime;
  }
}

export function getComponentsLabel(components: SpellDefinition['components']): string {
  const parts: string[] = [];
  if (components.verbal) parts.push('V');
  if (components.somatic) parts.push('S');
  if (components.material) parts.push('M');
  return parts.join(', ');
}

// Re-export types and individual spell lists
export * from './types';
export { CANTRIPS, getCantripsByPath } from './cantrips';
export { FIRST_LEVEL_SPELLS, getFirstLevelSpellsByPath } from './1st-level';
export { SECOND_LEVEL_SPELLS, getSecondLevelSpellsByPath } from './2nd-level';
export { THIRD_LEVEL_SPELLS, getThirdLevelSpellsByPath } from './3rd-level';
export { FOURTH_LEVEL_SPELLS, getFourthLevelSpellsByPath } from './4th-level';
export { FIFTH_LEVEL_SPELLS, getFifthLevelSpellsByPath } from './5th-level';
