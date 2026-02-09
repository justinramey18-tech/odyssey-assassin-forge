// Class-Based Spellcasting Hook
// For full caster classes (Wizard, Sorcerer, Cleric, Druid, Bard) and Warlock
// Separate from MagicPath system used by Rogues

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { DnDClass, ClassLevelMap, CLASS_REGISTRY, FULL_CASTER_CLASSES } from '@/lib/classes';
import { SpellSlotsByLevel } from '@/lib/magic/fullCasterSlots';
import { PactSlots as PactSlotsConfig } from '@/lib/magic/pactMagicSlots';
import { 
  getMulticlassSpellSlots, 
  getMulticlassMaxSpellLevel,
  hasSpellcasting,
  MulticlassSpellSlots 
} from '@/lib/magic/multiclassSlots';
import { getSpellById } from '@/lib/magic/spells';
import { 
  getProficiencyBonus, 
  scaleCantrip,
  getConcentrationCheckDC,
} from '@/lib/magic/calculations';
import {
  ActiveSpellEffect,
  createActiveSpellEffect,
  filterActiveSpells,
  getExpiredSpells,
} from '@/lib/magic/durations';
import { useToast } from '@/hooks/use-toast';

// Runtime pact slot tracking (current/max)
export interface TrackedPactSlots {
  current: number;
  max: number;
  level: number;
}

// Runtime spell slot tracking per level (current/max for each level)
export interface TrackedSpellSlot {
  current: number;
  max: number;
}

export type TrackedSpellSlots = Record<number, TrackedSpellSlot>;

// ============================================
// STORAGE KEYS
// ============================================

const CLASS_SPELLCASTING_KEY = 'odyssey-class-spellcasting';
const CLASS_ACTIVE_SPELLS_KEY = 'odyssey-class-active-spells';

// ============================================
// HELPERS
// ============================================

/**
 * Convert PactSlotsConfig to TrackedPactSlots for runtime tracking
 */
function toTrackedPactSlots(config: PactSlotsConfig | null): TrackedPactSlots | null {
  if (!config) return null;
  return {
    current: config.slotCount,
    max: config.slotCount,
    level: config.slotLevel,
  };
}

/**
 * Convert SpellSlotsByLevel to TrackedSpellSlots for runtime tracking
 */
function toTrackedSpellSlots(slots: SpellSlotsByLevel): TrackedSpellSlots {
  const tracked: TrackedSpellSlots = {};
  for (let level = 1; level <= 9; level++) {
    const count = slots[level as keyof SpellSlotsByLevel];
    if (count !== undefined && count > 0) {
      tracked[level] = { current: count, max: count };
    }
  }
  return tracked;
}

// ============================================
// TYPES
// ============================================

export interface ClassSpellcastingState {
  /** Known spells (for known-spell casters like Sorcerer, Bard) */
  knownSpells: string[];
  /** Prepared spells (for prepared casters like Wizard, Cleric, Druid) */
  preparedSpells: string[];
  /** Favorite/pinned spells for quick access */
  favoriteSpells: string[];
  /** Regular spell slots (from combined caster level) */
  spellSlots: TrackedSpellSlots;
  /** Warlock pact slots (separate from regular slots) */
  pactSlots: TrackedPactSlots | null;
  /** Current ability modifier for spellcasting */
  abilityModifier: number;
  /** Proficiency bonus */
  proficiencyBonus: number;
  /** Material component inventory */
  materialComponents: Record<string, number>;
  /** Whether an arcane focus is equipped */
  focusEquipped: boolean;
  /** Currently concentrating on spell ID */
  concentratingOn: string | null;
  /** When concentration started */
  concentrationStartTime?: number;
  /** Stats tracking */
  spellsCastToday: number;
  totalSpellsCast: number;
}

// ============================================
// DEFAULT STATE
// ============================================

function getDefaultClassSpellcastingState(): ClassSpellcastingState {
  return {
    knownSpells: [],
    preparedSpells: [],
    favoriteSpells: [],
    spellSlots: {},
    pactSlots: null,
    abilityModifier: 0,
    proficiencyBonus: 2,
    materialComponents: {},
    focusEquipped: false,
    concentratingOn: null,
    concentrationStartTime: undefined,
    spellsCastToday: 0,
    totalSpellsCast: 0,
  };
}

// ============================================
// LOAD/SAVE
// ============================================

