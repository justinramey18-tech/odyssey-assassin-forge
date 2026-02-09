// Warlock Class Features
// D&D 5e Warlock - Charisma-based pact magic caster

import { ClassFeature, ScalingFeature } from './types';

/**
 * Eldritch Invocations known scaling
 */
export const INVOCATIONS_SCALING: ScalingFeature = {
  id: 'warlock-invocations-count',
  classId: 'warlock',
  name: 'Eldritch Invocations Known',
  level: 2,
  description: 'The number of Eldritch Invocations you can learn.',
  isSubclassFeature: false,
  iconName: 'Eye',
  scaling: [
    { level: 2, value: '2' },
    { level: 5, value: '3' },
    { level: 7, value: '4' },
    { level: 9, value: '5' },
    { level: 12, value: '6' },
    { level: 15, value: '7' },
    { level: 18, value: '8' },
  ],
};

export const WARLOCK_FEATURES: ClassFeature[] = [
  {
    id: 'warlock-pact-magic',
    classId: 'warlock',
    name: 'Pact Magic',
    level: 1,
    description: 'You can cast warlock spells using Charisma. Your spell slots are always cast at the highest level available and recharge on a short rest.',
    mechanicalEffect: 'CHA-based pact magic, slots recharge on short rest',
    isSubclassFeature: false,
    iconName: 'Moon',
  },
  {
    id: 'warlock-patron',
    classId: 'warlock',
    name: 'Otherworldly Patron',
    level: 1,
    description: 'Choose your patron: The Archfey, The Fiend, The Great Old One, The Celestial, The Hexblade, or others. Your patron grants you features and an expanded spell list.',
    mechanicalEffect: 'Subclass selection',
    isSubclassFeature: true,
    iconName: 'Sparkles',
  },
  {
    id: 'warlock-eldritch-invocations',
    classId: 'warlock',
    name: 'Eldritch Invocations',
    level: 2,
    description: 'You gain eldritch invocations that grant you magical abilities. Some require specific pacts or patron features.',
    mechanicalEffect: 'Passive magical abilities',
    isSubclassFeature: false,
    iconName: 'Zap',
  },
  INVOCATIONS_SCALING,
  {
    id: 'warlock-pact-boon',
    classId: 'warlock',
    name: 'Pact Boon',
    level: 3,
    description: 'Choose a boon from your patron: Pact of the Chain (familiar), Pact of the Blade (weapon), Pact of the Tome (cantrips), or Pact of the Talisman.',
    mechanicalEffect: 'Choose Chain, Blade, Tome, or Talisman',
    isSubclassFeature: false,
    iconName: 'Gift',
  },
  {
    id: 'warlock-mystic-arcanum-6',
    classId: 'warlock',
    name: 'Mystic Arcanum (6th)',
    level: 11,
    description: 'Choose a 6th-level warlock spell. You can cast it once without a spell slot, regaining the ability on a long rest.',
    mechanicalEffect: '1/long rest 6th-level spell',
    usageType: 'long_rest',
    uses: 1,
    isSubclassFeature: false,
    iconName: 'Star',
  },
  {
    id: 'warlock-mystic-arcanum-7',
    classId: 'warlock',
    name: 'Mystic Arcanum (7th)',
    level: 13,
    description: 'Choose a 7th-level warlock spell. You can cast it once without a spell slot, regaining the ability on a long rest.',
    mechanicalEffect: '1/long rest 7th-level spell',
    usageType: 'long_rest',
    uses: 1,
    isSubclassFeature: false,
    iconName: 'Star',
  },
  {
    id: 'warlock-mystic-arcanum-8',
    classId: 'warlock',
    name: 'Mystic Arcanum (8th)',
    level: 15,
    description: 'Choose an 8th-level warlock spell. You can cast it once without a spell slot, regaining the ability on a long rest.',
    mechanicalEffect: '1/long rest 8th-level spell',
    usageType: 'long_rest',
    uses: 1,
    isSubclassFeature: false,
    iconName: 'Star',
  },
  {
    id: 'warlock-mystic-arcanum-9',
    classId: 'warlock',
    name: 'Mystic Arcanum (9th)',
    level: 17,
    description: 'Choose a 9th-level warlock spell. You can cast it once without a spell slot, regaining the ability on a long rest.',
    mechanicalEffect: '1/long rest 9th-level spell',
    usageType: 'long_rest',
    uses: 1,
    isSubclassFeature: false,
    iconName: 'Star',
  },
  {
    id: 'warlock-eldritch-master',
    classId: 'warlock',
    name: 'Eldritch Master',
    level: 20,
    description: 'You can spend 1 minute entreating your patron to regain all expended pact magic spell slots.',
    mechanicalEffect: '1/long rest: regain all pact slots in 1 minute',
    usageType: 'long_rest',
    uses: 1,
    isSubclassFeature: false,
    iconName: 'Crown',
  },
];

/**
 * Popular Eldritch Invocations (legacy reference - see src/lib/classes/invocations.ts for full list)
 */
export { ALL_INVOCATIONS as ELDRITCH_INVOCATIONS } from '../invocations';

/**
 * Get invocations known for a given warlock level
 */
export function getInvocationsKnown(warlockLevel: number): number {
  if (warlockLevel < 2) return 0;
  if (warlockLevel < 5) return 2;
  if (warlockLevel < 7) return 3;
  if (warlockLevel < 9) return 4;
  if (warlockLevel < 12) return 5;
  if (warlockLevel < 15) return 6;
  if (warlockLevel < 18) return 7;
  return 8;
}
