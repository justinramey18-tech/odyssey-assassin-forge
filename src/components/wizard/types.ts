// Character Builder Wizard Types

import { BaseAbilityScores } from '@/lib/abilityScores/types';
import { CharacterAbility } from '@/lib/types';
import { CharacterEquipment } from '@/lib/inventory/types';
import { HonestModeRules } from '@/lib/gameModes';
import { DiceOddsMode } from '@/lib/diceOdds';
import { MagicPath } from '@/lib/magic/types';

// XP Preset types
export type XPPreset = 'standard' | 'fastTrack' | 'epicJourney' | 'milestone';

export interface XPPresetConfig {
  id: XPPreset;
  label: string;
  multiplier: number;
  description: string;
}

export const XP_PRESETS: Record<XPPreset, XPPresetConfig> = {
  standard: {
    id: 'standard',
    label: 'Standard',
    multiplier: 1.0,
    description: 'Standard D&D 5e XP progression',
  },
  fastTrack: {
    id: 'fastTrack',
    label: 'Fast Track',
    multiplier: 0.5,
    description: 'Level up faster with half the XP required',
  },
  epicJourney: {
    id: 'epicJourney',
    label: 'Epic Journey',
    multiplier: 2.0,
    description: 'Double XP requirements for a longer campaign',
  },
  milestone: {
    id: 'milestone',
    label: 'Milestone',
    multiplier: 0,
    description: 'Manual level progression (DM discretion)',
  },
};

// Ability score generation methods
export type ScoreGenerationMethod = 'standard' | 'roll' | 'manual';

// Portrait icon options
export const PORTRAIT_ICONS = [
  'Skull',
  'User',
  'Shield',
  'Sword',
  'Crosshair',
  'Ghost',
  'Flame',
  'Zap',
  'Moon',
  'Sun',
  'Star',
  'Crown',
] as const;

export type PortraitIcon = typeof PORTRAIT_ICONS[number];

// Wizard step identifiers
export type WizardStep = 
  | 'identity'
  | 'abilityScores'
  | 'gameMode'
  | 'magicPath'
  | 'skillTrees'
  | 'equipment'
  | 'combatPrimer'
  | 'summary';

export const WIZARD_STEPS: WizardStep[] = [
  'identity',
  'abilityScores',
  'gameMode',
  'magicPath',
  'skillTrees',
  'equipment',
  'combatPrimer',
  'summary',
];

export const WIZARD_STEP_LABELS: Record<WizardStep, string> = {
  identity: 'Identity',
  abilityScores: 'Ability Scores',
  gameMode: 'Game Mode',
  magicPath: 'Magic Path',
  skillTrees: 'Skill Trees',
  equipment: 'Equipment',
  combatPrimer: 'Combat Primer',
  summary: 'Summary',
};

// Complete wizard state
export interface WizardState {
  // Navigation
  currentStep: number;
  completedSteps: number[];
  
  // Step 1: Identity
  name: string;
  level: number;
  portraitIcon: PortraitIcon;
  
  // Step 2: Ability Scores
  abilityScores: BaseAbilityScores;
  scoreGenerationMethod: ScoreGenerationMethod;
  
  // Step 3: Game Mode
  gameMode: 'honest' | 'infinityPool';
  honestModeRules: HonestModeRules;
  xpPreset: XPPreset;
  diceOddsMode: DiceOddsMode;
  
  // Step 4: Magic Path
  selectedPath: MagicPath | null;
  
  // Step 5: Skill Trees
  starterAbilities: CharacterAbility[];
  
  // Step 6: Equipment
  equipment: CharacterEquipment;
  selectedPresetId: string | null;
}

// Quick start defaults for fast character creation
export const QUICK_START_DEFAULTS: Partial<WizardState> = {
  level: 1,
  portraitIcon: 'Skull',
  abilityScores: {
    strength: 8,
    dexterity: 15,
    constitution: 14,
    intelligence: 12,
    wisdom: 13,
    charisma: 10,
  },
  scoreGenerationMethod: 'standard',
  gameMode: 'infinityPool',
  xpPreset: 'standard',
  diceOddsMode: 'fair',
  selectedPath: null,
  starterAbilities: [],
  selectedPresetId: 'street-runner',
};

// Validation result
export interface StepValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Wizard progress persistence
export const WIZARD_PROGRESS_KEY = 'odyssey-wizard-progress';

export interface SavedWizardProgress {
  state: WizardState;
  savedAt: number;
}
