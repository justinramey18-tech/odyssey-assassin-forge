import { useState, useCallback, useEffect, useRef } from 'react';
import { getScopedItem, setScopedItem } from '@/lib/scoped-storage';
import {
  AbilityCustomizationState,
  AbilityOverride,
  HomebrewAbility,
  DEFAULT_CUSTOMIZATION_STATE,
} from '@/lib/abilityCustomization/types';
import { generateHomebrewId } from '@/lib/abilityCustomization/utils';

const STORAGE_KEY = 'odyssey-ability-customization';
const CHANGE_EVENT = 'odyssey-ability-customization-changed';

/**
 * Hook for managing per-character ability customizations
 * Provides CRUD operations for overrides and homebrew abilities
 */
export function useAbilityCustomization() {
  const instanceId = useRef(Math.random().toString(36).slice(2));
  const [state, setState] = useState<AbilityCustomizationState>(() => {
    try {
      const saved = getScopedItem(STORAGE_KEY);
      if (saved) {
        return { ...DEFAULT_CUSTOMIZATION_STATE, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error('[AbilityCustomization] Failed to load:', e);
    }
    return DEFAULT_CUSTOMIZATION_STATE;
  });

  // Persist to localStorage and tell every other mounted instance to re-read,
  // so a homebrew ability created in Settings is instantly known to the DM
  // context / quick actions (otherwise they show the raw homebrew_<id>).
  const isFirstPersist = useRef(true);
  useEffect(() => {
    try {
      setScopedItem(STORAGE_KEY, JSON.stringify(state));
      if (isFirstPersist.current) {
        isFirstPersist.current = false;
        return;
      }
      window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { source: instanceId.current } }));
    } catch (e) {
      console.error('[AbilityCustomization] Failed to save:', e);
    }
  }, [state]);

  // Re-init when character is switched in-memory, or when another instance edits
  useEffect(() => {
    const reload = () => {
      try {
        const saved = getScopedItem(STORAGE_KEY);
        setState(saved ? { ...DEFAULT_CUSTOMIZATION_STATE, ...JSON.parse(saved) } : DEFAULT_CUSTOMIZATION_STATE);
      } catch { setState(DEFAULT_CUSTOMIZATION_STATE); }
    };
    const handleChanged = (e: Event) => {
      const src = (e as CustomEvent<{ source?: string }>).detail?.source;
      if (src === instanceId.current) return;
      reload();
    };
    window.addEventListener('odyssey-character-loaded', reload);
    window.addEventListener(CHANGE_EVENT, handleChanged as EventListener);
    return () => {
      window.removeEventListener('odyssey-character-loaded', reload);
      window.removeEventListener(CHANGE_EVENT, handleChanged as EventListener);
    };
  }, []);


  // ═══════════════════════════════════════════════════════════════
  // OVERRIDE OPERATIONS
  // ═══════════════════════════════════════════════════════════════

  const getOverride = useCallback((abilityId: string): AbilityOverride | undefined => {
    return state.overrides[abilityId];
  }, [state.overrides]);

  const setOverride = useCallback((override: AbilityOverride) => {
    setState(prev => ({
      ...prev,
      overrides: {
        ...prev.overrides,
        [override.abilityId]: {
          ...override,
          updatedAt: Date.now(),
        },
      },
    }));
  }, []);

  const updateOverride = useCallback((
    abilityId: string,
    updates: Partial<Omit<AbilityOverride, 'abilityId' | 'createdAt' | 'updatedAt'>>
  ) => {
    setState(prev => {
      const existing = prev.overrides[abilityId];
      const now = Date.now();
      
      return {
        ...prev,
        overrides: {
          ...prev.overrides,
          [abilityId]: {
            abilityId,
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
            ...existing,
            ...updates,
          },
        },
      };
    });
  }, []);

  const removeOverride = useCallback((abilityId: string) => {
    setState(prev => {
      const { [abilityId]: removed, ...rest } = prev.overrides;
      return { ...prev, overrides: rest };
    });
  }, []);

  const clearAllOverrides = useCallback(() => {
    setState(prev => ({ ...prev, overrides: {} }));
  }, []);

  // ═══════════════════════════════════════════════════════════════
  // HOMEBREW OPERATIONS
  // ═══════════════════════════════════════════════════════════════

  const getHomebrew = useCallback((id: string): HomebrewAbility | undefined => {
    return state.homebrewAbilities.find(h => h.id === id);
  }, [state.homebrewAbilities]);

  const addHomebrew = useCallback((
    homebrew: Omit<HomebrewAbility, 'id' | 'createdAt' | 'updatedAt'>
  ): string => {
    const id = generateHomebrewId();
    const now = Date.now();
    
    setState(prev => ({
      ...prev,
      homebrewAbilities: [
        ...prev.homebrewAbilities,
        { ...homebrew, id, createdAt: now, updatedAt: now },
      ],
    }));
    
    return id;
  }, []);

  const updateHomebrew = useCallback((
    id: string,
    updates: Partial<Omit<HomebrewAbility, 'id' | 'createdAt' | 'updatedAt'>>
  ) => {
    setState(prev => ({
      ...prev,
      homebrewAbilities: prev.homebrewAbilities.map(h =>
        h.id === id
          ? { ...h, ...updates, updatedAt: Date.now() }
          : h
      ),
    }));
  }, []);

  const removeHomebrew = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      homebrewAbilities: prev.homebrewAbilities.filter(h => h.id !== id),
    }));
  }, []);

  const clearAllHomebrew = useCallback(() => {
    setState(prev => ({ ...prev, homebrewAbilities: [] }));
  }, []);

  // ═══════════════════════════════════════════════════════════════
  // UTILITY
  // ═══════════════════════════════════════════════════════════════

  const hasAnyCustomizations = state.homebrewAbilities.length > 0 || 
    Object.keys(state.overrides).length > 0;

  const resetAll = useCallback(() => {
    setState(DEFAULT_CUSTOMIZATION_STATE);
  }, []);

  return {
    // State
    state,
    hasAnyCustomizations,
    
    // Override operations
    getOverride,
    setOverride,
    updateOverride,
    removeOverride,
    clearAllOverrides,
    
    // Homebrew operations
    getHomebrew,
    addHomebrew,
    updateHomebrew,
    removeHomebrew,
    clearAllHomebrew,
    
    // Reset
    resetAll,
  };
}

export type UseAbilityCustomizationReturn = ReturnType<typeof useAbilityCustomization>;
