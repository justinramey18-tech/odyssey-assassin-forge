// Rogue Class Configuration
// Legacy Odyssey Assassin base class

import { ClassConfig } from '../types';

export const ROGUE_CONFIG: ClassConfig = {
  id: 'rogue',
  name: 'Rogue',
  hitDie: 'd8',
  hitDieMax: 8,
  hitDieAvg: 5,
  primaryAbility: 'dexterity',
  spellcasting: {
    type: 'none', // Rogue uses MagicPath system instead
    ability: 'INT',
    prepared: false,
  },
  multiclassRequirements: {
    dexterity: 13,
  },
  multiclassProficiencies: {
    armor: ['light'],
    weapons: ['hand crossbow', 'longsword', 'rapier', 'shortsword'],
    skillCount: 1, // Choose 1 from Rogue skill list
  },
  iconName: 'Skull',
  themeColor: 'primary',
  flavorText: 'Masters of stealth and precision strikes. The Odyssey Assassin walks the path of shadows.',
};
