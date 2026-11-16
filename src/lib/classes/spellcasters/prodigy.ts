// The Prodigy: solo Empyrean's own class (D-37). Not a D&D class and not a spellcaster: its
// power is the signet, the dragon bond and command of the wing, and its progression is the
// Ascension (src/lib/empyreanClasses/prodigy.ts). Offered only by the Dragon Rider creator.

import { ClassConfig } from '../types';

export const PRODIGY_CONFIG: ClassConfig = {
  id: 'prodigy',
  name: 'The Prodigy',
  hitDie: 'd10',
  hitDieMax: 10,
  hitDieAvg: 6,
  primaryAbility: 'charisma',
  spellcasting: {
    type: 'none', // the signet and its strain, not spell slots
    ability: 'CHA',
    prepared: false,
  },
  // Not open to multiclassing: a Prodigy is made, not trained into.
  multiclassRequirements: {
    charisma: 99,
  },
  multiclassProficiencies: {
    armor: ['light'],
    weapons: ['dagger', 'shortsword', 'longsword'],
    skillCount: 0,
  },
  iconName: 'Flame',
  themeColor: 'primary',
  flavorText: 'A rider whose signet, dragon bond and command of the wing all grow together, far faster than anyone else at Basgiath.',
  empyreanOnly: true,
};
