// Combat Settings System
// Manages combat-related feature toggles like Two-Weapon Fighting Style

export interface CombatSettings {
  /** Two-Weapon Fighting Style: Adds ability modifier to offhand damage */
  hasTwoWeaponFightingStyle: boolean;
}

const STORAGE_KEY = 'odyssey-combat-settings';

const DEFAULT_SETTINGS: CombatSettings = {
  hasTwoWeaponFightingStyle: false,
};

// Custom event for same-tab synchronization
export const COMBAT_SETTINGS_CHANGE_EVENT = 'odyssey-combat-settings-change';

// Load settings from localStorage
export function loadCombatSettings(): CombatSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
      };
    }
  } catch (e) {
    console.error('Failed to load combat settings:', e);
  }
  return DEFAULT_SETTINGS;
}

// Save settings to localStorage and dispatch sync event
export function saveCombatSettings(settings: CombatSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    // Dispatch custom event for same-tab listeners
    window.dispatchEvent(new CustomEvent(COMBAT_SETTINGS_CHANGE_EVENT, { detail: settings }));
  } catch (e) {
    console.error('Failed to save combat settings:', e);
  }
}

// Get a human-readable description
export function getCombatSettingDescription(key: keyof CombatSettings): { label: string; description: string } {
  const descriptions: Record<keyof CombatSettings, { label: string; description: string }> = {
    hasTwoWeaponFightingStyle: {
      label: 'Two-Weapon Fighting Style',
      description: 'Add your ability modifier to the damage of offhand attacks. Requires the Fighting Style class feature.',
    },
  };
  return descriptions[key];
}
