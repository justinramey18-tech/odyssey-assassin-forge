// Druid Class Configuration
// D&D 5e full caster, Wisdom-based, nature magic

import { ClassConfig } from '../types';

export const DRUID_CONFIG: ClassConfig = {
  id: 'druid',
  name: 'Druid',
  hitDie: 'd8',
  hitDieMax: 8,
  hitDieAvg: 5,
  primaryAbility: 'wisdom',
  spellcasting: {
    type: 'full',
    ability: 'WIS',
    prepared: true, // Prepares from entire druid spell list
  },
  multiclassRequirements: {
    wisdom: 13,
  },
  multiclassProficiencies: {
    armor: ['light', 'medium', 'shields'], // Non-metal only per flavor
    weapons: [],
    skillCount: 0,
  },
  iconName: 'Leaf',
  themeColor: 'green-600',
  flavorText: 'Guardians of nature who draw upon primal magic and can transform into beasts.',
};
