// Feature Flags for Gradual Rollout
// Controls experimental features that can be toggled on/off

export const FEATURE_FLAGS = {
  /** Enable multiclass spellcaster system (Wizard, Sorcerer, etc.) */
  MULTICLASS_ENABLED: true,
  
  /** Enable subclass selection UI (Phase 2 feature - not yet implemented) */
  SUBCLASS_SELECTION_ENABLED: false,
  
  /** Enable class-specific spell lists (Phase 2 feature) */
  CLASS_SPELL_LISTS_ENABLED: false,
} as const;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;

/**
 * Check if a feature flag is enabled
 */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return FEATURE_FLAGS[flag];
}
