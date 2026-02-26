// Combat Settings System
// Manages combat-related feature toggles like Two-Weapon Fighting Style

export interface CombatSettings {
  /** Two-Weapon Fighting Style: Adds ability modifier to offhand damage */
  hasTwoWeaponFightingStyle: boolean;
  /** Dual Wielder Feat: Allows two-weapon fighting with non-Light weapons */
  hasDualWielderFeat: boolean;
  /** Great Weapon Master Feat: -5 attack, +10 damage with heavy weapons */
  hasGreatWeaponMaster: boolean;
  /** Sharpshooter Feat: -5 attack, +10 damage with ranged weapons */
  hasSharpshooter: boolean;
  /** Sentinel Feat: Opportunity attacks reduce speed to 0 */
  hasSentinel: boolean;
  /** Polearm Master Feat: Bonus action attack with butt end, opportunity attacks at reach */
  hasPolearmMaster: boolean;
  /** Monk Martial Arts: Scales unarmed strike damage by level */
  hasMonkMartialArts: boolean;
  /** Show round advance notifications in combat */
  showRoundNotifications: boolean;
}

const STORAGE_KEY = 'odyssey-combat-settings';

const DEFAULT_SETTINGS: CombatSettings = {
  hasTwoWeaponFightingStyle: false,
  hasDualWielderFeat: false,
  hasGreatWeaponMaster: false,
  hasSharpshooter: false,
  hasSentinel: false,
  hasPolearmMaster: false,
  hasMonkMartialArts: false,
  showRoundNotifications: true,
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
      description: 'Add your ability modifier to the damage of offhand attacks.',
    },
    hasDualWielderFeat: {
      label: 'Dual Wielder',
      description: 'Two-weapon fighting with any one-handed melee weapons. +1 AC while dual wielding.',
    },
    hasGreatWeaponMaster: {
      label: 'Great Weapon Master',
      description: 'Take -5 to attack for +10 damage with Heavy weapons. Bonus action attack on crit/kill.',
    },
    hasSharpshooter: {
      label: 'Sharpshooter',
      description: 'Take -5 to attack for +10 damage with ranged weapons. Ignore cover and long range penalty.',
    },
    hasSentinel: {
      label: 'Sentinel',
      description: 'Opportunity attacks reduce speed to 0. Attack creatures that attack allies within 5ft.',
    },
    hasPolearmMaster: {
      label: 'Polearm Master',
      description: 'Bonus action attack with butt end (1d4). Opportunity attacks when enemies enter reach.',
    },
    hasMonkMartialArts: {
      label: 'Monk Martial Arts',
      description: 'Unarmed strikes scale by level: 1d4 (1-4), 1d6 (5-10), 1d8 (11-16), 1d10 (17+). Use DEX for attacks.',
    },
    showRoundNotifications: {
      label: 'Round Advance Notifications',
      description: 'Show toast notifications when combat rounds advance.',
    },
  };
  return descriptions[key];
}

// Helper to check if a feat applies to a weapon
export function isFeatApplicable(
  feat: 'greatWeaponMaster' | 'sharpshooter' | 'polearmMaster',
  weaponProperties: string[],
  isRanged: boolean
): boolean {
  const propsLower = weaponProperties.map(p => p.toLowerCase());
  
  switch (feat) {
    case 'greatWeaponMaster':
      return propsLower.some(p => p.includes('heavy') || p.includes('two-handed'));
    case 'sharpshooter':
      return isRanged;
    case 'polearmMaster':
      return propsLower.some(p => 
        p.includes('reach') || 
        p.includes('glaive') || 
        p.includes('halberd') || 
        p.includes('pike') ||
        p.includes('quarterstaff') ||
        p.includes('spear')
      );
    default:
      return false;
  }
}
