// Wizard State Application Utility
// Translates WizardState into the app's various state systems

import { WizardState, XPPreset as WizardXPPreset } from '../types';
import { XPPreset as AppXPPreset, XP_PRESETS, getXPForLevel } from '@/lib/xpSystem';
import { Character, CharacterAbility } from '@/lib/types';
import { BaseAbilityScores, scoreToModifier } from '@/lib/abilityScores/types';
import { calculateMaxHP } from '@/lib/hpCalculation';
import { CharacterEquipment, createInitialEquipment } from '@/lib/inventory';
import { MagicPath } from '@/lib/magic/types';
import { DiceOddsMode, saveDiceOddsMode } from '@/lib/diceOdds';
import { HonestModeRules } from '@/lib/gameModes';
import { WIZARD_PROGRESS_KEY } from '../types';

// Result type for wizard application
export interface ApplyWizardResult {
  success: boolean;
  errors: string[];
  appliedChanges: string[];
}

// Toast configuration type
export interface ToastConfig {
  title: string;
  description: string;
  className?: string;
  variant?: 'default' | 'destructive';
  duration?: number;
}

// Setter functions interface - what Index.tsx provides
export interface WizardStateSetters {
  setCharacter: (updater: (prev: Character) => Character) => void;
  setCurrentXP: (xp: number) => void;
  setXPPreset: (preset: AppXPPreset) => void;
  setEquipment: (equipment: CharacterEquipment) => void;
  handleHPChange: (current: number, max: number, temp: number) => void;
  abilityScores: {
    applyScores: (scores: BaseAbilityScores) => void;
  };
  spellcasting: {
    selectPath: (path: MagicPath) => void;
  };
  toast: (config: ToastConfig) => void;
}

/**
 * Maps wizard XP preset to app XP preset
 */
export function mapXPPreset(wizardPreset: WizardXPPreset): AppXPPreset {
  switch (wizardPreset) {
    case 'fastTrack':
      return 'fast';
    case 'epicJourney':
      return 'slow';
    case 'milestone':
      return 'milestone';
    case 'standard':
    default:
      return 'standard';
  }
}

/**
 * Gets XP multiplier from wizard preset
 */
export function getXPMultiplier(wizardPreset: WizardXPPreset): number {
  switch (wizardPreset) {
    case 'fastTrack':
      return 0.5;
    case 'epicJourney':
      return 2.0;
    case 'milestone':
      return 0;
    case 'standard':
    default:
      return 1.0;
  }
}

/**
 * Calculates starting XP for a given level and preset
 */
export function calculateStartingXP(level: number, wizardPreset: WizardXPPreset): number {
  const multiplier = getXPMultiplier(wizardPreset);
  if (multiplier === 0) return 0; // Milestone mode
  return getXPForLevel(level, multiplier);
}

/**
 * Calculates starting HP based on level and constitution
 */
export function calculateStartingHP(level: number, constitution: number): {
  current: number;
  max: number;
  temp: number;
} {
  const conMod = scoreToModifier(constitution);
  const maxHP = calculateMaxHP(level, conMod, 0); // No prestige at wizard creation
  return {
    current: maxHP,
    max: maxHP,
    temp: 0,
  };
}

/**
 * Merges starter abilities with existing character abilities
 */
export function mergeAbilities(
  existingAbilities: CharacterAbility[],
  starterAbilities: CharacterAbility[]
): CharacterAbility[] {
  if (!starterAbilities || starterAbilities.length === 0) {
    return existingAbilities;
  }

  const merged = existingAbilities.map(existing => {
    const starter = starterAbilities.find(sa => sa.abilityId === existing.abilityId);
    if (starter && starter.currentTier > existing.currentTier) {
      return { ...existing, currentTier: starter.currentTier };
    }
    return existing;
  });

  // Append any starter ability the base catalog does not contain - for example
  // homebrew abilities, whose IDs never appear in allAbilities. Without this the
  // grant is silently dropped and the character is created with no such ability.
  for (const starter of starterAbilities) {
    if (!merged.some(m => m.abilityId === starter.abilityId)) {
      merged.push({ abilityId: starter.abilityId, currentTier: starter.currentTier });
    }
  }

  return merged;
}


