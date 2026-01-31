import { useEffect, useRef, useCallback } from 'react';
import { UseSpellcastingReturn } from './use-spellcasting';
import { getSpellById } from '@/lib/magic/spells';
import { ActiveCondition, DurationType } from '@/lib/conditions/types';

interface UseConcentrationSyncOptions {
  spellcasting: UseSpellcastingReturn | undefined;
  addCondition: (params: {
    conditionId: string;
    name?: string;
    source?: string;
    durationType: DurationType;
    durationValue: number;
    isConcentration?: boolean;
    notes?: string;
  }) => ActiveCondition;
  removeCondition: (id: string, recordInHistory?: boolean) => void;
  allActiveConditions: ActiveCondition[];
}

/**
 * Syncs concentration state between the spellcasting system and condition tracker.
 * When a concentration spell is cast, it automatically adds a "Concentrating" buff.
 * When concentration ends in either system, both stay in sync.
 */
export function useConcentrationSync({
  spellcasting,
  addCondition,
  removeCondition,
  allActiveConditions,
}: UseConcentrationSyncOptions) {
  const lastConcentratingOn = useRef<string | null>(null);
  const concentrationConditionId = useRef<string | null>(null);

  // Find existing concentration condition
  const existingConcentration = allActiveConditions.find(
    c => c.conditionId === 'concentrating' && c.isConcentration
  );

  // Sync spellcasting concentration -> conditions
  useEffect(() => {
    if (!spellcasting) return;

    const currentConcentrating = spellcasting.state.concentratingOn;

    // Started concentrating on a new spell
    if (currentConcentrating && currentConcentrating !== lastConcentratingOn.current) {
      const spell = getSpellById(currentConcentrating);
      
      // Remove old concentration condition if exists
      if (concentrationConditionId.current && existingConcentration) {
        removeCondition(concentrationConditionId.current, false);
      }

      // Add new concentration condition
      if (spell) {
        // Parse duration from spell (e.g., "1 minute" -> minutes: 1)
        const durationInfo = parseSpellDuration(spell.duration);
        
        const newCondition = addCondition({
          conditionId: 'concentrating',
          name: `Concentrating: ${spell.name}`,
          source: spell.name,
          durationType: durationInfo.type,
          durationValue: durationInfo.value,
          isConcentration: true,
          notes: `Maintaining ${spell.name}. DC = max(10, damage/2) on hit.`,
        });

        concentrationConditionId.current = newCondition.id;
      }
    }
    // Stopped concentrating
    else if (!currentConcentrating && lastConcentratingOn.current) {
      if (concentrationConditionId.current) {
        removeCondition(concentrationConditionId.current, true);
        concentrationConditionId.current = null;
      }
    }

    lastConcentratingOn.current = currentConcentrating;
  }, [spellcasting?.state.concentratingOn, addCondition, removeCondition, existingConcentration, spellcasting]);

  // Sync conditions -> spellcasting (if concentration removed from conditions board)
  useEffect(() => {
    if (!spellcasting) return;

    // If spellcasting thinks we're concentrating but there's no matching condition
    if (spellcasting.state.concentratingOn && !existingConcentration) {
      // Check if we had a tracked condition that was removed
      if (concentrationConditionId.current && lastConcentratingOn.current === spellcasting.state.concentratingOn) {
        // Condition was manually removed - break concentration in spellcasting too
        spellcasting.breakConcentration();
        concentrationConditionId.current = null;
      }
    }
  }, [existingConcentration, spellcasting]);

  // Helper to break concentration from either system
  const breakConcentration = useCallback(() => {
    if (spellcasting?.state.concentratingOn) {
      spellcasting.breakConcentration();
    }
    if (concentrationConditionId.current) {
      removeCondition(concentrationConditionId.current, true);
      concentrationConditionId.current = null;
    }
  }, [spellcasting, removeCondition]);

  // Get current concentration info for display
  const concentrationInfo = spellcasting?.state.concentratingOn
    ? {
        spellId: spellcasting.state.concentratingOn,
        spell: getSpellById(spellcasting.state.concentratingOn),
        condition: existingConcentration,
      }
    : null;

  return {
    isConcentrating: !!spellcasting?.state.concentratingOn,
    concentrationInfo,
    breakConcentration,
    concentrationConditionId: concentrationConditionId.current,
  };
}

// Parse spell duration string to condition duration
function parseSpellDuration(durationStr: string): { type: DurationType; value: number } {
  const lower = durationStr.toLowerCase();
  
  // Check for common patterns
  const roundsMatch = lower.match(/(\d+)\s*round/);
  if (roundsMatch) {
    return { type: 'rounds', value: parseInt(roundsMatch[1]) };
  }
  
  const minutesMatch = lower.match(/(\d+)\s*minute/);
  if (minutesMatch) {
    return { type: 'minutes', value: parseInt(minutesMatch[1]) };
  }
  
  const hoursMatch = lower.match(/(\d+)\s*hour/);
  if (hoursMatch) {
    return { type: 'hours', value: parseInt(hoursMatch[1]) };
  }
  
  // "Up to X" patterns
  if (lower.includes('up to 1 minute')) return { type: 'minutes', value: 1 };
  if (lower.includes('up to 10 minutes')) return { type: 'minutes', value: 10 };
  if (lower.includes('up to 1 hour')) return { type: 'hours', value: 1 };
  if (lower.includes('up to 8 hours')) return { type: 'hours', value: 8 };
  
  // Default to 10 rounds (1 minute) if can't parse
  return { type: 'rounds', value: 10 };
}
