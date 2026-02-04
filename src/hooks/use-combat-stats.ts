/**
 * Unified Combat Stats Hook
 * 
 * Aggregates combat-relevant stats from multiple sources:
 * - Equipment stats (AC, attack bonus, damage from gear)
 * - Ability scores (DEX/STR modifiers)
 * - Passive ability bonuses (Archery Master, Weapon Master, etc.)
 * - Character level (proficiency bonus)
 */

import { useMemo } from 'react';
import { Character } from '@/lib/types';
import { allAbilities } from '@/lib/abilities';
import { AggregatedStats } from '@/hooks/use-equipment-stats';
import { BaseAbilityScores, scoreToModifier } from '@/lib/abilityScores/types';

export interface CombatStats {
  // Final calculated values
  ac: number;
  attackBonus: number;
  damageBonus: number;
  initiativeBonus: number;
  saveDC: number;
  proficiencyBonus: number;
  
  // Breakdown for UI display
  breakdown: {
    baseAC: number;
    acFromGear: number;
    acFromAbilities: number;
    dexModifier: number;
    strModifier: number;
    attackFromGear: number;
    attackFromAbilities: number;
    damageFromGear: number;
    damageFromAbilities: number;
    initiativeFromAbilities: number;
  };
}

interface UseCombatStatsOptions {
  character: Character;
  equipmentStats?: AggregatedStats;
  abilityModifiers?: BaseAbilityScores;
}

/**
 * Calculate proficiency bonus based on character level
 */
function getProficiencyBonus(level: number): number {
  return Math.ceil(level / 4) + 1;
}

/**
 * Calculate passive ability bonuses from unlocked abilities
 */
function getPassiveAbilityBonuses(character: Character): {
  attackBonus: number;
  damageBonus: number;
  acBonus: number;
  initiativeBonus: number;
} {
  let attackBonus = 0;
  let damageBonus = 0;
  let acBonus = 0;
  let initiativeBonus = 0;
  
  character.abilities.forEach(ca => {
    if (ca.currentTier === 0) return;
    const ability = allAbilities.find(a => a.id === ca.abilityId);
    if (!ability || ability.type !== 'passive') return;
    
    // Archery Master
    if (ability.id === 'archery_master') {
      if (ca.currentTier >= 1) attackBonus += 1;
      if (ca.currentTier >= 2) { attackBonus += 1; damageBonus += 1; }
      if (ca.currentTier >= 3) damageBonus += 1;
    }
    
    // Weapon Master
    if (ability.id === 'weapon_master') {
      if (ca.currentTier >= 1) attackBonus += 1;
      if (ca.currentTier >= 2) { attackBonus += 1; damageBonus += 1; }
      if (ca.currentTier >= 3) damageBonus += 1;
    }
    
    // Warrior's Resilience
    if (ability.id === 'warriors_resilience') {
      if (ca.currentTier >= 1) acBonus += 1;
      if (ca.currentTier >= 2) acBonus += 1;
    }
    
    // Sixth Sense
    if (ability.id === 'sixth_sense') {
      if (ca.currentTier >= 1) initiativeBonus += 2;
      if (ca.currentTier >= 2) initiativeBonus += 3;
    }
  });
  
  return { attackBonus, damageBonus, acBonus, initiativeBonus };
}

export function useCombatStats(options: UseCombatStatsOptions): CombatStats {
  const { character, equipmentStats, abilityModifiers } = options;
  
  return useMemo(() => {
    const proficiencyBonus = getProficiencyBonus(character.level);
    const passiveBonuses = getPassiveAbilityBonuses(character);
    
    // Get DEX and STR modifiers from ability scores (or default to 0)
    const dexModifier = abilityModifiers?.dexterity ?? 0;
    const strModifier = abilityModifiers?.strength ?? 0;
    
    // Equipment stats (or defaults)
    const baseAC = 10;
    const acFromGear = equipmentStats?.acFromGear ?? 0;
    const attackFromGear = equipmentStats?.totalAttackBonus ?? 0;
    
    // For AC: If wearing armor, use gear AC + DEX (up to max). 
    // For unarmored: 10 + DEX + ability bonuses
    // Simplified: totalAC from equipment includes base calculations
    const gearAC = equipmentStats?.totalAC ?? baseAC;
    
    // If we have gear AC (from actual armor), use it. Otherwise use 10 + DEX
    const effectiveBaseAC = acFromGear > 0 ? gearAC : baseAC + Math.max(0, dexModifier);
    
    // Final AC = gear/base AC + passive ability bonuses
    const ac = effectiveBaseAC + passiveBonuses.acBonus;
    
    // Attack bonus = proficiency + DEX (for finesse/ranged) or STR + gear bonus + ability bonuses
    // Default to DEX for assassin-type characters
    const primaryAttackMod = Math.max(dexModifier, strModifier);
    const attackBonus = proficiencyBonus + primaryAttackMod + attackFromGear + passiveBonuses.attackBonus;
    
    // Damage bonus = STR/DEX modifier + ability bonuses
    const damageBonus = primaryAttackMod + passiveBonuses.damageBonus;
    
    // Initiative = DEX modifier + ability bonuses (Sixth Sense)
    const initiativeBonus = dexModifier + passiveBonuses.initiativeBonus;
    
    // Save DC = 8 + proficiency + DEX (for assassin-type abilities)
    const saveDC = 8 + proficiencyBonus + dexModifier;
    
    return {
      ac,
      attackBonus,
      damageBonus,
      initiativeBonus,
      saveDC,
      proficiencyBonus,
      breakdown: {
        baseAC,
        acFromGear,
        acFromAbilities: passiveBonuses.acBonus,
        dexModifier,
        strModifier,
        attackFromGear,
        attackFromAbilities: passiveBonuses.attackBonus,
        damageFromGear: 0, // Gear doesn't typically add flat damage
        damageFromAbilities: passiveBonuses.damageBonus,
        initiativeFromAbilities: passiveBonuses.initiativeBonus,
      },
    };
  }, [character, equipmentStats, abilityModifiers]);
}
