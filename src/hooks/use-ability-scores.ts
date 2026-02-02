import { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  AbilityName, 
  BaseAbilityScores, 
  DEFAULT_BASE_SCORES, 
  ABILITY_ORDER,
  scoreToModifier,
  clampScore,
  AbilityScoreBreakdown,
} from '@/lib/abilityScores/types';
import { generateAbilityScores, STANDARD_ARRAY, modifierToBaseScore } from '@/lib/abilityScores';
import { AggregatedStats } from '@/hooks/use-equipment-stats';

const STORAGE_KEY = 'odyssey-ability-scores';
const DICE_MODIFIERS_KEY = 'odyssey-dice-modifiers';

interface UseAbilityScoresOptions {
  equipmentStats?: AggregatedStats;
}

interface UseAbilityScoresReturn {
  // State
  baseScores: BaseAbilityScores;
  
  // Computed (includes gear/buff bonuses)
  finalScores: BaseAbilityScores;
  finalModifiers: BaseAbilityScores;
  
  // Breakdown for UI
  getScoreBreakdown: (ability: AbilityName) => AbilityScoreBreakdown;
  
  // Actions
  setBaseScore: (ability: AbilityName, score: number) => void;
  incrementScore: (ability: AbilityName) => void;
  decrementScore: (ability: AbilityName) => void;
  randomizeScores: () => number[];
  applyScores: (scores: BaseAbilityScores) => void;
  applyStandardArray: (assignment: Record<AbilityName, number>) => void;
}

/**
 * Load base scores from localStorage, with migration support
 */
function loadBaseScores(): BaseAbilityScores {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Validate structure
      if (typeof parsed === 'object' && 'strength' in parsed) {
        return { ...DEFAULT_BASE_SCORES, ...parsed };
      }
    }
    
    // Migration: Check for existing dice modifiers and reverse-calculate
    const modifiersStored = localStorage.getItem(DICE_MODIFIERS_KEY);
    if (modifiersStored) {
      const modifiers = JSON.parse(modifiersStored);
      const migrated: BaseAbilityScores = {
        strength: modifierToBaseScore(modifiers.str ?? 0),
        dexterity: modifierToBaseScore(modifiers.dex ?? 0),
        constitution: modifierToBaseScore(modifiers.con ?? 0),
        intelligence: modifierToBaseScore(modifiers.int ?? 0),
        wisdom: modifierToBaseScore(modifiers.wis ?? 0),
        charisma: modifierToBaseScore(modifiers.cha ?? 0),
      };
      // Save migrated scores
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      console.log('[AbilityScores] Migrated from dice modifiers');
      return migrated;
    }
  } catch (error) {
    console.error('[AbilityScores] Failed to load:', error);
  }
  
  return { ...DEFAULT_BASE_SCORES };
}

/**
 * Sync modifiers to DiceRoller's storage format for compatibility
 */
function syncToDiceRollerStorage(modifiers: BaseAbilityScores): void {
  try {
    const diceModifiers = {
      str: scoreToModifier(modifiers.strength),
      dex: scoreToModifier(modifiers.dexterity),
      con: scoreToModifier(modifiers.constitution),
      int: scoreToModifier(modifiers.intelligence),
      wis: scoreToModifier(modifiers.wisdom),
      cha: scoreToModifier(modifiers.charisma),
    };
    localStorage.setItem(DICE_MODIFIERS_KEY, JSON.stringify(diceModifiers));
  } catch (error) {
    console.error('[AbilityScores] Failed to sync to DiceRoller:', error);
  }
}

