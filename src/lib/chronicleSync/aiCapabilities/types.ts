// Enhanced AI Capabilities Types
// Types for character recognition, NPC tracking, location extraction, quest detection, and loot distribution

import { ConfidenceLevel } from '../types';

// ===== CHARACTER RECOGNITION =====

export interface RecognizedCharacter {
  id: string;
  name: string;
  aliases: string[]; // e.g., ["Elara", "the elf", "our rogue"]
  
  // Character details (if detected)
  race?: string;
  class?: string;
  level?: number;
  
  // Role in the party
  isPlayerCharacter: boolean;
  playerName?: string;
  
  // Actions attributed to this character
  actionsPerformed: CharacterAction[];
  
  // Statistics
  totalDamageDealt: number;
  totalDamageTaken: number;
  totalHealingDone: number;
  kills: number;
  
  confidence: ConfidenceLevel;
  firstMentionIndex: number;
}

export interface CharacterAction {
  type: 'attack' | 'spell' | 'skill_check' | 'saving_throw' | 'healing' | 'damage_taken' | 'kill' | 'other';
  description: string;
  result?: string;
  value?: number;
  sourceText: string;
  index: number;
}

// ===== NPC TRACKING =====

export type NPCDisposition = 'friendly' | 'neutral' | 'hostile' | 'unknown';
export type NPCStatus = 'alive' | 'dead' | 'unknown';

export interface TrackedNPC {
  id: string;
  name: string;
  aliases: string[];
  
  // NPC details
  race?: string;
  occupation?: string;
  title?: string;
  description?: string;
  
  // Relationship data
  disposition: NPCDisposition;
  relationshipNotes: string[];
  
  // Location association
  associatedLocations: string[];
  currentLocation?: string;
  
  // Status
  status: NPCStatus;
  isRecurring: boolean;
  mentionCount: number;
  
  // First/last appearance
  firstMentionSessionId?: string;
  lastMentionSessionId?: string;
  firstMentionText: string;
  
  confidence: ConfidenceLevel;
}

export interface NPCRelationship {
  npcId: string;
  relatedToId: string; // Can be another NPC or a character
  relatedToType: 'npc' | 'character';
  relationship: string; // e.g., "employer", "enemy", "ally", "family"
  notes?: string;
}

// ===== LOCATION EXTRACTION =====

export type LocationType = 
  | 'city'
  | 'town'
  | 'village'
  | 'dungeon'
  | 'wilderness'
  | 'building'
  | 'landmark'
  | 'region'
  | 'plane'
  | 'unknown';

export interface TrackedLocation {
  id: string;
  name: string;
  aliases: string[];
  
  // Location details
  type: LocationType;
  description?: string;
  parentLocation?: string; // e.g., "Baldur's Gate" is in "Sword Coast"
  
  // Associated data
  associatedNPCs: string[];
  associatedQuests: string[];
  
  // Visit tracking
  visited: boolean;
  visitCount: number;
  firstVisitSessionId?: string;
  lastVisitSessionId?: string;
  
  // Events at this location
  notableEvents: LocationEvent[];
  
  confidence: ConfidenceLevel;
}

export interface LocationEvent {
  description: string;
  sessionId: string;
  sourceText: string;
  eventType: 'combat' | 'discovery' | 'social' | 'quest' | 'rest' | 'other';
}

// ===== QUEST DETECTION =====

export type QuestStatus = 'discovered' | 'accepted' | 'in_progress' | 'completed' | 'failed' | 'abandoned';
export type QuestType = 'main' | 'side' | 'personal' | 'faction' | 'unknown';

export interface TrackedQuest {
  id: string;
  name: string;
  description?: string;
  
  // Quest details
  type: QuestType;
  status: QuestStatus;
  priority?: 'high' | 'medium' | 'low';
  
  // Quest giver
  questGiverId?: string;
  questGiverName?: string;
  
  // Objectives
  objectives: QuestObjective[];
  
  // Rewards (if known)
  rewards?: QuestRewards;
  
  // Timeline
  discoveredSessionId: string;
  discoveredAt: string;
  completedSessionId?: string;
  completedAt?: string;
  
  // Associated data
  associatedLocations: string[];
  associatedNPCs: string[];
  
  // Source
  sourceText: string;
  confidence: ConfidenceLevel;
}

export interface QuestObjective {
  id: string;
  description: string;
  completed: boolean;
  optional: boolean;
  completedSessionId?: string;
}

export interface QuestRewards {
  xp?: number;
  gold?: number;
  items?: string[];
  reputation?: string;
  other?: string;
}

// ===== LOOT DISTRIBUTION =====

export interface LootEvent {
  id: string;
  sessionId: string;
  
  // What was looted
  itemName: string;
  itemType?: 'weapon' | 'armor' | 'consumable' | 'treasure' | 'magic_item' | 'mundane' | 'currency' | 'unknown';
  quantity: number;
  
