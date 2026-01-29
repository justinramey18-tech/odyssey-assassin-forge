// Visual Inventory System Types and Data

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'artifact';

export type EquipmentSlotType = 
  | 'head' 
  | 'chest' 
  | 'arms' 
  | 'waist' 
  | 'legs' 
  | 'primary_weapon' 
  | 'secondary_weapon' 
  | 'ranged_weapon' 
  | 'amulet' 
  | 'ring1' 
  | 'ring2';

export interface EquipmentStats {
  ac?: number;
  damage?: string;
  attackBonus?: number;
  perception?: number;
  saves?: number;
  strength?: number;
  dexterity?: number;
  constitution?: number;
  intelligence?: number;
  wisdom?: number;
  charisma?: number;
  movement?: number;
  [key: string]: number | string | undefined;
}

export interface Enchantment {
  name: string;
  description: string;
  icon?: string;
}

export interface SetBonus {
  setName: string;
  setId: string;
  piecesRequired: number;
  bonus: string;
  isActive?: boolean;
}

export interface EquipmentItem {
  id: string;
  name: string;
  slotType: EquipmentSlotType;
  rarity: Rarity;
  level: number;
  icon: string;
  stats: EquipmentStats;
  properties?: string[];
  enchantments?: Enchantment[];
  weight: number;
  value: number;
  description?: string;
  lore?: string;
  setId?: string;
  setName?: string;
}

export interface EquipmentSlot {
  type: EquipmentSlotType;
  label: string;
  icon: string;
  category: 'armor' | 'weapons' | 'accessories';
  equippedItem: EquipmentItem | null;
}

export interface SetInfo {
  id: string;
  name: string;
  pieces: string[]; // Item IDs in the set
  bonuses: SetBonus[];
}

export interface CharacterEquipment {
  slots: Record<EquipmentSlotType, EquipmentItem | null>;
  inventory: EquipmentItem[];
}

// Rarity configuration
export const rarityConfig: Record<Rarity, { color: string; stars: number; label: string; borderClass: string }> = {
  common: { color: 'text-muted-foreground', stars: 0, label: 'Common', borderClass: 'border-l-muted-foreground' },
  uncommon: { color: 'text-green-400', stars: 0, label: 'Uncommon', borderClass: 'border-l-green-400' },
  rare: { color: 'text-blue-400', stars: 1, label: 'Rare', borderClass: 'border-l-blue-400' },
  epic: { color: 'text-purple-400', stars: 2, label: 'Epic', borderClass: 'border-l-purple-400' },
  legendary: { color: 'text-amber-400', stars: 3, label: 'Legendary', borderClass: 'border-l-amber-400' },
  artifact: { color: 'text-orange-500', stars: 3, label: 'Artifact', borderClass: 'border-l-orange-500' },
};

// Equipment slot definitions
export const equipmentSlotDefinitions: { type: EquipmentSlotType; label: string; icon: string; category: 'armor' | 'weapons' | 'accessories' }[] = [
  { type: 'head', label: 'HEAD', icon: 'Crown', category: 'armor' },
  { type: 'chest', label: 'CHEST', icon: 'Shield', category: 'armor' },
  { type: 'arms', label: 'ARMS', icon: 'Hand', category: 'armor' },
  { type: 'waist', label: 'WAIST', icon: 'CircleDot', category: 'armor' },
  { type: 'legs', label: 'LEGS', icon: 'Footprints', category: 'armor' },
  { type: 'primary_weapon', label: 'PRIMARY WEAPON', icon: 'Sword', category: 'weapons' },
  { type: 'secondary_weapon', label: 'SECONDARY WEAPON', icon: 'Axe', category: 'weapons' },
  { type: 'ranged_weapon', label: 'RANGED WEAPON', icon: 'Target', category: 'weapons' },
  { type: 'amulet', label: 'AMULET', icon: 'Gem', category: 'accessories' },
  { type: 'ring1', label: 'RING', icon: 'Circle', category: 'accessories' },
  { type: 'ring2', label: 'RING', icon: 'Circle', category: 'accessories' },
];

