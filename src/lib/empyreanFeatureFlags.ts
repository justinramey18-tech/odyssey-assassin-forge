// src/lib/empyreanFeatureFlags.ts
//
// Temporary hide flags for Empyrean sub-features.
// All original components remain in the codebase — these flags only gate their entry points.
// To restore a feature, flip its flag from false to true and redeploy.

export const EMPYREAN_FEATURE_FLAGS = {
  /** Session Zero, Arc Planner, and Session Planner cards in the Empyrean screen. */
  showPlanningWizards: false,

  /** Empyrean Prompt Library drawer (entry points in Empyrean screen AND Settings). */
  showPromptLibrary: false,

  /** Empyrean Campaign Pack / GM Guides drawer (entry points in Empyrean screen AND Settings). */
  showCampaignPack: false,

  /** AFK tab opens the Autopilot config modal. When false, AFK tab toggles autopilot directly. */
  showAutopilotGuideModal: false,

  /** Memorial Screen after Death Save fails. When false, runs rebirth logic inline and exits to menu. */
  showMemorialScreen: false,

  /** Cinematic Slideshow overlay for DM responses. When false, responses display in standard reading mode only. */
  showCinematicSlideshow: false,
} as const;
