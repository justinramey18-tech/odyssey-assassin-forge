// Consumables System Types

export type ConsumableType = 'potion' | 'poison' | 'scroll';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'very_rare' | 'legendary';

export type UsageType = 'drink' | 'apply' | 'throw' | 'read' | 'inhale' | 'injury' | 'contact' | 'ingested';

export interface Consumable {
  id: string;
  name: string;
  type: ConsumableType;
  rarity: Rarity;
  effect: string;
  duration: string;
  description: string;
  usageType: UsageType;
  icon: string;
  spellLevel?: number; // For scrolls
}

export interface InventoryItem {
  consumable: Consumable;
  quantity: number;
}

export const rarityConfig: Record<Rarity, { 
  color: string; 
  bgColor: string; 
  borderColor: string;
  glowColor: string;
  label: string;
}> = {
  common: { 
    color: 'text-zinc-300', 
    bgColor: 'bg-zinc-500/20', 
    borderColor: 'border-zinc-500/50',
    glowColor: 'shadow-zinc-500/20',
    label: 'Common' 
  },
  uncommon: { 
    color: 'text-emerald-400', 
    bgColor: 'bg-emerald-500/20', 
    borderColor: 'border-emerald-500/50',
    glowColor: 'shadow-emerald-500/30',
    label: 'Uncommon' 
  },
  rare: { 
    color: 'text-blue-400', 
    bgColor: 'bg-blue-500/20', 
    borderColor: 'border-blue-500/50',
    glowColor: 'shadow-blue-500/30',
    label: 'Rare' 
  },
  very_rare: { 
    color: 'text-purple-400', 
    bgColor: 'bg-purple-500/20', 
    borderColor: 'border-purple-500/50',
    glowColor: 'shadow-purple-500/30',
    label: 'Very Rare' 
  },
  legendary: { 
    color: 'text-amber-400', 
    bgColor: 'bg-amber-500/20', 
    borderColor: 'border-amber-500/50',
    glowColor: 'shadow-amber-500/40',
    label: 'Legendary' 
  },
};

export const typeConfig: Record<ConsumableType, {
  color: string;
  bgColor: string;
  iconName: string;
  label: string;
}> = {
  potion: {
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/20',
    iconName: 'Beaker',
    label: 'Potions',
  },
  poison: {
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    iconName: 'Skull',
    label: 'Poisons',
  },
  scroll: {
    color: 'text-sky-400',
    bgColor: 'bg-sky-500/20',
    iconName: 'ScrollText',
    label: 'Scrolls',
  },
};
