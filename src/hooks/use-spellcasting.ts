import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  SpellcastingState,
  MagicPath,
  SpellcastingAbility,
  SpellSlotLevel,
  PactSlots,
  getSlotsForLevel,
  getPactSlotsForLevel,
  getSpellAttackBonus,
  getSpellSaveDC,
} from '@/lib/magic/types';
import { getPathConfig, getPathProgression } from '@/lib/magic/paths';
import { useToast } from '@/hooks/use-toast';

// ============================================
// LOCAL STORAGE KEY
// ============================================

const STORAGE_KEY = 'odyssey-spellcasting';

// ============================================
// DEFAULT STATE
// ============================================

function getDefaultState(): SpellcastingState {
  return {
    path: null,
    pathUnlocked: false,
    knownSpells: [],
    preparedSpells: [],
    favoriteSpells: [],
    spellSlots: {},
    pactSlots: undefined,
    spellcastingAbility: 'INT',
    abilityModifier: 0,
    proficiencyBonus: 2,
    materialComponents: {},
    focusEquipped: false,
    concentratingOn: null,
    concentrationStartTime: undefined,
    ritualCastingActive: false,
    spellsCastToday: 0,
    totalSpellsCast: 0,
  };
}

// ============================================
// LOAD/SAVE FUNCTIONS
// ============================================

function loadState(): SpellcastingState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...getDefaultState(), ...parsed };
    }
  } catch (e) {
    console.error('[Spellcasting] Failed to load state:', e);
  }
  return getDefaultState();
}

function saveState(state: SpellcastingState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('[Spellcasting] Failed to save state:', e);
  }
}

// ============================================
// HOOK
// ============================================

export interface UseSpellcastingReturn {
  // State
  state: SpellcastingState;
  
  // Derived values
  spellAttackBonus: number;
  spellSaveDC: number;
  hasPath: boolean;
  isPathUnlocked: boolean;
  totalSlotsRemaining: number;
  
  // Path management
  selectPath: (path: MagicPath) => void;
  unlockPath: () => void;
  
  // Spell management
  learnSpell: (spellId: string) => void;
  forgetSpell: (spellId: string) => void;
  prepareSpell: (spellId: string) => void;
  unprepareSpell: (spellId: string) => void;
  toggleFavorite: (spellId: string) => void;
  
  // Slot management
  useSlot: (level: number) => boolean;
  restoreSlot: (level: number) => void;
  usePactSlot: () => boolean;
  restorePactSlot: () => void;
  
  // Concentration
  startConcentration: (spellId: string) => void;
  breakConcentration: () => void;
  
  // Component management
  addComponent: (componentId: string, quantity: number) => void;
  useComponent: (componentId: string, quantity: number) => boolean;
  toggleFocus: () => void;
  
  // Rest recovery
  onShortRest: () => void;
  onLongRest: () => void;
  
  // Stats update
  updateAbilityModifier: (mod: number) => void;
  updateProficiencyBonus: (bonus: number) => void;
  
  // Full reset
  resetSpellcasting: () => void;
  
  // Refresh slots for level changes
  refreshSlotsForLevel: (characterLevel: number) => void;
}

