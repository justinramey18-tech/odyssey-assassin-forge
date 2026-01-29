// Hook to calculate and aggregate equipment stats
import { useMemo } from 'react';
import { CharacterEquipment, EquipmentStats } from '@/lib/inventory/types';
import { getActiveSetBonuses } from '@/lib/inventory/utils';

export interface AggregatedStats {
  totalAC: number;
  baseAC: number;
  acFromGear: number;
  totalAttackBonus: number;
  totalWeight: number;
  damage: string | null;
  // Attribute bonuses
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  // Other bonuses
  perception: number;
  saves: number;
  movement: number;
  // Set bonus info
  activeSetBonuses: { setName: string; bonus: string; piecesActive: number; piecesTotal: number }[];
}

export function useEquipmentStats(equipment: CharacterEquipment): AggregatedStats {
  return useMemo(() => {
    const slots = equipment.slots;
    const equippedItems = Object.values(slots).filter(Boolean);
    
    let baseAC = 10;
    let acFromGear = 0;
    let totalAttackBonus = 0;
    let totalWeight = 0;
    let primaryDamage: string | null = null;
    
    // Attribute bonuses
    let strength = 0;
    let dexterity = 0;
    let constitution = 0;
    let intelligence = 0;
    let wisdom = 0;
    let charisma = 0;
    
    // Other bonuses
    let perception = 0;
    let saves = 0;
    let movement = 0;
    
    equippedItems.forEach(item => {
      if (!item) return;
      
      const stats = item.stats;
      
      // AC from armor
      if (stats.ac) acFromGear += stats.ac;
      
      // Attack bonus
      if (stats.attackBonus) totalAttackBonus += stats.attackBonus;
      
      // Weight
      totalWeight += item.weight;
      
      // Primary weapon damage
      if (item.slotType === 'primary_weapon' && stats.damage) {
        primaryDamage = stats.damage;
      }
      
      // Attributes
      if (stats.strength) strength += stats.strength;
      if (stats.dexterity) dexterity += stats.dexterity;
      if (stats.constitution) constitution += stats.constitution;
      if (stats.intelligence) intelligence += stats.intelligence;
      if (stats.wisdom) wisdom += stats.wisdom;
      if (stats.charisma) charisma += stats.charisma;
      
      // Other stats
      if (stats.perception) perception += stats.perception;
      if (stats.saves) saves += stats.saves;
      if (stats.movement) movement += stats.movement;
    });
    
    // Get set bonuses
    const setData = getActiveSetBonuses(slots);
    const activeSetBonuses = setData.map(({ setInfo, activePieces }) => ({
      setName: setInfo.name,
      bonus: setInfo.bonuses.find(b => b.piecesRequired <= activePieces)?.bonus || '',
      piecesActive: activePieces,
      piecesTotal: setInfo.pieces.length,
    }));
    
    return {
      totalAC: baseAC + acFromGear,
      baseAC,
      acFromGear,
      totalAttackBonus,
      totalWeight,
      damage: primaryDamage,
      strength,
      dexterity,
      constitution,
      intelligence,
      wisdom,
      charisma,
      perception,
      saves,
      movement,
      activeSetBonuses,
    };
  }, [equipment]);
}
