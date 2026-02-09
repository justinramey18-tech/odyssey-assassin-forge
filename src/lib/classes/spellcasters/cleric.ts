// Cleric Class Configuration
// D&D 5e full caster, Wisdom-based, divine magic

import { ClassConfig } from '../types';

export const CLERIC_CONFIG: ClassConfig = {
  id: 'cleric',
  name: 'Cleric',
  hitDie: 'd8',
  hitDieMax: 8,
  hitDieAvg: 5,
  primaryAbility: 'wisdom',
  spellcasting: {
    type: 'full',
    ability: 'WIS',
    prepared: true, // Prepares from entire cleric spell list
  },
  multiclassRequirements: {
    wisdom: 13,
  },
  multiclassProficiencies: {
    armor: ['light', 'medium', 'shields'],
    weapons: [],
    skillCount: 0,
  },
  iconName: 'Cross',
  themeColor: 'yellow-500',
  flavorText: 'Divine champions who channel the power of their deity to heal, protect, and smite.',
};
