// Druid Circle Subclasses
// Circle of the Moon: Enhanced Wild Shape for combat
// Circle of the Land: Bonus spells based on terrain type

export type DruidCircle = 'moon' | 'land';
export type LandType = 'arctic' | 'coast' | 'desert' | 'forest' | 'grassland' | 'mountain' | 'swamp' | 'underdark';

export interface DruidCircleConfig {
  id: DruidCircle;
  name: string;
  subtitle: string;
  iconName: string;
  description: string;
  features: CircleFeature[];
}

export interface CircleFeature {
  id: string;
  name: string;
  level: number;
  description: string;
}

export interface LandTypeConfig {
  id: LandType;
  name: string;
  iconName: string;
  bonusSpells: LandBonusSpell[];
}

export interface LandBonusSpell {
  spellId: string;
  spellName: string;
  level: number; // Druid level when gained
}

// ============================================
// CIRCLE OF THE MOON
// ============================================

export const CIRCLE_OF_THE_MOON: DruidCircleConfig = {
  id: 'moon',
  name: 'Circle of the Moon',
  subtitle: 'Combat Wild Shape',
  iconName: 'Moon',
  description: 'Druids who are members of the Circle of the Moon draw on the magic of the moon to transform into powerful beasts. Their Wild Shape is a potent combat tool.',
  features: [
    {
      id: 'combat-wild-shape',
      name: 'Combat Wild Shape',
      level: 2,
      description: 'You can use Wild Shape as a bonus action. Additionally, while in beast form, you can use a bonus action to expend a spell slot to regain 1d8 HP per slot level.',
    },
    {
      id: 'circle-forms',
      name: 'Circle Forms',
      level: 2,
      description: 'You can transform into beasts with a CR as high as 1 (no swimming/flying restriction at level 4, flying at level 8).',
    },
    {
      id: 'primal-strike',
      name: 'Primal Strike',
      level: 6,
      description: 'Your attacks in beast form count as magical for overcoming resistance and immunity to nonmagical attacks.',
    },
    {
      id: 'elemental-wild-shape',
      name: 'Elemental Wild Shape',
      level: 10,
      description: 'You can expend two uses of Wild Shape to transform into an air, earth, fire, or water elemental.',
    },
    {
      id: 'thousand-forms',
      name: 'Thousand Forms',
      level: 14,
      description: 'You can cast Alter Self at will.',
    },
  ],
};

// ============================================
// CIRCLE OF THE LAND
// ============================================

export const CIRCLE_OF_THE_LAND: DruidCircleConfig = {
  id: 'land',
  name: 'Circle of the Land',
  subtitle: 'Bonus Spells & Recovery',
  iconName: 'Trees',
  description: 'Druids of the Circle of the Land are mystics and sages who safeguard ancient knowledge and rites. They gain additional spells based on the land where they became a druid.',
  features: [
    {
      id: 'bonus-cantrip',
      name: 'Bonus Cantrip',
      level: 2,
      description: 'You learn one additional druid cantrip of your choice.',
    },
    {
      id: 'natural-recovery',
      name: 'Natural Recovery',
      level: 2,
      description: 'During a short rest, you can recover spell slots with a combined level equal to or less than half your druid level (rounded up). You can\'t recover slots of 6th level or higher. Once used, you must finish a long rest before using again.',
    },
    {
      id: 'circle-spells',
      name: 'Circle Spells',
      level: 2,
      description: 'Your mystical connection to the land infuses you with the ability to cast certain spells. These spells are always prepared and don\'t count against your prepared spell limit.',
    },
    {
      id: 'lands-stride',
      name: 'Land\'s Stride',
      level: 6,
      description: 'Moving through nonmagical difficult terrain costs no extra movement. You can pass through nonmagical plants without being slowed or taking damage. You have advantage on saves against plants that are magically created or manipulated.',
    },
    {
      id: 'natures-ward',
      name: 'Nature\'s Ward',
      level: 10,
      description: 'You can\'t be charmed or frightened by elementals or fey, and you are immune to poison and disease.',
    },
    {
      id: 'natures-sanctuary',
      name: 'Nature\'s Sanctuary',
      level: 14,
      description: 'Creatures of the natural world sense your connection. When a beast or plant attacks you, it must make a Wisdom save against your spell save DC or choose a different target.',
    },
  ],
};