function loadClassSpellcastingState(): ClassSpellcastingState {
  try {
    const stored = localStorage.getItem(CLASS_SPELLCASTING_KEY);
    if (stored) {
      return { ...getDefaultClassSpellcastingState(), ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error('[ClassSpellcasting] Failed to load state:', e);
  }
  return getDefaultClassSpellcastingState();
}

function saveClassSpellcastingState(state: ClassSpellcastingState): void {
  try {
    localStorage.setItem(CLASS_SPELLCASTING_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('[ClassSpellcasting] Failed to save state:', e);
  }
}

function loadClassActiveSpells(): ActiveSpellEffect[] {
  try {
    const stored = localStorage.getItem(CLASS_ACTIVE_SPELLS_KEY);
    if (stored) {
      return filterActiveSpells(JSON.parse(stored), Date.now());
    }
  } catch (e) {
    console.error('[ClassSpellcasting] Failed to load active spells:', e);
  }
  return [];
}

function saveClassActiveSpells(effects: ActiveSpellEffect[]): void {
  try {
    localStorage.setItem(CLASS_ACTIVE_SPELLS_KEY, JSON.stringify(effects));
  } catch (e) {
    console.error('[ClassSpellcasting] Failed to save active spells:', e);
  }
}

// ============================================
// HOOK OPTIONS
// ============================================

export interface UseClassSpellcastingOptions {
  abilityScores?: {
    intelligence: number;
    wisdom: number;
    charisma: number;
  };
}

// ============================================
// RETURN TYPE
// ============================================

export interface UseClassSpellcastingReturn {
  // State
  state: ClassSpellcastingState;
  activeSpells: ActiveSpellEffect[];
  
  // Slot info
  slotInfo: MulticlassSpellSlots;
  maxSpellLevel: number;
  hasSpellcasting: boolean;
  
  // Derived values
  spellAttackBonus: number;
  spellSaveDC: number;
  spellcastingAbility: 'INT' | 'WIS' | 'CHA';
  totalSlotsRemaining: number;
  
  // Preparation info
  maxPreparedSpells: number;
  currentPreparedCount: number;
  canPrepareMore: boolean;
  isPreparedCaster: boolean;
  
  // Cantrip scaling
  getScaledCantripDamage: (baseDamage: string | undefined) => string | undefined;
  getConcentrationDC: (damageTaken: number) => number;
  
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
  
  // Casting
  castSpell: (spellId: string, spellName: string, baseLevel: number, castLevel: number, usePact: boolean, requiresConcentration: boolean, duration: string) => {
    success: boolean;
    brokeConcentration: string | null;
  };
  
  // Active spell management
  dismissActiveSpell: (effectId: string) => void;
  
  // Concentration
  startConcentration: (spellId: string) => void;
  breakConcentration: () => void;
  
  // Components
  addComponent: (componentId: string, quantity: number) => void;
  useComponent: (componentId: string, quantity: number) => boolean;
  removeComponent: (componentId: string) => void;
  toggleFocus: () => void;
  
  // Rest recovery
  onShortRest: () => void;
  onLongRest: () => void;
  
  // Refresh
  refreshSlotsForLevel: () => void;
  resetClassSpellcasting: () => void;
}

// ============================================
// HOOK
// ============================================

export function useClassSpellcasting(
  primaryClass: DnDClass,
  primaryLevel: number,
  multiclassLevels: ClassLevelMap = {},
  characterName: string = 'Character',
  options: UseClassSpellcastingOptions = {}
): UseClassSpellcastingReturn {
  const { abilityScores } = options;
  const [state, setState] = useState<ClassSpellcastingState>(loadClassSpellcastingState);
  const [activeSpells, setActiveSpells] = useState<ActiveSpellEffect[]>(loadClassActiveSpells);
  const { toast } = useToast();
  const expirationCheckRef = useRef<NodeJS.Timeout | null>(null);

  // Get class config
  const classConfig = CLASS_REGISTRY[primaryClass];
  const spellcastingAbility = classConfig?.spellcasting?.ability ?? 'INT';
  const isPreparedCaster = classConfig?.spellcasting?.prepared ?? false;

  // Calculate slot info
  const slotInfo = useMemo(() => 
    getMulticlassSpellSlots(primaryClass, primaryLevel, multiclassLevels),
    [primaryClass, primaryLevel, multiclassLevels]
  );

  const maxSpellLevel = useMemo(() =>
    getMulticlassMaxSpellLevel(primaryClass, primaryLevel, multiclassLevels),
    [primaryClass, primaryLevel, multiclassLevels]
  );

  const hasSpellcastingAbility = useMemo(() =>
    hasSpellcasting(primaryClass, primaryLevel, multiclassLevels),
    [primaryClass, primaryLevel, multiclassLevels]
  );

  // Persist state
  useEffect(() => {
    saveClassSpellcastingState(state);
  }, [state]);

  useEffect(() => {
    saveClassActiveSpells(activeSpells);
  }, [activeSpells]);

  // Check for expired spells
  useEffect(() => {
    const checkExpired = () => {
      const now = Date.now();
      const expired = getExpiredSpells(activeSpells, now);
      
      if (expired.length > 0) {
        expired.forEach(e => {
          toast({
            title: `⏱️ ${e.spellName} Ended`,
            description: 'The spell duration has expired.',
            className: 'border-amber-500 bg-amber-500/10',
          });
          
          if (e.isConcentration && state.concentratingOn === e.spellId) {
            setState(prev => ({
              ...prev,
              concentratingOn: null,
              concentrationStartTime: undefined,
            }));
          }
        });
        
        setActiveSpells(prev => filterActiveSpells(prev, now));
      }
    };

    expirationCheckRef.current = setInterval(checkExpired, 1000);
    return () => {
      if (expirationCheckRef.current) {
        clearInterval(expirationCheckRef.current);
      }
    };
  }, [activeSpells, state.concentratingOn, toast]);

  // Auto-sync proficiency bonus
  useEffect(() => {
    const totalLevel = primaryLevel + Object.values(multiclassLevels).reduce((sum, l) => sum + (l ?? 0), 0);
    const calculatedProficiency = getProficiencyBonus(totalLevel);
    if (calculatedProficiency !== state.proficiencyBonus) {
      setState(prev => ({ ...prev, proficiencyBonus: calculatedProficiency }));
    }
  }, [primaryLevel, multiclassLevels, state.proficiencyBonus]);

  // Auto-sync ability modifier
  useEffect(() => {
    if (!abilityScores) return;
    
    let relevantScore = 10;
    switch (spellcastingAbility) {
      case 'INT':
        relevantScore = abilityScores.intelligence;
        break;
      case 'WIS':
        relevantScore = abilityScores.wisdom;
        break;
      case 'CHA':
        relevantScore = abilityScores.charisma;
        break;
    }
    
    const newModifier = Math.floor((relevantScore - 10) / 2);
    if (newModifier !== state.abilityModifier) {
      setState(prev => ({ ...prev, abilityModifier: newModifier }));
    }
  }, [abilityScores, spellcastingAbility, state.abilityModifier]);

  // Sync slots when level changes
  useEffect(() => {
    setState(prev => ({
      ...prev,
      spellSlots: toTrackedSpellSlots(slotInfo.regularSlots),
      pactSlots: toTrackedPactSlots(slotInfo.pactSlots),
    }));
  }, [slotInfo]);

  // Derived calculations
  const spellAttackBonus = state.abilityModifier + state.proficiencyBonus;
  const spellSaveDC = 8 + state.abilityModifier + state.proficiencyBonus;

  const totalSlotsRemaining = useMemo(() => {
    let total = 0;
    for (const slot of Object.values(state.spellSlots)) {
      if (typeof slot === 'object' && 'current' in slot) {
        total += slot.current;
      }
    }
    if (state.pactSlots) {
      total += state.pactSlots.current;
    }
    return total;
  }, [state.spellSlots, state.pactSlots]);

  // Preparation limits (for prepared casters)
  const maxPreparedSpells = useMemo(() => {
    if (!isPreparedCaster) return 999; // Known casters have no prep limit
    // Prepared spells = ability modifier + class level (minimum 1)
    return Math.max(1, state.abilityModifier + primaryLevel);
  }, [isPreparedCaster, state.abilityModifier, primaryLevel]);

  const currentPreparedCount = useMemo(() => {
    return state.preparedSpells.filter(id => {
      const spell = getSpellById(id);
      return spell && spell.level > 0;
    }).length;
  }, [state.preparedSpells]);

  const canPrepareMore = currentPreparedCount < maxPreparedSpells;

  // Helper functions
  const getScaledCantripDamage = useCallback((baseDamage: string | undefined): string | undefined => {
    const totalLevel = primaryLevel + Object.values(multiclassLevels).reduce((sum, l) => sum + (l ?? 0), 0);
    return scaleCantrip(baseDamage, totalLevel);
  }, [primaryLevel, multiclassLevels]);

  const getConcentrationDC = useCallback((damageTaken: number): number => {
    return getConcentrationCheckDC(damageTaken);
  }, []);

  // Spell management
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

  // Slot management
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
        : null,
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

  // Concentration
  const startConcentration = useCallback((spellId: string) => {
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
    const wasConcentrating = state.concentratingOn;
    if (wasConcentrating) {
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
    
    return wasConcentrating;
  }, [state.concentratingOn, toast]);

  // Casting
  const castSpell = useCallback((
    spellId: string,
    spellName: string,
    baseLevel: number,
    castLevel: number,
    usePact: boolean,
    requiresConcentration: boolean,
    duration: string = 'Instantaneous'
  ) => {
    const isCantrip = baseLevel === 0;
    let brokeConcentration: string | null = null;
    let slotSuccess = true;

    if (!isCantrip) {
      if (usePact) {
        slotSuccess = usePactSlot();
      } else {
        slotSuccess = useSlot(castLevel);
      }
    }

    if (!slotSuccess) {
      return { success: false, brokeConcentration: null };
    }

    if (requiresConcentration) {
      if (state.concentratingOn) {
        brokeConcentration = state.concentratingOn;
        setActiveSpells(prev => prev.filter(e => e.spellId !== state.concentratingOn));
      }
      startConcentration(spellId);
    }

    const activeEffect = createActiveSpellEffect(
      spellId,
      spellName,
      duration,
      castLevel,
      requiresConcentration,
      characterName
    );
    
    if (activeEffect) {
      setActiveSpells(prev => [...prev, activeEffect]);
    }

    const levelLabel = isCantrip ? 'Cantrip' : 
      castLevel === 1 ? '1st' : castLevel === 2 ? '2nd' : castLevel === 3 ? '3rd' : `${castLevel}th`;
    
    toast({
      title: `✨ ${spellName} Cast!`,
      description: isCantrip 
        ? 'Cantrip cast at will.'
        : `Cast at ${levelLabel} level.${requiresConcentration ? ' Concentrating.' : ''}`,
      className: 'border-indigo-500 bg-indigo-500/10',
    });

    return { success: true, brokeConcentration };
  }, [state.concentratingOn, characterName, useSlot, usePactSlot, startConcentration, toast]);

  const dismissActiveSpell = useCallback((effectId: string) => {
    setActiveSpells(prev => {
      const effect = prev.find(e => e.id === effectId);
      if (effect) {
        toast({
          title: `${effect.spellName} Dismissed`,
          description: 'The spell effect has ended.',
        });
      }
      return prev.filter(e => e.id !== effectId);
    });
  }, [toast]);

  // Components
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

  const removeComponent = useCallback((componentId: string) => {
    setState(prev => {
      const newComponents = { ...prev.materialComponents };
      delete newComponents[componentId];
      return { ...prev, materialComponents: newComponents };
    });
  }, []);

  const toggleFocus = useCallback(() => {
    setState(prev => ({ ...prev, focusEquipped: !prev.focusEquipped }));
  }, []);

  // Rest recovery
  const onShortRest = useCallback(() => {
    // Warlock pact slots recover on short rest
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
    const activeCount = activeSpells.length;
    setActiveSpells([]);
    
    setState(prev => {
      // Restore all spell slots
      const restoredSlots: TrackedSpellSlots = {};
      for (const [level, slot] of Object.entries(prev.spellSlots)) {
        if (typeof slot === 'object' && 'max' in slot) {
          restoredSlots[parseInt(level)] = { ...slot, current: slot.max };
        }
      }

      const restoredPact = prev.pactSlots 
        ? { ...prev.pactSlots, current: prev.pactSlots.max }
        : null;

      toast({
        title: '☀️ Arcane Reserves Restored',
        description: activeCount > 0 
          ? `All spell slots recovered. ${activeCount} active spell${activeCount > 1 ? 's' : ''} ended.`
          : 'All spell slots have been recovered.',
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
  }, [activeSpells.length, toast]);

  // Refresh
  const refreshSlotsForLevel = useCallback(() => {
    setState(prev => ({
      ...prev,
      spellSlots: toTrackedSpellSlots(slotInfo.regularSlots),
      pactSlots: toTrackedPactSlots(slotInfo.pactSlots),
    }));
  }, [slotInfo]);

  const resetClassSpellcasting = useCallback(() => {
    const defaultState = getDefaultClassSpellcastingState();
    setState(defaultState);
    setActiveSpells([]);
    localStorage.removeItem(CLASS_SPELLCASTING_KEY);
    localStorage.removeItem(CLASS_ACTIVE_SPELLS_KEY);
    toast({
      title: 'Spellcasting Reset',
      description: 'All class spellcasting data has been cleared.',
    });
  }, [toast]);

  return {
    state,
    activeSpells,
    slotInfo,
    maxSpellLevel,
    hasSpellcasting: hasSpellcastingAbility,
    spellAttackBonus,
    spellSaveDC,
    spellcastingAbility,
    totalSlotsRemaining,
    maxPreparedSpells,
    currentPreparedCount,
    canPrepareMore,
    isPreparedCaster,
    getScaledCantripDamage,
    getConcentrationDC,
    learnSpell,
    forgetSpell,
    prepareSpell,
    unprepareSpell,
    toggleFavorite,
    useSlot,
    restoreSlot,
    usePactSlot,
    restorePactSlot,
    castSpell,
    dismissActiveSpell,
    startConcentration,
    breakConcentration,
    addComponent,
    useComponent,
    removeComponent,
    toggleFocus,
    onShortRest,
    onLongRest,
    refreshSlotsForLevel,
    resetClassSpellcasting,
  };
}
