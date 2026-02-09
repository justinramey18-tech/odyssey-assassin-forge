// Bard Class Features
// D&D 5e Bard - Charisma-based versatile caster

import { ClassFeature, ScalingFeature } from './types';

/**
 * Bardic Inspiration die scaling
 */
export const BARDIC_INSPIRATION_DIE: ScalingFeature = {
  id: 'bard-inspiration-die',
  classId: 'bard',
  name: 'Bardic Inspiration Die',
  level: 1,
  description: 'The die type used for Bardic Inspiration.',
  isSubclassFeature: false,
  iconName: 'Dice1',
  scaling: [
    { level: 1, value: 'd6' },
    { level: 5, value: 'd8' },
    { level: 10, value: 'd10' },
    { level: 15, value: 'd12' },
  ],
};

export const BARD_FEATURES: ClassFeature[] = [
  {
    id: 'bard-spellcasting',
    classId: 'bard',
    name: 'Spellcasting',
    level: 1,
    description: 'You can cast bard spells using Charisma as your spellcasting ability. You know a fixed number of spells that you can swap when you level up.',
    mechanicalEffect: 'CHA-based known spellcasting',
    isSubclassFeature: false,
    iconName: 'Music',
  },
  {
    id: 'bard-bardic-inspiration',
    classId: 'bard',
    name: 'Bardic Inspiration',
    level: 1,
    description: 'As a bonus action, give one creature (other than yourself) within 60 feet an inspiration die. Within 10 minutes, they can add it to one ability check, attack roll, or saving throw.',
    mechanicalEffect: 'Bonus action: grant inspiration die to ally',
    usageType: 'long_rest',
    uses: 'modifier',
    usesAbility: 'CHA',
    isSubclassFeature: false,
    iconName: 'Sparkle',
  },
  BARDIC_INSPIRATION_DIE,
  {
    id: 'bard-jack-of-all-trades',
    classId: 'bard',
    name: 'Jack of All Trades',
    level: 2,
    description: 'You can add half your proficiency bonus, rounded down, to any ability check that doesn\'t already include your proficiency bonus.',
    mechanicalEffect: '+half proficiency to non-proficient checks',
    isSubclassFeature: false,
    iconName: 'Wrench',
  },
  {
    id: 'bard-song-of-rest',
    classId: 'bard',
    name: 'Song of Rest',
    level: 2,
    description: 'During a short rest, you and allies who can hear you regain extra hit points when spending Hit Dice. The die scales with bard level.',
    mechanicalEffect: 'Extra healing during short rest (d6, scales)',
    isSubclassFeature: false,
    iconName: 'Heart',
  },
  {
    id: 'bard-college',
    classId: 'bard',
    name: 'Bard College',
    level: 3,
    description: 'Choose a bard college: College of Lore, Valor, Glamour, Swords, Whispers, Creation, Eloquence, or Spirits.',
    mechanicalEffect: 'Subclass selection',
    isSubclassFeature: true,
    iconName: 'Sparkles',
  },
  {
    id: 'bard-expertise',
    classId: 'bard',
    name: 'Expertise',
    level: 3,
    description: 'Choose two skill proficiencies. Your proficiency bonus is doubled for ability checks using those skills. Choose two more at 10th level.',
    mechanicalEffect: 'Double proficiency on 2 skills (4 at 10th)',
    isSubclassFeature: false,
    iconName: 'GraduationCap',
  },
  {
    id: 'bard-font-of-inspiration',
    classId: 'bard',
    name: 'Font of Inspiration',
    level: 5,
    description: 'You regain all expended uses of Bardic Inspiration when you finish a short or long rest.',
    mechanicalEffect: 'Bardic Inspiration recharges on short rest',
    isSubclassFeature: false,
    iconName: 'RefreshCw',
  },
  {
    id: 'bard-countercharm',
    classId: 'bard',
    name: 'Countercharm',
    level: 6,
    description: 'As an action, start a performance that lasts until end of your next turn. You and allies within 30 feet have advantage on saves against being frightened or charmed.',
    mechanicalEffect: 'Advantage on fear/charm saves for nearby allies',
    isSubclassFeature: false,
    iconName: 'Shield',
  },
  {
    id: 'bard-magical-secrets',
    classId: 'bard',
    name: 'Magical Secrets',
    level: 10,
    description: 'Choose two spells from any class. They count as bard spells for you. Choose two additional spells at 14th and 18th level.',
    mechanicalEffect: 'Learn 2 spells from any class (6 total)',
    isSubclassFeature: false,
    iconName: 'ScrollText',
  },
  {
    id: 'bard-superior-inspiration',
    classId: 'bard',
    name: 'Superior Inspiration',
    level: 20,
    description: 'When you roll initiative and have no uses of Bardic Inspiration left, you regain one use.',
    mechanicalEffect: 'Regain 1 Bardic Inspiration on initiative if empty',
    isSubclassFeature: false,
    iconName: 'Crown',
  },
];

/**
 * Song of Rest die scaling by bard level
 */
export const SONG_OF_REST_DIE: Record<number, string> = {
  2: 'd6',
  9: 'd8',
  13: 'd10',
  17: 'd12',
};

/**
 * Get Bardic Inspiration die for a given bard level
 */
export function getBardicInspirationDie(bardLevel: number): string {
  if (bardLevel < 1) return 'd0';
  if (bardLevel < 5) return 'd6';
  if (bardLevel < 10) return 'd8';
  if (bardLevel < 15) return 'd10';
  return 'd12';
}

/**
 * Get Song of Rest die for a given bard level
 */
export function getSongOfRestDie(bardLevel: number): string {
  if (bardLevel < 2) return 'd0';
  if (bardLevel < 9) return 'd6';
  if (bardLevel < 13) return 'd8';
  if (bardLevel < 17) return 'd10';
  return 'd12';
}
