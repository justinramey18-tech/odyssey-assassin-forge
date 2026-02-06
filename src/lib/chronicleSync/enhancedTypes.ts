// Enhanced Chronicle Sync Types
// Extended detection patterns and analytics

import { ConfidenceLevel } from './types';

// ===== ENHANCED DETECTION TYPES =====

export interface ParsedRestEvent {
  type: 'short_rest' | 'long_rest';
  sourceText: string;
  confidence: ConfidenceLevel;
}

export interface ParsedSpellSlotUsage {
  level: number;
  spellName?: string;
  sourceText: string;
  confidence: ConfidenceLevel;
}

export interface ParsedDeathSave {
  type: 'success' | 'failure' | 'critical_success' | 'critical_failure';
  sourceText: string;
}

export interface ParsedCombatRound {
  roundNumber: number;
  events: string[];
  sourceText: string;
}

export interface ParsedKillEvent {
  targetName: string;
  sourceText: string;
}

export interface ParsedTempHP {
  amount: number;
  source?: string;
  sourceText: string;
  confidence: ConfidenceLevel;
}

export interface ParsedInspiration {
  type: 'gained' | 'used';
  sourceText: string;
  context?: string;
}

// ===== SESSION HISTORY TYPES =====

export interface ChronicleSession {
  id: string;
  userId?: string; // Only for cloud-synced sessions
  sessionName: string;
  inputPreview: string;
  inputHash: string;
  parseMode: 'ai' | 'offline';
  parsedAt: string;
  
  // Applied changes summary
  changesApplied: number;
  xpTotal: number;
  goldGained: number;
  goldSpent: number;
  itemsAcquired: number;
  itemsConsumed: number;
  achievementsTriggered: number;
  
  // Combat analytics
  damageDealt: number;
  damageTaken: number;
  healingReceived: number;
  criticalHits: number;
  kills: number;
  
  // Enhanced detection analytics
  spellSlotsUsed: Record<string, number>; // {"1": 2, "2": 1}
  deathSaves: { successes: number; failures: number };
  restsTaken: { short: number; long: number };
  combatRounds: number;
  conditionsApplied: string[];
  
  // For local storage only
  fullParseResult?: unknown;
  createdAt: string;
}

// ===== CAMPAIGN ANALYTICS TYPES =====

export interface CampaignAnalytics {
  userId?: string;
  
  // Lifetime combat stats
  totalDamageDealt: number;
  totalDamageTaken: number;
  totalHealingReceived: number;
  totalCriticalHits: number;
  totalKills: number;
  totalDeaths: number;
  
  // Lifetime resource stats
  totalXpEarned: number;
  totalGoldEarned: number;
  totalGoldSpent: number;
  totalItemsAcquired: number;
  totalItemsConsumed: number;
  totalSessionsImported: number;
  
  // Rest tracking
  totalShortRests: number;
  totalLongRests: number;
  
  // Spell tracking
  totalSpellsCast: number;
  spellSlotsUsedByLevel: Record<string, number>;
  
  // Death save tracking
  deathSaveSuccesses: number;
  deathSaveFailures: number;
  
  createdAt: string;
  updatedAt: string;
}

// ===== AUTO-APPLICATION TYPES =====

export interface AutoApplyConfig {
  gold: boolean;
  hp: boolean;
  conditions: boolean;
  restRecovery: boolean;
  deathSaves: boolean;
  spellSlots: boolean;
  tempHP: boolean;
  inspiration: boolean;
  initiative: boolean;
  round: boolean;
  kills: boolean;
}

export interface AutoApplyResult {
  goldApplied: { gained: number; spent: number };
  hpApplied: { damage: number; healing: number };
  conditionsApplied: string[];
  conditionsRemoved: string[];
  restApplied: 'short' | 'long' | null;
}

// ===== ENHANCED PARSE RESULT =====

export interface EnhancedParseResult {
  // From base ChronicleParseResult
  parseMode: 'ai' | 'offline';
  parsedAt: string;
  inputLength: number;
  
  // Enhanced detections
  restEvents: ParsedRestEvent[];
  spellSlotUsage: ParsedSpellSlotUsage[];
  deathSaves: ParsedDeathSave[];
  combatRounds: ParsedCombatRound[];
  kills: ParsedKillEvent[];
  
  // Computed analytics
  analytics: {
    totalDamageDealt: number;
    totalDamageTaken: number;
    totalHealingReceived: number;
    totalCriticalHits: number;
    totalKills: number;
    spellSlotsByLevel: Record<string, number>;
    deathSaveResults: { successes: number; failures: number };
    restCount: { short: number; long: number };
    combatRoundCount: number;
  };
}

// ===== STORAGE KEYS =====

export const CHRONICLE_LOCAL_SESSIONS_KEY = 'odyssey-chronicle-sessions';
export const CHRONICLE_LOCAL_ANALYTICS_KEY = 'odyssey-chronicle-analytics';
export const CHRONICLE_AUTO_APPLY_KEY = 'odyssey-chronicle-auto-apply';
export const MAX_LOCAL_SESSIONS = 50;
