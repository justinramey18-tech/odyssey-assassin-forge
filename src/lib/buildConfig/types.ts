// ═══════════════════════════════════════════════════════════════════════════
// BUILD CONFIGURATION - Single source of truth for class customization
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Core identity for the build
 */
export interface BuildIdentity {
  /** Class name displayed in UI (e.g., "Odyssey Assassin") */
  className: string;
  /** Short subtitle (e.g., "ASSASSIN") */
  classSubtitle: string;
  /** Default name for new characters */
  defaultCharacterName: string;
  /** App title for headers */
  appTitle: string;
  /** Description for GM guides */
  classDescription: string;
}

/**
 * Configuration for a single ability tree
 */
export interface TreeConfig {
  id: string;               // Unique identifier (e.g., 'hunter')
  name: string;             // Display name (e.g., 'Hunter')
  subtitle: string;         // Short description (e.g., 'Ranged & Awareness')
  iconName: string;         // Lucide icon name (e.g., 'Target')
  colors: {
    primary: string;        // CSS variable name (e.g., 'hunter')
    glow: string;
    dim: string;
  };
}

/**
 * Configuration for prestige/post-endgame system
 */
export interface PrestigeConfig {
  treeName: string;         // e.g., "Drizzt's Legacy"
  centralNode: {
    name: string;           // e.g., "Drizzt Do'Urden"
    title: string;          // e.g., "Legendary Ranger of Icewind Dale"
  };
  branches: PrestigeBranchConfig[];
}

export interface PrestigeBranchConfig {
  id: string;
  name: string;
  subtitle: string;
  iconName: string;
  primaryColor: string;
  glowColor: string;
}

/**
 * Mechanical progression configuration
 */
export interface ProgressionConfig {
  hitDie: 'd6' | 'd8' | 'd10' | 'd12';
  hitDieMax: number;
  hitDieAvg: number;
  maxLevel: number;
  /** Point formula: returns points available at given level */
  getAbilityPointsForLevel: (level: number) => number;
  /** HP formula: returns max HP for level + CON mod + prestige */
  calculateMaxHP: (level: number, conMod: number, prestigeLevel: number) => number;
}

/**
 * AI DM prompt customization
 */
export interface AIPromptConfig {
  /** Character personality archetype for RP prompts */
  personalityArchetype: string;
  /** Personality traits list */
  personalityTraits: string[];
  /** Example quips/dialogue */
  exampleQuips: string[];
}

/**
 * Complete build configuration
 */
export interface BuildConfig {
  version: number;
  identity: BuildIdentity;
  trees: TreeConfig[];
  prestige: PrestigeConfig;
  progression: ProgressionConfig;
  aiPrompts: AIPromptConfig;
}
