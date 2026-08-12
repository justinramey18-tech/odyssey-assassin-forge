// Class-Based Spellcasting Hook
// For full caster classes (Wizard, Sorcerer, Cleric, Druid, Bard) and Warlock
// Separate from MagicPath system used by Rogues

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { getScopedItem, setScopedItem, migrateToScoped } from '@/lib/scoped-storage';
import { DnDClass, ClassLevelMap, CLASS_REGISTRY, FULL_CASTER_CLASSES } from '@/lib/classes';
import { SpellSlotsByLevel } from '@/lib/magic/fullCasterSlots';
import { PactSlots as PactSlotsConfig } from '@/lib/magic/pactMagicSlots';
import { 
  getSorceryPointsForLevel, 
  getSlotCreationCost, 
  getPointsFromSlotLevel,
  SorceryPointsConfig,
} from '@/lib/magic/sorceryPoints';
import {
  getChannelDivinityForLevel,
  ChannelDivinityConfig,
} from '@/lib/magic/channelDivinity';
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

// Runtime sorcery point tracking (current/max)
export interface TrackedSorceryPoints {
  current: number;
  max: number;
}

// Runtime channel divinity tracking (current/max)
export interface TrackedChannelDivinity {
  current: number;
  max: number;
}

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
const ACTIVE_SAVE_ID_KEY = 'odyssey-active-cloud-save-id';

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
 * Convert SorceryPointsConfig to TrackedSorceryPoints for runtime tracking
 */
function toTrackedSorceryPoints(config: SorceryPointsConfig | null): TrackedSorceryPoints | null {
  if (!config) return null;
  return {
    current: config.maxPoints,
    max: config.maxPoints,
  };
}

/**
 * Convert ChannelDivinityConfig to TrackedChannelDivinity for runtime tracking
 */
function toTrackedChannelDivinity(config: ChannelDivinityConfig | null): TrackedChannelDivinity | null {
  if (!config || config.maxUses === 0) return null;
  return {
    current: config.maxUses,
    max: config.maxUses,
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
  /** Sorcerer sorcery points (for Metamagic and Font of Magic) */
  sorceryPoints: TrackedSorceryPoints | null;
  /** Cleric Channel Divinity uses */
  channelDivinity: TrackedChannelDivinity | null;
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
  /** Whether Natural Recovery (Circle of the Land) has been used since last long rest */
  naturalRecoveryUsed: boolean;
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
    sorceryPoints: null,
    channelDivinity: null,
    abilityModifier: 0,
    proficiencyBonus: 2,
    materialComponents: {},
    focusEquipped: false,
    concentratingOn: null,
    concentrationStartTime: undefined,
    spellsCastToday: 0,
    totalSpellsCast: 0,
    naturalRecoveryUsed: false,
  };
}

// ============================================
// LOAD/SAVE
// ============================================

