// Wizard State Management Hook with Reducer Pattern

import { useReducer, useCallback, useEffect, useState } from 'react';
import { 
  WizardState, 
  ScoreGenerationMethod, 
  XPPreset, 
  PortraitIcon,
  WIZARD_PROGRESS_KEY,
  SavedWizardProgress,
  QUICK_START_DEFAULTS,
  CLASS_SUGGESTED_ARRAYS,
} from '../types';
import { BaseAbilityScores, DEFAULT_BASE_SCORES } from '@/lib/abilityScores/types';
import { CharacterAbility, DnDClass } from '@/lib/types';
import { CharacterEquipment, EquipmentSlotType } from '@/lib/inventory/types';
import { HonestModeRules } from '@/lib/gameModes';
import { DiceOddsMode } from '@/lib/diceOdds';
import { MagicPath } from '@/lib/magic/types';

// Default honest mode rules (all enabled)
const DEFAULT_HONEST_RULES: HonestModeRules = {
  requireGearUnlocks: true,
  organicLevelUp: true,
  maxLevelInfinityStones: true,
  noRerolls: true,
  scribeItemVerification: true,
  prestigePointsRequireXP: true,
  prestigeRespecDisabled: true,
  enforceCooldowns: true,
};

// Empty equipment state
const EMPTY_EQUIPMENT: CharacterEquipment = {
  slots: {
    head: null,
    chest: null,
    arms: null,
    waist: null,
    legs: null,
    primary_weapon: null,
    secondary_weapon: null,
    ranged_weapon: null,
    amulet: null,
    ring1: null,
    ring2: null,
  },
  inventory: [],
};

// Initial state
const INITIAL_STATE: WizardState = {
  currentStep: 0,
  completedSteps: [],
  
  // Identity
  name: '',
  level: 1,
  portraitIcon: 'Skull',
  
  // Class Selection (NEW)
  primaryClass: 'rogue', // Default to legacy Odyssey Assassin
  
  // Ability Scores
  abilityScores: DEFAULT_BASE_SCORES,
  scoreGenerationMethod: 'standard',
  
  // Game Mode
  gameMode: 'infinityPool',
  honestModeRules: DEFAULT_HONEST_RULES,
  xpPreset: 'standard',
  diceOddsMode: 'fair',
  
  // Magic Path
  selectedPath: null,
  
  // Skill Trees
  starterAbilities: [],
  
  // Equipment
  equipment: EMPTY_EQUIPMENT,
  selectedPresetId: null,
};

// Action types
type WizardAction =
  | { type: 'SET_STEP'; step: number }
  | { type: 'COMPLETE_STEP'; step: number }
  | { type: 'SET_IDENTITY'; name: string; level: number; portraitIcon: PortraitIcon }
  | { type: 'SET_PRIMARY_CLASS'; primaryClass: DnDClass }
  | { type: 'SET_ABILITY_SCORES'; scores: BaseAbilityScores; method: ScoreGenerationMethod }
  | { type: 'SET_GAME_MODE'; mode: 'honest' | 'infinityPool' }
  | { type: 'SET_HONEST_RULES'; rules: Partial<HonestModeRules> }
  | { type: 'SET_XP_PRESET'; preset: XPPreset }
  | { type: 'SET_DICE_ODDS'; mode: DiceOddsMode }
  | { type: 'SET_MAGIC_PATH'; path: MagicPath | null }
  | { type: 'SET_STARTER_ABILITIES'; abilities: CharacterAbility[] }
  | { type: 'SET_EQUIPMENT'; equipment: CharacterEquipment; presetId?: string }
  | { type: 'APPLY_QUICK_START' }
  | { type: 'GO_BACK' }
  | { type: 'GO_NEXT' }
  | { type: 'JUMP_TO_STEP'; step: number }
  | { type: 'RESTORE_STATE'; state: WizardState }
  | { type: 'RESET' };

