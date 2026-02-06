// Wizard Step Validation Hook

import { useMemo } from 'react';
import { WizardState, StepValidation, WIZARD_STEPS } from '../types';
import { scoreToModifier } from '@/lib/abilityScores/types';
import { getAbilityPointsForLevel, getTotalPointsSpent } from '@/lib/types';

// Name validation regex: alphanumeric, spaces, apostrophes, hyphens
const NAME_REGEX = /^[a-zA-Z0-9 '\-]{2,30}$/;

// Validate Step 1: Identity
function validateIdentityStep(state: WizardState): StepValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Name validation
  if (!state.name || state.name.trim().length === 0) {
    errors.push('Character name is required');
  } else if (state.name.trim().length < 2) {
    errors.push('Name must be at least 2 characters');
  } else if (state.name.trim().length > 30) {
    errors.push('Name must be 30 characters or less');
  } else if (!NAME_REGEX.test(state.name.trim())) {
    errors.push('Name contains invalid characters');
  }
  
  // Level validation
  if (state.level < 1 || state.level > 20) {
    errors.push('Level must be between 1 and 20');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// Validate Step 2: Ability Scores
function validateAbilityScoresStep(state: WizardState): StepValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  const scores = Object.values(state.abilityScores);
  
  // Check all scores are in valid range
  for (const score of scores) {
    if (score < 3 || score > 18) {
      errors.push('All ability scores must be between 3 and 18');
      break;
    }
  }
  
  // Standard array validation (if using standard method)
  if (state.scoreGenerationMethod === 'standard') {
    const standardArray = [15, 14, 13, 12, 10, 8];
    const sortedScores = [...scores].sort((a, b) => b - a);
    const sortedStandard = [...standardArray].sort((a, b) => b - a);
    
    const isValidStandard = sortedScores.every((s, i) => s === sortedStandard[i]);
    if (!isValidStandard) {
      warnings.push('Scores do not match Standard Array values');
    }
  }
  
  // Constitution warning for low HP
  const conMod = scoreToModifier(state.abilityScores.constitution);
  if (conMod < 0) {
    warnings.push(`Low Constitution will reduce starting HP`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// Validate Step 3: Game Mode
function validateGameModeStep(state: WizardState): StepValidation {
  // Game mode step has no validation requirements
  // All options are valid
  return {
    isValid: true,
    errors: [],
    warnings: [],
  };
}

// Validate Step 4: Magic Path
function validateMagicPathStep(state: WizardState): StepValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check level requirements for magic paths
  if (state.selectedPath) {
    if (state.level < 3 && state.selectedPath !== 'hexblade') {
      errors.push(`${state.selectedPath} requires level 3 or higher`);
    }
  }
  
  // Suggest a path if none selected and level >= 3
  if (!state.selectedPath && state.level >= 3) {
    warnings.push('No magic path selected - you can add one later');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// Validate Step 5: Skill Trees
function validateSkillTreesStep(state: WizardState): StepValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  const availablePoints = getAbilityPointsForLevel(state.level);
  const spentPoints = getTotalPointsSpent(state.starterAbilities);
  
  if (spentPoints > availablePoints) {
    errors.push(`Spent ${spentPoints} points but only ${availablePoints} available`);
  }
  
  if (spentPoints === 0) {
    warnings.push('No starter abilities selected - you can allocate points later');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// Validate Step 6: Equipment
function validateEquipmentStep(state: WizardState): StepValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check if at least one weapon is equipped
  const hasWeapon = 
    state.equipment.slots.primary_weapon !== null ||
    state.equipment.slots.secondary_weapon !== null ||
    state.equipment.slots.ranged_weapon !== null;
  
  if (!hasWeapon) {
    warnings.push('No weapon equipped - consider selecting starting gear');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// Validate Step 7: Combat Primer (informational only)
function validateCombatPrimerStep(_state: WizardState): StepValidation {
  // Informational step - always valid
  return {
    isValid: true,
    errors: [],
    warnings: [],
  };
}

// Validate Step 8: Summary (final validation)
function validateSummaryStep(state: WizardState): StepValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Re-validate all critical fields
  if (!state.name || state.name.trim().length < 2) {
    errors.push('Character name is required');
  }
  
  if (state.level < 1 || state.level > 20) {
    errors.push('Invalid character level');
  }
  
  // Check ability scores are assigned
  const hasValidScores = Object.values(state.abilityScores).every(s => s >= 3 && s <= 18);
  if (!hasValidScores) {
    errors.push('Ability scores not properly configured');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// Get validation for a specific step
export function validateStep(step: number, state: WizardState): StepValidation {
  switch (step) {
    case 0:
      return validateIdentityStep(state);
    case 1:
      return validateAbilityScoresStep(state);
    case 2:
      return validateGameModeStep(state);
    case 3:
      return validateMagicPathStep(state);
    case 4:
      return validateSkillTreesStep(state);
    case 5:
      return validateEquipmentStep(state);
    case 6:
      return validateCombatPrimerStep(state);
    case 7:
      return validateSummaryStep(state);
    default:
      return { isValid: false, errors: ['Invalid step'], warnings: [] };
  }
}

// Hook for reactive validation
export function useWizardValidation(state: WizardState) {
  const currentValidation = useMemo(
    () => validateStep(state.currentStep, state),
    [state.currentStep, state]
  );
  
  const allValidations = useMemo(
    () => WIZARD_STEPS.map((_, i) => validateStep(i, state)),
    [state]
  );
  
  const canProceed = currentValidation.isValid;
  const canComplete = allValidations.every(v => v.isValid);
  
  return {
    currentValidation,
    allValidations,
    canProceed,
    canComplete,
    validateStep: (step: number) => validateStep(step, state),
  };
}
