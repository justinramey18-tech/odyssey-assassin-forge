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

// Type guards for localStorage validation (Issue #5 - complete validation)
export function isValidStep(step: unknown): step is OnboardingStep {
  return STEP_ORDER.includes(step as OnboardingStep);
}

export function isValidState(state: unknown): state is OnboardingStorage {
  if (typeof state !== 'object' || state === null) {
    return false;
  }
  
  const s = state as Record<string, unknown>;
  
  // Validate all required fields with proper types
  const hasValidIsComplete = typeof s.isComplete === 'boolean';
  const hasValidCurrentStep = isValidStep(s.currentStep);
  const hasValidTimestamp = 
    typeof s.lastUpdateTimestamp === 'number' && 
    Number.isFinite(s.lastUpdateTimestamp) &&
    s.lastUpdateTimestamp >= 0;
  const hasValidTargetAbility = 
    typeof s.targetAbilityId === 'string' && 
    s.targetAbilityId.length > 0;

  return hasValidIsComplete && hasValidCurrentStep && hasValidTimestamp && hasValidTargetAbility;
}

// Expiry check for stale onboarding states (Issue #15)
const ONBOARDING_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function isStateExpired(state: OnboardingStorage): boolean {
  if (state.lastUpdateTimestamp === 0) return false;
  return Date.now() - state.lastUpdateTimestamp > ONBOARDING_TTL_MS;
}
