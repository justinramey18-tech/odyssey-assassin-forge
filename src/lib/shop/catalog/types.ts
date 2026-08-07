// Permanent Shop Catalog - shared types

import { EquipmentSlotType, EquipmentStats } from '@/lib/inventory/types';

export type CatalogCategory =
  | 'weapons'
  | 'armor'
  | 'apparel'
  | 'jewelry'
  | 'consumables'
  | 'gear';

export interface CatalogItem {
  /** Stable kebab-case id. Never change these once shipped. */
  id: string;
  name: string;
  category: CatalogCategory;
  /** Shown on the card, e.g. "Martial Melee", "Heavy Armor", "Ring". */
  subcategory: string;
  /** Where it lands after purchase. */
  itemType: 'equipment' | 'consumable' | 'miscellaneous';
  /** Required for anything the character wears or wields. */
  slotType?: EquipmentSlotType;
  rarity: 'common' | 'uncommon' | 'rare' | 'very_rare' | 'legendary';
  costGold: number;
  weight: number;
  description: string;
  /** Plain-English "what do I actually do with this". Always fill this in. */
  usage: string;
  lore?: string;
  /** IMPORTANT: stats.ac is a BONUS added on top of base AC 10, not a final AC value. */
  stats?: EquipmentStats;
  properties?: string[];
  /** Consumables only. */
  effect?: string;
  duration?: string;
  consumableType?: 'potion' | 'poison' | 'scroll';
  usageType?: 'drink' | 'apply' | 'throw' | 'read' | 'inhale' | 'injury' | 'contact' | 'ingested';
}

export const CATALOG_CATEGORIES: { id: CatalogCategory; label: string }[] = [
  { id: 'weapons', label: 'Weapons' },
  { id: 'armor', label: 'Armor' },
  { id: 'apparel', label: 'Apparel' },
  { id: 'jewelry', label: 'Jewelry' },
  { id: 'consumables', label: 'Consumables' },
  { id: 'gear', label: 'Gear' },
];
