// Onboarding UI Constants

export const ONBOARDING_Z_INDEX = {
  OVERLAY: 9000,
  SPOTLIGHT: 9001,
  TOOLTIP: 9002,
  MODAL: 9003,
} as const;

export const ONBOARDING_TIMING = {
  ELEMENT_TIMEOUT_MS: 3000,     // Auto-skip if element not found
  ADVANCE_DELAY_MS: 50,         // Delay before advancing to next step
  SPOTLIGHT_TRANSITION_MS: 300, // CSS transition for spotlight
} as const;
