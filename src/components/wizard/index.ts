// Character Builder Wizard - Barrel Export

// Types
export * from './types';

// Hooks
export { useWizardState } from './hooks/use-wizard-state';
export { useWizardValidation, validateStep } from './hooks/use-wizard-validation';

// Utils
export { 
  applyWizardState, 
  applyQuickStart,
  calculateStartingHP,
  calculateStartingXP,
  mapXPPreset,
  validateWizardStateForApplication,
  getApplicationSummary,
} from './utils/apply-wizard-state';
export type { ApplyWizardResult, WizardStateSetters, ToastConfig } from './utils/apply-wizard-state';

// Components
export { CharacterWizard } from './CharacterWizard';
export { WizardProgress, WizardProgressCompact } from './WizardProgress';
export { WizardNavigation, WizardNavigationCompact } from './WizardNavigation';

// Steps
export { 
  IdentityStep, 
  AbilityScoresStep, 
  GameModeStep, 
  MagicPathStep,
  SkillTreePreviewStep,
  EquipmentStep,
  SummaryStep,
} from './steps';

// Presets
export { 
  EQUIPMENT_PRESETS, 
  getAvailablePresets, 
  presetToEquipment,
  getPresetById,
} from './presets/equipment-presets';
export type { EquipmentPreset } from './presets/equipment-presets';
