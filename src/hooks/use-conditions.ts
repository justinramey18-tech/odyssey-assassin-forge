import { useState, useCallback, useEffect, useMemo } from 'react';
import { toast } from '@/hooks/use-toast';
import { getScopedItem, setScopedItem } from '@/lib/scoped-storage';
import {
  ActiveCondition,
  NewConditionInput,
  ConditionsState,
  formatDuration,
  ROUNDS_PER_MINUTE,
  MAX_ACTIVE_CONDITIONS,
  CONDITION_WARNING_THRESHOLD,
  STORAGE_KEY,
  getConditionById,
  CLEARS_ON_SHORT_REST,
  CLEARS_ON_LONG_REST,
  NEVER_AUTO_CLEAR,
} from '@/lib/conditions';

// Generate unique ID for condition instances
const generateId = (): string => {
  return `cond_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Default state
const DEFAULT_STATE: ConditionsState = {
  conditions: [],
  recentConditions: [],
};

// Load state from localStorage
const loadState = (): ConditionsState => {
  try {
    const saved = getScopedItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        conditions: parsed.conditions || [],
        recentConditions: parsed.recentConditions || [],
      };
    }
  } catch (e) {
    console.error('Failed to load conditions state:', e);
  }
  return DEFAULT_STATE;
};

// Save state to localStorage with error handling
const saveState = (state: ConditionsState): void => {
  try {
    setScopedItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save conditions:', e);
    toast({
      title: "Save Warning",
      description: "Conditions may not persist - storage full",
      variant: "destructive",
    });
  }
};

export interface UseConditionsOptions {
  /** Callback when concentration is broken - used to sync with spellcasting */
  onConcentrationBroken?: (spellName: string, reason?: string) => void;
}

export interface UseConditionsReturn {
  // State
  conditions: ActiveCondition[];
  recentConditions: string[];
  
  // Computed
  allActive: ActiveCondition[];
  debuffs: ActiveCondition[];
  buffs: ActiveCondition[];
  concentration: ActiveCondition[];
  hasConcentration: boolean;
  concentrationSpell: ActiveCondition | null;
  activeCount: number;
  isAtCapacity: boolean;
  isNearCapacity: boolean;
  
  // Actions
  addCondition: (input: NewConditionInput) => boolean;
  removeCondition: (id: string) => void;
  updateDuration: (id: string, newValue: number) => void;
  updateNotes: (id: string, notes: string) => void;
  
  // Turn & Rest mechanics
  endTurn: () => { expired: string[]; tickedDown: string[] };
  shortRest: () => void;
  longRest: () => void;
  
  // Concentration
  breakConcentration: (reason?: string) => void;
  
  // Undo support
  undoBuffer: ActiveCondition | null;
  undoRemove: () => void;
  clearUndo: () => void;
  
  // Utility
  clearAll: () => void;
  getConditionById: (id: string) => ActiveCondition | undefined;
}

export function useConditions(options: UseConditionsOptions = {}): UseConditionsReturn {
  const { onConcentrationBroken } = options;
  const [state, setState] = useState<ConditionsState>(loadState);
  const [undoBuffer, setUndoBuffer] = useState<ActiveCondition | null>(null);

  // Persist state changes
  useEffect(() => {
    saveState(state);
  }, [state]);

  // Re-init when character is switched in-memory
  useEffect(() => {
    const handleCharacterLoaded = () => setState(loadState());
    window.addEventListener('odyssey-character-loaded', handleCharacterLoaded);
    return () => window.removeEventListener('odyssey-character-loaded', handleCharacterLoaded);
  }, []);

  // Clear undo buffer after 5 seconds
  useEffect(() => {
    if (undoBuffer) {
      const timer = setTimeout(() => {
        setUndoBuffer(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [undoBuffer]);

  // ============================================
  // Computed Properties
  // ============================================

  const allActive = useMemo(() => state.conditions, [state.conditions]);

  const debuffs = useMemo(
    () => state.conditions.filter(c => c.category === 'debuff'),
    [state.conditions]
  );

  const buffs = useMemo(
    () => state.conditions.filter(c => c.category === 'buff'),
    [state.conditions]
  );

  const concentration = useMemo(
    () => state.conditions.filter(c => c.category === 'concentration'),
    [state.conditions]
  );

  const hasConcentration = concentration.length > 0;
  const concentrationSpell = concentration[0] || null;
  const activeCount = state.conditions.length;
  const isAtCapacity = activeCount >= MAX_ACTIVE_CONDITIONS;
  const isNearCapacity = activeCount >= CONDITION_WARNING_THRESHOLD;

  // ============================================
  // Core Actions
  // ============================================

  const addCondition = useCallback((input: NewConditionInput): boolean => {
    // Check capacity
    if (state.conditions.length >= MAX_ACTIVE_CONDITIONS) {
      toast({
        title: "Condition Limit Reached",
        description: "Remove a condition before adding more",
        variant: "destructive",
      });
      return false;
    }

    // Check for duplicate - refresh if exists
    const existingIndex = state.conditions.findIndex(
      c => c.conditionId === input.conditionId
    );

    if (existingIndex !== -1) {
      // Refresh existing condition
      setState(prev => ({
        ...prev,
        conditions: prev.conditions.map((c, i) =>
          i === existingIndex
            ? {
                ...c,
                durationValue: input.durationValue,
                durationType: input.durationType,
                roundsElapsed: 0,
                source: input.source ?? c.source,
                appliedAt: Date.now(),
                notes: input.notes ?? c.notes,
              }
            : c
        ),
      }));

      toast({
        title: `${input.name} refreshed`,
        description: formatDuration(input.durationType, input.durationValue),
      });
      return true;
    }

    // Handle concentration - break existing before adding new
    if (input.category === 'concentration') {
      const existingConcentration = state.conditions.find(
        c => c.category === 'concentration'
      );
      if (existingConcentration) {
        // Break concentration first, then add new
        setState(prev => ({
          ...prev,
          conditions: prev.conditions.filter(c => c.category !== 'concentration'),
        }));
        // Notify spellcasting system so it clears concentratingOn
        onConcentrationBroken?.(existingConcentration.name, `Replaced by ${input.name}`);
        toast({
          title: "Concentration Broken",
          description: `${existingConcentration.name} ended - Replaced by ${input.name}`,
          variant: "destructive",
        });
      }
    }

    // Create new condition
    const newCondition: ActiveCondition = {
      id: generateId(),
      conditionId: input.conditionId,
      name: input.name,
      category: input.category,
      severity: input.severity,
      durationType: input.durationType,
      durationValue: input.durationValue,
      roundsElapsed: 0,
      source: input.source,
      saveType: input.saveType,
      saveDC: input.saveDC,
      appliedAt: Date.now(),
      notes: input.notes,
      spellLevel: input.spellLevel,
    };

    setState(prev => ({
      conditions: [...prev.conditions, newCondition],
      recentConditions: [
        input.conditionId,
        ...prev.recentConditions.filter(id => id !== input.conditionId),
      ].slice(0, 5),
    }));

    toast({
      title: `${input.name} applied`,
      description: formatDuration(input.durationType, input.durationValue),
    });

    // Warn if approaching capacity
    if (state.conditions.length >= CONDITION_WARNING_THRESHOLD - 1) {
      toast({
        title: "Many Conditions Active",
        description: "Consider clearing expired conditions",
      });
    }

    return true;
  }, [state.conditions]);

  const removeCondition = useCallback((id: string) => {
    const condition = state.conditions.find(c => c.id === id);
    if (!condition) return;

    // Store in undo buffer
    setUndoBuffer(condition);

    setState(prev => ({
      ...prev,
      conditions: prev.conditions.filter(c => c.id !== id),
    }));

    toast({
      title: `${condition.name} removed`,
      description: "Undo within 5 seconds to restore",
    });
  }, [state.conditions]);

  const updateDuration = useCallback((id: string, newValue: number) => {
    setState(prev => ({
      ...prev,
      conditions: prev.conditions.map(c =>
        c.id === id ? { ...c, durationValue: newValue, roundsElapsed: 0 } : c
      ),
    }));
  }, []);

  const updateNotes = useCallback((id: string, notes: string) => {
    setState(prev => ({
      ...prev,
      conditions: prev.conditions.map(c =>
        c.id === id ? { ...c, notes } : c
      ),
    }));
  }, []);

  // ============================================
  // Turn & Rest Mechanics
  // ============================================

  const endTurn = useCallback((): { expired: string[]; tickedDown: string[] } => {
    const expiredConditions: string[] = [];
    const tickedDownConditions: string[] = [];

    setState(prev => {
      const updatedConditions = prev.conditions
        .map(c => {
          // Handle round-based durations
          if (c.durationType === 'rounds') {
            const newValue = c.durationValue - 1;
            if (newValue <= 0) {
              expiredConditions.push(c.name);
              return null; // Mark for removal
            }
            // Include spell level for concentration spells
            const slotInfo = c.category === 'concentration' && c.spellLevel ? ` [L${c.spellLevel}]` : '';
            tickedDownConditions.push(`${c.name}${slotInfo} (${newValue})`);
            return { ...c, durationValue: newValue };
          }

          // Handle minute-based durations (10 rounds = 1 minute)
          if (c.durationType === 'minutes') {
            const newRoundsElapsed = c.roundsElapsed + 1;
            if (newRoundsElapsed >= ROUNDS_PER_MINUTE) {
              const newValue = c.durationValue - 1;
              if (newValue <= 0) {
                expiredConditions.push(c.name);
                return null; // Mark for removal
              }
              // Include spell level for concentration spells
              const slotInfo = c.category === 'concentration' && c.spellLevel ? ` [L${c.spellLevel}]` : '';
              tickedDownConditions.push(`${c.name}${slotInfo} (${newValue}m)`);
              return { ...c, durationValue: newValue, roundsElapsed: 0 };
            }
            // Don't add to tickedDown for partial minute progress
            return { ...c, roundsElapsed: newRoundsElapsed };
          }

          // save_ends, indefinite, and hours don't tick on end turn
          return c;
        })
        .filter((c): c is ActiveCondition => c !== null);

      return { ...prev, conditions: updatedConditions };
    });

    return { expired: expiredConditions, tickedDown: tickedDownConditions };
  }, []);

  const shortRest = useCallback(() => {
    const clearedConditions: string[] = [];

    setState(prev => {
      const updatedConditions = prev.conditions.filter(c => {
        // Check if this condition clears on short rest
        if (CLEARS_ON_SHORT_REST.includes(c.conditionId)) {
          clearedConditions.push(c.name);
          return false;
        }
        return true;
      });

      return { ...prev, conditions: updatedConditions };
    });

    if (clearedConditions.length > 0) {
      toast({
        title: "Short Rest Complete",
        description: `Cleared: ${clearedConditions.join(', ')}`,
      });
    } else {
      toast({
        title: "Short Rest Complete",
        description: "Conditions unchanged",
      });
    }
  }, []);

  const longRest = useCallback(() => {
    const clearedConditions: string[] = [];

    setState(prev => {
      const updatedConditions = prev.conditions.filter(c => {
        // Never auto-clear certain conditions
        if (NEVER_AUTO_CLEAR.includes(c.conditionId)) {
          return true;
        }

        // Clear concentration effects
        if (c.category === 'concentration') {
          clearedConditions.push(c.name);
          return false;
        }

        // Clear most temporary conditions
        if (
          c.durationType === 'minutes' ||
          c.durationType === 'hours' ||
          c.durationType === 'rounds' ||
          CLEARS_ON_LONG_REST.includes(c.conditionId)
        ) {
          clearedConditions.push(c.name);
          return false;
        }

        return true;
      });

      return { ...prev, conditions: updatedConditions };
    });

    if (clearedConditions.length > 0) {
      toast({
        title: "Long Rest Complete",
        description: `Cleared: ${clearedConditions.join(', ')}`,
      });
    } else {
      toast({
        title: "Long Rest Complete",
        description: "All temporary conditions cleared",
      });
    }
  }, []);

  // ============================================
  // Concentration
  // ============================================

  const breakConcentration = useCallback((reason?: string) => {
    const concentrationSpells = state.conditions.filter(
      c => c.category === 'concentration'
    );

    if (concentrationSpells.length === 0) return;

    const spellNames = concentrationSpells.map(c => c.name).join(', ');

    setState(prev => ({
      ...prev,
      conditions: prev.conditions.filter(c => c.category !== 'concentration'),
    }));

    // Notify spellcasting system to sync concentration state
    concentrationSpells.forEach(spell => {
      onConcentrationBroken?.(spell.name, reason);
    });

    toast({
      title: "Concentration Broken",
      description: reason
        ? `${spellNames} ended - ${reason}`
        : `${spellNames} ended`,
      variant: "destructive",
    });
  }, [state.conditions, onConcentrationBroken]);

  // ============================================
  // Undo Support
  // ============================================

  const undoRemove = useCallback(() => {
    if (undoBuffer) {
      setState(prev => ({
        ...prev,
        conditions: [...prev.conditions, undoBuffer],
      }));
      toast({
        title: `${undoBuffer.name} restored`,
      });
      setUndoBuffer(null);
    }
  }, [undoBuffer]);

  const clearUndo = useCallback(() => {
    setUndoBuffer(null);
  }, []);

  // ============================================
  // Utility
  // ============================================

  const clearAll = useCallback(() => {
    setState(DEFAULT_STATE);
    toast({
      title: "All Conditions Cleared",
    });
  }, []);

  const getConditionByIdFn = useCallback(
    (id: string) => state.conditions.find(c => c.id === id),
    [state.conditions]
  );

  return {
    // State
    conditions: state.conditions,
    recentConditions: state.recentConditions,

    // Computed
    allActive,
    debuffs,
    buffs,
    concentration,
    hasConcentration,
    concentrationSpell,
    activeCount,
    isAtCapacity,
    isNearCapacity,

    // Actions
    addCondition,
    removeCondition,
    updateDuration,
    updateNotes,

    // Turn & Rest mechanics
    endTurn,
    shortRest,
    longRest,

    // Concentration
    breakConcentration,

    // Undo support
    undoBuffer,
    undoRemove,
    clearUndo,

    // Utility
    clearAll,
    getConditionById: getConditionByIdFn,
  };
}

// Export type for context usage
export type ConditionsSystem = UseConditionsReturn;
