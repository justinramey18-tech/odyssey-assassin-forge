import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
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
import { getSpellById } from '@/lib/magic/spells';
import { 
  getProficiencyBonus, 
  getSpellPreparationInfo, 
  SpellPreparationInfo,
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

// ============================================
// LOCAL STORAGE KEYS
// ============================================

const STORAGE_KEY = 'odyssey-spellcasting';
const ACTIVE_SPELLS_KEY = 'odyssey-active-spells';

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

function loadActiveSpells(): ActiveSpellEffect[] {
  try {
    const stored = localStorage.getItem(ACTIVE_SPELLS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Filter out expired spells on load
      return filterActiveSpells(parsed, Date.now());
    }
  } catch (e) {
    console.error('[Spellcasting] Failed to load active spells:', e);
  }
  return [];
}

function saveActiveSpells(effects: ActiveSpellEffect[]): void {
  try {
    localStorage.setItem(ACTIVE_SPELLS_KEY, JSON.stringify(effects));
  } catch (e) {
    console.error('[Spellcasting] Failed to save active spells:', e);
  }
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
// SPELL COMPATIBILITY HELPER
// ============================================

/**
 * Check if a spell is compatible with a given path
 * A spell is compatible if:
 * 1. It has no pathRestrictions, OR the path is in pathRestrictions
 * 2. It's a cantrip (always transferable) OR the path has no school restrictions OR the spell's school is in the path's allowed schools
 */
function isSpellCompatibleWithPath(spellId: string, path: MagicPath): boolean {
  const spell = getSpellById(spellId);
  if (!spell) return false;
  
  // Check path restrictions on the spell
  if (spell.pathRestrictions && !spell.pathRestrictions.includes(path)) {
    return false;
  }
  
  // Cantrips are generally transferable
  if (spell.level === 0) return true;
  
  // Check if the spell's school is allowed by the path
  const pathConfig = getPathConfig(path);
  if (pathConfig.spellListRestrictions && pathConfig.spellListRestrictions.length > 0) {
    // Path has school restrictions - spell must be from an allowed school
    return pathConfig.spellListRestrictions.includes(spell.school);
  }
  
  // No school restrictions on the path - spell is compatible
  return true;
}

// ============================================
// HOOK
// ============================================

export interface SpellCastResult {
  success: boolean;
  spellId: string;
  spellName: string;
  castLevel: number;
  isUpcast: boolean;
  isCantrip: boolean;
  usedPactSlot: boolean;
  startedConcentration: boolean;
  brokeConcentration: string | null;
}

export interface UseSpellcastingOptions {
  /** Character's ability scores (to auto-calculate modifier) */
  abilityScores?: {
    intelligence: number;
    wisdom: number;
    charisma: number;
  };
}

export interface UseSpellcastingReturn {
  // State
  state: SpellcastingState;
  
  // Active spell effects (duration tracking)
  activeSpells: ActiveSpellEffect[];
  
  // Derived values
  spellAttackBonus: number;
  spellSaveDC: number;
  hasPath: boolean;
  isPathUnlocked: boolean;
  totalSlotsRemaining: number;
  
  // Preparation info (5e compliant)
  preparationInfo: SpellPreparationInfo | null;
  currentPreparedCount: number;
  canPrepareMore: boolean;
  
  // Cantrip scaling helper
  getScaledCantripDamage: (baseDamage: string | undefined) => string | undefined;
  
  // Concentration check
  getConcentrationDC: (damageTaken: number) => number;
  
  // Path management
  selectPath: (path: MagicPath) => void;
  unlockPath: () => void;
  clearPath: () => void;
  
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
  castSpell: (spellId: string, spellName: string, baseLevel: number, castLevel: number, usePact: boolean, requiresConcentration: boolean, duration: string) => SpellCastResult;
  
  // Active spell management
  dismissActiveSpell: (effectId: string) => void;
  
  // Concentration
  startConcentration: (spellId: string) => void;
  breakConcentration: () => void;
  
  // Component management
  addComponent: (componentId: string, quantity: number) => void;
  useComponent: (componentId: string, quantity: number) => boolean;
  removeComponent: (componentId: string) => void;
  toggleFocus: () => void;
  
  // Rest recovery
  onShortRest: () => void;
  onLongRest: () => void;
  
  // Stats update (manual override)
  updateAbilityModifier: (mod: number) => void;
  updateProficiencyBonus: (bonus: number) => void;
  
  // Full reset
  resetSpellcasting: () => void;
  
  // Refresh slots for level changes
  refreshSlotsForLevel: (characterLevel: number) => void;
}

export function useSpellcasting(
  characterLevel: number,
  characterName: string = 'Character',
  options: UseSpellcastingOptions = {}
): UseSpellcastingReturn {
  const { abilityScores } = options;
  const [state, setState] = useState<SpellcastingState>(loadState);
  const [activeSpells, setActiveSpells] = useState<ActiveSpellEffect[]>(loadActiveSpells);
  const { toast } = useToast();
  const expirationCheckRef = useRef<NodeJS.Timeout | null>(null);

  // Persist state changes
  useEffect(() => {
    saveState(state);
  }, [state]);

  // Persist active spells
  useEffect(() => {
    saveActiveSpells(activeSpells);
  }, [activeSpells]);

  // Check for expired spells every second
  useEffect(() => {
    const checkExpired = () => {
      const now = Date.now();
      const expired = getExpiredSpells(activeSpells, now);
      
      if (expired.length > 0) {
        // Notify about expired spells
        expired.forEach(e => {
          toast({
            title: `⏱️ ${e.spellName} Ended`,
            description: 'The spell duration has expired.',
            className: 'border-amber-500 bg-amber-500/10',
          });
          
          // If it was a concentration spell, clear concentration
          if (e.isConcentration && state.concentratingOn === e.spellId) {
            setState(prev => ({
              ...prev,
              concentratingOn: null,
              concentrationStartTime: undefined,
            }));
          }
        });
        
        // Filter out expired
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

  // Auto-sync proficiency bonus based on character level
  useEffect(() => {
    const calculatedProficiency = getProficiencyBonus(characterLevel);
    if (calculatedProficiency !== state.proficiencyBonus) {
      setState(prev => ({ ...prev, proficiencyBonus: calculatedProficiency }));
    }
  }, [characterLevel, state.proficiencyBonus]);

  // Auto-sync ability modifier from ability scores
  useEffect(() => {
    if (!abilityScores || !state.path) return;
    
    const pathConfig = getPathConfig(state.path);
    let relevantScore = 10;
    
    switch (pathConfig.spellcastingAbility) {
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
    
    // Calculate modifier: floor((score - 10) / 2)
    const newModifier = Math.floor((relevantScore - 10) / 2);
    if (newModifier !== state.abilityModifier) {
      setState(prev => ({ ...prev, abilityModifier: newModifier }));
    }
  }, [abilityScores, state.path, state.abilityModifier]);

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

  // Preparation info (5e compliant)
  const preparationInfo = useMemo((): SpellPreparationInfo | null => {
    if (!state.path) return null;
    return getSpellPreparationInfo(state.path, characterLevel, state.abilityModifier);
  }, [state.path, characterLevel, state.abilityModifier]);

  // Count non-cantrip prepared spells
  const currentPreparedCount = useMemo(() => {
    return state.preparedSpells.filter(id => {
      const spell = getSpellById(id);
      return spell && spell.level > 0;
    }).length;
  }, [state.preparedSpells]);

  const canPrepareMore = preparationInfo 
    ? currentPreparedCount < preparationInfo.maxPreparedSpells 
    : true;

  // Cantrip scaling helper
  const getScaledCantripDamage = useCallback((baseDamage: string | undefined): string | undefined => {
    return scaleCantrip(baseDamage, characterLevel);
  }, [characterLevel]);

  // Concentration check DC calculator
  const getConcentrationDC = useCallback((damageTaken: number): number => {
    return getConcentrationCheckDC(damageTaken);
  }, []);

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

    setState(prev => {
      // Filter spells to keep only those compatible with the new path
      const compatibleKnown = prev.knownSpells.filter(id => isSpellCompatibleWithPath(id, path));
      const compatiblePrepared = prev.preparedSpells.filter(id => isSpellCompatibleWithPath(id, path));
      const compatibleFavorites = prev.favoriteSpells.filter(id => isSpellCompatibleWithPath(id, path));
      
      // Count how many spells were preserved
      const keptCount = compatibleKnown.length;
      const lostCount = prev.knownSpells.length - keptCount;
      
      return {
        ...prev,
        path,
        pathUnlocked: true,
        spellcastingAbility: pathConfig.spellcastingAbility,
        spellSlots: slots,
        pactSlots,
        knownSpells: compatibleKnown,
        preparedSpells: compatiblePrepared,
        favoriteSpells: compatibleFavorites,
        // Clear concentration when switching paths
        concentratingOn: null,
        concentrationStartTime: undefined,
        // Store counts for toast message
        _keptCount: keptCount,
        _lostCount: lostCount,
      };
    });

    // Get counts after state update for toast
    const prevState = loadState();
    const keptCount = prevState.knownSpells.filter(id => isSpellCompatibleWithPath(id, path)).length;
    const lostCount = prevState.knownSpells.length - keptCount;

    let description = pathConfig.flavorText;
    if (prevState.knownSpells.length > 0) {
      if (keptCount > 0 && lostCount > 0) {
        description = `${keptCount} compatible spell${keptCount !== 1 ? 's' : ''} preserved. ${lostCount} incompatible spell${lostCount !== 1 ? 's' : ''} removed.`;
      } else if (keptCount > 0) {
        description = `All ${keptCount} spell${keptCount !== 1 ? 's' : ''} are compatible and preserved!`;
      } else if (lostCount > 0) {
        description = `${lostCount} spell${lostCount !== 1 ? 's were' : ' was'} not compatible with this path.`;
      }
    }

    toast({
      title: `✨ ${pathConfig.name} Unlocked`,
      description,
      className: 'border-indigo-500 bg-indigo-500/10',
    });
  }, [characterLevel, toast]);

  const unlockPath = useCallback(() => {
    setState(prev => ({ ...prev, pathUnlocked: true }));
  }, []);

  const clearPath = useCallback(() => {
    setState(prev => ({
      ...prev,
      path: null,
      pathUnlocked: false,
    }));
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

  // ============================================
  // CASTING
  // ============================================

  const castSpell = useCallback((
    spellId: string,
    spellName: string,
    baseLevel: number,
    castLevel: number,
    usePact: boolean,
    requiresConcentration: boolean,
    duration: string = 'Instantaneous'
  ): SpellCastResult => {
    const isCantrip = baseLevel === 0;
    const isUpcast = castLevel > baseLevel;
    let brokeConcentration: string | null = null;
    let slotSuccess = true;

    // Cantrips don't use slots
    if (!isCantrip) {
      if (usePact) {
        slotSuccess = usePactSlot();
      } else {
        slotSuccess = useSlot(castLevel);
      }
    }

    if (!slotSuccess) {
      return {
        success: false,
        spellId,
        spellName,
        castLevel,
        isUpcast,
        isCantrip,
        usedPactSlot: usePact,
        startedConcentration: false,
        brokeConcentration: null,
      };
    }

    // Handle concentration
    if (requiresConcentration) {
      if (state.concentratingOn) {
        brokeConcentration = state.concentratingOn;
        // Remove old concentration spell from active effects
        setActiveSpells(prev => prev.filter(e => e.spellId !== state.concentratingOn));
      }
      startConcentration(spellId);
    }

    // Add to active spell effects (if not instantaneous)
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

    // Success toast
    const levelLabel = isCantrip ? 'Cantrip' : 
      castLevel === 1 ? '1st' : castLevel === 2 ? '2nd' : castLevel === 3 ? '3rd' : `${castLevel}th`;
    
    toast({
      title: `✨ ${spellName} Cast!`,
      description: isCantrip 
        ? 'Cantrip cast at will.'
        : `Cast at ${levelLabel} level${isUpcast ? ' (upcast)' : ''}.${requiresConcentration ? ' Concentrating.' : ''}`,
      className: 'border-indigo-500 bg-indigo-500/10',
    });

    return {
      success: true,
      spellId,
      spellName,
      castLevel,
      isUpcast,
      isCantrip,
      usedPactSlot: usePact,
      startedConcentration: requiresConcentration,
      brokeConcentration,
    };
  }, [state.concentratingOn, characterName, useSlot, usePactSlot, startConcentration, toast]);

  // Dismiss an active spell effect manually
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

  const removeComponent = useCallback((componentId: string) => {
    setState(prev => {
      const newComponents = { ...prev.materialComponents };
      delete newComponents[componentId];
      return { ...prev, materialComponents: newComponents };
    });
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
    // Clear all active spell effects
    const activeCount = activeSpells.length;
    setActiveSpells([]);
    
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
    activeSpells,
    spellAttackBonus,
    spellSaveDC,
    hasPath,
    isPathUnlocked,
    totalSlotsRemaining,
    preparationInfo,
    currentPreparedCount,
    canPrepareMore,
    getScaledCantripDamage,
    getConcentrationDC,
    selectPath,
    unlockPath,
    clearPath,
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
    updateAbilityModifier,
    updateProficiencyBonus,
    resetSpellcasting,
    refreshSlotsForLevel,
  };
}
