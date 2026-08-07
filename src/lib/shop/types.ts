// Shop System Types - Chronicle-Powered Dynamic Shop

import { ConfidenceLevel } from '@/lib/chronicleSync/types';
import { EquipmentSlotType, EquipmentStats } from '@/lib/inventory/types';

// Raw shop item from Chronicle AI (before conversion)
export interface ShopItem {
  id: string;
  name: string;
  itemType: 'consumable' | 'equipment' | 'miscellaneous';
  category?: string; // weapon, armor, potion, poison, scroll, etc.
  
  // D&D Mechanics (AI-generated if missing)
  mechanics: {
    damage?: string;
    ac?: number;
    properties?: string[];
    effect?: string;
    duration?: string;
    savingThrow?: string;
  };
  
  rarity: 'common' | 'uncommon' | 'rare' | 'very_rare' | 'epic' | 'legendary';
  description: string;
  lore: string;
  
  costGold: number;
  sourceText: string;
  detectedAt: string;
  expiresAt?: string; // Omitted means the item is permanent stock and never expires
  
  // Track what was AI-generated vs extracted
  aiGenerated?: {
    mechanics: boolean;
    description: boolean;
    lore: boolean;
    rarity: boolean;
  };

  // ---- Permanent catalog item overrides (optional, ignored by AI-detected items) ----
  slotType?: EquipmentSlotType;
  stats?: EquipmentStats;
  weight?: number;
  usage?: string;
  catalogId?: string;
  consumableType?: 'potion' | 'poison' | 'scroll';
  usageType?: 'drink' | 'apply' | 'throw' | 'read' | 'inhale' | 'injury' | 'contact' | 'ingested';
}

export interface ShopState {
  currentGold: number;
  items: ShopItem[];
  purchaseHistory: PurchaseRecord[];
}

export interface PurchaseRecord {
  itemId: string;
  itemName: string;
  cost: number;
  convertedTo: 'consumable' | 'equipment' | 'miscellaneous';
  purchasedAt: string;
}

// Parsed shop item from Chronicle Sync AI
export interface ParsedShopItem {
  name: string;
  itemType: 'equipment' | 'consumable' | 'miscellaneous';
  category?: string;
  costGold: number;
  mechanics?: {
    damage?: string;
    ac?: number;
    properties?: string[];
    effect?: string;
    duration?: string;
    savingThrow?: string;
  };
  rarity?: string;
  description?: string;
  lore?: string;
  sourceText: string;
  confidence: ConfidenceLevel;
}

// Rarity configuration for shop items
export const shopRarityConfig: Record<string, { 
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
  epic: { 
    color: 'text-purple-400', 
    bgColor: 'bg-purple-500/20', 
    borderColor: 'border-purple-500/50',
    glowColor: 'shadow-purple-500/30',
    label: 'Epic' 
  },
  legendary: { 
    color: 'text-amber-400', 
    bgColor: 'bg-amber-500/20', 
    borderColor: 'border-amber-500/50',
    glowColor: 'shadow-amber-500/40',
    label: 'Legendary' 
  },
};