// ============================================
// LAND TYPE BONUS SPELLS
// ============================================

export const LAND_TYPES: Record<LandType, LandTypeConfig> = {
  arctic: {
    id: 'arctic',
    name: 'Arctic',
    iconName: 'Snowflake',
    bonusSpells: [
      { spellId: 'hold-person', spellName: 'Hold Person', level: 3 },
      { spellId: 'spike-growth', spellName: 'Spike Growth', level: 3 },
      { spellId: 'druid-sleet-storm', spellName: 'Sleet Storm', level: 5 },
      { spellId: 'slow', spellName: 'Slow', level: 5 },
      { spellId: 'freedom-of-movement', spellName: 'Freedom of Movement', level: 7 },
      { spellId: 'druid-ice-storm', spellName: 'Ice Storm', level: 7 },
      { spellId: 'commune-with-nature', spellName: 'Commune with Nature', level: 9 },
      { spellId: 'cone-of-cold', spellName: 'Cone of Cold', level: 9 },
    ],
  },
  coast: {
    id: 'coast',
    name: 'Coast',
    iconName: 'Waves',
    bonusSpells: [
      { spellId: 'mirror-image', spellName: 'Mirror Image', level: 3 },
      { spellId: 'misty-step', spellName: 'Misty Step', level: 3 },
      { spellId: 'water-breathing', spellName: 'Water Breathing', level: 5 },
      { spellId: 'water-walk', spellName: 'Water Walk', level: 5 },
      { spellId: 'control-water', spellName: 'Control Water', level: 7 },
      { spellId: 'freedom-of-movement', spellName: 'Freedom of Movement', level: 7 },
      { spellId: 'conjure-elemental', spellName: 'Conjure Elemental', level: 9 },
      { spellId: 'scrying', spellName: 'Scrying', level: 9 },
    ],
  },
  desert: {
    id: 'desert',
    name: 'Desert',
    iconName: 'Sun',
    bonusSpells: [
      { spellId: 'blur', spellName: 'Blur', level: 3 },
      { spellId: 'silence', spellName: 'Silence', level: 3 },
      { spellId: 'create-food-and-water', spellName: 'Create Food and Water', level: 5 },
      { spellId: 'protection-from-energy', spellName: 'Protection from Energy', level: 5 },
      { spellId: 'druid-blight', spellName: 'Blight', level: 7 },
      { spellId: 'hallucinatory-terrain', spellName: 'Hallucinatory Terrain', level: 7 },
      { spellId: 'druid-insect-plague', spellName: 'Insect Plague', level: 9 },
      { spellId: 'druid-wall-of-stone', spellName: 'Wall of Stone', level: 9 },
    ],
  },
  forest: {
    id: 'forest',
    name: 'Forest',
    iconName: 'TreeDeciduous',
    bonusSpells: [
      { spellId: 'barkskin', spellName: 'Barkskin', level: 3 },
      { spellId: 'spider-climb', spellName: 'Spider Climb', level: 3 },
      { spellId: 'call-lightning', spellName: 'Call Lightning', level: 5 },
      { spellId: 'plant-growth', spellName: 'Plant Growth', level: 5 },
      { spellId: 'divination', spellName: 'Divination', level: 7 },
      { spellId: 'freedom-of-movement', spellName: 'Freedom of Movement', level: 7 },
      { spellId: 'commune-with-nature', spellName: 'Commune with Nature', level: 9 },
      { spellId: 'tree-stride', spellName: 'Tree Stride', level: 9 },
    ],
  },
  grassland: {
    id: 'grassland',
    name: 'Grassland',
    iconName: 'Wheat',
    bonusSpells: [
      { spellId: 'invisibility', spellName: 'Invisibility', level: 3 },
      { spellId: 'pass-without-trace', spellName: 'Pass Without Trace', level: 3 },
      { spellId: 'daylight', spellName: 'Daylight', level: 5 },
      { spellId: 'haste', spellName: 'Haste', level: 5 },
      { spellId: 'divination', spellName: 'Divination', level: 7 },
      { spellId: 'freedom-of-movement', spellName: 'Freedom of Movement', level: 7 },
      { spellId: 'dream', spellName: 'Dream', level: 9 },
      { spellId: 'druid-insect-plague', spellName: 'Insect Plague', level: 9 },
    ],
  },
  mountain: {
    id: 'mountain',
    name: 'Mountain',
    iconName: 'Mountain',
    bonusSpells: [
      { spellId: 'spider-climb', spellName: 'Spider Climb', level: 3 },
      { spellId: 'spike-growth', spellName: 'Spike Growth', level: 3 },
      { spellId: 'lightning-bolt', spellName: 'Lightning Bolt', level: 5 },
      { spellId: 'meld-into-stone', spellName: 'Meld into Stone', level: 5 },
      { spellId: 'stone-shape', spellName: 'Stone Shape', level: 7 },
      { spellId: 'stoneskin', spellName: 'Stoneskin', level: 7 },
      { spellId: 'passwall', spellName: 'Passwall', level: 9 },
      { spellId: 'druid-wall-of-stone', spellName: 'Wall of Stone', level: 9 },
    ],
  },
  swamp: {
    id: 'swamp',
    name: 'Swamp',
    iconName: 'Droplets',
    bonusSpells: [
      { spellId: 'darkness', spellName: 'Darkness', level: 3 },
      { spellId: 'melfs-acid-arrow', spellName: 'Melf\'s Acid Arrow', level: 3 },
      { spellId: 'water-walk', spellName: 'Water Walk', level: 5 },
      { spellId: 'stinking-cloud', spellName: 'Stinking Cloud', level: 5 },
      { spellId: 'freedom-of-movement', spellName: 'Freedom of Movement', level: 7 },
      { spellId: 'locate-creature', spellName: 'Locate Creature', level: 7 },
      { spellId: 'druid-insect-plague', spellName: 'Insect Plague', level: 9 },
      { spellId: 'scrying', spellName: 'Scrying', level: 9 },
    ],
  },
  underdark: {
    id: 'underdark',
    name: 'Underdark',
    iconName: 'Eclipse',
    bonusSpells: [
      { spellId: 'spider-climb', spellName: 'Spider Climb', level: 3 },
      { spellId: 'web', spellName: 'Web', level: 3 },
      { spellId: 'gaseous-form', spellName: 'Gaseous Form', level: 5 },
      { spellId: 'stinking-cloud', spellName: 'Stinking Cloud', level: 5 },
      { spellId: 'greater-invisibility', spellName: 'Greater Invisibility', level: 7 },
      { spellId: 'stone-shape', spellName: 'Stone Shape', level: 7 },
      { spellId: 'cloudkill', spellName: 'Cloudkill', level: 9 },
      { spellId: 'druid-insect-plague', spellName: 'Insect Plague', level: 9 },
    ],
  },
};

