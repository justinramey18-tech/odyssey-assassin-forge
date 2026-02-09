// Bard Class Configuration
// D&D 5e full caster, Charisma-based, versatile support

import { ClassConfig } from '../types';

export const BARD_CONFIG: ClassConfig = {
  id: 'bard',
  name: 'Bard',
  hitDie: 'd8',
  hitDieMax: 8,
  hitDieAvg: 5,
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
    armor: ['light'],
    weapons: ['hand crossbow', 'longsword', 'rapier', 'shortsword'],
    skillCount: 1, // Choose 1 from any skill
  },
  iconName: 'Music',
  themeColor: 'pink-500',
  flavorText: 'Masters of song, speech, and the magic woven into both. Jacks of all trades.',
};
