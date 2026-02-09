// Wild Shape - Druid Class Feature
// Transform into beasts with separate HP pool and CR/movement restrictions by level

export interface WildShapeConfig {
  maxUses: number;
  maxCR: number;
  canSwim: boolean;
  canFly: boolean;
  maxHours: number;
}

export interface BeastForm {
  id: string;
  name: string;
  cr: number;
  hp: number;
  ac: number;
  speed: string;
  swimSpeed?: number;
  flySpeed?: number;
  iconName: string;
  description: string;
  specialAbilities?: string[];
}

export interface WildShapeState {
  usesRemaining: number;
  maxUses: number;
  isTransformed: boolean;
  currentForm: BeastForm | null;
  formHP: number;
  formMaxHP: number;
  transformedAt?: number;
  transformDurationMinutes?: number;
}

/**
 * Wild Shape progression by Druid level
 * Level 2: CR 1/4, no swimming/flying
 * Level 4: CR 1/2, swimming
 * Level 8: CR 1, flying
 * Higher levels continue at CR 1 (Circle of the Moon increases this)
 */
export const WILD_SHAPE_BY_LEVEL: Record<number, WildShapeConfig> = {
  1:  { maxUses: 0, maxCR: 0, canSwim: false, canFly: false, maxHours: 0 },
  2:  { maxUses: 2, maxCR: 0.25, canSwim: false, canFly: false, maxHours: 1 },
  3:  { maxUses: 2, maxCR: 0.25, canSwim: false, canFly: false, maxHours: 1 },
  4:  { maxUses: 2, maxCR: 0.5, canSwim: true, canFly: false, maxHours: 2 },
  5:  { maxUses: 2, maxCR: 0.5, canSwim: true, canFly: false, maxHours: 2 },
  6:  { maxUses: 2, maxCR: 0.5, canSwim: true, canFly: false, maxHours: 3 },
  7:  { maxUses: 2, maxCR: 0.5, canSwim: true, canFly: false, maxHours: 3 },
  8:  { maxUses: 2, maxCR: 1, canSwim: true, canFly: true, maxHours: 4 },
  9:  { maxUses: 2, maxCR: 1, canSwim: true, canFly: true, maxHours: 4 },
  10: { maxUses: 2, maxCR: 1, canSwim: true, canFly: true, maxHours: 5 },
  11: { maxUses: 2, maxCR: 1, canSwim: true, canFly: true, maxHours: 5 },
  12: { maxUses: 2, maxCR: 1, canSwim: true, canFly: true, maxHours: 6 },
  13: { maxUses: 2, maxCR: 1, canSwim: true, canFly: true, maxHours: 6 },
  14: { maxUses: 2, maxCR: 1, canSwim: true, canFly: true, maxHours: 7 },
  15: { maxUses: 2, maxCR: 1, canSwim: true, canFly: true, maxHours: 7 },
  16: { maxUses: 2, maxCR: 1, canSwim: true, canFly: true, maxHours: 8 },
  17: { maxUses: 2, maxCR: 1, canSwim: true, canFly: true, maxHours: 8 },
  18: { maxUses: 2, maxCR: 1, canSwim: true, canFly: true, maxHours: 9 },
  19: { maxUses: 2, maxCR: 1, canSwim: true, canFly: true, maxHours: 9 },
  20: { maxUses: 2, maxCR: 1, canSwim: true, canFly: true, maxHours: 10 },
};

/**
 * Get Wild Shape configuration for a druid level
 */
export function getWildShapeForLevel(druidLevel: number): WildShapeConfig | null {
  if (druidLevel < 2) return null;
  const clampedLevel = Math.min(druidLevel, 20);
  return WILD_SHAPE_BY_LEVEL[clampedLevel] ?? null;
}

/**
 * Get maximum Wild Shape duration in hours
 */
export function getWildShapeDuration(druidLevel: number): number {
  return Math.floor(druidLevel / 2);
}

/**
 * Format CR for display
 */
export function formatCR(cr: number): string {
  if (cr === 0.125) return '1/8';
  if (cr === 0.25) return '1/4';
  if (cr === 0.5) return '1/2';
  return cr.toString();
}