// Reducer function
function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, currentStep: action.step };
      
    case 'COMPLETE_STEP':
      if (state.completedSteps.includes(action.step)) {
        return state;
      }
      return { 
        ...state, 
        completedSteps: [...state.completedSteps, action.step].sort((a, b) => a - b),
      };
      
    case 'SET_IDENTITY':
      return { 
        ...state, 
        name: action.name, 
        level: action.level,
        portraitIcon: action.portraitIcon,
      };
      
    case 'SET_PRIMARY_CLASS':
      // When changing class, optionally suggest optimized ability scores
      const suggestedScores = CLASS_SUGGESTED_ARRAYS[action.primaryClass];
      return { 
        ...state, 
        primaryClass: action.primaryClass,
        // Update ability scores if using standard array method
        ...(state.scoreGenerationMethod === 'standard' && suggestedScores 
          ? { abilityScores: suggestedScores } 
          : {}),
        // Clear magic path if switching away from rogue
        ...(action.primaryClass !== 'rogue' ? { selectedPath: null } : {}),
      };
      
    case 'SET_ABILITY_SCORES':
      return { 
        ...state, 
        abilityScores: action.scores,
        scoreGenerationMethod: action.method,
      };
      
    case 'SET_GAME_MODE':
      return { ...state, gameMode: action.mode };
      
    case 'SET_HONEST_RULES':
      return { 
        ...state, 
        honestModeRules: { ...state.honestModeRules, ...action.rules },
      };
      
    case 'SET_XP_PRESET':
      return { ...state, xpPreset: action.preset };
      
    case 'SET_DICE_ODDS':
      return { ...state, diceOddsMode: action.mode };
      
    case 'SET_MAGIC_PATH':
      // Validate level requirements
      if (action.path && action.path !== 'hexblade' && state.level < 3) {
        // Can't select non-Hexblade paths below level 3
        return state;
      }
      return { ...state, selectedPath: action.path };
      
    case 'SET_STARTER_ABILITIES':
      return { ...state, starterAbilities: action.abilities };
      
    case 'SET_EQUIPMENT':
      return { 
        ...state, 
        equipment: action.equipment,
        selectedPresetId: action.presetId ?? state.selectedPresetId,
      };
      
    case 'APPLY_QUICK_START':
      return {
        ...INITIAL_STATE,
        ...QUICK_START_DEFAULTS,
        name: state.name, // Keep any name already entered
        currentStep: 0,
        completedSteps: [],
      } as WizardState;
      
    case 'GO_BACK':
      return { 
        ...state, 
        currentStep: Math.max(0, state.currentStep - 1),
      };
      
    case 'GO_NEXT':
      const nextStep = state.currentStep + 1;
      const totalSteps = 8; // Updated for new classSelection step (0-8 = 9 steps)
      return { 
        ...state, 
        currentStep: Math.min(totalSteps, nextStep),
        completedSteps: state.completedSteps.includes(state.currentStep)
          ? state.completedSteps
          : [...state.completedSteps, state.currentStep].sort((a, b) => a - b),
      };
      
    case 'JUMP_TO_STEP':
      // Only allow jumping to completed steps or current step + 1
      if (action.step <= Math.max(...state.completedSteps, -1) + 1) {
        return { ...state, currentStep: action.step };
      }
      return state;
      
    case 'RESTORE_STATE':
      return action.state;
      
    case 'RESET':
      return INITIAL_STATE;
      
    default:
      return state;
  }
}

// Validate dependencies when level changes
function validateDependencies(state: WizardState): WizardState {
  let updatedState = { ...state };
  
  // If level dropped below 3, clear non-Hexblade magic paths
  if (state.level < 3 && state.selectedPath && state.selectedPath !== 'hexblade') {
    updatedState.selectedPath = null;
  }
  
  return updatedState;
}

