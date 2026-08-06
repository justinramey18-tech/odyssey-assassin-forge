// Converts an item awarded by the AI DM into an equippable gear item when it
// looks like something the character can wear or wield. Returns null for
// ordinary loot (potions, treasure, trinkets, quest items).

import { EquipmentItem, EquipmentSlotType, EquipmentStats, Rarity } from './types';
import { SLOT_ICONS } from './homebrewGear';

export interface DmItemDetails {
  goldValue?: number;
  description?: string;
  rarity?: string;
  category?: string;
  effect?: string;
  dice?: string;
}

const SLOT_KEYWORDS: { slot: EquipmentSlotType; words: string[] }[] = [
  { slot: 'head', words: ['helm', 'helmet', 'hood', 'crown', 'circlet', 'cap', 'mask', 'coif', 'diadem'] },
  { slot: 'cloak', words: ['cloak', 'cape', 'mantle', 'shroud'] },
  { slot: 'arms', words: ['gauntlet', 'glove', 'bracer', 'vambrace', 'armguard'] },
  { slot: 'waist', words: ['belt', 'girdle', 'sash'] },
  { slot: 'legs', words: ['greave', 'boot', 'legging', 'trouser', 'sabaton', 'shoe', 'pants'] },
  { slot: 'chest', words: ['breastplate', 'chestplate', 'cuirass', 'robe', 'tunic', 'vest', 'mail', 'brigandine', 'plate', 'armor', 'armour', 'jerkin'] },
  { slot: 'secondary_weapon', words: ['shield', 'buckler'] },
  { slot: 'ranged_weapon', words: ['bow', 'crossbow', 'sling', 'javelin', 'dart'] },
  { slot: 'amulet', words: ['amulet', 'necklace', 'pendant', 'talisman', 'locket', 'torc'] },
  { slot: 'ring1', words: ['ring', 'signet', 'band'] },
  { slot: 'primary_weapon', words: ['sword', 'blade', 'axe', 'mace', 'dagger', 'staff', 'spear', 'hammer', 'flail', 'glaive', 'halberd', 'scimitar', 'rapier', 'katana', 'club', 'whip', 'sickle', 'lance', 'polearm', 'warhammer'] },
];

const RARITY_MAP: Record<string, Rarity> = {
  common: 'common',
  uncommon: 'uncommon',
  rare: 'rare',
  very_rare: 'epic',
  'very rare': 'epic',
  epic: 'epic',
  legendary: 'legendary',
  artifact: 'artifact',
};

export function inferGearSlot(name: string, category?: string): EquipmentSlotType | null {
  const n = (name || '').toLowerCase();
  for (const { slot, words } of SLOT_KEYWORDS) {
    if (words.some(w => n.includes(w))) return slot;
  }
  if (category === 'weapon') return 'primary_weapon';
  if (category === 'armor') return 'chest';
  return null;
}

function extractStats(slot: EquipmentSlotType, details?: DmItemDetails): EquipmentStats {
  const stats: EquipmentStats = {};
  const dice = details?.dice?.trim();
  const text = `${details?.effect ?? ''} ${details?.description ?? ''}`;

  const isWeapon = slot === 'primary_weapon' || slot === 'secondary_weapon' || slot === 'ranged_weapon';
  if (dice && isWeapon) {
    stats.damage = dice;
  }

  const acMatch = text.match(/(?:\+\s*(\d+)\s*(?:to\s*)?(?:AC|armou?r class)|(?:AC|armou?r class)\s*\+?\s*(\d+))/i);
  const ac = Number(acMatch?.[1] ?? acMatch?.[2]);
  if (Number.isFinite(ac) && ac > 0 && ac <= 10) stats.ac = ac;

  const atkMatch = text.match(/\+\s*(\d+)\s*(?:to\s*)?(?:attack|hit)/i);
  const atk = Number(atkMatch?.[1]);
  if (Number.isFinite(atk) && atk > 0 && atk <= 10) stats.attackBonus = atk;

  return stats;
}

/**
 * Build an EquipmentItem from a DM-awarded item, or null if it is not wearable gear.
 */
export function dmItemToEquipment(
  name: string,
  details?: DmItemDetails,
  level = 1,
): EquipmentItem | null {
  const category = details?.category;
  if (category === 'usable' || category === 'treasure') return null;

  const slot = inferGearSlot(name, category);
  if (!slot) return null;

  const rawValue = Number(details?.goldValue);
  const value = Number.isFinite(rawValue) && rawValue > 0 ? Math.round(rawValue) : 1;
  const rarity = RARITY_MAP[(details?.rarity ?? 'common').toLowerCase()] ?? 'common';

  const description = details?.description?.trim() || 'Awarded by the AI Dungeon Master.';
  const effect = details?.effect?.trim();

  return {
    id: `dm-gear-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    slotType: slot,
    rarity,
    level,
    icon: SLOT_ICONS[slot],
    stats: extractStats(slot, details),
    properties: effect ? [effect] : [],
    enchantments: [],
    weight: 1,
    value,
    description,
  };
}
