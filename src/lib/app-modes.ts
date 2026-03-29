import type { MainCategory, SubTabConfig } from '@/components/navigation/types';
import { getSubTabsForCategory } from '@/components/navigation/types';

// ── Types ──────────────────────────────────────────────────────────────────

export type AppMode = 'companion' | 'player' | 'magicBuild' | 'chronicler' | 'storyteller' | 'party' | 'fullAccess' | 'empyrean';

export type CustomOverrides = Record<string, boolean>;

export interface AppModeConfig {
  label: string;
  description: string;
  icon: string; // lucide icon name for the selection screen
  color: string; // tailwind accent color key (amber, red, violet, blue, emerald)
  visibleTabs: string[];
  visibleHomeFeatures: string[];
  visibleQuickAccess: string[];
  visibleDMButtons: string[];
}

// ── Visibility Matrix ──────────────────────────────────────────────────────

export const APP_MODE_CONFIGS: Record<AppMode, AppModeConfig> = {
  companion: {
    label: 'Companion',
    description: 'Dice, Empyrean guides/prompts, clock — pocket DM assistant',
    icon: 'Sparkles',
    color: 'amber',
    visibleTabs: ['settings'],
    visibleHomeFeatures: [
      'home.characterInfo', 'home.d20', 'home.clock', 'home.empyreanCard',
    ],
    visibleQuickAccess: [
      'quickAccess.prompts', 'quickAccess.oracle', 'quickAccess.features', 'quickAccess.settings',
    ],
    visibleDMButtons: ['dm.empyrean'],
  },

  player: {
    label: 'Martial Build',
    description: 'Core martial character sheet — combat, skills, abilities',
    icon: 'Sword',
    color: 'red',
    visibleTabs: [
      'combat', 'skills', 'abilities', 'settings',
    ],
    visibleHomeFeatures: [
      'home.characterInfo', 'home.d20', 'home.clock',
      'home.healthBar', 'home.restButtons', 'home.categoryNav',
    ],
    visibleQuickAccess: [
      'quickAccess.quickActions', 'quickAccess.combat', 'quickAccess.abilities',
      'quickAccess.features', 'quickAccess.settings',
    ],
    visibleDMButtons: [],
  },

  magicBuild: {
    label: 'Magic Build',
    description: 'Core caster sheet — arcana, consumables, spells & potions',
    icon: 'Wand2',
    color: 'cyan',
    visibleTabs: [
      'combat', 'skills', 'arcana', 'inventory', 'settings',
    ],
    visibleHomeFeatures: [
      'home.characterInfo', 'home.d20', 'home.clock',
      'home.healthBar', 'home.restButtons', 'home.categoryNav',
    ],
    visibleQuickAccess: [
      'quickAccess.quickActions', 'quickAccess.combat', 'quickAccess.arcana',
      'quickAccess.features', 'quickAccess.settings',
    ],
    visibleDMButtons: [],
  },

  chronicler: {
    label: 'Novel Builder',
    description: 'Simplified narrative forge — paste, style, transform',
    icon: 'Feather',
    color: 'rose',
    visibleTabs: [
      'scribe', 'cloud', 'settings',
    ],
    visibleHomeFeatures: [
      'home.characterInfo', 'home.clock',
    ],
    visibleQuickAccess: [
      'quickAccess.features', 'quickAccess.settings',
    ],
    visibleDMButtons: [],
  },

  storyteller: {
    label: 'Solo AI DM',
    description: 'Player + AI DM, Scribe, Chronicle — narrative tools',
    icon: 'BookOpen',
    color: 'violet',
    visibleTabs: [
      'combat', 'skills', 'abilities', 'arcana',
      'scribe', 'chronicle', 'settings',
    ],
    visibleHomeFeatures: [
      'home.characterInfo', 'home.d20', 'home.clock',
      'home.healthBar', 'home.restButtons', 'home.categoryNav',
      'home.wildShape', 'home.empyrean',
    ],
    visibleQuickAccess: [
      'quickAccess.prompts', 'quickAccess.quickActions', 'quickAccess.abilities',
      'quickAccess.arcana', 'quickAccess.oracle', 'quickAccess.features', 'quickAccess.settings',
    ],
    visibleDMButtons: ['dm.solo', 'dm.empyrean'],
  },

  party: {
    label: 'Party',
    description: 'Full co-op — multiplayer sync, economy, shared loot',
    icon: 'Users',
    color: 'blue',
    visibleTabs: [
      'combat', 'skills', 'abilities', 'arcana',
      'inventory', 'cloud', 'settings',
    ],
    visibleHomeFeatures: [
      'home.characterInfo', 'home.d20', 'home.clock',
      'home.healthBar', 'home.restButtons', 'home.categoryNav',
      'home.playModeToggle', 'home.partyButton', 'home.partyChat',
      'home.wildShape',
    ],
    visibleQuickAccess: [
      'quickAccess.quickActions', 'quickAccess.combat', 'quickAccess.abilities',
      'quickAccess.arcana', 'quickAccess.features', 'quickAccess.settings',
    ],
    visibleDMButtons: ['dm.party'],
  },

  fullAccess: {
    label: 'Full Access',
    description: 'Everything unlocked',
    icon: 'Crown',
    color: 'emerald',
    visibleTabs: [
      'combat', 'skills', 'abilities', 'arcana', 'legacy',
      'inventory', 'stars', 'feats',
      'scribe', 'chronicle', 'cloud', 'settings',
    ],
    visibleHomeFeatures: [
      'home.characterInfo', 'home.d20', 'home.clock',
      'home.healthBar', 'home.restButtons', 'home.categoryNav',
      'home.playModeToggle', 'home.partyButton', 'home.partyChat',
      'home.wildShape', 'home.empyrean',
    ],
    visibleQuickAccess: [
      'quickAccess.prompts', 'quickAccess.quickActions', 'quickAccess.combat',
      'quickAccess.abilities', 'quickAccess.arcana', 'quickAccess.oracle',
      'quickAccess.features', 'quickAccess.settings',
    ],
    visibleDMButtons: ['dm.solo', 'dm.party', 'dm.empyrean'],
  },
};

