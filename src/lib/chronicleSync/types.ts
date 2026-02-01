// Chronicle Sync Type Definitions
// Interfaces for parsing session logs and applying changes to character state

export type ConfidenceLevel = 'high' | 'medium' | 'low';

// ===== PARSED DATA TYPES =====

export interface ParsedXPChange {
  amount: number;
  context: string;
  confidence: ConfidenceLevel;
  sourceText: string;
}

export interface ParsedHPChange {
  amount: number;
  type: 'damage' | 'healing';
  source: string;
  sourceText: string;
}

export interface ParsedItemChange {
  name: string;
  quantity: number;
  action: 'acquired' | 'consumed';
  consumableId?: string; // Matched consumable ID from database
  confidence: ConfidenceLevel;
  sourceText: string;
}

export interface ParsedAchievementTrigger {
  achievementId: string;
  achievementName: string;
  increment: number;
  evidence: string;
  confidence: ConfidenceLevel;
  sourceText: string;
}

export interface ParsedLevelUp {
  newLevel: number;
  sourceText: string;
}

export interface ParsedGoldChange {
  amount: number;
  action: 'gained' | 'spent';
  sourceText: string;
}

export interface ParsedCondition {
  name: string;
  action: 'applied' | 'removed';
  sourceText: string;
}

export interface ParsedCombatEvent {
  type: 'critical_hit' | 'sneak_attack' | 'kill' | 'counterattack';
  sourceText: string;
}

// ===== SHOP ITEM FROM CHRONICLE =====

export interface ParsedShopItem {
  name: string;
  itemType: 'equipment' | 'consumable' | 'miscellaneous';
  category?: string;
  costGold: number;
  mechanics?: {
    damage?: string;
    ac?: number;
    properties?: string[];
    effect?: string;
    duration?: string;
    savingThrow?: string;
  };
  rarity?: string;
  description?: string;
  lore?: string;
  sourceText: string;
  confidence: ConfidenceLevel;
}

// ===== PARSE RESULT CONTAINER =====

export interface ChronicleParseResult {
  xpChanges: ParsedXPChange[];
  hpChanges: ParsedHPChange[];
  itemChanges: ParsedItemChange[];
  achievementTriggers: ParsedAchievementTrigger[];
  goldChanges: ParsedGoldChange[];
  shopItems: ParsedShopItem[];
  conditions: ParsedCondition[];
  combatEvents: ParsedCombatEvent[];
  levelUp: ParsedLevelUp | null;
  parseMode: 'ai' | 'offline';
  parsedAt: string;
  inputLength: number;
}

// ===== REVIEW AND APPROVAL TYPES =====

export type ChangeCategory = 'xp' | 'achievement' | 'item' | 'levelUp' | 'gold' | 'shop';

export interface ReviewableChange {
  id: string;
  category: ChangeCategory;
  description: string;
  confidence: ConfidenceLevel;
  sourceText: string;
  approved: boolean;
  // Original data reference
  data: ParsedXPChange | ParsedItemChange | ParsedAchievementTrigger | ParsedLevelUp | ParsedGoldChange | ParsedShopItem;
}

export interface ApprovedChanges {
  xp: ParsedXPChange[];
  achievements: ParsedAchievementTrigger[];
  items: ParsedItemChange[];
  gold: ParsedGoldChange[];
  shopItems: ParsedShopItem[];
  levelUp: ParsedLevelUp | null;
  totalApplied: number;
}

// ===== UNDO SYSTEM =====

export interface UndoSnapshot {
  currentXP: number;
  characterLevel: number;
  achievements: Array<{ id: string; currentValue: number; claimedMilestones?: number[] }>;
  consumablesInventory: Array<{ consumableId: string; quantity: number }>;
  timestamp: number;
  changesApplied: number;
}

// ===== SESSION HISTORY =====

export interface ChronicleSyncSession {
  id: string;
  parsedAt: string;
  inputPreview: string; // First 200 chars
  changesApplied: number;
  categories: {
    xp: number;
    achievements: number;
    items: number;
  };
  canUndo: boolean;
}

// ===== SETTINGS =====

export interface ChronicleSyncSettings {
  autoApplyHighConfidence: boolean;
  defaultMode: 'ai' | 'offline';
  showSourceSnippets: boolean;
}

// ===== PROCESS STATE =====

export type ProcessStage = 
  | 'idle'
  | 'validating' 
  | 'sending' 
  | 'parsing' 
  | 'matching' 
  | 'complete'
  | 'error';

export interface ProcessProgress {
  stage: ProcessStage;
  message: string;
  progress: number; // 0-100
}

// ===== CONSTANTS =====

export const MAX_INPUT_CHARS = 50000;
export const WARN_THRESHOLD_CHARS = 40000;
export const UNDO_EXPIRATION_MS = 60 * 60 * 1000; // 1 hour
export const MAX_SESSION_HISTORY = 10;