// ============================================
// CIRCLE OF THE MOON WILD SHAPE ENHANCEMENTS
// ============================================

export interface MoonCircleWildShapeConfig {
  maxCR: number;
  canSwim: boolean;
  canFly: boolean;
  canElemental: boolean;
}

/**
 * Circle of the Moon Wild Shape progression
 * Much higher CR limits than base druid
 */
export const MOON_CIRCLE_WILD_SHAPE: Record<number, MoonCircleWildShapeConfig> = {
  2:  { maxCR: 1, canSwim: false, canFly: false, canElemental: false },
  3:  { maxCR: 1, canSwim: false, canFly: false, canElemental: false },
  4:  { maxCR: 1, canSwim: true, canFly: false, canElemental: false },
  5:  { maxCR: 1, canSwim: true, canFly: false, canElemental: false },
  6:  { maxCR: 2, canSwim: true, canFly: false, canElemental: false },
  7:  { maxCR: 2, canSwim: true, canFly: false, canElemental: false },
  8:  { maxCR: 2, canSwim: true, canFly: true, canElemental: false },
  9:  { maxCR: 3, canSwim: true, canFly: true, canElemental: false },
  10: { maxCR: 3, canSwim: true, canFly: true, canElemental: true },
  11: { maxCR: 3, canSwim: true, canFly: true, canElemental: true },
  12: { maxCR: 4, canSwim: true, canFly: true, canElemental: true },
  13: { maxCR: 4, canSwim: true, canFly: true, canElemental: true },
  14: { maxCR: 4, canSwim: true, canFly: true, canElemental: true },
  15: { maxCR: 5, canSwim: true, canFly: true, canElemental: true },
  16: { maxCR: 5, canSwim: true, canFly: true, canElemental: true },
  17: { maxCR: 5, canSwim: true, canFly: true, canElemental: true },
  18: { maxCR: 6, canSwim: true, canFly: true, canElemental: true },
  19: { maxCR: 6, canSwim: true, canFly: true, canElemental: true },
  20: { maxCR: 6, canSwim: true, canFly: true, canElemental: true },
};

