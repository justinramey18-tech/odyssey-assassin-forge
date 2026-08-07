// Permanent Shop Catalog - assembled export

import { ShopItem } from '../types';
import { CatalogItem, CatalogCategory } from './types';
import { catalogWeapons } from './weapons';
import { catalogArmor } from './armor';
import { catalogApparel } from './apparel';
import { catalogJewelry } from './jewelry';
import { catalogConsumables } from './consumables';
import { catalogGear } from './gear';

export * from './types';
export { catalogWeapons, catalogArmor, catalogApparel, catalogJewelry, catalogConsumables, catalogGear };

export const ALL_CATALOG_ITEMS: CatalogItem[] = [
  ...catalogWeapons,
  ...catalogArmor,
  ...catalogApparel,
  ...catalogJewelry,
  ...catalogConsumables,
  ...catalogGear,
];

export function getCatalogItemsByCategory(category: CatalogCategory | 'all'): CatalogItem[] {
  if (category === 'all') return ALL_CATALOG_ITEMS;
  return ALL_CATALOG_ITEMS.filter(i => i.category === category);
}

export function getCatalogItemById(id: string): CatalogItem | undefined {
  return ALL_CATALOG_ITEMS.find(i => i.id === id);
}

export function searchCatalog(items: CatalogItem[], query: string): CatalogItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter(i =>
    i.name.toLowerCase().includes(q) ||
    i.subcategory.toLowerCase().includes(q) ||
    i.description.toLowerCase().includes(q) ||
    (i.properties || []).some(p => p.toLowerCase().includes(q))
  );
}

/**
 * Converts a catalog item into the ShopItem shape the existing purchase pipeline expects.
 *
 * Pass uniqueInstance = true when actually buying a piece of equipment, so each purchased
 * copy gets its own id and the inventory does not collide on duplicate keys.
 * Leave it false for rendering, and for consumables, which must keep a stable id so that
 * buying the same potion twice stacks to quantity 2 instead of creating a second row.
 */
export function catalogItemToShopItem(item: CatalogItem, uniqueInstance = false): ShopItem {
  const needsUnique = uniqueInstance && item.itemType !== 'consumable';
  const id = needsUnique
    ? `catalog-${item.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    : `catalog-${item.id}`;

  const damage = typeof item.stats?.damage === 'string' ? item.stats.damage : undefined;
  const ac = typeof item.stats?.ac === 'number' ? item.stats.ac : undefined;

  return {
    id,
    catalogId: item.id,
    name: item.name,
    itemType: item.itemType,
    category: item.subcategory,
    mechanics: {
      damage,
      ac,
      properties: item.properties,
      effect: item.effect,
      duration: item.duration,
    },
    rarity: item.rarity,
    description: item.description,
    lore: item.lore || '',
    costGold: item.costGold,
    sourceText: 'Merchant permanent stock',
    detectedAt: new Date().toISOString(),
    slotType: item.slotType,
    stats: item.stats,
    weight: item.weight,
    usage: item.usage,
    usageType: item.usageType,
    consumableType: item.consumableType,
  };
}