// Sample equipment items
export const sampleEquipment: EquipmentItem[] = [
  {
    id: 'spartan-war-helm',
    name: 'Spartan War Helm',
    slotType: 'head',
    rarity: 'rare',
    level: 15,
    icon: 'Crown',
    stats: { ac: 2 },
    weight: 4,
    value: 250,
    description: 'A battle-worn helm bearing the marks of countless Spartan victories.',
    lore: 'Forged in the fires of Sparta, this helm has witnessed the fall of empires.',
    setId: 'greek-heroes',
    setName: 'Greek Heroes Set',
  },
  {
    id: 'greek-heroes-cuirass',
    name: 'Greek Heroes Cuirass',
    slotType: 'chest',
    rarity: 'epic',
    level: 18,
    icon: 'Shield',
    stats: { ac: 5 },
    properties: ['Heavy Armor'],
    weight: 25,
    value: 500,
    description: 'Legendary armor said to have been worn by the heroes of old.',
    setId: 'greek-heroes',
    setName: 'Greek Heroes Set',
  },
  {
    id: 'mercenary-gauntlets',
    name: 'Mercenary Gauntlets',
    slotType: 'arms',
    rarity: 'rare',
    level: 12,
    icon: 'Hand',
    stats: { ac: 1, attackBonus: 1 },
    weight: 2,
    value: 150,
    description: 'Reinforced gauntlets favored by hired blades across Greece.',
  },
  {
    id: 'belt-of-immortal',
    name: 'Belt of the Immortal',
    slotType: 'waist',
    rarity: 'epic',
    level: 16,
    icon: 'CircleDot',
    stats: { ac: 2, constitution: 1 },
    enchantments: [
      { name: 'Undying Fortitude', description: 'Once per long rest, drop to 1 HP instead of 0' },
    ],
    weight: 1,
    value: 400,
    description: 'A belt woven with threads said to be from the Fates themselves.',
    setId: 'greek-heroes',
    setName: 'Greek Heroes Set',
  },
  {
    id: 'spartan-war-greaves',
    name: 'Spartan War Greaves',
    slotType: 'legs',
    rarity: 'rare',
    level: 15,
    icon: 'Footprints',
    stats: { ac: 3, movement: 5 },
    weight: 4,
    value: 200,
    description: 'Bronze greaves that have marched across countless battlefields.',
  },
  {
    id: 'sword-of-damokles',
    name: 'Sword of Damokles',
    slotType: 'primary_weapon',
    rarity: 'legendary',
    level: 20,
    icon: 'Sword',
    stats: { damage: '2d6+3', attackBonus: 2 },
    properties: ['Magical', 'Versatile'],
    enchantments: [
      { name: 'Impending Doom', description: '+1d6 damage on critical hits' },
      { name: 'Favor of Fortune', description: 'Advantage on death saving throws' },
    ],
    weight: 3,
    value: 2500,
    description: 'A blade that hangs by a thread over the heads of tyrants.',
    lore: 'Legend says this sword was gifted by the gods to remind mortals of the fragility of power.',
  },
  {
    id: 'spear-of-leonidas',
    name: 'Spear of Leonidas',
    slotType: 'secondary_weapon',
    rarity: 'legendary',
    level: 20,
    icon: 'Axe',
    stats: { damage: '1d8+2', attackBonus: 3 },
    properties: ['Magical', 'Reach', 'Thrown'],
    enchantments: [
      { name: 'Spartan Legacy', description: 'Advantage on attacks when outnumbered' },
      { name: 'Thermopylae\'s Stand', description: '+2 AC when at half HP or lower' },
    ],
    weight: 4,
    value: 3000,
    description: 'The legendary spear wielded by King Leonidas at Thermopylae.',
    lore: 'This spear has tasted the blood of immortals and mortals alike.',
  },
  {
    id: 'hades-bow',
    name: "Hades's Bow",
    slotType: 'ranged_weapon',
    rarity: 'legendary',
    level: 18,
    icon: 'Target',
    stats: { damage: '1d8+1d6🔥' },
    properties: ['Magical', 'Ammunition'],
    enchantments: [
      { name: 'Hellfire Arrows', description: 'Arrows deal an additional 1d6 fire damage' },
      { name: 'Soul Sight', description: 'Can see invisible creatures within 60 feet' },
    ],
    weight: 2,
    value: 2000,
    description: 'A bow forged in the depths of the Underworld.',
  },
  {
    id: 'eye-of-horus',
    name: 'Eye of Horus',
    slotType: 'amulet',
    rarity: 'epic',
    level: 14,
    icon: 'Gem',
    stats: { perception: 2, wisdom: 1 },
    enchantments: [
      { name: 'Divine Sight', description: 'Advantage on Perception checks' },
    ],
    weight: 0.1,
    value: 350,
    description: 'An ancient amulet bearing the all-seeing eye.',
  },
  {
    id: 'ring-of-protection',
    name: 'Ring of Protection',
    slotType: 'ring1',
    rarity: 'epic',
    level: 10,
    icon: 'Circle',
    stats: { ac: 1, saves: 1 },
    weight: 0,
    value: 300,
    description: 'A simple silver band that provides an aura of protection.',
  },
];

