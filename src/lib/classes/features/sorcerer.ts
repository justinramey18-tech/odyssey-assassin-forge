// Sorcerer Class Features
// D&D 5e Sorcerer - Charisma-based innate caster

import { ClassFeature, ScalingFeature } from './types';

/**
 * Sorcery Points scaling by level
 */
export const SORCERY_POINTS_SCALING: ScalingFeature = {
  id: 'sorcerer-sorcery-points',
  classId: 'sorcerer',
  name: 'Sorcery Points',
  level: 2,
  description: 'You have a pool of sorcery points that fuel your metamagic abilities. You regain all spent points on a long rest.',
  mechanicalEffect: 'Resource pool for metamagic',
  usageType: 'long_rest',
  isSubclassFeature: false,
  iconName: 'Droplets',
  scaling: [
    { level: 2, value: '2' },
    { level: 3, value: '3' },
    { level: 4, value: '4' },
    { level: 5, value: '5' },
    { level: 6, value: '6' },
    { level: 7, value: '7' },
    { level: 8, value: '8' },
    { level: 9, value: '9' },
    { level: 10, value: '10' },
    { level: 11, value: '11' },
    { level: 12, value: '12' },
    { level: 13, value: '13' },
    { level: 14, value: '14' },
    { level: 15, value: '15' },
    { level: 16, value: '16' },
    { level: 17, value: '17' },
    { level: 18, value: '18' },
    { level: 19, value: '19' },
    { level: 20, value: '20' },
  ],
};

export const SORCERER_FEATURES: ClassFeature[] = [
  {
    id: 'sorcerer-spellcasting',
    classId: 'sorcerer',
    name: 'Spellcasting',
    level: 1,
    description: 'You can cast sorcerer spells using Charisma as your spellcasting ability. You know a fixed number of spells that you can swap when you level up.',
    mechanicalEffect: 'CHA-based known spellcasting',
    isSubclassFeature: false,
    iconName: 'Flame',
  },
  {
    id: 'sorcerer-origin',
    classId: 'sorcerer',
    name: 'Sorcerous Origin',
    level: 1,
    description: 'Choose the source of your innate magic: Draconic Bloodline, Wild Magic, Divine Soul, Shadow Magic, Storm Sorcery, or others.',
    mechanicalEffect: 'Subclass selection',
    isSubclassFeature: true,
    iconName: 'Sparkles',
  },
  {
    id: 'sorcerer-font-of-magic',
    classId: 'sorcerer',
    name: 'Font of Magic',
    level: 2,
    description: 'You can convert sorcery points into spell slots and vice versa. Creating a slot costs points equal to the slot level + 1. Converting a slot gives points equal to the slot level.',
    mechanicalEffect: 'Convert between sorcery points and spell slots',
    isSubclassFeature: false,
    iconName: 'Repeat',
  },
  SORCERY_POINTS_SCALING,
  {
    id: 'sorcerer-metamagic',
    classId: 'sorcerer',
    name: 'Metamagic',
    level: 3,
    description: 'Choose two Metamagic options. You can use one Metamagic option per spell unless stated otherwise. Gain additional options at levels 10 and 17.',
    mechanicalEffect: 'Modify spells with sorcery points',
    isSubclassFeature: false,
    iconName: 'Wand2',
  },
  {
    id: 'sorcerer-sorcerous-restoration',
    classId: 'sorcerer',
    name: 'Sorcerous Restoration',
    level: 20,
    description: 'You regain 4 expended sorcery points whenever you finish a short rest.',
    mechanicalEffect: 'Short rest: regain 4 sorcery points',
    usageType: 'short_rest',
    isSubclassFeature: false,
    iconName: 'Battery',
  },
];

/**
 * Metamagic options available to sorcerers
 */
export const METAMAGIC_OPTIONS = [
  { id: 'careful', name: 'Careful Spell', cost: 1, description: 'Protect allies from your AoE spells' },
  { id: 'distant', name: 'Distant Spell', cost: 1, description: 'Double spell range' },
  { id: 'empowered', name: 'Empowered Spell', cost: 1, description: 'Reroll damage dice' },
  { id: 'extended', name: 'Extended Spell', cost: 1, description: 'Double spell duration' },
  { id: 'heightened', name: 'Heightened Spell', cost: 3, description: 'Target has disadvantage on save' },
  { id: 'quickened', name: 'Quickened Spell', cost: 2, description: 'Cast as bonus action' },
  { id: 'subtle', name: 'Subtle Spell', cost: 1, description: 'No verbal or somatic components' },
  { id: 'twinned', name: 'Twinned Spell', cost: 'level', description: 'Target two creatures' },
] as const;

/**
 * Get sorcery points for a given sorcerer level
 */
export function getSorceryPoints(sorcererLevel: number): number {
  if (sorcererLevel < 2) return 0;
  return Math.min(sorcererLevel, 20);
}
