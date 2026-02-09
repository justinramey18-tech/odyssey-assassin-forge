// Wizard Class Configuration
// D&D 5e full caster, Intelligence-based

import { ClassConfig } from '../types';

export const WIZARD_CONFIG: ClassConfig = {
  id: 'wizard',
  name: 'Wizard',
  hitDie: 'd6',
  hitDieMax: 6,
  hitDieAvg: 4,
  primaryAbility: 'intelligence',
  spellcasting: {
    type: 'full',
    ability: 'INT',
    prepared: true, // Prepares spells from spellbook
  },
  multiclassRequirements: {
    intelligence: 13,
  },
  multiclassProficiencies: {
    armor: [],
    weapons: [],
    skillCount: 0,
  },
  iconName: 'BookOpen',
  themeColor: 'blue-500',
  flavorText: 'Scholars of arcane lore who master magic through rigorous study and intellect.',
};
