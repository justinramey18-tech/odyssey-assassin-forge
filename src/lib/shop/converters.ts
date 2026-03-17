// Shop Item Converters - Translate shop items to system types

import { Consumable, ConsumableType, Rarity as ConsumableRarity, UsageType } from '@/lib/consumables/types';
import { EquipmentItem, Rarity as EquipmentRarity, EquipmentSlotType, EquipmentStats } from '@/lib/inventory/types';
import { ShopItem } from './types';

// ============ CONSUMABLE CONVERTER ============

/**
 * Converts a ShopItem of type 'consumable' into a proper Consumable
 * that can be added to the consumables inventory via useConsumables.addItem()
 */
export function convertShopItemToConsumable(shopItem: ShopItem): Consumable {
  // Determine consumable type from category
  const consumableType = inferConsumableType(shopItem.category);
  
  // Map shop rarity to consumable rarity (consumables use 'very_rare' not 'epic')
  const rarityMap: Record<string, ConsumableRarity> = {
    'common': 'common',
    'uncommon': 'uncommon',
    'rare': 'rare',
    'very_rare': 'very_rare',
    'epic': 'very_rare',      // Epic maps to very_rare for consumables
    'legendary': 'legendary',
  };
  
  // Infer usage type from category/mechanics
  const usageType = inferUsageType(shopItem, consumableType);
  
  // Determine appropriate icon based on type
  const icon = inferConsumableIcon(consumableType, shopItem.name);
  
  return {
    id: `shop-${shopItem.id}`,
    name: shopItem.name,
    type: consumableType,
    rarity: rarityMap[shopItem.rarity] || 'common',
    effect: shopItem.mechanics.effect || shopItem.description,
    duration: shopItem.mechanics.duration || 'Instant',
    description: shopItem.lore || shopItem.description,
    usageType: usageType,
    icon: icon,
    spellLevel: consumableType === 'scroll' ? inferSpellLevel(shopItem) : undefined,
  };
}

function inferConsumableType(category?: string): ConsumableType {
  if (!category) return 'potion';
  const lower = category.toLowerCase();
  if (lower.includes('poison')) return 'poison';
  if (lower.includes('scroll')) return 'scroll';
  return 'potion';
}

function inferUsageType(shopItem: ShopItem, consumableType: ConsumableType): UsageType {
  // Scrolls are always read
  if (consumableType === 'scroll') return 'read';
  
  // Check for poison application keywords
  if (consumableType === 'poison') {
    const effect = (shopItem.mechanics.effect || '').toLowerCase();
    if (effect.includes('ingested') || effect.includes('ingest')) return 'ingested';
    if (effect.includes('contact')) return 'contact';
    if (effect.includes('inhale') || effect.includes('fumes')) return 'inhale';
    return 'injury'; // Default for poisons
  }
  
  // Potions default to drink
  return 'drink';
}

function inferConsumableIcon(type: ConsumableType, name: string): string {
  const nameLower = name.toLowerCase();
  
  if (type === 'poison') {
    if (nameLower.includes('venom')) return 'Waves';
    if (nameLower.includes('sleep') || nameLower.includes('torpor')) return 'BedDouble';
    return 'Skull';
  }
  
  if (type === 'scroll') {
    if (nameLower.includes('fire')) return 'Flame';
    if (nameLower.includes('heal')) return 'Heart';
    return 'ScrollText';
  }
  
  // Potions
  if (nameLower.includes('heal')) return 'Heart';
  if (nameLower.includes('strength')) return 'Dumbbell';
  if (nameLower.includes('speed') || nameLower.includes('haste')) return 'Zap';
  if (nameLower.includes('fly')) return 'Feather';
  if (nameLower.includes('invisible')) return 'Eye';
  return 'Beaker';
}

function inferSpellLevel(shopItem: ShopItem): number | undefined {
  // Estimate spell level from cost
  const cost = shopItem.costGold;
  if (cost < 50) return 0;       // Cantrip
  if (cost < 100) return 1;
  if (cost < 250) return 2;
  if (cost < 500) return 3;
  if (cost < 1000) return 4;
  return 5;
}

// ============ EQUIPMENT CONVERTER ============

/**
 * Converts a ShopItem of type 'equipment' into a proper EquipmentItem
 * that can be added to equipment.inventory
 */
/**
 * Returns true if the item can be assigned a valid equipment slot.
 * Used by the shop to decide equipment vs miscellaneous routing.
 */
export function isWearableEquipment(shopItem: ShopItem): boolean {
  return inferSlotType(shopItem.category, shopItem.name) !== null;
}

