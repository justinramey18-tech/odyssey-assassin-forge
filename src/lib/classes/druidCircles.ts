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
  canDragon: boolean;
}

/**
 * Circle of the Moon Wild Shape progression
 * Much higher CR limits than base druid
 */
export const MOON_CIRCLE_WILD_SHAPE: Record<number, MoonCircleWildShapeConfig> = {
  2:  { maxCR: 1, canSwim: false, canFly: false, canElemental: false, canDragon: false },
  3:  { maxCR: 1, canSwim: false, canFly: false, canElemental: false, canDragon: false },
  4:  { maxCR: 1, canSwim: true, canFly: false, canElemental: false, canDragon: false },
  5:  { maxCR: 1, canSwim: true, canFly: false, canElemental: false, canDragon: false },
  6:  { maxCR: 2, canSwim: true, canFly: false, canElemental: false, canDragon: false },
  7:  { maxCR: 2, canSwim: true, canFly: false, canElemental: false, canDragon: false },
  8:  { maxCR: 2, canSwim: true, canFly: true, canElemental: false, canDragon: false },
  9:  { maxCR: 3, canSwim: true, canFly: true, canElemental: false, canDragon: false },
  10: { maxCR: 3, canSwim: true, canFly: true, canElemental: true, canDragon: false },
  11: { maxCR: 3, canSwim: true, canFly: true, canElemental: true, canDragon: false },
  12: { maxCR: 4, canSwim: true, canFly: true, canElemental: true, canDragon: false },
  13: { maxCR: 4, canSwim: true, canFly: true, canElemental: true, canDragon: false },
  14: { maxCR: 4, canSwim: true, canFly: true, canElemental: true, canDragon: false },
  15: { maxCR: 5, canSwim: true, canFly: true, canElemental: true, canDragon: false },
  16: { maxCR: 5, canSwim: true, canFly: true, canElemental: true, canDragon: false },
  17: { maxCR: 5, canSwim: true, canFly: true, canElemental: true, canDragon: false },
  18: { maxCR: 6, canSwim: true, canFly: true, canElemental: true, canDragon: true },
  19: { maxCR: 6, canSwim: true, canFly: true, canElemental: true, canDragon: true },
  20: { maxCR: 6, canSwim: true, canFly: true, canElemental: true, canDragon: true },
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
  // New Moon Circle forms
  {
    id: 'owlbear',
    name: 'Owlbear',
    cr: 3,
    hp: 59,
    ac: 13,
    speed: '40 ft.',
    iconName: 'Bird',
    description: 'A fearsome hybrid predator with the body of a bear and the head of an owl.',
    specialAbilities: ['Keen Sight and Smell', 'Multiattack (Beak + Claws)', 'Bear Hug (grapple on claw hit, DC 14)'],
  },
  {
    id: 'chupacabra',
    name: 'Chupacabra',
    cr: 3,
    hp: 45,
    ac: 14,
    speed: '40 ft., climb 30 ft.',
    iconName: 'Skull',
    description: 'A blood-drinking nocturnal predator of legend.',
    specialAbilities: ['Blood Drain (regain HP equal to damage)', 'Stealthy Predator (advantage on Stealth at night)', 'Darkvision 120 ft.', 'Spider Climb'],
  },
  {
    id: 'giant-otter',
    name: 'Giant Otter',
    cr: 3,
    hp: 52,
    ac: 13,
    speed: '40 ft., swim 60 ft.',
    swimSpeed: 60,
    iconName: 'Fish',
    description: 'A massive river predator with powerful jaws and playful agility.',
    specialAbilities: ['Hold Breath 30 min', 'Powerful Jaws (2d10 bite + grapple)', 'Playful Dodge (Disengage as bonus action)', 'Keen Smell'],
  },
  {
    id: 'mothman',
    name: 'Mothman',
    cr: 4,
    hp: 65,
    ac: 15,
    speed: '30 ft., fly 60 ft.',
    flySpeed: 60,
    iconName: 'Bug',
    description: 'A cryptid harbinger with hypnotic eyes and prophetic shrieks.',
    specialAbilities: ['Hypnotic Gaze (DC 14, charmed)', 'Prophetic Shriek (DC 14, frightened + prone)', 'Darkvision 120 ft.', 'Flyby'],
  },
  {
    id: 'skinwalker',
    name: 'Skinwalker',
    cr: 4,
    hp: 71,
    ac: 14,
    speed: '40 ft.',
    iconName: 'Skull',
    description: 'A shapeshifting predator that mimics humanoid forms.',
    specialAbilities: ['Shapechanger (mimic any Medium humanoid)', 'Terrifying Howl (DC 14, frightened 30 ft.)', 'Multiattack (Bite + Claw)', 'Darkvision 60 ft.'],
  },
  {
    id: 'mi-go',
    name: 'Mi-Go (Brain Fungus)',
    cr: 5,
    hp: 76,
    ac: 16,
    speed: '30 ft., fly 60 ft.',
    flySpeed: 60,
    iconName: 'Bug',
    description: 'An alien fungal creature with surgical precision and telepathic ability.',
    specialAbilities: ['Surgical Claws (2d8 + stun DC 15)', 'Extract Brain (incapacitated target, instant kill)', 'Innate Spellcasting (Detect Thoughts at will)', 'Blindsight 30 ft.'],
  },
  {
    id: 'shoggoth-spawn',
    name: 'Shoggoth Spawn',
    cr: 5,
    hp: 95,
    ac: 14,
    speed: '30 ft., swim 30 ft.',
    swimSpeed: 30,
    iconName: 'Skull',
    description: 'A lesser spawn of the formless horrors — amorphous, acid-secreting, and maddening.',
    specialAbilities: ['Amorphous (squeeze through 1-inch gaps)', 'Pseudopod Multiattack (3x 2d6+5)', 'Maddening Form (DC 14, frightened on sight)', 'Acid Secretion (melee attackers take 1d6 acid)'],
  },
  {
    id: 'spinosaurus',
    name: 'Spinosaurus',
    cr: 5,
    hp: 95,
    ac: 14,
    speed: '40 ft., swim 40 ft.',
    swimSpeed: 40,
    iconName: 'Squirrel',
    description: 'A massive semi-aquatic dinosaur with a fearsome sail and crushing bite.',
    specialAbilities: ['Multiattack (Bite + 2 Claws)', 'Amphibious', 'Bite (3d12 + grapple)', 'Sail Display (DC 14, frightened)', 'Siege Monster'],
  },
  {
    id: 't-rex',
    name: 'T-Rex',
    cr: 8,
    hp: 136,
    ac: 13,
    speed: '50 ft.',
    iconName: 'Skull',
    description: 'The tyrant lizard king — apex predator of the prehistoric world.',
    specialAbilities: ['Multiattack (Bite + Tail)', 'Bite (4d12 + grapple, swallow Medium)', 'Tail (3d8 + knockdown)', 'Legendary Resistance (1/day)'],
  },
  {
    id: 'hydra',
    name: 'Hydra',
    cr: 8,
    hp: 172,
    ac: 15,
    speed: '30 ft., swim 30 ft.',
    swimSpeed: 30,
    iconName: 'Snail',
    description: 'A many-headed terror that regrows severed heads.',
    specialAbilities: ['Reactive Heads (one reaction per head)', 'Multiple Bites (5 heads, 1d10+5 each)', 'Head Regrowth (2 new heads unless fire damage)', 'Hold Breath 1 hour', 'Wakeful (cannot be surprised)'],
  },
  {
    id: 'flesh-cathedral',
    name: 'Flesh Cathedral',
    cr: 10,
    hp: 200,
    ac: 16,
    speed: '20 ft.',
    iconName: 'Skull',
    description: 'A horrific amalgamation of absorbed creatures forming a living structure of flesh.',
    specialAbilities: ['Absorb (grappled creatures merge, healing the form)', 'Maddening Aura (DC 16, 3d6 psychic in 30 ft.)', 'Siege Monster', 'Regeneration (10 HP/round unless fire/acid)', 'Amorphous'],
  },
  {
    id: 'mothra-kaiju',
    name: 'Mothra (Kaiju)',
    cr: 12,
    hp: 250,
    ac: 17,
    speed: '20 ft., fly 120 ft.',
    flySpeed: 120,
    iconName: 'Bug',
    description: 'A colossal divine moth radiating protective light and devastating dust.',
    specialAbilities: ['Radiant Dust (DC 17, 6d8 radiant 60 ft. cone)', 'Blinding Scales (DC 17, blinded)', 'Legendary Resistance (2/day)', 'Gust Wings (DC 17, push 30 ft.)', 'Silk Spray (restrain DC 17)'],
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
// DRAGON FORMS (MOON CIRCLE LEVEL 18+)
// ============================================

export interface DragonForm extends BeastForm {
  element: 'fire' | 'cold' | 'acid';
  immunities: string[];
  resistances: string[];
}

export const DRAGON_FORMS: DragonForm[] = [
  {
    id: 'white-dragon',
    name: 'White Dragon',
    cr: 13,
    hp: 200,
    ac: 18,
    speed: '40 ft., fly 80 ft., burrow 40 ft., swim 40 ft.',
    flySpeed: 80,
    swimSpeed: 40,
    iconName: 'Snowflake',
    description: 'An ancient wyrm of ice and fury.',
    element: 'cold',
    immunities: ['Cold'],
    resistances: [],
    specialAbilities: ['Cold Breath (DC 19, 12d8 cold, 60 ft. cone)', 'Cold Immunity', 'Ice Walk', 'Blindsight 60 ft.'],
  },
  {
    id: 'black-dragon',
    name: 'Black Dragon',
    cr: 14,
    hp: 195,
    ac: 19,
    speed: '40 ft., fly 80 ft., swim 40 ft.',
    flySpeed: 80,
    swimSpeed: 40,
    iconName: 'Skull',
    description: 'A sinister dragon of acid and shadow.',
    element: 'acid',
    immunities: ['Acid'],
    resistances: [],
    specialAbilities: ['Acid Breath (DC 18, 12d8 acid, 60 ft. line)', 'Acid Immunity', 'Amphibious', 'Blindsight 60 ft.'],
  },
  {
    id: 'copper-dragon',
    name: 'Copper Dragon',
    cr: 14,
    hp: 184,
    ac: 18,
    speed: '40 ft., fly 80 ft., climb 40 ft.',
    flySpeed: 80,
    iconName: 'Mountain',
    description: 'A clever and witty metallic dragon with dual breath weapons.',
    element: 'acid',
    immunities: ['Acid'],
    resistances: [],
    specialAbilities: ['Acid Breath (DC 18, 12d8 acid, 60 ft. line)', 'Slowing Breath (DC 18, speed halved)', 'Acid Immunity'],
  },
  {
    id: 'silver-dragon',
    name: 'Silver Dragon',
    cr: 16,
    hp: 243,
    ac: 19,
    speed: '40 ft., fly 80 ft.',
    flySpeed: 80,
    iconName: 'Sparkles',
    description: 'A noble metallic dragon of cold and paralysis.',
    element: 'cold',
    immunities: ['Cold'],
    resistances: [],
    specialAbilities: ['Cold Breath (DC 20, 13d8 cold, 60 ft. cone)', 'Paralyzing Breath (DC 20, CON save or paralyzed)', 'Cold Immunity'],
  },
  {
    id: 'red-dragon',
    name: 'Red Dragon',
    cr: 17,
    hp: 256,
    ac: 19,
    speed: '40 ft., fly 80 ft., climb 40 ft.',
    flySpeed: 80,
    iconName: 'Flame',
    description: 'The most fearsome of all chromatic dragons — a lord of fire.',
    element: 'fire',
    immunities: ['Fire'],
    resistances: [],
    specialAbilities: ['Fire Breath (DC 21, 18d6 fire, 60 ft. cone)', 'Frightful Presence (DC 19)', 'Fire Immunity', 'Legendary Resistance (3/day)'],
  },
  {
    id: 'gold-dragon',
    name: 'Gold Dragon',
    cr: 17,
    hp: 256,
    ac: 19,
    speed: '40 ft., fly 80 ft., swim 40 ft.',
    flySpeed: 80,
    swimSpeed: 40,
    iconName: 'Sparkles',
    description: 'The mightiest metallic dragon — a paragon of fire and justice.',
    element: 'fire',
    immunities: ['Fire'],
    resistances: [],
    specialAbilities: ['Fire Breath (DC 21, 12d10 fire, 60 ft. cone)', 'Weakening Breath (DC 21, STR disadvantage)', 'Fire Immunity', 'Amphibious'],
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
