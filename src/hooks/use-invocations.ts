// Warlock Invocations State Management Hook
// Manages selected invocations with localStorage persistence

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  EldritchInvocation,
  ALL_INVOCATIONS,
  getAvailableInvocations,
  getMaxInvocations,
  meetsPrerequisite,
} from '@/lib/classes/invocations';

const STORAGE_KEY = 'dnd-warlock-invocations';
const PACT_BOON_KEY = 'dnd-warlock-pact-boon';

export type PactBoon = 'blade' | 'chain' | 'tome' | null;

interface InvocationState {
  selectedIds: string[];
  pactBoon: PactBoon;
}

function loadState(): InvocationState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const pact = localStorage.getItem(PACT_BOON_KEY) as PactBoon;
    if (stored) {
      return { selectedIds: JSON.parse(stored), pactBoon: pact };
    }
  } catch (e) {
    console.error('[Invocations] Failed to load:', e);
  }
  return { selectedIds: [], pactBoon: null };
}

function saveState(state: InvocationState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.selectedIds));
    if (state.pactBoon) {
      localStorage.setItem(PACT_BOON_KEY, state.pactBoon);
    } else {
      localStorage.removeItem(PACT_BOON_KEY);
    }
  } catch (e) {
    console.error('[Invocations] Failed to save:', e);
  }
}

export interface UseInvocationsReturn {
  /** Currently selected invocation IDs */
  selectedIds: string[];
  /** Full invocation objects for selected invocations */
  selectedInvocations: EldritchInvocation[];
  /** Invocations available at current level */
  availableInvocations: EldritchInvocation[];
  /** Max invocations allowed at current level */
  maxInvocations: number;
  /** How many slots remaining */
  slotsRemaining: number;
  /** Current pact boon selection */
  pactBoon: PactBoon;
  /** Whether an invocation can be selected (meets prereqs & level) */
  canSelect: (invocation: EldritchInvocation) => boolean;
  /** Whether an invocation is currently selected */
  isSelected: (id: string) => boolean;
  /** Toggle an invocation on/off */
  toggleInvocation: (id: string) => void;
  /** Set pact boon */
  setPactBoon: (boon: PactBoon) => void;
  /** Get active Eldritch Blast modifications */
  eldritchBlastMods: EldritchInvocation[];
  /** Get at-will spells granted */
  atWillSpells: EldritchInvocation[];
  /** Get passive benefits */
  passiveBenefits: EldritchInvocation[];
  /** Reset all invocations */
  resetInvocations: () => void;
}

export function useInvocations(
  warlockLevel: number,
  hasEldritchBlast: boolean = true,
): UseInvocationsReturn {
  const [state, setState] = useState<InvocationState>(loadState);
  const { toast } = useToast();

  // Persist on change
  useEffect(() => {
    saveState(state);
  }, [state]);

  const maxInvocations = useMemo(() => getMaxInvocations(warlockLevel), [warlockLevel]);

  const availableInvocations = useMemo(
    () => getAvailableInvocations(warlockLevel),
    [warlockLevel]
  );

  const selectedInvocations = useMemo(
    () => ALL_INVOCATIONS.filter(inv => state.selectedIds.includes(inv.id)),
    [state.selectedIds]
  );

  const canSelect = useCallback((invocation: EldritchInvocation): boolean => {
    if (warlockLevel < invocation.levelRequirement) return false;
    return meetsPrerequisite(invocation, {
      hasEldritchBlast,
      pactBoon: state.pactBoon,
      hasHex: true, // Assume hex is available
    });
  }, [warlockLevel, hasEldritchBlast, state.pactBoon]);

  const isSelected = useCallback((id: string): boolean => {
    return state.selectedIds.includes(id);
  }, [state.selectedIds]);

  const toggleInvocation = useCallback((id: string) => {
    setState(prev => {
      if (prev.selectedIds.includes(id)) {
        // Remove
        return { ...prev, selectedIds: prev.selectedIds.filter(i => i !== id) };
      }
      // Add - check max
      if (prev.selectedIds.length >= maxInvocations) {
        toast({
          title: 'Invocation Limit Reached',
          description: `You can only know ${maxInvocations} invocations at level ${warlockLevel}.`,
          variant: 'destructive',
        });
        return prev;
      }
      // Check prerequisites
      const inv = ALL_INVOCATIONS.find(i => i.id === id);
      if (inv && !meetsPrerequisite(inv, { hasEldritchBlast, pactBoon: prev.pactBoon, hasHex: true })) {
        toast({
          title: 'Prerequisite Not Met',
          description: `${inv.name} requires: ${inv.prerequisite}`,
          variant: 'destructive',
        });
        return prev;
      }
      return { ...prev, selectedIds: [...prev.selectedIds, id] };
    });
  }, [maxInvocations, warlockLevel, hasEldritchBlast, toast]);

  const setPactBoon = useCallback((boon: PactBoon) => {
    setState(prev => ({ ...prev, pactBoon: boon }));
  }, []);

  const eldritchBlastMods = useMemo(
    () => selectedInvocations.filter(inv => inv.category === 'eldritch_blast'),
    [selectedInvocations]
  );

  const atWillSpells = useMemo(
    () => selectedInvocations.filter(inv => inv.category === 'at_will_spell'),
    [selectedInvocations]
  );

  const passiveBenefits = useMemo(
    () => selectedInvocations.filter(inv => inv.category === 'passive' || inv.category === 'pact_boon'),
    [selectedInvocations]
  );

  const resetInvocations = useCallback(() => {
    setState({ selectedIds: [], pactBoon: null });
  }, []);

  return {
    selectedIds: state.selectedIds,
    selectedInvocations,
    availableInvocations,
    maxInvocations,
    slotsRemaining: maxInvocations - state.selectedIds.length,
    pactBoon: state.pactBoon,
    canSelect,
    isSelected,
    toggleInvocation,
    setPactBoon,
    eldritchBlastMods,
    atWillSpells,
    passiveBenefits,
    resetInvocations,
  };
}