/**
 * Saves game mode settings to localStorage
 */
export function saveGameModeSettings(
  mode: 'honest' | 'infinityPool',
  honestModeRules: HonestModeRules
): void {
  localStorage.setItem('odyssey-game-mode', JSON.stringify({
    mode,
    honestModeRules,
  }));
}

/**
 * Clears wizard progress from localStorage
 */
export function clearWizardProgress(): void {
  localStorage.removeItem(WIZARD_PROGRESS_KEY);
}

/**
 * Main function to apply wizard state to the app
 * This is a pure orchestrator - it calls the provided setters
 */
export function applyWizardState(
  wizardState: WizardState,
  setters: WizardStateSetters
): ApplyWizardResult {
  const errors: string[] = [];
  const appliedChanges: string[] = [];

  try {
    // 1. Character basics (name, level, class, abilities, loadout)
    setters.setCharacter(prev => ({
      ...prev,
      name: wizardState.name,
      level: wizardState.level,
      primaryClass: wizardState.primaryClass,
      portraitIcon: wizardState.portraitIcon || prev.portraitIcon,
      abilities: mergeAbilities(prev.abilities, wizardState.starterAbilities),
      equippedAbilities:
        wizardState.equippedAbilities && wizardState.equippedAbilities.length > 0
          ? wizardState.equippedAbilities
          : prev.equippedAbilities,
    }));

    appliedChanges.push(`Character: ${wizardState.name}, Level ${wizardState.level} ${wizardState.primaryClass.charAt(0).toUpperCase() + wizardState.primaryClass.slice(1)}`);

    // 2. XP for level
    const startingXP = calculateStartingXP(wizardState.level, wizardState.xpPreset);
    setters.setCurrentXP(startingXP);
    appliedChanges.push(`XP set to ${startingXP}`);

    // 3. XP preset
    const appXpPreset = mapXPPreset(wizardState.xpPreset);
    setters.setXPPreset(appXpPreset);
    appliedChanges.push(`XP Preset: ${appXpPreset}`);

    // 4. Ability scores
    setters.abilityScores.applyScores(wizardState.abilityScores);
    appliedChanges.push('Ability scores applied');

    // 5. Game mode settings
    saveGameModeSettings(wizardState.gameMode, wizardState.honestModeRules);
    appliedChanges.push(`Game Mode: ${wizardState.gameMode}`);

    // 6. Dice odds mode
    saveDiceOddsMode(wizardState.diceOddsMode);
    appliedChanges.push(`Dice Odds: ${wizardState.diceOddsMode}`);

    // 7. Magic path (if selected)
    if (wizardState.selectedPath) {
      setters.spellcasting.selectPath(wizardState.selectedPath);
      appliedChanges.push(`Magic Path: ${wizardState.selectedPath}`);
    }

    // 8. Equipment (if preset selected or custom equipment)
    if (wizardState.selectedPresetId && wizardState.equipment) {
      setters.setEquipment(wizardState.equipment);
      appliedChanges.push(`Equipment Preset: ${wizardState.selectedPresetId}`);
    } else if (hasAnyEquipment(wizardState.equipment)) {
      setters.setEquipment(wizardState.equipment);
      appliedChanges.push('Custom equipment applied');
    }

    // 9. HP calculation and application
    const hpState = calculateStartingHP(wizardState.level, wizardState.abilityScores.constitution);
    setters.handleHPChange(hpState.current, hpState.max, hpState.temp);
    appliedChanges.push(`HP: ${hpState.max}`);

    // 10. Clear wizard progress
    clearWizardProgress();

    // 11. Success toast
    setters.toast({
      title: `⚔️ ${wizardState.name} Created!`,
      description: `Level ${wizardState.level} Assassin ready for adventure.`,
      className: 'border-primary bg-primary/10',
    });

    return {
      success: true,
      errors: [],
      appliedChanges,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    errors.push(errorMessage);
    console.error('[ApplyWizardState] Failed:', error);

    setters.toast({
      title: 'Character Creation Failed',
      description: errorMessage,
      variant: 'destructive',
    });

    return {
      success: false,
      errors,
      appliedChanges,
    };
  }
}

/**
 * Quick start application - simplified version with defaults
 */
export function applyQuickStart(
  wizardState: WizardState,
  setters: Pick<WizardStateSetters, 'setCharacter' | 'setCurrentXP' | 'setXPPreset' | 'abilityScores' | 'handleHPChange' | 'toast'>
): ApplyWizardResult {
  const appliedChanges: string[] = [];

  try {
    // 1. Character basics
    setters.setCharacter(prev => ({
      ...prev,
      name: wizardState.name,
      level: wizardState.level,
    }));
    appliedChanges.push(`Character: ${wizardState.name}, Level ${wizardState.level}`);

    // 2. Ability scores
    setters.abilityScores.applyScores(wizardState.abilityScores);
    appliedChanges.push('Quick Start ability scores applied');

    // 3. XP (start at 0 for quick start)
    setters.setCurrentXP(0);
    setters.setXPPreset('standard');
    appliedChanges.push('XP: 0 (Standard preset)');

    // 4. HP
    const hpState = calculateStartingHP(wizardState.level, wizardState.abilityScores.constitution);
    setters.handleHPChange(hpState.current, hpState.max, hpState.temp);
    appliedChanges.push(`HP: ${hpState.max}`);

    // 5. Clear wizard progress
    clearWizardProgress();

    // 6. Success toast
    setters.toast({
      title: `⚔️ ${wizardState.name} Created!`,
      description: 'Quick Start character ready. Customize in the builder.',
      className: 'border-primary bg-primary/10',
    });

    return {
      success: true,
      errors: [],
      appliedChanges,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[ApplyQuickStart] Failed:', error);

    setters.toast({
      title: 'Quick Start Failed',
      description: errorMessage,
      variant: 'destructive',
    });

    return {
      success: false,
      errors: [errorMessage],
      appliedChanges,
    };
  }
}

/**
 * Helper to check if equipment has any items
 */
function hasAnyEquipment(equipment: CharacterEquipment): boolean {
  if (!equipment || !equipment.slots) return false;
  
  // Check all slots for equipped items
  return Object.values(equipment.slots).some(slot => slot !== null);
}

/**
 * Validates wizard state before application
 */
export function validateWizardStateForApplication(state: WizardState): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Name validation
  if (!state.name || state.name.trim().length < 2) {
    errors.push('Character name must be at least 2 characters');
  }
  if (state.name && state.name.length > 30) {
    errors.push('Character name must be 30 characters or less');
  }

  // Level validation
  if (state.level < 1 || state.level > 20) {
    errors.push('Level must be between 1 and 20');
  }

  // Ability scores validation
  const scores = state.abilityScores;
  const scoreValues = [
    scores.strength,
    scores.dexterity,
    scores.constitution,
    scores.intelligence,
    scores.wisdom,
    scores.charisma,
  ];
  
  for (const score of scoreValues) {
    if (score < 3 || score > 20) {
      errors.push('All ability scores must be between 3 and 20');
      break;
    }
  }

  // Magic path level requirement
  if (state.selectedPath && state.selectedPath !== 'hexblade' && state.level < 3) {
    errors.push(`${state.selectedPath} requires level 3 or higher`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Gets a summary of what will be applied (for preview/confirmation)
 */
export function getApplicationSummary(state: WizardState): {
  character: { name: string; level: number };
  abilityScores: BaseAbilityScores;
  hp: number;
  xp: number;
  gameMode: string;
  magicPath: string | null;
  equipment: string | null;
} {
  const hp = calculateStartingHP(state.level, state.abilityScores.constitution);
  const xp = calculateStartingXP(state.level, state.xpPreset);

  return {
    character: {
      name: state.name,
      level: state.level,
    },
    abilityScores: state.abilityScores,
    hp: hp.max,
    xp,
    gameMode: state.gameMode,
    magicPath: state.selectedPath,
    equipment: state.selectedPresetId,
  };
}
