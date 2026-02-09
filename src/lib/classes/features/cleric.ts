// Cleric Class Features
// D&D 5e Cleric - Wisdom-based divine caster

import { ClassFeature } from './types';

export const CLERIC_FEATURES: ClassFeature[] = [
  {
    id: 'cleric-spellcasting',
    classId: 'cleric',
    name: 'Spellcasting',
    level: 1,
    description: 'You can cast cleric spells using Wisdom as your spellcasting ability. You prepare spells from the entire cleric spell list each day.',
    mechanicalEffect: 'WIS-based prepared spellcasting',
    isSubclassFeature: false,
    iconName: 'BookOpen',
  },
  {
    id: 'cleric-divine-domain',
    classId: 'cleric',
    name: 'Divine Domain',
    level: 1,
    description: 'Choose a divine domain related to your deity: Life, Light, Nature, Knowledge, Tempest, Trickery, War, Death, Forge, Grave, Order, Peace, or Twilight.',
    mechanicalEffect: 'Subclass selection',
    isSubclassFeature: true,
    iconName: 'Sparkles',
  },
  {
    id: 'cleric-channel-divinity',
    classId: 'cleric',
    name: 'Channel Divinity',
    level: 2,
    description: 'You can channel divine energy to fuel magical effects. You start with Turn Undead and one domain-specific option. Uses increase at 6th and 18th level.',
    mechanicalEffect: '1 use/rest (2 at 6th, 3 at 18th)',
    usageType: 'short_rest',
    uses: 1,
    isSubclassFeature: false,
    iconName: 'Sunrise',
  },
  {
    id: 'cleric-turn-undead',
    classId: 'cleric',
    name: 'Channel Divinity: Turn Undead',
    level: 2,
    description: 'As an action, present your holy symbol. Each undead within 30 feet that can see or hear you must make a WIS save or be turned for 1 minute.',
    mechanicalEffect: 'Turn undead in 30 ft radius',
    isSubclassFeature: false,
    iconName: 'Sun',
  },
  {
    id: 'cleric-destroy-undead',
    classId: 'cleric',
    name: 'Destroy Undead',
    level: 5,
    description: 'When an undead fails its save against Turn Undead and has a CR at or below a threshold based on your level, it is instantly destroyed.',
    mechanicalEffect: 'Destroy low-CR undead (CR 1/2 at 5th, scales up)',
    isSubclassFeature: false,
    iconName: 'Flame',
  },
  {
    id: 'cleric-divine-intervention',
    classId: 'cleric',
    name: 'Divine Intervention',
    level: 10,
    description: 'You can call on your deity for aid. Roll d100; if the result is equal to or less than your cleric level, your deity intervenes. Usable once per 7 days on success.',
    mechanicalEffect: 'Cleric level % chance for divine aid',
    usageType: 'long_rest',
    uses: 1,
    isSubclassFeature: false,
    iconName: 'CloudLightning',
  },
  {
    id: 'cleric-divine-intervention-improved',
    classId: 'cleric',
    name: 'Improved Divine Intervention',
    level: 20,
    description: 'Your call to your deity succeeds automatically.',
    mechanicalEffect: 'Divine Intervention always succeeds',
    isSubclassFeature: false,
    iconName: 'Crown',
  },
];

/**
 * Destroy Undead CR thresholds by cleric level
 */
export const DESTROY_UNDEAD_CR: Record<number, string> = {
  5: 'CR 1/2',
  8: 'CR 1',
  11: 'CR 2',
  14: 'CR 3',
  17: 'CR 4',
};

/**
 * Get Channel Divinity uses for a given cleric level
 */
export function getChannelDivinityUses(clericLevel: number): number {
  if (clericLevel < 2) return 0;
  if (clericLevel < 6) return 1;
  if (clericLevel < 18) return 2;
  return 3;
}