/**
 * Get Moon Circle Wild Shape config for a druid level
 */
export function getMoonCircleWildShape(druidLevel: number): MoonCircleWildShapeConfig | null {
  if (druidLevel < 2) return null;
  const clampedLevel = Math.min(druidLevel, 20);
  return MOON_CIRCLE_WILD_SHAPE[clampedLevel] ?? null;
}

// ============================================
// ADDITIONAL BEAST FORMS (HIGH CR FOR MOON)
// ============================================

import { BeastForm } from '@/lib/magic/wildShape';

export const MOON_CIRCLE_BEAST_FORMS: BeastForm[] = [
  // CR 2
  {
    id: 'polar-bear',
    name: 'Polar Bear',
    cr: 2,
    hp: 42,
    ac: 12,
    speed: '40 ft., swim 30 ft.',
    swimSpeed: 30,
    iconName: 'Snowflake',
    description: 'A massive arctic predator with keen smell and multiattack.',
    specialAbilities: ['Keen Smell', 'Multiattack (Bite + Claw)'],
  },
  {
    id: 'giant-elk',
    name: 'Giant Elk',
    cr: 2,
    hp: 42,
    ac: 14,
    speed: '60 ft.',
    iconName: 'Rabbit',
    description: 'A majestic beast with a charging attack.',
    specialAbilities: ['Charge (ram + knockdown)'],
  },
  {
    id: 'giant-constrictor-snake',
    name: 'Giant Constrictor Snake',
    cr: 2,
    hp: 60,
    ac: 12,
    speed: '30 ft., swim 30 ft.',
    swimSpeed: 30,
    iconName: 'Snail',
    description: 'A massive serpent that grapples and constricts.',
    specialAbilities: ['Constrict (grapple + 2d8 damage)'],
  },
  // CR 3
  {
    id: 'giant-scorpion',
    name: 'Giant Scorpion',
    cr: 3,
    hp: 52,
    ac: 15,
    speed: '40 ft.',
    iconName: 'Bug',
    description: 'A huge arachnid with claws and a poison stinger.',
    specialAbilities: ['Multiattack (2 Claws + Sting)', 'Poison Sting (DC 12, 4d10)'],
  },
  {
    id: 'killer-whale',
    name: 'Killer Whale',
    cr: 3,
    hp: 90,
    ac: 12,
    speed: '0 ft., swim 60 ft.',
    swimSpeed: 60,
    iconName: 'Fish',
    description: 'An apex ocean predator with echolocation.',
    specialAbilities: ['Echolocation', 'Hold Breath 30 min', 'Keen Hearing'],
  },
  // CR 4
  {
    id: 'elephant',
    name: 'Elephant',
    cr: 4,
    hp: 76,
    ac: 12,
    speed: '40 ft.',
    iconName: 'Squirrel',
    description: 'A massive pachyderm with trampling charge.',
    specialAbilities: ['Trampling Charge (knockdown + stomp)'],
  },
  // CR 5
  {
    id: 'giant-crocodile',
    name: 'Giant Crocodile',
    cr: 5,
    hp: 85,
    ac: 14,
    speed: '30 ft., swim 50 ft.',
    swimSpeed: 50,
    iconName: 'Fish',
    description: 'An enormous reptilian predator with a crushing bite.',
    specialAbilities: ['Hold Breath 30 min', 'Multiattack', 'Bite (grapple + restrain)'],
  },
  // CR 6
  {
    id: 'mammoth',
    name: 'Mammoth',
    cr: 6,
    hp: 126,
    ac: 13,
    speed: '40 ft.',
    iconName: 'Squirrel',
    description: 'A prehistoric beast of tremendous size and power.',
    specialAbilities: ['Trampling Charge (knockdown + gore)', 'Gore + Stomp'],
  },
];

// ============================================
// ELEMENTAL FORMS (MOON CIRCLE LEVEL 10+)
// ============================================

