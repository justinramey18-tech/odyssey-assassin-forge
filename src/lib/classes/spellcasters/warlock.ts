// Warlock Class Configuration
// D&D 5e pact magic caster, Charisma-based

import { ClassConfig } from '../types';

export const WARLOCK_CONFIG: ClassConfig = {
  id: 'warlock',
  name: 'Warlock',
  hitDie: 'd8',
  hitDieMax: 8,
  hitDieAvg: 5,
  primaryAbility: 'charisma',
  spellcasting: {
    type: 'pact',
    ability: 'CHA',
    prepared: false, // Known spells only
  },
  multiclassRequirements: {
    charisma: 13,
  },
  multiclassProficiencies: {
    armor: ['light'],
    weapons: ['simple weapons'],
    skillCount: 0,
  },
  iconName: 'Moon',
  themeColor: 'purple-600',
  flavorText: 'Seekers of forbidden knowledge who forge pacts with otherworldly patrons for power.',
};
