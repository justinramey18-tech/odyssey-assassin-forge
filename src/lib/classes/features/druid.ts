// Druid Class Features
// D&D 5e Druid - Wisdom-based nature caster

import { ClassFeature, ScalingFeature } from './types';

/**
 * Wild Shape usage scaling
 */
export const WILD_SHAPE_SCALING: ScalingFeature = {
  id: 'druid-wild-shape-uses',
  classId: 'druid',
  name: 'Wild Shape Uses',
  level: 2,
  description: 'Number of times you can use Wild Shape before a short or long rest.',
  usageType: 'short_rest',
  isSubclassFeature: false,
  iconName: 'PawPrint',
  scaling: [
    { level: 2, value: '2' },
    { level: 20, value: 'Unlimited' },
  ],
};

export const DRUID_FEATURES: ClassFeature[] = [
  {
    id: 'druid-druidic',
    classId: 'druid',
    name: 'Druidic',
    level: 1,
    description: 'You know Druidic, the secret language of druids. You can speak it and use it to leave hidden messages.',
    isSubclassFeature: false,
    iconName: 'Languages',
  },
  {
    id: 'druid-spellcasting',
    classId: 'druid',
    name: 'Spellcasting',
    level: 1,
    description: 'You can cast druid spells using Wisdom as your spellcasting ability. You prepare spells from the entire druid spell list each day.',
    mechanicalEffect: 'WIS-based prepared spellcasting',
    isSubclassFeature: false,
    iconName: 'Leaf',
  },
  {
    id: 'druid-wild-shape',
    classId: 'druid',
    name: 'Wild Shape',
    level: 2,
    description: 'You can use your action to magically assume the shape of a beast you have seen before. Max CR and movement types improve with level.',
    mechanicalEffect: 'Transform into beasts',
    usageType: 'short_rest',
    uses: 2,
    isSubclassFeature: false,
    iconName: 'PawPrint',
  },
  WILD_SHAPE_SCALING,
  {
    id: 'druid-circle',
    classId: 'druid',
    name: 'Druid Circle',
    level: 2,
    description: 'Choose a druid circle: Circle of the Land, Moon, Dreams, Shepherd, Spores, Stars, or Wildfire.',
    mechanicalEffect: 'Subclass selection',
    isSubclassFeature: true,
    iconName: 'Sparkles',
  },
  {
    id: 'druid-wild-shape-improvement-1',
    classId: 'druid',
    name: 'Wild Shape Improvement',
    level: 4,
    description: 'You can transform into a beast with a CR as high as 1/2 (no flying speed). Swim speed becomes available.',
    mechanicalEffect: 'Max CR 1/2, swim speed allowed',
    isSubclassFeature: false,
    iconName: 'TrendingUp',
  },
  {
    id: 'druid-wild-shape-improvement-2',
    classId: 'druid',
    name: 'Wild Shape Improvement',
    level: 8,
    description: 'You can transform into a beast with a CR as high as 1. Flying speed becomes available.',
    mechanicalEffect: 'Max CR 1, fly speed allowed',
    isSubclassFeature: false,
    iconName: 'Bird',
  },
  {
    id: 'druid-timeless-body',
    classId: 'druid',
    name: 'Timeless Body',
    level: 18,
    description: 'The primal magic you wield causes you to age more slowly. For every 10 years that pass, your body ages only 1 year.',
    isSubclassFeature: false,
    iconName: 'Hourglass',
  },
  {
    id: 'druid-beast-spells',
    classId: 'druid',
    name: 'Beast Spells',
    level: 18,
    description: 'You can cast many of your druid spells while in Wild Shape form.',
    mechanicalEffect: 'Cast spells while transformed',
    isSubclassFeature: false,
    iconName: 'Wand2',
  },
  {
    id: 'druid-archdruid',
    classId: 'druid',
    name: 'Archdruid',
    level: 20,
    description: 'You can use your Wild Shape an unlimited number of times. Additionally, you can ignore verbal and somatic components of druid spells.',
    mechanicalEffect: 'Unlimited Wild Shape, ignore V/S components',
    isSubclassFeature: false,
    iconName: 'Crown',
  },
];

/**
 * Wild Shape CR limits by druid level
 */
export const WILD_SHAPE_CR_LIMITS: { level: number; maxCR: string; limitations: string }[] = [
  { level: 2, maxCR: '1/4', limitations: 'No flying or swimming speed' },
  { level: 4, maxCR: '1/2', limitations: 'No flying speed' },
  { level: 8, maxCR: '1', limitations: 'None' },
];

/**
 * Get Wild Shape max CR for a given druid level
 */
export function getWildShapeMaxCR(druidLevel: number): string {
  if (druidLevel < 2) return '0';
  if (druidLevel < 4) return '1/4';
  if (druidLevel < 8) return '1/2';
  return '1';
}
