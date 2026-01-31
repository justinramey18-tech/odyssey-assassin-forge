import { Personality } from '@/components/oracle/types';

// Duration types for TTRPG time tracking
export type DurationType = 'rounds' | 'minutes' | 'hours' | 'save_ends' | 'indefinite';

// Saving throw stats
export type SaveStat = 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';

// Severity levels for visual styling
export type ConditionSeverity = 'low' | 'medium' | 'high' | 'critical';

// Condition categories
export type ConditionCategory = 'debuff' | 'buff' | 'environmental';

// Personality-keyed flavor descriptions
export interface PersonalityDescriptions {
  thunderhead: string;
  jarvis: string;
  deadpool: string;
}

// Condition definition (static config)
export interface ConditionDefinition {
  id: string;
  name: string;
  icon: string; // Lucide icon name
  category: ConditionCategory;
  severity: ConditionSeverity;
  mechanicalEffect: string;
  personalityDescriptions: PersonalityDescriptions;
  saveStat?: SaveStat;
  shortRestClears?: boolean;
  longRestClears?: boolean;
  color?: string; // HSL color for themed styling
}

// Duration tracking for active conditions
export interface ConditionDuration {
  type: DurationType;
  value: number; // Current remaining
  initial: number; // Starting value for progress display
}

// Active condition instance
export interface ActiveCondition {
  id: string; // Unique instance ID
  conditionId: string; // Links to ConditionDefinition
  name: string; // Display name (allows custom)
  source?: string; // "Giant Spider", "Lich's Curse", "Poison Trap"
  duration: ConditionDuration;
  isConcentration: boolean;
  appliedAt: number; // Timestamp
  notes?: string;
  severity: ConditionSeverity;
  category: ConditionCategory;
  icon?: string;
  color?: string;
}

// Session statistics for Chronicle Sync
export interface ConditionSessionStats {
  totalApplied: number;
  totalCleared: number;
  conditionCounts: Record<string, number>; // conditionId -> times applied
  sourceCounts: Record<string, number>; // source -> times applied
  totalRoundsAfflicted: number;
  savesMade: number;
  savesFailed: number;
  mostCommonCondition?: string;
  mostCommonSource?: string;
}

// Condition state for the hook
export interface ConditionState {
  active: ActiveCondition[];
  history: ActiveCondition[]; // Recently cleared for potential undo
  stats: ConditionSessionStats;
}

// Deadpool commentary events
export type DeadpoolEventType = 
  | 'condition_added'
  | 'condition_cleared'
  | 'critical_severity'
  | 'save_succeeded'
  | 'save_failed'
  | 'short_rest'
  | 'long_rest';

// Context for Oracle integration
export interface ConditionsContext {
  activeConditions: Array<{
    name: string;
    remainingRounds: number;
    source?: string;
    severity: ConditionSeverity;
    saveType?: SaveStat;
  }>;
  activeBuffs: Array<{
    name: string;
    remainingMinutes: number;
    concentration: boolean;
  }>;
}