  // Who received it
  recipientId?: string;
  recipientName?: string;
  
  // Source of loot
  source?: string; // e.g., "goblin chieftain", "treasure chest"
  location?: string;
  
  // Value
  estimatedValue?: number;
  rarity?: 'common' | 'uncommon' | 'rare' | 'very_rare' | 'legendary' | 'artifact';
  
  // Source text
  sourceText: string;
  confidence: ConfidenceLevel;
}

export interface LootDistributionSummary {
  sessionId: string;
  
  // Total loot
  totalItems: number;
  totalGold: number;
  
  // Distribution by character
  distributionByCharacter: Record<string, {
    characterName: string;
    items: string[];
    gold: number;
  }>;
  
  // Party loot (unclaimed/shared)
  partyLoot: LootEvent[];
  
  // Notable items
  magicItems: LootEvent[];
}

// ===== AI EXTRACTION REQUEST/RESPONSE =====

export interface AIExtractionRequest {
  sessionText: string;
  sessionId: string;
  
  // What to extract
  extractCharacters: boolean;
  extractNPCs: boolean;
  extractLocations: boolean;
  extractQuests: boolean;
  extractLoot: boolean;
  
  // Context from previous sessions
  knownCharacters?: RecognizedCharacter[];
  knownNPCs?: TrackedNPC[];
  knownLocations?: TrackedLocation[];
  knownQuests?: TrackedQuest[];
}

export interface AIExtractionResult {
  characters: RecognizedCharacter[];
  npcs: TrackedNPC[];
  npcRelationships: NPCRelationship[];
  locations: TrackedLocation[];
  quests: TrackedQuest[];
  lootEvents: LootEvent[];
  lootSummary: LootDistributionSummary;
  
  // Parsing metadata
  processingTime: number;
  confidence: ConfidenceLevel;
  warnings: string[];
}

// ===== STORAGE KEYS =====

export const AI_CHARACTERS_KEY = 'odyssey-chronicle-characters';
export const AI_NPCS_KEY = 'odyssey-chronicle-npcs';
export const AI_NPC_RELATIONSHIPS_KEY = 'odyssey-chronicle-npc-relationships';
export const AI_LOCATIONS_KEY = 'odyssey-chronicle-locations';
export const AI_QUESTS_KEY = 'odyssey-chronicle-quests';
export const AI_LOOT_KEY = 'odyssey-chronicle-loot';

// ===== HELPER FUNCTIONS =====

export function createEmptyAIExtractionResult(sessionId: string): AIExtractionResult {
  return {
    characters: [],
    npcs: [],
    npcRelationships: [],
    locations: [],
    quests: [],
    lootEvents: [],
    lootSummary: {
      sessionId,
      totalItems: 0,
      totalGold: 0,
      distributionByCharacter: {},
      partyLoot: [],
      magicItems: [],
    },
    processingTime: 0,
    confidence: 'low',
    warnings: [],
  };
}

export function mergeCharacterData(
  existing: RecognizedCharacter,
  newData: Partial<RecognizedCharacter>
): RecognizedCharacter {
  return {
    ...existing,
    ...newData,
    aliases: [...new Set([...existing.aliases, ...(newData.aliases || [])])],
    actionsPerformed: [...existing.actionsPerformed, ...(newData.actionsPerformed || [])],
    totalDamageDealt: existing.totalDamageDealt + (newData.totalDamageDealt || 0),
    totalDamageTaken: existing.totalDamageTaken + (newData.totalDamageTaken || 0),
    totalHealingDone: existing.totalHealingDone + (newData.totalHealingDone || 0),
    kills: existing.kills + (newData.kills || 0),
  };
}

export function mergeNPCData(
  existing: TrackedNPC,
  newData: Partial<TrackedNPC>
): TrackedNPC {
  return {
    ...existing,
    ...newData,
    aliases: [...new Set([...existing.aliases, ...(newData.aliases || [])])],
    relationshipNotes: [...existing.relationshipNotes, ...(newData.relationshipNotes || [])],
    associatedLocations: [...new Set([...existing.associatedLocations, ...(newData.associatedLocations || [])])],
    mentionCount: existing.mentionCount + 1,
    isRecurring: true,
  };
}

export function mergeLocationData(
  existing: TrackedLocation,
  newData: Partial<TrackedLocation>
): TrackedLocation {
  return {
    ...existing,
    ...newData,
    aliases: [...new Set([...existing.aliases, ...(newData.aliases || [])])],
    associatedNPCs: [...new Set([...existing.associatedNPCs, ...(newData.associatedNPCs || [])])],
    associatedQuests: [...new Set([...existing.associatedQuests, ...(newData.associatedQuests || [])])],
    notableEvents: [...existing.notableEvents, ...(newData.notableEvents || [])],
    visitCount: existing.visitCount + 1,
  };
}