/** Display order for the mode selection screen */
export const APP_MODES_ORDERED: AppMode[] = [
  'companion', 'player', 'magicBuild', 'chronicler', 'storyteller', 'party', 'fullAccess',
];

// ── Helper Functions ───────────────────────────────────────────────────────

function resolveVisibility(
  featureId: string,
  list: string[],
  overrides?: CustomOverrides,
): boolean {
  if (overrides && featureId in overrides) return overrides[featureId];
  return list.includes(featureId);
}

/** Check if any feature ID is visible for the given mode */
export function isFeatureVisible(
  featureId: string,
  mode: AppMode,
  overrides?: CustomOverrides,
): boolean {
  const config = APP_MODE_CONFIGS[mode];
  const allLists = [
    ...config.visibleTabs,
    ...config.visibleHomeFeatures,
    ...config.visibleQuickAccess,
    ...config.visibleDMButtons,
  ];
  return resolveVisibility(featureId, allLists, overrides);
}

/** Convenience: check a navigation tab ID */
export function isTabVisible(
  tabId: string,
  mode: AppMode,
  overrides?: CustomOverrides,
): boolean {
  return resolveVisibility(tabId, APP_MODE_CONFIGS[mode].visibleTabs, overrides);
}

/** Convenience: check a home screen element */
export function isHomeFeatureVisible(
  featureId: string,
  mode: AppMode,
  overrides?: CustomOverrides,
): boolean {
  return resolveVisibility(featureId, APP_MODE_CONFIGS[mode].visibleHomeFeatures, overrides);
}

/** Convenience: check a DM drawer button */
export function isDMButtonVisible(
  buttonId: string,
  mode: AppMode,
  overrides?: CustomOverrides,
): boolean {
  return resolveVisibility(buttonId, APP_MODE_CONFIGS[mode].visibleDMButtons, overrides);
}

/** Convenience: check a quick-access menu item */
export function isQuickAccessVisible(
  itemId: string,
  mode: AppMode,
  overrides?: CustomOverrides,
): boolean {
  return resolveVisibility(itemId, APP_MODE_CONFIGS[mode].visibleQuickAccess, overrides);
}

/** Filter a category's sub-tabs to only those visible in the current mode */
export function getFilteredSubTabsForCategory(
  category: MainCategory,
  mode: AppMode,
  overrides?: CustomOverrides,
): SubTabConfig[] {
  if (category === 'home') return [];
  const allTabs = getSubTabsForCategory(category);
  return allTabs.filter(tab => isTabVisible(tab.id, mode, overrides));
}

/** Return categories that have at least one visible tab */
export function getVisibleCategories(
  mode: AppMode,
  overrides?: CustomOverrides,
): MainCategory[] {
  const categories: MainCategory[] = ['fighting', 'inventory', 'utility'];
  return categories.filter(
    cat => getFilteredSubTabsForCategory(cat, mode, overrides).length > 0,
  );
}

/** Returns all feature IDs grouped by category, for the customization UI */
export function getAllFeatureIds(): Record<string, { id: string; label: string }[]> {
  return {
    tabs: [
      { id: 'combat', label: 'Combat' },
      { id: 'skills', label: 'Skills' },
      { id: 'abilities', label: 'Abilities' },
      { id: 'arcana', label: 'Arcana' },
      { id: 'legacy', label: 'Legacy' },
      { id: 'inventory', label: 'Inventory' },
      { id: 'stars', label: 'Stars' },
      { id: 'feats', label: 'Feats' },
      { id: 'scribe', label: 'Scribe' },
      { id: 'chronicle', label: 'Chronicle' },
      { id: 'cloud', label: 'Cloud' },
      { id: 'settings', label: 'Settings' },
    ],
    home: [
      { id: 'home.healthBar', label: 'Health Bar' },
      { id: 'home.restButtons', label: 'Rest Buttons' },
      { id: 'home.categoryNav', label: 'Category Nav Cards' },
      { id: 'home.playModeToggle', label: 'Play Mode Toggle' },
      { id: 'home.partyButton', label: 'Party Button' },
      { id: 'home.partyChat', label: 'Party Chat' },
      
      { id: 'home.wildShape', label: 'Wild Shape' },
      
      { id: 'home.empyrean', label: 'Empyrean' },
      { id: 'home.empyreanCard', label: 'Empyrean Card' },
    ],
    quickAccess: [
      { id: 'quickAccess.prompts', label: 'RP Prompts' },
      { id: 'quickAccess.quickActions', label: 'Quick Actions' },
      { id: 'quickAccess.combat', label: 'Combat' },
      { id: 'quickAccess.abilities', label: 'Abilities' },
      { id: 'quickAccess.arcana', label: 'Arcana' },
      { id: 'quickAccess.oracle', label: 'Oracle' },
      { id: 'quickAccess.features', label: 'Features' },
      { id: 'quickAccess.settings', label: 'Settings' },
    ],
    dm: [
      { id: 'dm.solo', label: 'Solo DM' },
      { id: 'dm.party', label: 'Party DM' },
      { id: 'dm.empyrean', label: 'Empyrean Campaign' },
    ],
  };
}
