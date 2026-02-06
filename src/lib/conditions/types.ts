// Duration types matching TTRPG conventions
export type DurationType = 
  | 'rounds'      // Combat turns (6 seconds each)
  | 'minutes'     // Out of combat timing (10 rounds = 1 minute)
  | 'hours'       // Long-duration buffs
  | 'save_ends'   // Until successful save
  | 'indefinite'; // Until manually removed

// Severity for visual styling
export type ConditionSeverity = 'minor' | 'moderate' | 'severe';

// Category for organization
export type ConditionCategory = 'debuff' | 'buff' | 'concentration';

// Saving throw types
export type SaveType = 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';

// Active condition instance (what's currently affecting the character)
export interface ActiveCondition {
  id: string;                    // Unique instance ID
  conditionId: string;           // Reference to condition config
  name: string;
  category: ConditionCategory;
  severity: ConditionSeverity;
  durationType: DurationType;
  durationValue: number;         // Rounds/minutes/hours remaining
  roundsElapsed: number;         // Tracks rounds for minute conversion (10 rounds = 1 minute)
  source?: string;               // "Poison Spray from Goblin"
  saveType?: SaveType;
  saveDC?: number;
  appliedAt: number;             // Unix timestamp
  notes?: string;
  spellLevel?: number;           // For concentration spells: the slot level used
}

// Static condition definition (the template)
export interface ConditionConfig {
  id: string;
  name: string;
  category: ConditionCategory;
  severity: ConditionSeverity;
  description: string;           // D&D rules text
  mechanical: string;            // Gameplay effect summary
  icon: string;                  // Lucide icon name
  defaultDuration: DurationType;
  defaultValue: number;
  suggestedSave?: SaveType;
}

// Input for adding a new condition
export interface NewConditionInput {
  conditionId: string;
  name: string;
  category: ConditionCategory;
  severity: ConditionSeverity;
  durationType: DurationType;
  durationValue: number;
  source?: string;
  saveType?: SaveType;
  saveDC?: number;
  notes?: string;
  spellLevel?: number;           // For concentration spells: the slot level used
}

// Quick-apply preset for common conditions
export interface QuickPreset {
  conditionId: string;
  durationType: DurationType;
  durationValue: number;
  concentration?: boolean;
}

// Conditions state for persistence
export interface ConditionsState {
  conditions: ActiveCondition[];
  recentConditions: string[]; // Last 5 conditionIds for quick re-apply
}

// Duration display helpers
export const formatDuration = (type: DurationType, value: number): string => {
  switch (type) {
    case 'rounds':
      return value === 1 ? '1 round' : `${value} rounds`;
    case 'minutes':
      return value === 1 ? '1 minute' : `${value} minutes`;
    case 'hours':
      return value === 1 ? '1 hour' : `${value} hours`;
    case 'save_ends':
      return 'Until save';
    case 'indefinite':
      return 'Until removed';
    default:
      return '';
  }
};

// Severity color mapping (for Tailwind classes)
export const SEVERITY_COLORS = {
  minor: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/50',
    text: 'text-blue-400',
    icon: 'text-blue-400',
  },
  moderate: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/50',
    text: 'text-amber-400',
    icon: 'text-amber-400',
  },
  severe: {
    bg: 'bg-red-500/20',
    border: 'border-red-500/50',
    text: 'text-red-400',
    icon: 'text-red-400',
  },
} as const;

// Category color mapping
export const CATEGORY_COLORS = {
  debuff: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/40',
    text: 'text-red-400',
  },
  buff: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/50',
    text: 'text-emerald-400',
  },
  concentration: {
    bg: 'bg-amber-500/20',
    border: 'border-amber-400',
    text: 'text-amber-300',
  },
} as const;

// Constants
export const ROUNDS_PER_MINUTE = 10;
export const MAX_ACTIVE_CONDITIONS = 15;
export const CONDITION_WARNING_THRESHOLD = 12;
export const STORAGE_KEY = 'odyssey-conditions-state';
