// Multi-Session Processing Types
// Types for batch import, campaign folders, and cumulative stats

import { ChronicleParseResult } from '../types';
import { EnhancedPatternResults } from '../patterns/index';

// ===== CAMPAIGN TYPES =====

export interface Campaign {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  
  // Metadata
  dmName?: string;
  setting?: string;
  startDate?: string;
  currentArc?: string;
  
  // Session tracking
  sessionCount: number;
  lastSessionDate?: string;
  
  // Tags for organization
  tags: string[];
  
  // Guide assignments
  gmGuideIds?: string[];
}

export interface CampaignSession {
  id: string;
  campaignId: string;
  sessionNumber: number;
  sessionName: string;
  sessionDate?: string;
  
  // Original input
  inputPreview: string;
  inputHash: string;
  inputLength: number;
  
  // Parse results
  parseMode: 'ai' | 'offline';
  parsedAt: string;
  parseResult?: ChronicleParseResult;
  enhancedPatterns?: EnhancedPatternResults;
  
  // Session summary
  summary?: SessionSummary;
  
  // Character arc markers
  arcMarkers: ArcMarker[];
  
  // Notes
  notes?: string;
  createdAt: string;
}

// ===== SESSION SUMMARY =====

export interface SessionSummary {
  // XP and progression
  totalXP: number;
  levelUps: number;
  
  // Combat stats
  combatEncounters: number;
  totalDamageDealt: number;
  totalDamageTaken: number;
  totalHealingReceived: number;
  criticalHits: number;
  kills: number;
  
  // Resources
  goldGained: number;
  goldSpent: number;
  itemsAcquired: number;
  itemsConsumed: number;
  
  // Spell usage
  spellSlotsByLevel: Record<number, number>;
  totalSpellsCast: number;
  
  // Rest tracking
  shortRests: number;
  longRests: number;
  
  // Death saves
  deathSaveSuccesses: number;
  deathSaveFailures: number;
  
  // Skill checks
  skillChecksMade: number;
  savingThrowsMade: number;
  
  // Misc
  inspirationGained: number;
  inspirationUsed: number;
  downtimeDays: number;
}

// ===== CHARACTER ARC DETECTION =====

export type ArcMarkerType = 
  | 'quest_start'
  | 'quest_complete'
  | 'major_combat'
  | 'boss_fight'
  | 'character_death'
  | 'character_revival'
  | 'level_up'
  | 'major_item_acquired'
  | 'npc_introduction'
  | 'location_discovery'
  | 'plot_revelation'
  | 'downtime_significant';

export interface ArcMarker {
  id: string;
  type: ArcMarkerType;
  title: string;
  description: string;
  sourceText: string;
  confidence: 'high' | 'medium' | 'low';
  sessionId: string;
  timestamp?: string;
}

// ===== BATCH IMPORT =====

export interface BatchImportInput {
  // Raw session logs
  sessions: Array<{
    name: string;
    content: string;
    date?: string;
    sessionNumber?: number;
  }>;
  
  // Campaign assignment
  campaignId?: string;
  createNewCampaign?: boolean;
  newCampaignName?: string;
  
  // Parse options
  parseMode: 'ai' | 'offline';
  autoApply: boolean;
}

export interface BatchImportResult {
  totalSessions: number;
  successfulParsed: number;
  failedParsed: number;
  
  // Cumulative stats across all sessions
  cumulativeStats: CumulativeStats;
  
  // Sessions with results
  sessions: Array<{
    name: string;
    success: boolean;
    error?: string;
    result?: ChronicleParseResult;
  }>;
  
  // Detected character arcs
  detectedArcs: ArcMarker[];
  
  // Campaign created/updated
  campaignId?: string;
}

// ===== CUMULATIVE STATS =====

export interface CumulativeStats {
  // Across all imported sessions
  totalSessions: number;
  totalInputCharacters: number;
  
  // XP and progression
  totalXP: number;
  levelUps: number;
  startingLevel?: number;
  endingLevel?: number;
  
  // Combat lifetime
  totalCombatEncounters: number;
  totalDamageDealt: number;
  totalDamageTaken: number;
  totalHealingReceived: number;
  totalCriticalHits: number;
  totalKills: number;
  
  // Resources lifetime
  totalGoldGained: number;
  totalGoldSpent: number;
  netGold: number;
  totalItemsAcquired: number;
  totalItemsConsumed: number;
  
  // Spell usage lifetime
  totalSpellsCast: number;
  spellSlotsByLevel: Record<number, number>;
  
  // Rest lifetime
  totalShortRests: number;
  totalLongRests: number;
  
  // Death saves lifetime
  totalDeathSaveSuccesses: number;
  totalDeathSaveFailures: number;
  totalDeaths: number;
  
