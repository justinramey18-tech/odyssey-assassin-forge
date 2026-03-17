import { EquipmentItem, EquipmentSlotType, Rarity, EquipmentStats } from './types';

export interface HomebrewGearItem extends EquipmentItem {
  isHomebrew: true;
  createdAt: string;
}

export interface HomebrewGearFormState {
  name: string;
  slotType: EquipmentSlotType;
  rarity: Rarity;
  level: number;
  icon: string;
  weight: number;
  value: number;
  description: string;
  lore: string;
  properties: string[];
  stats: EquipmentStats;
  damage: string;
}

export const HOMEBREW_GEAR_STORAGE_KEY = 'dnd-homebrew-gear';

export const DEFAULT_GEAR_FORM: HomebrewGearFormState = {
  name: '',
  slotType: 'primary_weapon',
  rarity: 'common',
  level: 1,
  icon: 'Sword',
  weight: 1,
  value: 0,
  description: '',
  lore: '',
  properties: [],
  stats: {},
  damage: '',
};

export const SLOT_ICONS: Record<EquipmentSlotType, string> = {
  head: 'Crown',
  chest: 'Shield',
  arms: 'Hand',
  waist: 'CircleDot',
  legs: 'Footprints',
  cloak: 'Wind',
  primary_weapon: 'Sword',
  secondary_weapon: 'Axe',
  ranged_weapon: 'Target',
  amulet: 'Gem',
  ring1: 'Circle',
  ring2: 'Circle',
};

export function formToEquipmentItem(form: HomebrewGearFormState): HomebrewGearItem {
  const stats: EquipmentStats = { ...form.stats };
  if (form.damage) {
    stats.damage = form.damage;
  }

  return {
    id: `homebrew-gear-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: form.name,
    slotType: form.slotType,
    rarity: form.rarity,
    level: form.level,
    icon: form.icon || SLOT_ICONS[form.slotType],
    stats,
    properties: form.properties.filter(Boolean),
    weight: form.weight,
    value: form.value,
    description: form.description || undefined,
    lore: form.lore || undefined,
    enchantments: [],
    isHomebrew: true,
    createdAt: new Date().toISOString(),
  };
}

export function loadHomebrewGear(): HomebrewGearItem[] {
  try {
    const raw = localStorage.getItem(HOMEBREW_GEAR_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveHomebrewGear(items: HomebrewGearItem[]): void {
  try {
    localStorage.setItem(HOMEBREW_GEAR_STORAGE_KEY, JSON.stringify(items));
  } catch (error) {
    console.error('Failed to save homebrew gear:', error);
  }
}
