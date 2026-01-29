// Inventory Utility Functions
import { EquipmentSlotType, EquipmentItem, CharacterEquipment, SetInfo } from './types';
import { sampleEquipment, baseSetDefinitions } from './baseItems';
import { allLegendaryItems } from './legendaryItems';
import { legendarySetDefinitions } from './legendarySets';

// Combine all equipment items
export const allEquipment: EquipmentItem[] = [...sampleEquipment, ...allLegendaryItems];

// Combine all set definitions
export const setDefinitions: SetInfo[] = [...baseSetDefinitions, ...legendarySetDefinitions];

// Calculate total stats from equipment
export function calculateTotalStats(slots: Record<EquipmentSlotType, EquipmentItem | null>): {
  totalAC: number;
  totalDamage: string;
  totalWeight: number;
} {
  let totalAC = 10; // Base AC
  let totalWeight = 0;
  const damages: string[] = [];

  Object.values(slots).forEach(item => {
    if (item) {
      if (item.stats.ac) totalAC += item.stats.ac;
      if (item.stats.damage) damages.push(item.stats.damage);
      totalWeight += item.weight;
    }
  });

  return {
    totalAC,
    totalDamage: damages.length > 0 ? damages[0] : '1d4',
    totalWeight,
  };
}

// Get active set bonuses
export function getActiveSetBonuses(slots: Record<EquipmentSlotType, EquipmentItem | null>): { setInfo: SetInfo; activePieces: number }[] {
  const equippedItems = Object.values(slots).filter(Boolean) as EquipmentItem[];
  const setGroups: Record<string, string[]> = {};

  equippedItems.forEach(item => {
    if (item.setId) {
      if (!setGroups[item.setId]) setGroups[item.setId] = [];
      setGroups[item.setId].push(item.id);
    }
  });

  return setDefinitions
    .filter(set => setGroups[set.id] && setGroups[set.id].length >= 2)
    .map(set => ({
      setInfo: set,
      activePieces: setGroups[set.id].length,
    }));
}

// Create initial equipment state
export function createInitialEquipment(): CharacterEquipment {
  const slots: Record<EquipmentSlotType, EquipmentItem | null> = {
    head: sampleEquipment.find(e => e.slotType === 'head') || null,
    chest: sampleEquipment.find(e => e.slotType === 'chest') || null,
    arms: sampleEquipment.find(e => e.slotType === 'arms') || null,
    waist: sampleEquipment.find(e => e.slotType === 'waist') || null,
    legs: sampleEquipment.find(e => e.slotType === 'legs') || null,
    primary_weapon: sampleEquipment.find(e => e.slotType === 'primary_weapon') || null,
    secondary_weapon: sampleEquipment.find(e => e.slotType === 'secondary_weapon') || null,
    ranged_weapon: sampleEquipment.find(e => e.slotType === 'ranged_weapon') || null,
    amulet: sampleEquipment.find(e => e.slotType === 'amulet') || null,
    ring1: sampleEquipment.find(e => e.slotType === 'ring1') || null,
    ring2: null,
  };

  // Inventory includes all items not equipped (including legendary items)
  const equippedIds = Object.values(slots).filter(Boolean).map(item => item!.id);
  const inventory = allEquipment.filter(item => !equippedIds.includes(item.id));

  return { slots, inventory };
}

// Get items compatible with a specific slot
export function getCompatibleItems(inventory: EquipmentItem[], slotType: EquipmentSlotType): EquipmentItem[] {
  // Handle ring slots specially
  if (slotType === 'ring1' || slotType === 'ring2') {
    return inventory.filter(item => item.slotType === 'ring1' || item.slotType === 'ring2');
  }
  return inventory.filter(item => item.slotType === slotType);
}