  // Skill checks lifetime
  totalSkillChecks: number;
  totalSavingThrows: number;
  
  // Timeline
  firstSessionDate?: string;
  lastSessionDate?: string;
  totalDowntimeDays: number;
}

// ===== CAMPAIGN FOLDER MANAGEMENT =====

export interface CampaignFolder {
  id: string;
  name: string;
  campaigns: Campaign[];
  subfolders: CampaignFolder[];
  parentId?: string;
  createdAt: string;
}

// ===== STORAGE KEYS =====

export const CAMPAIGNS_STORAGE_KEY = 'odyssey-chronicle-campaigns';
export const CAMPAIGN_SESSIONS_KEY_PREFIX = 'odyssey-chronicle-campaign-sessions-';
export const CAMPAIGN_FOLDERS_KEY = 'odyssey-chronicle-folders';

// ===== HELPER FUNCTIONS =====

export function createEmptyCumulativeStats(): CumulativeStats {
  return {
    totalSessions: 0,
    totalInputCharacters: 0,
    totalXP: 0,
    levelUps: 0,
    totalCombatEncounters: 0,
    totalDamageDealt: 0,
    totalDamageTaken: 0,
    totalHealingReceived: 0,
    totalCriticalHits: 0,
    totalKills: 0,
    totalGoldGained: 0,
    totalGoldSpent: 0,
    netGold: 0,
    totalItemsAcquired: 0,
    totalItemsConsumed: 0,
    totalSpellsCast: 0,
    spellSlotsByLevel: {},
    totalShortRests: 0,
    totalLongRests: 0,
    totalDeathSaveSuccesses: 0,
    totalDeathSaveFailures: 0,
    totalDeaths: 0,
    totalSkillChecks: 0,
    totalSavingThrows: 0,
    totalDowntimeDays: 0,
  };
}

export function createEmptySessionSummary(): SessionSummary {
  return {
    totalXP: 0,
    levelUps: 0,
    combatEncounters: 0,
    totalDamageDealt: 0,
    totalDamageTaken: 0,
    totalHealingReceived: 0,
    criticalHits: 0,
    kills: 0,
    goldGained: 0,
    goldSpent: 0,
    itemsAcquired: 0,
    itemsConsumed: 0,
    spellSlotsByLevel: {},
    totalSpellsCast: 0,
    shortRests: 0,
    longRests: 0,
    deathSaveSuccesses: 0,
    deathSaveFailures: 0,
    skillChecksMade: 0,
    savingThrowsMade: 0,
    inspirationGained: 0,
    inspirationUsed: 0,
    downtimeDays: 0,
  };
}

export function mergeCumulativeStats(
  existing: CumulativeStats,
  sessionSummary: SessionSummary
): CumulativeStats {
  const merged = { ...existing };
  
  merged.totalSessions += 1;
  merged.totalXP += sessionSummary.totalXP;
  merged.levelUps += sessionSummary.levelUps;
  merged.totalCombatEncounters += sessionSummary.combatEncounters;
  merged.totalDamageDealt += sessionSummary.totalDamageDealt;
  merged.totalDamageTaken += sessionSummary.totalDamageTaken;
  merged.totalHealingReceived += sessionSummary.totalHealingReceived;
  merged.totalCriticalHits += sessionSummary.criticalHits;
  merged.totalKills += sessionSummary.kills;
  merged.totalGoldGained += sessionSummary.goldGained;
  merged.totalGoldSpent += sessionSummary.goldSpent;
  merged.netGold = merged.totalGoldGained - merged.totalGoldSpent;
  merged.totalItemsAcquired += sessionSummary.itemsAcquired;
  merged.totalItemsConsumed += sessionSummary.itemsConsumed;
  merged.totalSpellsCast += sessionSummary.totalSpellsCast;
  merged.totalShortRests += sessionSummary.shortRests;
  merged.totalLongRests += sessionSummary.longRests;
  merged.totalDeathSaveSuccesses += sessionSummary.deathSaveSuccesses;
  merged.totalDeathSaveFailures += sessionSummary.deathSaveFailures;
  merged.totalSkillChecks += sessionSummary.skillChecksMade;
  merged.totalSavingThrows += sessionSummary.savingThrowsMade;
  merged.totalDowntimeDays += sessionSummary.downtimeDays;
  
  // Merge spell slots by level
  for (const [level, count] of Object.entries(sessionSummary.spellSlotsByLevel)) {
    const lvl = parseInt(level, 10);
    merged.spellSlotsByLevel[lvl] = (merged.spellSlotsByLevel[lvl] || 0) + count;
  }
  
  return merged;
}