export function useSpellcasting(characterLevel: number): UseSpellcastingReturn {
  const [state, setState] = useState<SpellcastingState>(loadState);
  const { toast } = useToast();

  // Persist state changes
  useEffect(() => {
    saveState(state);
  }, [state]);

  // Derived calculations
  const spellAttackBonus = useMemo(() => 
    getSpellAttackBonus(state.abilityModifier, state.proficiencyBonus),
    [state.abilityModifier, state.proficiencyBonus]
  );

  const spellSaveDC = useMemo(() => 
    getSpellSaveDC(state.abilityModifier, state.proficiencyBonus),
    [state.abilityModifier, state.proficiencyBonus]
  );

  const hasPath = state.path !== null;
  const isPathUnlocked = state.pathUnlocked;

  const totalSlotsRemaining = useMemo(() => {
    let total = 0;
    for (const slot of Object.values(state.spellSlots)) {
      total += slot.current;
    }
    if (state.pactSlots) {
      total += state.pactSlots.current;
    }
    return total;
  }, [state.spellSlots, state.pactSlots]);

  // ============================================
  // PATH MANAGEMENT
  // ============================================

  const selectPath = useCallback((path: MagicPath) => {
    const pathConfig = getPathConfig(path);
    const progression = getPathProgression(path);
    
    const slots = getSlotsForLevel(characterLevel, progression);
    const pactSlots = progression === 'pact' 
      ? getPactSlotsForLevel(characterLevel) 
      : undefined;

    setState(prev => ({
      ...prev,
      path,
      pathUnlocked: true,
      spellcastingAbility: pathConfig.spellcastingAbility,
      spellSlots: slots,
      pactSlots,
    }));

    toast({
      title: `✨ ${pathConfig.name} Unlocked`,
      description: pathConfig.flavorText,
      className: 'border-indigo-500 bg-indigo-500/10',
    });
  }, [characterLevel, toast]);

  const unlockPath = useCallback(() => {
    setState(prev => ({ ...prev, pathUnlocked: true }));
  }, []);

  // ============================================
  // SPELL MANAGEMENT
  // ============================================

  const learnSpell = useCallback((spellId: string) => {
    setState(prev => {
      if (prev.knownSpells.includes(spellId)) return prev;
      return { ...prev, knownSpells: [...prev.knownSpells, spellId] };
    });
  }, []);

  const forgetSpell = useCallback((spellId: string) => {
    setState(prev => ({
      ...prev,
      knownSpells: prev.knownSpells.filter(id => id !== spellId),
      preparedSpells: prev.preparedSpells.filter(id => id !== spellId),
      favoriteSpells: prev.favoriteSpells.filter(id => id !== spellId),
    }));
  }, []);

  const prepareSpell = useCallback((spellId: string) => {
    setState(prev => {
      if (prev.preparedSpells.includes(spellId)) return prev;
      return { ...prev, preparedSpells: [...prev.preparedSpells, spellId] };
    });
  }, []);

  const unprepareSpell = useCallback((spellId: string) => {
    setState(prev => ({
      ...prev,
      preparedSpells: prev.preparedSpells.filter(id => id !== spellId),
    }));
  }, []);

  const toggleFavorite = useCallback((spellId: string) => {
    setState(prev => {
      if (prev.favoriteSpells.includes(spellId)) {
        return { ...prev, favoriteSpells: prev.favoriteSpells.filter(id => id !== spellId) };
      }
      return { ...prev, favoriteSpells: [...prev.favoriteSpells, spellId] };
    });
  }, []);

  // ============================================
  // SLOT MANAGEMENT
  // ============================================

  const useSlot = useCallback((level: number): boolean => {
    const slot = state.spellSlots[level];
    if (!slot || slot.current <= 0) {
      toast({
        title: 'No Slots Available',
        description: `No ${level}${level === 1 ? 'st' : level === 2 ? 'nd' : level === 3 ? 'rd' : 'th'}-level slots remaining.`,
        variant: 'destructive',
      });
      return false;
    }

    setState(prev => ({
      ...prev,
      spellSlots: {
        ...prev.spellSlots,
        [level]: { ...prev.spellSlots[level], current: prev.spellSlots[level].current - 1 },
      },
      spellsCastToday: prev.spellsCastToday + 1,
      totalSpellsCast: prev.totalSpellsCast + 1,
    }));
    return true;
  }, [state.spellSlots, toast]);

  const restoreSlot = useCallback((level: number) => {
    setState(prev => {
      const slot = prev.spellSlots[level];
      if (!slot || slot.current >= slot.max) return prev;
      return {
        ...prev,
        spellSlots: {
          ...prev.spellSlots,
          [level]: { ...slot, current: slot.current + 1 },
        },
      };
    });
  }, []);

  const usePactSlot = useCallback((): boolean => {
    if (!state.pactSlots || state.pactSlots.current <= 0) {
      toast({
        title: 'No Pact Slots',
        description: 'No pact magic slots remaining.',
        variant: 'destructive',
      });
      return false;
    }

    setState(prev => ({
      ...prev,
      pactSlots: prev.pactSlots 
        ? { ...prev.pactSlots, current: prev.pactSlots.current - 1 }
        : undefined,
      spellsCastToday: prev.spellsCastToday + 1,
      totalSpellsCast: prev.totalSpellsCast + 1,
    }));
    return true;
  }, [state.pactSlots, toast]);

  const restorePactSlot = useCallback(() => {
    setState(prev => {
      if (!prev.pactSlots || prev.pactSlots.current >= prev.pactSlots.max) return prev;
      return {
        ...prev,
        pactSlots: { ...prev.pactSlots, current: prev.pactSlots.current + 1 },
      };
    });
  }, []);

  // ============================================
  // CONCENTRATION
  // ============================================

  const startConcentration = useCallback((spellId: string) => {
    // If already concentrating, break the old spell
    if (state.concentratingOn) {
      toast({
        title: 'Concentration Broken',
        description: 'Your previous concentration spell has ended.',
        className: 'border-amber-500 bg-amber-500/10',
      });
    }

    setState(prev => ({
      ...prev,
      concentratingOn: spellId,
      concentrationStartTime: Date.now(),
    }));
  }, [state.concentratingOn, toast]);

  const breakConcentration = useCallback(() => {
    if (state.concentratingOn) {
      toast({
        title: 'Concentration Ended',
        description: 'Your concentration spell has ended.',
      });
    }

    setState(prev => ({
      ...prev,
      concentratingOn: null,
      concentrationStartTime: undefined,
    }));
  }, [state.concentratingOn, toast]);

  // ============================================
  // COMPONENTS
  // ============================================

  const addComponent = useCallback((componentId: string, quantity: number) => {
    setState(prev => ({
      ...prev,
      materialComponents: {
        ...prev.materialComponents,
        [componentId]: (prev.materialComponents[componentId] || 0) + quantity,
      },
    }));
  }, []);

  const useComponent = useCallback((componentId: string, quantity: number): boolean => {
    const current = state.materialComponents[componentId] || 0;
    if (current < quantity) {
      toast({
        title: 'Insufficient Components',
        description: `You need ${quantity} but only have ${current}.`,
        variant: 'destructive',
      });
      return false;
    }

    setState(prev => ({
      ...prev,
      materialComponents: {
        ...prev.materialComponents,
        [componentId]: current - quantity,
      },
    }));
    return true;
  }, [state.materialComponents, toast]);

  const toggleFocus = useCallback(() => {
    setState(prev => ({ ...prev, focusEquipped: !prev.focusEquipped }));
  }, []);

  // ============================================
  // REST RECOVERY
  // ============================================

  const onShortRest = useCallback(() => {
    // Pact slots recover on short rest
    setState(prev => {
      if (!prev.pactSlots) return prev;
      
      const restored = prev.pactSlots.max - prev.pactSlots.current;
      if (restored > 0) {
        toast({
          title: '🌙 Pact Magic Restored',
          description: `${restored} pact slot${restored > 1 ? 's' : ''} recovered.`,
          className: 'border-violet-500 bg-violet-500/10',
        });
      }

      return {
        ...prev,
        pactSlots: { ...prev.pactSlots, current: prev.pactSlots.max },
      };
    });
  }, [toast]);

  const onLongRest = useCallback(() => {
    setState(prev => {
      // Restore all spell slots to max
      const restoredSlots: Record<number, SpellSlotLevel> = {};
      for (const [level, slot] of Object.entries(prev.spellSlots)) {
        restoredSlots[parseInt(level)] = { ...slot, current: slot.max };
      }

      // Restore pact slots
      const restoredPact = prev.pactSlots 
        ? { ...prev.pactSlots, current: prev.pactSlots.max }
        : undefined;

      toast({
        title: '☀️ Arcane Reserves Restored',
        description: 'All spell slots have been recovered.',
        className: 'border-indigo-500 bg-indigo-500/10',
      });

      return {
        ...prev,
        spellSlots: restoredSlots,
        pactSlots: restoredPact,
        spellsCastToday: 0,
        concentratingOn: null,
        concentrationStartTime: undefined,
      };
    });
  }, [toast]);

  // ============================================
  // STATS UPDATE
  // ============================================

  const updateAbilityModifier = useCallback((mod: number) => {
    setState(prev => ({ ...prev, abilityModifier: mod }));
  }, []);

  const updateProficiencyBonus = useCallback((bonus: number) => {
    setState(prev => ({ ...prev, proficiencyBonus: bonus }));
  }, []);

  // ============================================
  // RESET
  // ============================================

  const resetSpellcasting = useCallback(() => {
    const defaultState = getDefaultState();
    setState(defaultState);
    localStorage.removeItem(STORAGE_KEY);
    toast({
      title: 'Magic System Reset',
      description: 'All spellcasting data has been cleared.',
    });
  }, [toast]);

  // ============================================
  // LEVEL CHANGE
  // ============================================

  const refreshSlotsForLevel = useCallback((newLevel: number) => {
    if (!state.path) return;

    const progression = getPathProgression(state.path);
    const newSlots = getSlotsForLevel(newLevel, progression);
    const newPactSlots = progression === 'pact' 
      ? getPactSlotsForLevel(newLevel) 
      : undefined;

    setState(prev => ({
      ...prev,
      spellSlots: newSlots,
      pactSlots: newPactSlots,
    }));
  }, [state.path]);

  return {
    state,
    spellAttackBonus,
    spellSaveDC,
    hasPath,
    isPathUnlocked,
    totalSlotsRemaining,
    selectPath,
    unlockPath,
    learnSpell,
    forgetSpell,
    prepareSpell,
    unprepareSpell,
    toggleFavorite,
    useSlot,
    restoreSlot,
    usePactSlot,
    restorePactSlot,
    startConcentration,
    breakConcentration,
    addComponent,
    useComponent,
    toggleFocus,
    onShortRest,
    onLongRest,
    updateAbilityModifier,
    updateProficiencyBonus,
    resetSpellcasting,
    refreshSlotsForLevel,
  };
}