// Set definitions
export const setDefinitions: SetInfo[] = [
  {
    id: 'greek-heroes',
    name: 'Greek Heroes Set',
    pieces: ['spartan-war-helm', 'greek-heroes-cuirass', 'belt-of-immortal', 'spartan-war-greaves', 'mercenary-gauntlets'],
    bonuses: [
      { setId: 'greek-heroes', setName: 'Greek Heroes Set', piecesRequired: 2, bonus: '+10 movement speed' },
      { setId: 'greek-heroes', setName: 'Greek Heroes Set', piecesRequired: 3, bonus: 'Advantage on Athletics checks' },
      { setId: 'greek-heroes', setName: 'Greek Heroes Set', piecesRequired: 4, bonus: '+2 Strength' },
      { setId: 'greek-heroes', setName: 'Greek Heroes Set', piecesRequired: 5, bonus: 'Heroic Strike: Once per day, deal maximum damage' },
    ],
  },
];

// Calculate total stats from equipment
export function calculateTotalStats(slots: Record<EquipmentSlotType, EquipmentItem | null>): {
  totalAC: number;
  totalDamage: string;
  totalWeight: number;
} {
  let totalAC = 10; // Base AC
  let totalWeight = 0;
  const damages: string[] = [];

  Object.values(slots).forEach(item => {
    if (item) {
      if (item.stats.ac) totalAC += item.stats.ac;
      if (item.stats.damage) damages.push(item.stats.damage);
      totalWeight += item.weight;
    }
  });

  return {
    totalAC,
    totalDamage: damages.length > 0 ? damages[0] : '1d4',
    totalWeight,
  };
}

// Get active set bonuses
export function getActiveSetBonuses(slots: Record<EquipmentSlotType, EquipmentItem | null>): { setInfo: SetInfo; activePieces: number }[] {
  const equippedItems = Object.values(slots).filter(Boolean) as EquipmentItem[];
  const setGroups: Record<string, string[]> = {};

  equippedItems.forEach(item => {
    if (item.setId) {
      if (!setGroups[item.setId]) setGroups[item.setId] = [];
      setGroups[item.setId].push(item.id);
    }
  });

  return setDefinitions
    .filter(set => setGroups[set.id] && setGroups[set.id].length >= 2)
    .map(set => ({
      setInfo: set,
      activePieces: setGroups[set.id].length,
    }));
}

// Create initial equipment state
export function createInitialEquipment(): CharacterEquipment {
  const slots: Record<EquipmentSlotType, EquipmentItem | null> = {
    head: sampleEquipment.find(e => e.slotType === 'head') || null,
    chest: sampleEquipment.find(e => e.slotType === 'chest') || null,
    arms: sampleEquipment.find(e => e.slotType === 'arms') || null,
    waist: sampleEquipment.find(e => e.slotType === 'waist') || null,
    legs: sampleEquipment.find(e => e.slotType === 'legs') || null,
    primary_weapon: sampleEquipment.find(e => e.slotType === 'primary_weapon') || null,
    secondary_weapon: sampleEquipment.find(e => e.slotType === 'secondary_weapon') || null,
    ranged_weapon: sampleEquipment.find(e => e.slotType === 'ranged_weapon') || null,
    amulet: sampleEquipment.find(e => e.slotType === 'amulet') || null,
    ring1: sampleEquipment.find(e => e.slotType === 'ring1') || null,
    ring2: null,
  };

  // Inventory includes items not equipped
  const equippedIds = Object.values(slots).filter(Boolean).map(item => item!.id);
  const inventory = sampleEquipment.filter(item => !equippedIds.includes(item.id));

  return { slots, inventory };
}