export function convertShopItemToEquipment(shopItem: ShopItem): EquipmentItem {
  // Determine slot type from category + name fallback
  const slotType = inferSlotType(shopItem.category, shopItem.name) || 'primary_weapon';
  
  // Map shop rarity to equipment rarity
  const rarityMap: Record<string, EquipmentRarity> = {
    'common': 'common',
    'uncommon': 'uncommon',
    'rare': 'rare',
    'very_rare': 'epic',      // very_rare maps to epic for equipment
    'epic': 'epic',
    'legendary': 'legendary',
  };
  
  // Build stats object from mechanics
  const stats: EquipmentStats = {};
  if (shopItem.mechanics.damage) stats.damage = shopItem.mechanics.damage;
  if (shopItem.mechanics.ac) stats.ac = shopItem.mechanics.ac;
  
  // Estimate level from cost
  const level = estimateLevelFromCost(shopItem.costGold);
  
  // Infer weight from slot type
  const weight = inferWeight(slotType);
  
  return {
    id: `shop-${shopItem.id}`,
    name: shopItem.name,
    slotType: slotType,
    rarity: rarityMap[shopItem.rarity] || 'common',
    level: level,
    icon: inferEquipmentIcon(slotType),
    description: shopItem.description,
    lore: shopItem.lore,
    stats: stats,
    properties: shopItem.mechanics.properties || [],
    enchantments: [],
    weight: weight,
    value: shopItem.costGold,
  };
}

function inferSlotType(category?: string, itemName?: string): EquipmentSlotType | null {
  // Try category first, then fall back to item name
  const sources = [category, itemName].filter(Boolean).map(s => s!.toLowerCase());
  
  for (const lower of sources) {
    if (lower.includes('sword') || lower.includes('axe') || lower.includes('mace') || lower.includes('scimitar') || lower.includes('rapier') || lower.includes('flail') || lower.includes('maul') || lower.includes('glaive') || lower.includes('halberd')) return 'primary_weapon';
    if (lower.includes('dagger') || lower.includes('knife')) return 'secondary_weapon';
    if (lower.includes('bow') || lower.includes('crossbow') || lower.includes('sling') || lower.includes('blowgun')) return 'ranged_weapon';
    if (lower.includes('spear') || lower.includes('pike') || lower.includes('trident') || lower.includes('whip')) return 'secondary_weapon';
    if (lower.includes('helm') || lower.includes('hood') || lower.includes('hat') || lower.includes('circlet') || lower.includes('crown')) return 'head';
    if (lower.includes('chest') || lower.includes('armor') || lower.includes('mail') || lower.includes('plate') || lower.includes('leather') || lower.includes('robe')) return 'chest';
    if (lower.includes('glove') || lower.includes('bracer') || lower.includes('gauntlet') || lower.includes('vambrace')) return 'arms';
    if (lower.includes('belt') || lower.includes('sash')) return 'waist';
    if (lower.includes('boot') || lower.includes('greave') || lower.includes('leg')) return 'legs';
    if (lower.includes('amulet') || lower.includes('necklace') || lower.includes('pendant') || lower.includes('periapt')) return 'amulet';
    if (lower.includes('ring')) return 'ring1';
    if (lower.includes('cloak') || lower.includes('cape') || lower.includes('mantle')) return 'chest';
    if (lower.includes('staff') || lower.includes('wand')) return 'primary_weapon';
    if (lower.includes('shield')) return 'secondary_weapon';
  }
  
  return null; // No slot found — item should route to miscellaneous
}

function estimateLevelFromCost(cost: number): number {
  if (cost < 50) return 1;
  if (cost < 200) return 3;
  if (cost < 500) return 5;
  if (cost < 1500) return 8;
  if (cost < 5000) return 12;
  if (cost < 15000) return 16;
  return 20;
}

function inferWeight(slotType: EquipmentSlotType): number {
  const weights: Record<EquipmentSlotType, number> = {
    head: 1,
    chest: 8,
    arms: 1,
    waist: 1,
    legs: 2,
    cloak: 1,
    primary_weapon: 3,
    secondary_weapon: 1,
    ranged_weapon: 2,
    amulet: 0.1,
    ring1: 0,
    ring2: 0,
  };
  return weights[slotType];
}

function inferEquipmentIcon(slotType: EquipmentSlotType): string {
  const icons: Record<EquipmentSlotType, string> = {
    head: '🎭',
    chest: '🛡️',
    arms: '🧤',
    waist: '🎗️',
    legs: '👢',
    cloak: '🧣',
    primary_weapon: '⚔️',
    secondary_weapon: '🗡️',
    ranged_weapon: '🏹',
    amulet: '📿',
    ring1: '💍',
    ring2: '💍',
  };
  return icons[slotType];
}
