// Loot System Types
// Items found adventuring that aren't for sale

export type LootRarity = 'common' | 'uncommon' | 'rare' | 'very_rare' | 'legendary' | 'artifact';
export type LootCategory = 'weapon' | 'armor' | 'trinket' | 'treasure' | 'usable' | 'miscellaneous';

export interface LootMechanics {
  damage?: string;
  ac?: number;
  effect?: string;
  duration?: string;
  savingThrow?: string;
  diceRoll?: string; // e.g., "1d8+2" for items with dice mechanics
  properties?: string[];
}

export interface LootItem {
  id: string;
  name: string;
  category: LootCategory;
  rarity: LootRarity;
  goldValue: number;
  description: string;
  lore?: string;
  mechanics?: LootMechanics;
  sourceText?: string; // Original text from Chronicle sync
  acquiredAt: string; // ISO timestamp
  // AI prompt for usable items
  aiPrompt?: string;
  // Whether this item has dice mechanics (syncs to combat items)
  hasDiceMechanics: boolean;
  // Track if AI-generated
  aiGenerated?: {
    description: boolean;
    lore: boolean;
    mechanics: boolean;
    goldValue: boolean;
  };
}

// Chronicle parsed loot
export interface ParsedLootItem {
  name: string;
  category?: LootCategory;
  rarity?: LootRarity;
  goldValue?: number;
  description?: string;
  lore?: string;
  mechanics?: LootMechanics;
  sourceText: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface LootState {
  items: LootItem[];
  soldHistory: SoldLootRecord[];
}

export interface SoldLootRecord {
  itemId: string;
  itemName: string;
  goldReceived: number;
  soldAt: string;
}

// Rarity configuration for loot
export const lootRarityConfig: Record<LootRarity, { 
  color: string; 
  bgColor: string; 
  borderColor: string;
  glowColor: string;
  label: string;
  goldMultiplier: number;
}> = {
  common: { 
    color: 'text-zinc-300', 
    bgColor: 'bg-zinc-500/20', 
    borderColor: 'border-zinc-500/50',
    glowColor: 'shadow-zinc-500/20',
    label: 'Common',
    goldMultiplier: 1,
  },
  uncommon: { 
    color: 'text-emerald-400', 
    bgColor: 'bg-emerald-500/20', 
    borderColor: 'border-emerald-500/50',
    glowColor: 'shadow-emerald-500/30',
    label: 'Uncommon',
    goldMultiplier: 2,
  },
  rare: { 
    color: 'text-blue-400', 
    bgColor: 'bg-blue-500/20', 
    borderColor: 'border-blue-500/50',
    glowColor: 'shadow-blue-500/30',
    label: 'Rare',
    goldMultiplier: 5,
  },
  very_rare: { 
    color: 'text-purple-400', 
    bgColor: 'bg-purple-500/20', 
    borderColor: 'border-purple-500/50',
    glowColor: 'shadow-purple-500/30',
    label: 'Very Rare',
    goldMultiplier: 15,
  },
  legendary: { 
    color: 'text-amber-400', 
    bgColor: 'bg-amber-500/20', 
    borderColor: 'border-amber-500/50',
    glowColor: 'shadow-amber-500/40',
    label: 'Legendary',
    goldMultiplier: 50,
  },
  artifact: { 
    color: 'text-orange-500', 
    bgColor: 'bg-orange-500/20', 
    borderColor: 'border-orange-500/50',
    glowColor: 'shadow-orange-500/40',
    label: 'Artifact',
    goldMultiplier: 100,
  },
};

// Category configuration
export const lootCategoryConfig: Record<LootCategory, {
  icon: string;
  color: string;
  bgColor: string;
  label: string;
}> = {
  weapon: {
    icon: 'Sword',
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    label: 'Weapon',
  },
  armor: {
    icon: 'Shield',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    label: 'Armor',
  },
  trinket: {
    icon: 'Gem',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
    label: 'Trinket',
  },
  treasure: {
    icon: 'Coins',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/20',
    label: 'Treasure',
  },
  usable: {
    icon: 'Zap',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/20',
    label: 'Usable',
  },
  miscellaneous: {
    icon: 'Package',
    color: 'text-zinc-400',
    bgColor: 'bg-zinc-500/20',
    label: 'Misc',
  },
};

// Random loot tables for generator
export const RANDOM_LOOT_TABLES = {
  trinkets: [
    { name: 'Bone Dice', category: 'trinket' as LootCategory, baseValue: 2 },
    { name: 'Glass Eye', category: 'trinket' as LootCategory, baseValue: 5 },
    { name: 'Lucky Rabbit Foot', category: 'trinket' as LootCategory, baseValue: 3 },
    { name: 'Mysterious Key', category: 'trinket' as LootCategory, baseValue: 10 },
    { name: 'Cracked Compass', category: 'trinket' as LootCategory, baseValue: 8 },
    { name: 'Petrified Eyeball', category: 'trinket' as LootCategory, baseValue: 15 },
    { name: 'Silver Locket', category: 'trinket' as LootCategory, baseValue: 20 },
    { name: 'Obsidian Shard', category: 'trinket' as LootCategory, baseValue: 12 },
    { name: 'Dried Mandrake Root', category: 'trinket' as LootCategory, baseValue: 25 },
    { name: 'Broken Crown Fragment', category: 'trinket' as LootCategory, baseValue: 50 },
  ],
  weapons: [
    { name: 'Rusty Dagger', category: 'weapon' as LootCategory, baseValue: 5, mechanics: { damage: '1d4 piercing' } },
    { name: 'Chipped Shortsword', category: 'weapon' as LootCategory, baseValue: 10, mechanics: { damage: '1d6 slashing' } },
    { name: 'Cracked Warhammer', category: 'weapon' as LootCategory, baseValue: 15, mechanics: { damage: '1d8 bludgeoning' } },
    { name: 'Bent Rapier', category: 'weapon' as LootCategory, baseValue: 20, mechanics: { damage: '1d8 piercing', properties: ['Finesse'] } },
    { name: 'Weathered Crossbow', category: 'weapon' as LootCategory, baseValue: 25, mechanics: { damage: '1d8 piercing' } },
  ],
  armor: [
    { name: 'Torn Leather Scraps', category: 'armor' as LootCategory, baseValue: 5, mechanics: { ac: 1 } },
    { name: 'Dented Shield', category: 'armor' as LootCategory, baseValue: 10, mechanics: { ac: 1 } },
    { name: 'Rusted Chain Links', category: 'armor' as LootCategory, baseValue: 15, mechanics: { ac: 2 } },
    { name: 'Cracked Helmet', category: 'armor' as LootCategory, baseValue: 12, mechanics: { ac: 1 } },
    { name: 'Worn Gauntlets', category: 'armor' as LootCategory, baseValue: 8, mechanics: { ac: 0 } },
  ],
  usable: [
    { name: 'Smoke Bomb', category: 'usable' as LootCategory, baseValue: 20, mechanics: { effect: 'Creates 10ft radius heavily obscured area', diceRoll: '1d4 rounds' } },
    { name: 'Flash Powder', category: 'usable' as LootCategory, baseValue: 15, mechanics: { effect: 'DC 12 CON save or blinded', diceRoll: '1d2 rounds', savingThrow: 'DC 12 CON' } },
    { name: 'Caltrops Pouch', category: 'usable' as LootCategory, baseValue: 10, mechanics: { effect: 'Covers 5ft square, DC 15 DEX save or 1 piercing + speed 0', diceRoll: '1d4 piercing' } },
    { name: 'Tanglefoot Bag', category: 'usable' as LootCategory, baseValue: 30, mechanics: { effect: 'DC 13 DEX save or restrained', diceRoll: '1d4 rounds', savingThrow: 'DC 13 DEX' } },
    { name: 'Alchemist Fire Flask', category: 'usable' as LootCategory, baseValue: 50, mechanics: { damage: '1d4 fire', effect: 'Target takes 1d4 fire start of each turn until action to extinguish', diceRoll: '1d4 fire' } },
    { name: 'Thunderstone', category: 'usable' as LootCategory, baseValue: 35, mechanics: { effect: 'DC 15 CON save or deafened for 1 minute', savingThrow: 'DC 15 CON' } },
  ],
  treasure: [
    { name: 'Copper Coins', category: 'treasure' as LootCategory, baseValue: 5 },
    { name: 'Silver Coins', category: 'treasure' as LootCategory, baseValue: 25 },
    { name: 'Gold Coins', category: 'treasure' as LootCategory, baseValue: 50 },
    { name: 'Uncut Gemstone', category: 'treasure' as LootCategory, baseValue: 75 },
    { name: 'Pearl Necklace', category: 'treasure' as LootCategory, baseValue: 100 },
    { name: 'Ancient Coin Collection', category: 'treasure' as LootCategory, baseValue: 150 },
    { name: 'Jeweled Brooch', category: 'treasure' as LootCategory, baseValue: 200 },
    { name: 'Golden Idol', category: 'treasure' as LootCategory, baseValue: 500 },
  ],
};