export function useAbilityScores(options: UseAbilityScoresOptions = {}): UseAbilityScoresReturn {
  const { equipmentStats } = options;
  
  const [baseScores, setBaseScores] = useState<BaseAbilityScores>(loadBaseScores);
  
  // Calculate final scores (base + gear bonuses)
  const finalScores = useMemo((): BaseAbilityScores => {
    const gearStr = equipmentStats?.strength ?? 0;
    const gearDex = equipmentStats?.dexterity ?? 0;
    const gearCon = equipmentStats?.constitution ?? 0;
    const gearInt = equipmentStats?.intelligence ?? 0;
    const gearWis = equipmentStats?.wisdom ?? 0;
    const gearCha = equipmentStats?.charisma ?? 0;
    
    return {
      strength: clampScore(baseScores.strength + gearStr),
      dexterity: clampScore(baseScores.dexterity + gearDex),
      constitution: clampScore(baseScores.constitution + gearCon),
      intelligence: clampScore(baseScores.intelligence + gearInt),
      wisdom: clampScore(baseScores.wisdom + gearWis),
      charisma: clampScore(baseScores.charisma + gearCha),
    };
  }, [baseScores, equipmentStats]);
  
  // Calculate final modifiers from final scores
  const finalModifiers = useMemo((): BaseAbilityScores => ({
    strength: scoreToModifier(finalScores.strength),
    dexterity: scoreToModifier(finalScores.dexterity),
    constitution: scoreToModifier(finalScores.constitution),
    intelligence: scoreToModifier(finalScores.intelligence),
    wisdom: scoreToModifier(finalScores.wisdom),
    charisma: scoreToModifier(finalScores.charisma),
  }), [finalScores]);
  
  // Persist and sync on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(baseScores));
      syncToDiceRollerStorage(finalScores);
    } catch (error) {
      console.error('[AbilityScores] Failed to save:', error);
    }
  }, [baseScores, finalScores]);
  
  // Get full breakdown for UI display
  const getScoreBreakdown = useCallback((ability: AbilityName): AbilityScoreBreakdown => {
    const base = baseScores[ability];
    const gearBonus = equipmentStats?.[ability] ?? 0;
    const buffBonus = 0; // Reserved for future buff system
    const total = clampScore(base + gearBonus + buffBonus);
    
    return {
      base,
      gearBonus,
      buffBonus,
      total,
      modifier: scoreToModifier(total),
    };
  }, [baseScores, equipmentStats]);
  
  // Set a specific base score
  const setBaseScore = useCallback((ability: AbilityName, score: number) => {
    setBaseScores(prev => ({
      ...prev,
      [ability]: clampScore(score),
    }));
  }, []);
  
  // Increment score by 1
  const incrementScore = useCallback((ability: AbilityName) => {
    setBaseScores(prev => ({
      ...prev,
      [ability]: clampScore(prev[ability] + 1),
    }));
  }, []);
  
  // Decrement score by 1
  const decrementScore = useCallback((ability: AbilityName) => {
    setBaseScores(prev => ({
      ...prev,
      [ability]: clampScore(prev[ability] - 1),
    }));
  }, []);
  
  // Generate random scores (returns them for user assignment)
  const randomizeScores = useCallback((): number[] => {
    return generateAbilityScores();
  }, []);
  
  // Apply a complete set of scores
  const applyScores = useCallback((scores: BaseAbilityScores) => {
    setBaseScores({
      strength: clampScore(scores.strength),
      dexterity: clampScore(scores.dexterity),
      constitution: clampScore(scores.constitution),
      intelligence: clampScore(scores.intelligence),
      wisdom: clampScore(scores.wisdom),
      charisma: clampScore(scores.charisma),
    });
  }, []);
  
  // Apply standard array with specific assignment
  const applyStandardArray = useCallback((assignment: Record<AbilityName, number>) => {
    setBaseScores({
      strength: clampScore(assignment.strength),
      dexterity: clampScore(assignment.dexterity),
      constitution: clampScore(assignment.constitution),
      intelligence: clampScore(assignment.intelligence),
      wisdom: clampScore(assignment.wisdom),
      charisma: clampScore(assignment.charisma),
    });
  }, []);
  
  return {
    baseScores,
    finalScores,
    finalModifiers,
    getScoreBreakdown,
    setBaseScore,
    incrementScore,
    decrementScore,
    randomizeScores,
    applyScores,
    applyStandardArray,
  };
}
