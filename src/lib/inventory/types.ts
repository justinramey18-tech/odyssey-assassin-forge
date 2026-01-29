// Visual Inventory System Types

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
