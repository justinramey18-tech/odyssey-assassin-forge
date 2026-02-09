// Sorcerer Class Configuration
// D&D 5e full caster, Charisma-based, innate magic

import { ClassConfig } from '../types';

export const SORCERER_CONFIG: ClassConfig = {
  id: 'sorcerer',
  name: 'Sorcerer',
  hitDie: 'd6',
  hitDieMax: 6,
  hitDieAvg: 4,
  primaryAbility: 'charisma',
  spellcasting: {
    type: 'full',
    ability: 'CHA',
    prepared: false, // Known spells only
  },
  multiclassRequirements: {
    charisma: 13,
  },
  multiclassProficiencies: {
    armor: [],
    weapons: [],
    skillCount: 0,
  },
  iconName: 'Flame',
  themeColor: 'red-500',
  flavorText: 'Born with innate magical power, Sorcerers shape raw magic through force of will.',
};
