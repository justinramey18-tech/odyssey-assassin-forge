// Game Modes System
// Manages "Honest Mode" (restrictive) and "Infinity Pool Mode" (full access)

export interface HonestModeRules {
  requireGearUnlocks: boolean;     // Gear pieces with unlock requirements are inaccessible until met
  organicLevelUp: boolean;         // No manual level ups, only organic XP gains
  maxLevelInfinityStones: boolean; // Infinity stones only accessible at max level (20)
  noRerolls: boolean;              // Player cannot reroll dice
  scribeItemVerification: boolean; // Items only gained through scribe input narrative verification
}

export interface GameModeSettings {
  mode: 'honest' | 'infinityPool';
  honestModeRules: HonestModeRules;
}

const STORAGE_KEY = 'odyssey-game-mode';

const DEFAULT_HONEST_RULES: HonestModeRules = {
  requireGearUnlocks: true,
  organicLevelUp: true,
  maxLevelInfinityStones: true,
  noRerolls: true,
  scribeItemVerification: true,
};

const DEFAULT_SETTINGS: GameModeSettings = {
  mode: 'infinityPool', // Default to full access
  honestModeRules: DEFAULT_HONEST_RULES,
};

// Load settings from localStorage
export function loadGameModeSettings(): GameModeSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge with defaults to ensure all properties exist
      return {
        mode: parsed.mode || DEFAULT_SETTINGS.mode,
        honestModeRules: {
          ...DEFAULT_HONEST_RULES,
          ...(parsed.honestModeRules || {}),
        },
      };
    }
  } catch (e) {
    console.error('Failed to load game mode settings:', e);
  }
  return DEFAULT_SETTINGS;
}

// Custom event for same-tab synchronization
export const GAME_MODE_CHANGE_EVENT = 'odyssey-game-mode-change';

// Save settings to localStorage and dispatch sync event
export function saveGameModeSettings(settings: GameModeSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    // Dispatch custom event for same-tab listeners
    window.dispatchEvent(new CustomEvent(GAME_MODE_CHANGE_EVENT, { detail: settings }));
  } catch (e) {
    console.error('Failed to save game mode settings:', e);
  }
}

// Helper to check if a specific rule is active
export function isRuleActive(settings: GameModeSettings, rule: keyof HonestModeRules): boolean {
  if (settings.mode === 'infinityPool') {
    return false; // Infinity Pool disables all restrictions
  }
  return settings.honestModeRules[rule];
}

// Helper to check if honest mode is enabled with any rules
export function isHonestModeActive(settings: GameModeSettings): boolean {
  return settings.mode === 'honest';
}

// Helper to check if infinity pool mode is enabled
export function isInfinityPoolActive(settings: GameModeSettings): boolean {
  return settings.mode === 'infinityPool';
}

// Get a human-readable description of each rule
export function getRuleDescription(rule: keyof HonestModeRules): { label: string; description: string } {
  const descriptions: Record<keyof HonestModeRules, { label: string; description: string }> = {
    requireGearUnlocks: {
      label: 'Gear Unlock Requirements',
      description: 'Gear pieces with achievement requirements are locked until those requirements are met.',
    },
    organicLevelUp: {
      label: 'Organic Leveling',
      description: 'Level ups occur only through XP gains and milestones. Manual level up is disabled.',
    },
    maxLevelInfinityStones: {
      label: 'Max Level Infinity Stones',
      description: 'Infinity Stones are only accessible once you reach maximum level (20).',
    },
    noRerolls: {
      label: 'No Rerolls',
      description: 'Dice rerolls are disabled. You must accept the outcome of your first roll.',
    },
    scribeItemVerification: {
      label: 'Scribe Item Verification',
      description: 'New items can only be obtained through verified narrative events in the Scribe.',
    },
  };
  return descriptions[rule];
}

// Get all rule keys
export function getAllRuleKeys(): (keyof HonestModeRules)[] {
  return [
    'requireGearUnlocks',
    'organicLevelUp',
    'maxLevelInfinityStones',
    'noRerolls',
    'scribeItemVerification',
  ];
}
