// Multiclass State Management Hook
// Central hook for managing class selection and multiclass state

import { useState, useCallback, useMemo } from 'react';
import { Character, DnDClass, ClassLevelMap } from '@/lib/types';
import { BaseAbilityScores } from '@/lib/abilityScores/types';
import { 
  CLASS_REGISTRY, 
  getClassById, 
  calculateTotalLevel,
  getDefaultClass,
} from '@/lib/classes';
import { 
  meetsMulticlassPrerequisites, 
  canAddMulticlassLevel,
  PrerequisiteResult,
} from '@/lib/classes/prerequisites';
import { 
  calculateMulticlassMaxHP, 
  getMulticlassHPBreakdown,
  getHitDicePool,
} from '@/lib/hpCalculation';
import { getMulticlassSpellSlots, hasSpellcasting } from '@/lib/magic/multiclassSlots';

export interface UseMulticlassOptions {
  character: Character;
  abilityScores: BaseAbilityScores;
  constitutionModifier: number;
  prestigeLevel?: number;
}

export interface MulticlassState {
  primaryClass: DnDClass;
  multiclassLevels: ClassLevelMap;
}

export function useMulticlass({
  character,
  abilityScores,
  constitutionModifier,
  prestigeLevel = 0,
}: UseMulticlassOptions) {
  // Initialize state from character or defaults
  const [state, setState] = useState<MulticlassState>(() => ({
    primaryClass: character.primaryClass ?? getDefaultClass(),
    multiclassLevels: character.multiclassLevels ?? {},
  }));

  // ========================
  // COMPUTED VALUES
  // ========================

  /** Total character level (primary + all multiclass levels) */
  const totalLevel = useMemo(() => {
    return calculateTotalLevel(character.level, state.multiclassLevels);
  }, [character.level, state.multiclassLevels]);

  /** Primary class configuration */
  const primaryClassConfig = useMemo(() => {
    return getClassById(state.primaryClass);
  }, [state.primaryClass]);

  /** Maximum HP calculated with multiclass rules */
  const maxHP = useMemo(() => {
    return calculateMulticlassMaxHP(
      state.primaryClass,
      character.level,
      state.multiclassLevels,
      constitutionModifier,
      prestigeLevel
    );
  }, [state.primaryClass, character.level, state.multiclassLevels, constitutionModifier, prestigeLevel]);

  /** HP breakdown for UI display */
  const hpBreakdown = useMemo(() => {
    return getMulticlassHPBreakdown(
      state.primaryClass,
      character.level,
      state.multiclassLevels,
      constitutionModifier,
      prestigeLevel
    );
  }, [state.primaryClass, character.level, state.multiclassLevels, constitutionModifier, prestigeLevel]);

  /** Hit dice pool for short rest healing */
  const hitDicePool = useMemo(() => {
    return getHitDicePool(state.primaryClass, character.level, state.multiclassLevels);
  }, [state.primaryClass, character.level, state.multiclassLevels]);

  /** Spell slots (regular + pact if applicable) */
  const spellSlots = useMemo(() => {
    return getMulticlassSpellSlots(state.primaryClass, character.level, state.multiclassLevels);
  }, [state.primaryClass, character.level, state.multiclassLevels]);

  /** Whether character has any spellcasting */
  const canCastSpells = useMemo(() => {
    return hasSpellcasting(state.primaryClass, character.level, state.multiclassLevels);
  }, [state.primaryClass, character.level, state.multiclassLevels]);

  /** Check if character is multiclassed */
  const isMulticlassed = useMemo(() => {
    return Object.values(state.multiclassLevels).some(l => l && l > 0);
  }, [state.multiclassLevels]);

  // ========================
  // ACTIONS
  // ========================

  /** Set the primary class (typically at character creation) */
  const setPrimaryClass = useCallback((classId: DnDClass) => {
    setState(prev => ({
      ...prev,
      primaryClass: classId,
    }));
  }, []);

  /** Check if a class can be multiclassed into */
  const canMulticlassInto = useCallback((classId: DnDClass): PrerequisiteResult => {
    const classConfig = getClassById(classId);
    return canAddMulticlassLevel(classConfig, abilityScores, totalLevel);
  }, [abilityScores, totalLevel]);

  /** Add a level to a multiclass */
  const addMulticlassLevel = useCallback((classId: DnDClass): boolean => {
    const check = canMulticlassInto(classId);
    if (!check.allowed) {
      return false;
    }

    setState(prev => ({
      ...prev,
      multiclassLevels: {
        ...prev.multiclassLevels,
        [classId]: (prev.multiclassLevels[classId] ?? 0) + 1,
      },
    }));
    return true;
  }, [canMulticlassInto]);

  /** Remove a level from a multiclass */
  const removeMulticlassLevel = useCallback((classId: DnDClass): boolean => {
    const currentLevels = state.multiclassLevels[classId] ?? 0;
    if (currentLevels <= 0) {
      return false;
    }

    setState(prev => {
      const newLevels = { ...prev.multiclassLevels };
      const updated = (newLevels[classId] ?? 0) - 1;
      
      if (updated <= 0) {
        delete newLevels[classId];
      } else {
        newLevels[classId] = updated;
      }

      return {
        ...prev,
        multiclassLevels: newLevels,
      };
    });
    return true;
  }, [state.multiclassLevels]);

  /** Clear all multiclass levels */
  const clearMulticlasses = useCallback(() => {
    setState(prev => ({
      ...prev,
      multiclassLevels: {},
    }));
  }, []);

  /** Get exportable state for saving */
  const getExportState = useCallback(() => {
    return {
      primaryClass: state.primaryClass,
      multiclassLevels: state.multiclassLevels,
    };
  }, [state]);

  /** Import state (e.g., from save file) */
  const importState = useCallback((imported: Partial<MulticlassState>) => {
    setState(prev => ({
      primaryClass: imported.primaryClass ?? prev.primaryClass,
      multiclassLevels: imported.multiclassLevels ?? prev.multiclassLevels,
    }));
  }, []);

  return {
    // State
    primaryClass: state.primaryClass,
    multiclassLevels: state.multiclassLevels,
    
    // Computed
    totalLevel,
    primaryClassConfig,
    maxHP,
    hpBreakdown,
    hitDicePool,
    spellSlots,
    canCastSpells,
    isMulticlassed,
    
    // Actions
    setPrimaryClass,
    canMulticlassInto,
    addMulticlassLevel,
    removeMulticlassLevel,
    clearMulticlasses,
    
    // Persistence
    getExportState,
    importState,
  };
}

export type UseMulticlassReturn = ReturnType<typeof useMulticlass>;