function loadClassSpellcastingState(): ClassSpellcastingState {
  try {
    migrateToScoped(CLASS_SPELLCASTING_KEY);
    const stored = getScopedItem(CLASS_SPELLCASTING_KEY);
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
    setScopedItem(CLASS_SPELLCASTING_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('[ClassSpellcasting] Failed to save state:', e);
  }
}

function loadClassActiveSpells(): ActiveSpellEffect[] {
  try {
    migrateToScoped(CLASS_ACTIVE_SPELLS_KEY);
    const stored = getScopedItem(CLASS_ACTIVE_SPELLS_KEY);
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
    setScopedItem(CLASS_ACTIVE_SPELLS_KEY, JSON.stringify(effects));
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
  
  // Sorcery Points (Sorcerer only)
  hasSorceryPoints: boolean;
  sorceryPointsMax: number;
  sorceryPointsCurrent: number;
  
  // Channel Divinity (Cleric only)
  hasChannelDivinity: boolean;
  channelDivinityMax: number;
  channelDivinityCurrent: number;
  
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
  
  // Sorcery Point management
  useSorceryPoints: (amount: number, reason?: string) => boolean;
  restoreSorceryPoints: (amount: number) => void;
  convertSlotToPoints: (slotLevel: number) => boolean;
  createSlotFromPoints: (slotLevel: number) => boolean;
  
  // Channel Divinity management
  useChannelDivinity: (optionName?: string) => boolean;
  restoreChannelDivinity: () => void;
  
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
  
  // Natural Recovery (Circle of the Land Druid)
  naturalRecoveryUsed: boolean;
  /** Max total spell levels recoverable = ceil(druidLevel / 2) */
  naturalRecoveryMax: number;
  useNaturalRecovery: (slotLevels: number[]) => boolean;
  
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

  // Auto-sync known spells to prepared for non-prepared casters (Warlock, Sorcerer, Bard)
  // This fixes existing characters where knownSpells weren't mirrored to preparedSpells
  useEffect(() => {
    if (isPreparedCaster) return;
    setState(prev => {
      const missing = prev.knownSpells.filter(id => !prev.preparedSpells.includes(id));
      if (missing.length === 0) return prev;
      return { ...prev, preparedSpells: [...prev.preparedSpells, ...missing] };
    });
  }, [isPreparedCaster, state.knownSpells]);


  // Cleanup: remove orphan spell IDs (deleted/renamed spells) from preparedSpells.
  // Homebrew IDs are never treated as orphans: the custom spell registry is
  // populated by a separate effect that may not have run yet, so a missing
  // lookup here means "not loaded yet", not "deleted".
  useEffect(() => {
    setState(prev => {
      const cleaned = prev.preparedSpells.filter(id => {
        if (typeof id === 'string' && id.startsWith('homebrew_spell_')) return true;
        const spell = getSpellById(id);
        return spell !== null && spell !== undefined;
      });
      if (cleaned.length === prev.preparedSpells.length) return prev;
      return { ...prev, preparedSpells: cleaned };
    });
  }, []);

  // Sync slots when level changes — preserve current values if max hasn't changed
  const prevSlotInfoRef = useRef<string>('');
  useEffect(() => {
    const slotKey = JSON.stringify({
      regular: slotInfo.regularSlots,
      pact: slotInfo.pactSlots,
      primaryClass,
      primaryLevel,
    });
    
    // Only reset slots when the slot configuration actually changes
    if (slotKey === prevSlotInfoRef.current) return;
    prevSlotInfoRef.current = slotKey;

    // Get sorcery points config if this is a sorcerer
    const sorceryConfig = primaryClass === 'sorcerer' 
      ? getSorceryPointsForLevel(primaryLevel)
      : null;

    // Get channel divinity config if this is a cleric
    const channelDivinityConfig = primaryClass === 'cleric'
      ? getChannelDivinityForLevel(primaryLevel)
      : null;

    setState(prev => {
      // Merge new max values while preserving current usage
      const newSlots: TrackedSpellSlots = {};
      for (let level = 1; level <= 9; level++) {
        const newMax = (slotInfo.regularSlots as Record<number, number>)[level] ?? 0;
        if (newMax > 0) {
          const prevSlot = prev.spellSlots[level];
          // If the max changed, adjust current proportionally; otherwise keep current
          if (prevSlot && prevSlot.max === newMax) {
            newSlots[level] = { current: prevSlot.current, max: newMax };
          } else {
            // New slot level or max changed — set current to new max
            newSlots[level] = { current: newMax, max: newMax };
          }
        }
      }

      // Preserve pact slot usage
      let newPactSlots = toTrackedPactSlots(slotInfo.pactSlots);
      if (newPactSlots && prev.pactSlots && prev.pactSlots.max === newPactSlots.max) {
        newPactSlots = { ...newPactSlots, current: prev.pactSlots.current };
      }

      // Preserve sorcery point usage
      let newSorceryPoints = toTrackedSorceryPoints(sorceryConfig);
      if (newSorceryPoints && prev.sorceryPoints && prev.sorceryPoints.max === newSorceryPoints.max) {
        newSorceryPoints = { ...newSorceryPoints, current: prev.sorceryPoints.current };
      }

      // Preserve channel divinity usage
      let newChannelDivinity = toTrackedChannelDivinity(channelDivinityConfig);
      if (newChannelDivinity && prev.channelDivinity && prev.channelDivinity.max === newChannelDivinity.max) {
        newChannelDivinity = { ...newChannelDivinity, current: prev.channelDivinity.current };
      }

      return {
        ...prev,
        spellSlots: newSlots,
        pactSlots: newPactSlots,
        sorceryPoints: newSorceryPoints,
        channelDivinity: newChannelDivinity,
      };
    });
  }, [slotInfo, primaryClass, primaryLevel]);

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
      return spell && spell.level > 0 && spell.level <= maxSpellLevel;
    }).length;
  }, [state.preparedSpells, maxSpellLevel]);

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
      const newState = { ...prev, knownSpells: [...prev.knownSpells, spellId] };
      // For known-spell casters (non-prepared like Warlock, Sorcerer, Bard),
      // auto-add to preparedSpells so they appear in combat/quick-actions
      if (!isPreparedCaster && !prev.preparedSpells.includes(spellId)) {
        newState.preparedSpells = [...prev.preparedSpells, spellId];
      }
      return newState;
    });
  }, [isPreparedCaster]);

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
      // Enforce preparation limit for prepared casters
      if (isPreparedCaster) {
        const currentNonCantrips = prev.preparedSpells.filter(id => {
          const s = getSpellById(id);
          return s && s.level > 0 && s.level <= maxSpellLevel;
        }).length;
        const spell = getSpellById(spellId);
        const isNonCantrip = spell && spell.level > 0;
        if (isNonCantrip && currentNonCantrips >= maxPreparedSpells) {
          return prev; // Hard limit reached
        }
      }
      return { ...prev, preparedSpells: [...prev.preparedSpells, spellId] };
    });
  }, [isPreparedCaster, maxPreparedSpells, maxSpellLevel]);

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

  // ============================================
  // SORCERY POINT MANAGEMENT
  // ============================================

  // Derived sorcery point values
  const hasSorceryPoints = primaryClass === 'sorcerer' && state.sorceryPoints !== null;
  const sorceryPointsMax = state.sorceryPoints?.max ?? 0;
  const sorceryPointsCurrent = state.sorceryPoints?.current ?? 0;

  const useSorceryPoints = useCallback((amount: number, reason?: string): boolean => {
    if (!state.sorceryPoints || state.sorceryPoints.current < amount) {
      toast({
        title: 'Insufficient Sorcery Points',
        description: `Need ${amount} but only have ${state.sorceryPoints?.current ?? 0}.`,
        variant: 'destructive',
      });
      return false;
    }

    setState(prev => ({
      ...prev,
      sorceryPoints: prev.sorceryPoints 
        ? { ...prev.sorceryPoints, current: prev.sorceryPoints.current - amount }
        : null,
    }));

    toast({
      title: `⚡ ${amount} Sorcery Point${amount > 1 ? 's' : ''} Used`,
      description: reason ?? 'Innate magic expended.',
      className: 'border-red-500 bg-red-500/10',
    });

    return true;
  }, [state.sorceryPoints, toast]);

  const restoreSorceryPoints = useCallback((amount: number) => {
    setState(prev => {
      if (!prev.sorceryPoints) return prev;
      const newCurrent = Math.min(prev.sorceryPoints.max, prev.sorceryPoints.current + amount);
      return {
        ...prev,
        sorceryPoints: { ...prev.sorceryPoints, current: newCurrent },
      };
    });
  }, []);

  /**
   * Font of Magic: Convert a spell slot to sorcery points
   * Gain points equal to the slot's level
   */
  const convertSlotToPoints = useCallback((slotLevel: number): boolean => {
    const slot = state.spellSlots[slotLevel];
    if (!slot || slot.current <= 0) {
      toast({
        title: 'No Slot Available',
        description: `No ${slotLevel}${slotLevel === 1 ? 'st' : slotLevel === 2 ? 'nd' : slotLevel === 3 ? 'rd' : 'th'}-level slot to convert.`,
        variant: 'destructive',
      });
      return false;
    }

    if (!state.sorceryPoints) {
      toast({
        title: 'No Sorcery Points',
        description: 'Only sorcerers can convert spell slots.',
        variant: 'destructive',
      });
      return false;
    }

    const pointsGained = getPointsFromSlotLevel(slotLevel);
    const newCurrent = Math.min(state.sorceryPoints.max, state.sorceryPoints.current + pointsGained);

    setState(prev => ({
      ...prev,
      spellSlots: {
        ...prev.spellSlots,
        [slotLevel]: { ...prev.spellSlots[slotLevel], current: prev.spellSlots[slotLevel].current - 1 },
      },
      sorceryPoints: prev.sorceryPoints 
        ? { ...prev.sorceryPoints, current: newCurrent }
        : null,
    }));

    toast({
      title: `🔄 Slot Converted`,
      description: `Level ${slotLevel} slot → ${pointsGained} sorcery point${pointsGained > 1 ? 's' : ''}.`,
      className: 'border-violet-500 bg-violet-500/10',
    });

    return true;
  }, [state.spellSlots, state.sorceryPoints, toast]);

  /**
   * Font of Magic: Create a spell slot using sorcery points
   * Costs vary by slot level (max 5th level)
   */
  const createSlotFromPoints = useCallback((slotLevel: number): boolean => {
    const cost = getSlotCreationCost(slotLevel);
    if (cost === null) {
      toast({
        title: 'Invalid Slot Level',
        description: 'Can only create slots of 1st-5th level.',
        variant: 'destructive',
      });
      return false;
    }

    if (!state.sorceryPoints || state.sorceryPoints.current < cost) {
      toast({
        title: 'Insufficient Sorcery Points',
        description: `Creating a ${slotLevel}${slotLevel === 1 ? 'st' : slotLevel === 2 ? 'nd' : slotLevel === 3 ? 'rd' : 'th'}-level slot requires ${cost} points.`,
        variant: 'destructive',
      });
      return false;
    }

    setState(prev => {
      const currentSlot = prev.spellSlots[slotLevel] ?? { current: 0, max: 0 };
      return {
        ...prev,
        spellSlots: {
          ...prev.spellSlots,
          [slotLevel]: { ...currentSlot, current: currentSlot.current + 1 },
        },
        sorceryPoints: prev.sorceryPoints 
          ? { ...prev.sorceryPoints, current: prev.sorceryPoints.current - cost }
          : null,
      };
    });

    toast({
      title: `✨ Slot Created`,
      description: `${cost} sorcery points → Level ${slotLevel} slot.`,
      className: 'border-indigo-500 bg-indigo-500/10',
    });

    return true;
  }, [state.sorceryPoints, toast]);

  // ============================================
  // CHANNEL DIVINITY MANAGEMENT (Cleric only)
  // ============================================

  // Derived channel divinity values
  const hasChannelDivinity = primaryClass === 'cleric' && state.channelDivinity !== null;
  const channelDivinityMax = state.channelDivinity?.max ?? 0;
  const channelDivinityCurrent = state.channelDivinity?.current ?? 0;

  const useChannelDivinity = useCallback((optionName?: string): boolean => {
    if (!state.channelDivinity || state.channelDivinity.current <= 0) {
      toast({
        title: 'No Channel Divinity Uses',
        description: 'You have no Channel Divinity uses remaining. Take a short or long rest to recover.',
        variant: 'destructive',
      });
      return false;
    }

    setState(prev => ({
      ...prev,
      channelDivinity: prev.channelDivinity 
        ? { ...prev.channelDivinity, current: prev.channelDivinity.current - 1 }
        : null,
    }));

    toast({
      title: `☀️ Channel Divinity${optionName ? `: ${optionName}` : ''}`,
      description: `Divine power channeled. ${state.channelDivinity.current - 1} use${state.channelDivinity.current - 1 !== 1 ? 's' : ''} remaining.`,
      className: 'border-yellow-500 bg-yellow-500/10',
    });

    return true;
  }, [state.channelDivinity, toast]);

  const restoreChannelDivinity = useCallback(() => {
    setState(prev => {
      if (!prev.channelDivinity || prev.channelDivinity.current >= prev.channelDivinity.max) return prev;
      return {
        ...prev,
        channelDivinity: { ...prev.channelDivinity, current: prev.channelDivinity.current + 1 },
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
    setState(prev => {
      let restoredPact = false;
      let restoredChannelDivinity = false;

      // Warlock pact slots recover on short rest
      const newPactSlots = prev.pactSlots 
        ? (() => {
            restoredPact = prev.pactSlots.current < prev.pactSlots.max;
            return { ...prev.pactSlots, current: prev.pactSlots.max };
          })()
        : null;

      // Cleric Channel Divinity recovers on short rest
      const newChannelDivinity = prev.channelDivinity
        ? (() => {
            restoredChannelDivinity = prev.channelDivinity.current < prev.channelDivinity.max;
            return { ...prev.channelDivinity, current: prev.channelDivinity.max };
          })()
        : null;

      // Show appropriate toast
      if (restoredPact || restoredChannelDivinity) {
        const parts: string[] = [];
        if (restoredPact) parts.push('Pact slots');
        if (restoredChannelDivinity) parts.push('Channel Divinity');
        
        toast({
          title: '🌙 Short Rest Complete',
          description: `${parts.join(' and ')} recovered.`,
          className: 'border-violet-500 bg-violet-500/10',
        });
      }

      return {
        ...prev,
        pactSlots: newPactSlots,
        channelDivinity: newChannelDivinity,
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

      // Restore sorcery points on long rest
      const restoredSorceryPoints = prev.sorceryPoints 
        ? { ...prev.sorceryPoints, current: prev.sorceryPoints.max }
        : null;

      // Restore channel divinity on long rest
      const restoredChannelDivinity = prev.channelDivinity
        ? { ...prev.channelDivinity, current: prev.channelDivinity.max }
        : null;

      const sorceryRestored = prev.sorceryPoints && prev.sorceryPoints.current < prev.sorceryPoints.max;
      const divinityRestored = prev.channelDivinity && prev.channelDivinity.current < prev.channelDivinity.max;

      toast({
        title: '☀️ Arcane Reserves Restored',
        description: activeCount > 0 
          ? `All resources recovered. ${activeCount} active spell${activeCount > 1 ? 's' : ''} ended.`
          : 'All spell slots and class resources have been recovered.',
        className: 'border-indigo-500 bg-indigo-500/10',
      });

      return {
        ...prev,
        spellSlots: restoredSlots,
        pactSlots: restoredPact,
        sorceryPoints: restoredSorceryPoints,
        channelDivinity: restoredChannelDivinity,
        spellsCastToday: 0,
        concentratingOn: null,
        concentrationStartTime: undefined,
        naturalRecoveryUsed: false, // Reset Natural Recovery on long rest
      };
    });
  }, [activeSpells.length, toast]);

  // Natural Recovery (Circle of the Land Druid)
  const naturalRecoveryMax = useMemo(() => {
    if (primaryClass !== 'druid') return 0;
    return Math.ceil(primaryLevel / 2);
  }, [primaryClass, primaryLevel]);

  const useNaturalRecovery = useCallback((slotLevels: number[]): boolean => {
    if (primaryClass !== 'druid') return false;
    
    const totalLevels = slotLevels.reduce((sum, l) => sum + l, 0);
    const maxRecoverable = Math.ceil(primaryLevel / 2);
    
    if (totalLevels > maxRecoverable) {
      toast({
        title: 'Too Many Slot Levels',
        description: `Combined slot levels (${totalLevels}) exceed your maximum of ${maxRecoverable}.`,
        variant: 'destructive',
      });
      return false;
    }

    // Check no slots above 5th level
    if (slotLevels.some(l => l >= 6)) {
      toast({
        title: 'Slot Level Too High',
        description: "Natural Recovery can't restore slots of 6th level or higher.",
        variant: 'destructive',
      });
      return false;
    }

    setState(prev => {
      if (prev.naturalRecoveryUsed) return prev;

      const newSlots = { ...prev.spellSlots };
      for (const level of slotLevels) {
        const slot = newSlots[level];
        if (slot && slot.current < slot.max) {
          newSlots[level] = { ...slot, current: Math.min(slot.current + 1, slot.max) };
        }
      }

      return {
        ...prev,
        spellSlots: newSlots,
        naturalRecoveryUsed: true,
      };
    });

    toast({
      title: '🌿 Natural Recovery',
      description: `Recovered ${slotLevels.length} spell slot${slotLevels.length > 1 ? 's' : ''} (${totalLevels} levels total).`,
      className: 'border-green-500 bg-green-500/10',
    });

    return true;
  }, [primaryClass, primaryLevel, toast]);

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
    // Sorcery Points
    hasSorceryPoints,
    sorceryPointsMax,
    sorceryPointsCurrent,
    // Channel Divinity
    hasChannelDivinity,
    channelDivinityMax,
    channelDivinityCurrent,
    // Preparation
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
    // Sorcery Point management
    useSorceryPoints,
    restoreSorceryPoints,
    convertSlotToPoints,
    createSlotFromPoints,
    // Channel Divinity management
    useChannelDivinity,
    restoreChannelDivinity,
    // Other
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
    // Natural Recovery
    naturalRecoveryUsed: state.naturalRecoveryUsed,
    naturalRecoveryMax,
    useNaturalRecovery,
    refreshSlotsForLevel,
    resetClassSpellcasting,
  };
}
