// Ability Cooldown System Types
// TTRPG-adjusted timing (minutes, not seconds like video games)

export interface CooldownConfig {
  abilityId: string;
  displayName: string;
  tree: 'hunter' | 'warrior' | 'assassin';
  baseCooldown: number; // in SECONDS (converted from minutes for calculations)
  tierReductions: {
    tier1: number; // 0% reduction (base)
    tier2: number; // 12.5% reduction
    tier3: number; // 25% reduction
  };
  isPassive: boolean;
}

export interface AbilityCooldownState {
  abilityId: string;
  tier: 1 | 2 | 3;
  lastUsed: number | null; // Unix timestamp (ms)
  availableAt: number | null; // Unix timestamp (ms)
  isOnCooldown: boolean;
  usageCount: number; // Session tracking
  effectiveCooldown: number; // Calculated with modifiers (seconds)
}

export interface CooldownModifier {
  id: string;
  source: 'gear' | 'buff' | 'debuff';
  type: 'percentage' | 'flat'; // -10% or -30 seconds
  value: number;
  expiresAt: number | null; // Unix timestamp for temporary buffs
}

export interface SessionState {
  sessionStart: number | null;
  isPaused: boolean;
  pausedAt: number | null;
  totalPausedTime: number; // Accumulated pause duration (ms)
}

export interface CooldownSettings {
  enabled: boolean;
  autoPause: boolean; // Pause when app loses focus
  notifications: boolean;
  soundEffects: boolean;
  timeFormat: 'mm:ss' | 'descriptive' | 'short';
}

export interface SessionStatistics {
  sessionStart: number;
  sessionEnd: number;
  duration: number; // ms
  totalPausedTime: number;
  activeDuration: number; // duration - pausedTime
  abilitiesUsed: Record<string, {
    name: string;
    count: number;
    totalCooldownTime: number;
  }>;
  mostUsedAbility: string;
  totalAbilityActivations: number;
}

export interface CooldownSaveState {
  cooldowns: [string, AbilityCooldownState][];
  session: SessionState;
  modifiers: CooldownModifier[];
  settings: CooldownSettings;
}

// Default settings
export const DEFAULT_COOLDOWN_SETTINGS: CooldownSettings = {
  enabled: true,
  autoPause: true,
  notifications: false,
  soundEffects: false,
  timeFormat: 'mm:ss',
};

export const DEFAULT_SESSION_STATE: SessionState = {
  sessionStart: null,
  isPaused: false,
  pausedAt: null,
  totalPausedTime: 0,
};
