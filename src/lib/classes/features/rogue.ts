// Rogue Class Features
// D&D 5e Rogue (Odyssey Assassin base class)

import { ClassFeature, ScalingFeature } from './types';

/**
 * Sneak Attack damage scaling by rogue level
 */
export const SNEAK_ATTACK_SCALING: ScalingFeature = {
  id: 'rogue-sneak-attack',
  classId: 'rogue',
  name: 'Sneak Attack',
  level: 1,
  description: 'Once per turn, deal extra damage to a creature you hit with a finesse or ranged weapon attack if you have advantage or an ally is within 5 feet of the target.',
  mechanicalEffect: 'Extra damage on qualifying attacks',
  usageType: 'at_will',
  isSubclassFeature: false,
  iconName: 'Crosshair',
  scaling: [
    { level: 1, value: '1d6' },
    { level: 3, value: '2d6' },
    { level: 5, value: '3d6' },
    { level: 7, value: '4d6' },
    { level: 9, value: '5d6' },
    { level: 11, value: '6d6' },
    { level: 13, value: '7d6' },
    { level: 15, value: '8d6' },
    { level: 17, value: '9d6' },
    { level: 19, value: '10d6' },
  ],
};

export const ROGUE_FEATURES: ClassFeature[] = [
  {
    id: 'rogue-expertise-1',
    classId: 'rogue',
    name: 'Expertise',
    level: 1,
    description: 'Choose two proficiencies (skills or thieves\' tools). Your proficiency bonus is doubled for any ability check using those proficiencies.',
    mechanicalEffect: 'Double proficiency bonus on 2 skills',
    isSubclassFeature: false,
    iconName: 'GraduationCap',
  },
  {
    id: 'rogue-thieves-cant',
    classId: 'rogue',
    name: "Thieves' Cant",
    level: 1,
    description: 'You know a secret mix of dialect, jargon, and code that allows you to hide messages in seemingly normal conversation.',
    isSubclassFeature: false,
    iconName: 'MessageSquare',
  },
  SNEAK_ATTACK_SCALING,
  {
    id: 'rogue-cunning-action',
    classId: 'rogue',
    name: 'Cunning Action',
    level: 2,
    description: 'You can take a bonus action to Dash, Disengage, or Hide.',
    mechanicalEffect: 'Bonus action: Dash, Disengage, or Hide',
    usageType: 'at_will',
    isSubclassFeature: false,
    iconName: 'Zap',
  },
  {
    id: 'rogue-subclass',
    classId: 'rogue',
    name: 'Roguish Archetype',
    level: 3,
    description: 'Choose an archetype that you emulate. Your archetype grants you features at 3rd level and again at 9th, 13th, and 17th level.',
    mechanicalEffect: 'Subclass selection (see MagicPath)',
    isSubclassFeature: true,
    iconName: 'Sparkles',
  },
  {
    id: 'rogue-uncanny-dodge',
    classId: 'rogue',
    name: 'Uncanny Dodge',
    level: 5,
    description: 'When an attacker you can see hits you with an attack, you can use your reaction to halve the attack\'s damage.',
    mechanicalEffect: 'Reaction: Halve damage from one attack',
    usageType: 'at_will',
    isSubclassFeature: false,
    iconName: 'Shield',
  },
  {
    id: 'rogue-evasion',
    classId: 'rogue',
    name: 'Evasion',
    level: 7,
    description: 'When subjected to an effect that allows a DEX save for half damage, you take no damage on success and half on failure.',
    mechanicalEffect: 'DEX saves: success = 0 damage, fail = half',
    isSubclassFeature: false,
    iconName: 'Wind',
  },
  {
    id: 'rogue-reliable-talent',
    classId: 'rogue',
    name: 'Reliable Talent',
    level: 11,
    description: 'When you make an ability check with a skill you\'re proficient in, treat any d20 roll of 9 or lower as a 10.',
    mechanicalEffect: 'Minimum 10 on proficient skill checks',
    isSubclassFeature: false,
    iconName: 'Target',
  },
  {
    id: 'rogue-blindsense',
    classId: 'rogue',
    name: 'Blindsense',
    level: 14,
    description: 'If you can hear, you\'re aware of the location of any hidden or invisible creature within 10 feet.',
    mechanicalEffect: 'Detect hidden creatures within 10 ft',
    isSubclassFeature: false,
    iconName: 'Eye',
  },
  {
    id: 'rogue-slippery-mind',
    classId: 'rogue',
    name: 'Slippery Mind',
    level: 15,
    description: 'You gain proficiency in Wisdom saving throws.',
    mechanicalEffect: 'WIS save proficiency',
    isSubclassFeature: false,
    iconName: 'Brain',
  },
  {
    id: 'rogue-elusive',
    classId: 'rogue',
    name: 'Elusive',
    level: 18,
    description: 'No attack roll has advantage against you while you aren\'t incapacitated.',
    mechanicalEffect: 'Attackers cannot have advantage',
    isSubclassFeature: false,
    iconName: 'Ghost',
  },
  {
    id: 'rogue-stroke-of-luck',
    classId: 'rogue',
    name: 'Stroke of Luck',
    level: 20,
    description: 'If your attack misses, you can turn it into a hit. Or turn a failed ability check into a natural 20.',
    mechanicalEffect: 'Turn miss into hit or failed check into 20',
    usageType: 'short_rest',
    uses: 1,
    isSubclassFeature: false,
    iconName: 'Clover',
  },
];

/**
 * Get sneak attack dice for a given rogue level
 */
export function getSneakAttackDice(rogueLevel: number): string {
  const scaling = SNEAK_ATTACK_SCALING.scaling;
  for (let i = scaling.length - 1; i >= 0; i--) {
    if (rogueLevel >= scaling[i].level) {
      return scaling[i].value;
    }
  }
  return '0';
}