export interface ElementalForm {
  id: string;
  name: string;
  element: 'air' | 'earth' | 'fire' | 'water';
  cr: 5;
  hp: number;
  ac: number;
  speed: string;
  iconName: string;
  description: string;
  immunities: string[];
  resistances: string[];
  specialAbilities: string[];
}

export const ELEMENTAL_FORMS: ElementalForm[] = [
  {
    id: 'air-elemental',
    name: 'Air Elemental',
    element: 'air',
    cr: 5,
    hp: 90,
    ac: 15,
    speed: 'fly 90 ft. (hover)',
    iconName: 'Wind',
    description: 'A swirling vortex of wind and air.',
    immunities: ['Poison', 'Exhaustion', 'Grappled', 'Paralyzed', 'Petrified', 'Poisoned', 'Prone', 'Restrained', 'Unconscious'],
    resistances: ['Lightning', 'Thunder', 'Bludgeoning/Piercing/Slashing (nonmagical)'],
    specialAbilities: ['Air Form (move through 1-inch spaces)', 'Whirlwind (DC 13, capture + bludgeoning)'],
  },
  {
    id: 'earth-elemental',
    name: 'Earth Elemental',
    element: 'earth',
    cr: 5,
    hp: 126,
    ac: 17,
    speed: '30 ft., burrow 30 ft.',
    iconName: 'Mountain',
    description: 'A hulking mass of stone and earth.',
    immunities: ['Poison', 'Exhaustion', 'Paralyzed', 'Petrified', 'Poisoned', 'Unconscious'],
    resistances: ['Bludgeoning/Piercing/Slashing (nonmagical)'],
    specialAbilities: ['Earth Glide (burrow through earth/stone)', 'Siege Monster (2x damage to structures)'],
  },
  {
    id: 'fire-elemental',
    name: 'Fire Elemental',
    element: 'fire',
    cr: 5,
    hp: 102,
    ac: 13,
    speed: '50 ft.',
    iconName: 'Flame',
    description: 'A roaring pillar of living flame.',
    immunities: ['Fire', 'Poison', 'Exhaustion', 'Grappled', 'Paralyzed', 'Petrified', 'Poisoned', 'Prone', 'Restrained', 'Unconscious'],
    resistances: ['Bludgeoning/Piercing/Slashing (nonmagical)'],
    specialAbilities: ['Fire Form (ignite flammables, move through 1-inch spaces)', 'Illumination (30 ft. bright)', 'Water Susceptibility (1 cold per gallon)'],
  },
  {
    id: 'water-elemental',
    name: 'Water Elemental',
    element: 'water',
    cr: 5,
    hp: 114,
    ac: 14,
    speed: '30 ft., swim 90 ft.',
    iconName: 'Waves',
    description: 'A churning wave of sentient water.',
    immunities: ['Poison', 'Exhaustion', 'Grappled', 'Paralyzed', 'Petrified', 'Poisoned', 'Prone', 'Restrained', 'Unconscious'],
    resistances: ['Acid', 'Bludgeoning/Piercing/Slashing (nonmagical)'],
    specialAbilities: ['Water Form (move through 1-inch spaces)', 'Whelm (DC 15, grapple + suffocate)', 'Freeze (vulnerable to cold, speed 0)'],
  },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

export const ALL_CIRCLES: DruidCircleConfig[] = [CIRCLE_OF_THE_MOON, CIRCLE_OF_THE_LAND];

export function getCircleById(id: DruidCircle): DruidCircleConfig | undefined {
  return ALL_CIRCLES.find(c => c.id === id);
}

export function getLandTypeById(id: LandType): LandTypeConfig | undefined {
  return LAND_TYPES[id];
}

export function getCircleBonusSpells(circle: DruidCircle, landType: LandType | null, druidLevel: number): LandBonusSpell[] {
  if (circle !== 'land' || !landType) return [];
  
  const land = LAND_TYPES[landType];
  if (!land) return [];
  
  return land.bonusSpells.filter(spell => druidLevel >= spell.level);
}

export function getCircleFeaturesForLevel(circle: DruidCircle, druidLevel: number): CircleFeature[] {
  const config = getCircleById(circle);
  if (!config) return [];
  
  return config.features.filter(f => druidLevel >= f.level);
}