// Hook
export function useWizardState() {
  const [state, dispatch] = useReducer(wizardReducer, INITIAL_STATE);
  const [hasResumableProgress, setHasResumableProgress] = useState(false);
  const [savedProgress, setSavedProgress] = useState<SavedWizardProgress | null>(null);

  // Check for resumable progress on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(WIZARD_PROGRESS_KEY);
      if (saved) {
        const parsed: SavedWizardProgress = JSON.parse(saved);
        // Only restore if less than 24 hours old
        const oneDayMs = 24 * 60 * 60 * 1000;
        if (Date.now() - parsed.savedAt < oneDayMs) {
          setHasResumableProgress(true);
          setSavedProgress(parsed);
        } else {
          // Clear stale progress
          localStorage.removeItem(WIZARD_PROGRESS_KEY);
        }
      }
    } catch (e) {
      console.error('Failed to load wizard progress:', e);
    }
  }, []);

  // Auto-save progress after step 1 is complete
  useEffect(() => {
    if (state.currentStep > 0 || state.completedSteps.length > 0) {
      try {
        const progress: SavedWizardProgress = {
          state,
          savedAt: Date.now(),
        };
        localStorage.setItem(WIZARD_PROGRESS_KEY, JSON.stringify(progress));
      } catch (e) {
        console.error('Failed to save wizard progress:', e);
      }
    }
  }, [state]);

  // Action dispatchers
  const setStep = useCallback((step: number) => {
    dispatch({ type: 'SET_STEP', step });
  }, []);

  const completeStep = useCallback((step: number) => {
    dispatch({ type: 'COMPLETE_STEP', step });
  }, []);

  const setIdentity = useCallback((name: string, level: number, portraitIcon: PortraitIcon) => {
    dispatch({ type: 'SET_IDENTITY', name, level, portraitIcon });
  }, []);

  const setPrimaryClass = useCallback((primaryClass: DnDClass) => {
    dispatch({ type: 'SET_PRIMARY_CLASS', primaryClass });
  }, []);

  const setAbilityScores = useCallback((scores: BaseAbilityScores, method: ScoreGenerationMethod) => {
    dispatch({ type: 'SET_ABILITY_SCORES', scores, method });
  }, []);

  const setGameMode = useCallback((mode: 'honest' | 'infinityPool') => {
    dispatch({ type: 'SET_GAME_MODE', mode });
  }, []);

  const setHonestRules = useCallback((rules: Partial<HonestModeRules>) => {
    dispatch({ type: 'SET_HONEST_RULES', rules });
  }, []);

  const setXPPreset = useCallback((preset: XPPreset) => {
    dispatch({ type: 'SET_XP_PRESET', preset });
  }, []);

  const setDiceOdds = useCallback((mode: DiceOddsMode) => {
    dispatch({ type: 'SET_DICE_ODDS', mode });
  }, []);

  const setMagicPath = useCallback((path: MagicPath | null) => {
    dispatch({ type: 'SET_MAGIC_PATH', path });
  }, []);

  const setStarterAbilities = useCallback((abilities: CharacterAbility[]) => {
    dispatch({ type: 'SET_STARTER_ABILITIES', abilities });
  }, []);

  const setEquipment = useCallback((equipment: CharacterEquipment, presetId?: string) => {
    dispatch({ type: 'SET_EQUIPMENT', equipment, presetId });
  }, []);

  const applyQuickStart = useCallback(() => {
    dispatch({ type: 'APPLY_QUICK_START' });
  }, []);

  const goBack = useCallback(() => {
    dispatch({ type: 'GO_BACK' });
  }, []);

  const goNext = useCallback(() => {
    dispatch({ type: 'GO_NEXT' });
  }, []);

  const jumpToStep = useCallback((step: number) => {
    dispatch({ type: 'JUMP_TO_STEP', step });
  }, []);

  const restoreProgress = useCallback(() => {
    if (savedProgress) {
      dispatch({ type: 'RESTORE_STATE', state: savedProgress.state });
      setHasResumableProgress(false);
      setSavedProgress(null);
    }
  }, [savedProgress]);

  const clearProgress = useCallback(() => {
    localStorage.removeItem(WIZARD_PROGRESS_KEY);
    setHasResumableProgress(false);
    setSavedProgress(null);
  }, []);

  const reset = useCallback(() => {
    localStorage.removeItem(WIZARD_PROGRESS_KEY);
    dispatch({ type: 'RESET' });
  }, []);

  // Computed values
  const isFirstStep = state.currentStep === 0;
  const isLastStep = state.currentStep === 8; // Updated for 9 steps (0-8)
  const canGoBack = state.currentStep > 0;
  const canGoNext = state.completedSteps.includes(state.currentStep) || state.currentStep < Math.max(...state.completedSteps, -1) + 1;

  // Check if MagicPath step should be skipped (non-Rogue classes)
  const shouldSkipMagicPath = state.primaryClass !== 'rogue';

  return {
    state,
    
    // Navigation
    setStep,
    completeStep,
    goBack,
    goNext,
    jumpToStep,
    isFirstStep,
    isLastStep,
    canGoBack,
    canGoNext,
    shouldSkipMagicPath,
    
    // Step 1: Identity
    setIdentity,
    
    // Step 2: Class Selection
    setPrimaryClass,
    
    // Step 3: Ability Scores
    setAbilityScores,
    
    // Step 4: Game Mode
    setGameMode,
    setHonestRules,
    setXPPreset,
    setDiceOdds,
    
    // Step 5: Magic Path (Rogue only)
    setMagicPath,
    
    // Step 6: Skill Trees
    setStarterAbilities,
    
    // Step 7: Equipment
    setEquipment,
    
    // Quick start
    applyQuickStart,
    
    // Progress restoration
    hasResumableProgress,
    savedProgress,
    restoreProgress,
    clearProgress,
    
    // Reset
    reset,
  };
}
