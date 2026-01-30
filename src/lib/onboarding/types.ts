// Onboarding System Types

export type OnboardingStep = 
  | 'inactive'           // Not running
  | 'welcome'            // Step 1: Welcome modal
  | 'points_intro'       // Step 2: Highlight available points
  | 'select_tree'        // Step 3: Guide to Warrior tree
  | 'select_ability'     // Step 4: Highlight Weapon Master node
  | 'unlock_ability'     // Step 5: Click unlock button
  | 'complete';          // Step 6: Graduation message

export interface OnboardingStorage {
  isComplete: boolean;
  currentStep: OnboardingStep;
  lastUpdateTimestamp: number;
  targetAbilityId: string;
}

export const DEFAULT_ONBOARDING_STATE: OnboardingStorage = {
  isComplete: false,
  currentStep: 'inactive',
  lastUpdateTimestamp: 0,
  targetAbilityId: 'weapon_master',
};

export const ONBOARDING_STORAGE_KEY = 'odyssey-onboarding-v2';
export const TARGET_ABILITY = 'weapon_master';
export const TARGET_TREE = 'warrior';

export const STEP_ORDER: OnboardingStep[] = [
  'inactive', 'welcome', 'points_intro', 'select_tree', 
  'select_ability', 'unlock_ability', 'complete'
];

// Type guards for localStorage validation
export function isValidStep(step: unknown): step is OnboardingStep {
  return STEP_ORDER.includes(step as OnboardingStep);
}

export function isValidState(state: unknown): state is OnboardingStorage {
  return (
    typeof state === 'object' &&
    state !== null &&
    'isComplete' in state &&
    'currentStep' in state &&
    typeof (state as OnboardingStorage).isComplete === 'boolean' &&
    isValidStep((state as OnboardingStorage).currentStep)
  );
}