/**
 * Common beast forms for Wild Shape
 * Organized by CR for easy filtering
 */
export const BEAST_FORMS: BeastForm[] = [
  // CR 0
  {
    id: 'cat',
    name: 'Cat',
    cr: 0,
    hp: 2,
    ac: 12,
    speed: '40 ft., climb 30 ft.',
    iconName: 'Cat',
    description: 'A tiny feline with keen senses and climbing ability.',
    specialAbilities: ['Keen Smell', 'Claws'],
  },
  {
    id: 'rat',
    name: 'Rat',
    cr: 0,
    hp: 1,
    ac: 10,
    speed: '20 ft.',
    iconName: 'Rat',
    description: 'A tiny rodent useful for scouting tight spaces.',
    specialAbilities: ['Keen Smell', 'Darkvision 30 ft.'],
  },
  {
    id: 'spider',
    name: 'Spider',
    cr: 0,
    hp: 1,
    ac: 12,
    speed: '20 ft., climb 20 ft.',
    iconName: 'Bug',
    description: 'A tiny arachnid with web sense and climbing.',
    specialAbilities: ['Spider Climb', 'Web Sense'],
  },
  // CR 0 - Screaming Goat
  {
    id: 'screaming-goat',
    name: 'Screaming Goat',
    cr: 0,
    hp: 4,
    ac: 10,
    speed: '40 ft.',
    iconName: 'Rabbit',
    description: 'A small but terrifyingly loud goat.',
    specialAbilities: ['Terrifying Scream (DC 10, frightened 1 round)', 'Sure-Footed (advantage vs. knockdown)', 'Charge (ram + knockdown)'],
  },
  // CR 1/8
  {
    id: 'poisonous-snake',
    name: 'Poisonous Snake',
    cr: 0.125,
    hp: 2,
    ac: 13,
    speed: '30 ft., swim 30 ft.',
    swimSpeed: 30,
    iconName: 'Snail',
    description: 'A small venomous serpent.',
    specialAbilities: ['Poison Bite (DC 10, 2d4 poison)'],
  },
  // CR 1/4
  {
    id: 'wolf',
    name: 'Wolf',
    cr: 0.25,
    hp: 11,
    ac: 13,
    speed: '40 ft.',
    iconName: 'Dog',
    description: 'A medium canine with pack tactics.',
    specialAbilities: ['Keen Hearing and Smell', 'Pack Tactics'],
  },
  {
    id: 'giant-badger',
    name: 'Giant Badger',
    cr: 0.25,
    hp: 13,
    ac: 10,
    speed: '30 ft., burrow 10 ft.',
    iconName: 'Squirrel',
    description: 'A burrowing beast with multiattack.',
    specialAbilities: ['Keen Smell', 'Multiattack'],
  },
  {
    id: 'giant-frog',
    name: 'Giant Frog',
    cr: 0.25,
    hp: 18,
    ac: 11,
    speed: '30 ft., swim 30 ft.',
    swimSpeed: 30,
    iconName: 'Rabbit',
    description: 'An amphibian that can swallow small creatures.',
    specialAbilities: ['Amphibious', 'Standing Leap', 'Swallow'],
  },
  // CR 1/2
  {
    id: 'black-bear',
    name: 'Black Bear',
    cr: 0.5,
    hp: 19,
    ac: 11,
    speed: '40 ft., climb 30 ft.',
    iconName: 'Squirrel',
    description: 'A sturdy bear with keen smell and multiattack.',
    specialAbilities: ['Keen Smell', 'Multiattack'],
  },
  {
    id: 'giant-wasp',
    name: 'Giant Wasp',
    cr: 0.5,
    hp: 13,
    ac: 12,
    speed: '10 ft., fly 50 ft.',
    flySpeed: 50,
    iconName: 'Bug',
    description: 'A flying insect with a poison stinger.',
    specialAbilities: ['Sting (DC 11, 3d6 poison + poisoned)'],
  },
  {
    id: 'reef-shark',
    name: 'Reef Shark',
    cr: 0.5,
    hp: 22,
    ac: 12,
    speed: '0 ft., swim 40 ft.',
    swimSpeed: 40,
    iconName: 'Fish',
    description: 'An aquatic predator with pack tactics.',
    specialAbilities: ['Pack Tactics', 'Water Breathing'],
  },
  {
    id: 'warhorse',
    name: 'Warhorse',
    cr: 0.5,
    hp: 19,
    ac: 11,
    speed: '60 ft.',
    iconName: 'Rabbit',
    description: 'A trained mount with trampling charge.',
    specialAbilities: ['Trampling Charge'],
  },
  // CR 1
  {
    id: 'brown-bear',
    name: 'Brown Bear',
    cr: 1,
    hp: 34,
    ac: 11,
    speed: '40 ft., climb 30 ft.',
    iconName: 'Squirrel',
    description: 'A large powerful bear. Classic Wild Shape form.',
    specialAbilities: ['Keen Smell', 'Multiattack (Bite + Claw)'],
  },
  {
    id: 'dire-wolf',
    name: 'Dire Wolf',
    cr: 1,
    hp: 37,
    ac: 14,
    speed: '50 ft.',
    iconName: 'Dog',
    description: 'A massive wolf with pack tactics and knockdown.',
    specialAbilities: ['Keen Hearing and Smell', 'Pack Tactics', 'Bite (knockdown)'],
  },
  {
    id: 'giant-spider',
    name: 'Giant Spider',
    cr: 1,
    hp: 26,
    ac: 14,
    speed: '30 ft., climb 30 ft.',
    iconName: 'Bug',
    description: 'A large arachnid with webs and poison.',
    specialAbilities: ['Spider Climb', 'Web Sense', 'Web (restrain)', 'Poison Bite'],
  },
  {
    id: 'giant-eagle',
    name: 'Giant Eagle',
    cr: 1,
    hp: 26,
    ac: 13,
    speed: '10 ft., fly 80 ft.',
    flySpeed: 80,
    iconName: 'Bird',
    description: 'A majestic flying predator with keen sight.',
    specialAbilities: ['Keen Sight', 'Multiattack'],
  },
  // CR 1 - Utah Raptor
  {
    id: 'utah-raptor',
    name: 'Utah Raptor',
    cr: 1,
    hp: 32,
    ac: 14,
    speed: '60 ft.',
    iconName: 'Rabbit',
    description: 'A swift and deadly pack predator with razor claws.',
    specialAbilities: ['Pounce (knockdown + bonus bite)', 'Pack Tactics', 'Keen Smell', 'Disemboweling Claw (2d8 slashing)'],
  },
  {
    id: 'giant-octopus',
    name: 'Giant Octopus',
    cr: 1,
    hp: 52,
    ac: 11,
    speed: '10 ft., swim 60 ft.',
    swimSpeed: 60,
    iconName: 'Fish',
    description: 'A large cephalopod with ink and grappling tentacles.',
    specialAbilities: ['Hold Breath 1 hour', 'Underwater Camouflage', 'Ink Cloud', 'Tentacles (grapple)'],
  },
];

/**
 * Get available beast forms for a druid level
 */
export function getAvailableBeastForms(druidLevel: number): BeastForm[] {
  const config = getWildShapeForLevel(druidLevel);
  if (!config) return [];

  return BEAST_FORMS.filter(beast => {
    // CR restriction
    if (beast.cr > config.maxCR) return false;
    // Swimming restriction
    if (beast.swimSpeed && !config.canSwim) return false;
    // Flying restriction
    if (beast.flySpeed && !config.canFly) return false;
    return true;
  });
}

/**
 * Get default Wild Shape state
 */
export function getDefaultWildShapeState(druidLevel: number): WildShapeState {
  const config = getWildShapeForLevel(druidLevel);
  return {
    usesRemaining: config?.maxUses ?? 0,
    maxUses: config?.maxUses ?? 0,
    isTransformed: false,
    currentForm: null,
    formHP: 0,
    formMaxHP: 0,
  };
}

/**
 * Wild Shape regenerates on SHORT rest (like Channel Divinity)
 */
export function wildShapeRegeneratesOnShortRest(): boolean {
  return true;
}

export function wildShapeRegeneratesOnLongRest(): boolean {
  return true;
}
