// Converts an item awarded by the AI DM into a usable consumable (potion,
// poison or scroll) when it reads like one. Returns null for anything else,
// which then falls through to the loot stash.

import { Consumable, ConsumableType, Rarity, UsageType } from '@/lib/consumables/types';
import type { DmItemDetails } from './dmGearIntake';

const RARITY_MAP: Record<string, Rarity> = {
  common: 'common',
  uncommon: 'uncommon',
  rare: 'rare',
  epic: 'very_rare',
  very_rare: 'very_rare',
  'very rare': 'very_rare',
  legendary: 'legendary',
  artifact: 'legendary',
};

const SCROLL_WORDS = ['scroll', 'tome page', 'parchment', 'incantation slip'];
const POISON_WORDS = ['poison', 'venom', 'toxin', 'antitoxin'];
const POTION_WORDS = [
  'potion', 'elixir', 'draught', 'draft', 'tonic', 'philter', 'philtre',
  'vial', 'flask', 'oil', 'salve', 'balm', 'brew', 'serum', 'extract',
];

const USABLE_CATEGORIES = ['usable', 'consumable', 'potion', 'scroll', 'poison'];

function slug(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

/** Consumable type for a DM-awarded item, or null if it is not consumable. */
export function inferConsumableType(name: string, category?: string): ConsumableType | null {
  const n = (name || '').toLowerCase();
  const cat = (category || '').toLowerCase();

  if (SCROLL_WORDS.some(w => n.includes(w)) || cat === 'scroll') return 'scroll';
  if (POISON_WORDS.some(w => n.includes(w)) || cat === 'poison') return 'poison';
  if (POTION_WORDS.some(w => n.includes(w)) || cat === 'potion') return 'potion';
  if (USABLE_CATEGORIES.includes(cat)) return 'potion';
  return null;
}

const USAGE_BY_TYPE: Record<ConsumableType, UsageType> = {
  potion: 'drink',
  poison: 'apply',
  scroll: 'read',
};

const ICON_BY_TYPE: Record<ConsumableType, string> = {
  potion: 'FlaskConical',
  poison: 'Skull',
  scroll: 'ScrollText',
};

/**
 * Build a Consumable from a DM-awarded item, or null if it is not consumable.
 * The id is derived from the name so repeat awards stack instead of duplicating.
 */
export function dmItemToConsumable(name: string, details?: DmItemDetails): Consumable | null {
  const clean = (name || '').trim();
  if (!clean) return null;

  const type = inferConsumableType(clean, details?.category);
  if (!type) return null;

  const rarity = RARITY_MAP[(details?.rarity ?? 'common').toLowerCase()] ?? 'common';
  const dice = details?.dice?.trim();
  const effect = details?.effect?.trim()
    || (dice ? `Rolls ${dice} on use.` : '')
    || details?.description?.trim()
    || 'Effect determined by the Dungeon Master.';

  return {
    id: `dm-${type}-${slug(clean)}`,
    name: clean,
    type,
    rarity,
    effect,
    duration: 'Instantaneous',
    description: details?.description?.trim() || 'Awarded by the AI Dungeon Master.',
    usageType: USAGE_BY_TYPE[type],
    icon: ICON_BY_TYPE[type],
  };
}

/** Dice string attached to a DM consumable, if any. */
export function dmConsumableDice(details?: DmItemDetails): string | undefined {
  const dice = details?.dice?.trim();
  return dice || undefined;
}
