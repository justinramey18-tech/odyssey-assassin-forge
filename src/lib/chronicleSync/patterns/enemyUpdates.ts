// Chronicle Sync Enemy Update Detection Patterns
// Regex patterns for detecting damage/healing/conditions applied to enemies

import { ConfidenceLevel } from '../types';
import { DamageType, EnemyCondition, DAMAGE_TYPES, ENEMY_CONDITIONS } from '@/lib/combat/creatureTypes';

/**
 * Represents a detected update to an enemy's state
 */
export interface ParsedEnemyUpdate {
  id: string;
  targetName: string;
  updateType: 'damage' | 'healing' | 'condition_add' | 'condition_remove' | 'defeat';
  amount?: number;
  damageType?: DamageType;
  condition?: EnemyCondition;
  source?: string;
  sourceText: string;
  confidence: ConfidenceLevel;
  timestamp: number;
}

// ===== DAMAGE DETECTION PATTERNS =====

// Pattern: "deal X damage to the orc", "hit goblin for 15 slashing damage"
const DAMAGE_TO_ENEMY_PATTERNS = [
  // "deal X damage to TARGET" or "deals X damage to TARGET"
  /(?:deal|deals|dealt|dealing)\s+(\d+)\s+(?:(\w+)\s+)?damage\s+to\s+(?:the\s+)?([a-zA-Z][a-zA-Z\s'-]*?)(?:\s*[.!,]|$)/gi,
  // "X damage to the TARGET"
  /(\d+)\s+(?:(\w+)\s+)?damage\s+to\s+(?:the\s+)?([a-zA-Z][a-zA-Z\s'-]*?)(?:\s*[.!,]|$)/gi,
  // "hit the TARGET for X damage"
  /(?:hit|hits|struck|strikes|stab|stabs|slash|slashes|shoot|shoots|blast|blasts)\s+(?:the\s+)?([a-zA-Z][a-zA-Z\s'-]*?)\s+(?:for|with)\s+(\d+)\s+(?:(\w+)\s+)?damage/gi,
  // "TARGET takes X damage"
  /(?:the\s+)?([a-zA-Z][a-zA-Z\s'-]*?)\s+(?:takes?|receives?|suffers?)\s+(\d+)\s+(?:(\w+)\s+)?damage/gi,
  // "injure/wound the TARGET for X"
  /(?:injure|injures|wound|wounds)\s+(?:the\s+)?([a-zA-Z][a-zA-Z\s'-]*?)\s+(?:for\s+)?(\d+)\s*(?:(\w+)\s+)?(?:damage|points?)?/gi,
  // "the TARGET is hit for X"
  /(?:the\s+)?([a-zA-Z][a-zA-Z\s'-]*?)\s+is\s+hit\s+for\s+(\d+)\s+(?:(\w+)\s+)?damage/gi,
  // "critical hit on TARGET for X damage"
  /(?:crit(?:ical)?(?:\s+hit)?)\s+(?:on\s+)?(?:the\s+)?([a-zA-Z][a-zA-Z\s'-]*?)\s+(?:for\s+)?(\d+)\s+(?:(\w+)\s+)?damage/gi,
];

// ===== HEALING DETECTION PATTERNS (for enemies) =====

const HEALING_ENEMY_PATTERNS = [
  // "the TARGET heals for X"
  /(?:the\s+)?([a-zA-Z][a-zA-Z\s'-]*?)\s+(?:heals?|regenerates?|recovers?)\s+(?:for\s+)?(\d+)\s*(?:HP|hp|hit\s*points?)?/gi,
  // "heal the TARGET for X"
  /(?:heal|heals)\s+(?:the\s+)?([a-zA-Z][a-zA-Z\s'-]*?)\s+(?:for\s+)?(\d+)\s*(?:HP|hp|hit\s*points?)?/gi,
];

// ===== CONDITION DETECTION PATTERNS =====

// Build condition words regex from the ENEMY_CONDITIONS constant
const CONDITION_WORDS = ENEMY_CONDITIONS.join('|');

// Pattern: "the orc becomes poisoned", "goblin is now stunned"
const CONDITION_ADD_PATTERNS = [
  // "TARGET becomes/is CONDITION"
  new RegExp(`(?:the\\s+)?([a-zA-Z][a-zA-Z\\s'-]*?)\\s+(?:becomes?|is\\s+now|is|gets?)\\s+(${CONDITION_WORDS})(?:\\s*[.!,]|$)`, 'gi'),
  // "CONDITION applied to TARGET"
  new RegExp(`(${CONDITION_WORDS})\\s+(?:is\\s+)?(?:applied|inflicted)\\s+(?:to|on)\\s+(?:the\\s+)?([a-zA-Z][a-zA-Z\\s'-]*?)`, 'gi'),
  // "knock/render TARGET CONDITION"
  new RegExp(`(?:knock|knocks|render|renders)\\s+(?:the\\s+)?([a-zA-Z][a-zA-Z\\s'-]*?)\\s+(${CONDITION_WORDS})`, 'gi'),
  // "TARGET falls/drops CONDITION" (e.g., "falls prone", "drops unconscious")
  new RegExp(`(?:the\\s+)?([a-zA-Z][a-zA-Z\\s'-]*?)\\s+(?:falls?|drops?)\\s+(${CONDITION_WORDS})`, 'gi'),
];

// Pattern: "the orc is no longer poisoned", "goblin recovers from stunned"
const CONDITION_REMOVE_PATTERNS = [
  // "TARGET is no longer CONDITION"
  new RegExp(`(?:the\\s+)?([a-zA-Z][a-zA-Z\\s'-]*?)\\s+is\\s+no\\s+longer\\s+(${CONDITION_WORDS})`, 'gi'),
  // "TARGET recovers from CONDITION"
  new RegExp(`(?:the\\s+)?([a-zA-Z][a-zA-Z\\s'-]*?)\\s+(?:recovers?|shakes?\\s+off|breaks?\\s+free)\\s+(?:from\\s+)?(${CONDITION_WORDS})`, 'gi'),
  // "CONDITION ends on TARGET"
  new RegExp(`(${CONDITION_WORDS})\\s+(?:ends?|wears?\\s+off|fades?)\\s+(?:on|from)\\s+(?:the\\s+)?([a-zA-Z][a-zA-Z\\s'-]*?)`, 'gi'),
];

// ===== DEFEAT PATTERNS (enhanced for real-time) =====

const INSTANT_DEFEAT_PATTERNS = [
  // "kill the TARGET", "slay the TARGET"
  /(?:kill|kills|killed|slay|slays|slain|destroy|destroys|destroyed|defeat|defeats|defeated|finish|finishes|finished)\s+(?:the\s+)?([a-zA-Z][a-zA-Z\s'-]*?)(?:\s*[.!,]|$)/gi,
  // "TARGET dies/falls/drops"
  /(?:the\s+)?([a-zA-Z][a-zA-Z\s'-]*?)\s+(?:dies?|falls?\s+dead|drops?\s+dead|is\s+(?:killed|slain|defeated)|collapses?)(?:\s*[.!,]|$)/gi,
  // "TARGET is down/out"
  /(?:the\s+)?([a-zA-Z][a-zA-Z\s'-]*?)\s+(?:is\s+)?(?:down|out|dead|destroyed|eliminated|vanquished)(?:\s*[.!,]|$)/gi,
];

// ===== UTILITY FUNCTIONS =====

// Common non-enemy words to filter out
const NON_ENEMY_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'player', 'character', 'party', 'group',
  'attack', 'damage', 'roll', 'dice', 'hit', 'miss', 'save', 'check', 'action',
  'spell', 'weapon', 'armor', 'item', 'gold', 'xp', 'hp', 'ac', 'dc',
  'round', 'turn', 'initiative', 'advantage', 'disadvantage', 'critical',
  'you', 'your', 'i', 'me', 'we', 'us', 'they', 'them', 'he', 'she', 'it',
  'target', 'enemy', 'foe', 'opponent', 'creature', 'monster',
]);

function cleanEnemyName(name: string): string {
  return name
    .replace(/^(?:the|a|an|one)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isValidEnemyName(name: string): boolean {
  const cleaned = cleanEnemyName(name).toLowerCase();
  if (cleaned.length < 2) return false;
  if (NON_ENEMY_WORDS.has(cleaned)) return false;
  if (/^\d+$/.test(cleaned)) return false;
  return true;
}

function parseDamageType(typeStr?: string): DamageType | undefined {
  if (!typeStr) return undefined;
  const lower = typeStr.toLowerCase().trim();
  return DAMAGE_TYPES.find(t => t === lower) as DamageType | undefined;
}

function parseCondition(condStr: string): EnemyCondition | undefined {
  const lower = condStr.toLowerCase().trim();
  return ENEMY_CONDITIONS.find(c => c === lower) as EnemyCondition | undefined;
}

function generateId(): string {
  return `update-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
}

function getContext(text: string, index: number, length: number): string {
  const start = Math.max(0, index - 30);
  const end = Math.min(text.length, index + length + 30);
  return text.slice(start, end).replace(/\s+/g, ' ').trim();
}

/**
 * Parse enemy damage events from session log text
 */
export function parseEnemyDamageUpdates(text: string): ParsedEnemyUpdate[] {
  const updates: ParsedEnemyUpdate[] = [];

  for (const pattern of DAMAGE_TO_ENEMY_PATTERNS) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    
    while ((match = regex.exec(text)) !== null) {
      // Pattern varies: some have damage first, some have target first
      let targetName: string;
      let amount: number;
      let damageTypeStr: string | undefined;

      // Detect pattern type based on capture groups
      if (/deal|deals|dealt|dealing/.test(pattern.source.toLowerCase()) && match[3]) {
        // "deal X damage to TARGET" pattern
        amount = parseInt(match[1], 10);
        damageTypeStr = match[2];
        targetName = match[3];
      } else if (/hit|hits|struck|strikes|stab|slash|shoot|blast/.test(pattern.source.toLowerCase())) {
        // "hit TARGET for X damage" pattern
        targetName = match[1];
        amount = parseInt(match[2], 10);
        damageTypeStr = match[3];
      } else if (/takes?|receives?|suffers?/.test(pattern.source.toLowerCase())) {
        // "TARGET takes X damage" pattern
        targetName = match[1];
        amount = parseInt(match[2], 10);
        damageTypeStr = match[3];
      } else {
        // Generic fallback
        if (!isNaN(parseInt(match[1], 10))) {
          amount = parseInt(match[1], 10);
          damageTypeStr = match[2];
          targetName = match[3] || match[1];
        } else {
          targetName = match[1];
          amount = parseInt(match[2], 10);
          damageTypeStr = match[3];
        }
      }

      targetName = cleanEnemyName(targetName);
      
      if (!isValidEnemyName(targetName) || isNaN(amount) || amount <= 0) continue;

      updates.push({
        id: generateId(),
        targetName: targetName.charAt(0).toUpperCase() + targetName.slice(1).toLowerCase(),
        updateType: 'damage',
        amount,
        damageType: parseDamageType(damageTypeStr),
        sourceText: getContext(text, match.index, match[0].length),
        confidence: amount > 0 && amount < 500 ? 'high' : 'medium',
        timestamp: Date.now(),
      });
    }
  }

  return updates;
}

/**
 * Parse enemy healing events from session log text
 */
export function parseEnemyHealingUpdates(text: string): ParsedEnemyUpdate[] {
  const updates: ParsedEnemyUpdate[] = [];

  for (const pattern of HEALING_ENEMY_PATTERNS) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    
    while ((match = regex.exec(text)) !== null) {
      const targetName = cleanEnemyName(match[1]);
      const amount = parseInt(match[2], 10);

      if (!isValidEnemyName(targetName) || isNaN(amount) || amount <= 0) continue;

      updates.push({
        id: generateId(),
        targetName: targetName.charAt(0).toUpperCase() + targetName.slice(1).toLowerCase(),
        updateType: 'healing',
        amount,
        sourceText: getContext(text, match.index, match[0].length),
        confidence: 'medium',
        timestamp: Date.now(),
      });
    }
  }

  return updates;
}

/**
 * Parse enemy condition changes from session log text
 */
export function parseEnemyConditionUpdates(text: string): ParsedEnemyUpdate[] {
  const updates: ParsedEnemyUpdate[] = [];

  // Condition additions
  for (const pattern of CONDITION_ADD_PATTERNS) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    
    while ((match = regex.exec(text)) !== null) {
      // Some patterns have condition first, some have target first
      let targetName: string;
      let conditionStr: string;
      
      const firstLower = (match[1] || '').toLowerCase();
      if (ENEMY_CONDITIONS.some(c => c === firstLower)) {
        conditionStr = match[1];
        targetName = match[2];
      } else {
        targetName = match[1];
        conditionStr = match[2];
      }

      targetName = cleanEnemyName(targetName);
      const condition = parseCondition(conditionStr);

      if (!isValidEnemyName(targetName) || !condition) continue;

      updates.push({
        id: generateId(),
        targetName: targetName.charAt(0).toUpperCase() + targetName.slice(1).toLowerCase(),
        updateType: 'condition_add',
        condition,
        sourceText: getContext(text, match.index, match[0].length),
        confidence: 'high',
        timestamp: Date.now(),
      });
    }
  }

  // Condition removals
  for (const pattern of CONDITION_REMOVE_PATTERNS) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    
    while ((match = regex.exec(text)) !== null) {
      let targetName: string;
      let conditionStr: string;
      
      const firstLower = (match[1] || '').toLowerCase();
      if (ENEMY_CONDITIONS.some(c => c === firstLower)) {
        conditionStr = match[1];
        targetName = match[2];
      } else {
        targetName = match[1];
        conditionStr = match[2];
      }

      targetName = cleanEnemyName(targetName);
      const condition = parseCondition(conditionStr);

      if (!isValidEnemyName(targetName) || !condition) continue;

      updates.push({
        id: generateId(),
        targetName: targetName.charAt(0).toUpperCase() + targetName.slice(1).toLowerCase(),
        updateType: 'condition_remove',
        condition,
        sourceText: getContext(text, match.index, match[0].length),
        confidence: 'high',
        timestamp: Date.now(),
      });
    }
  }

  return updates;
}

/**
 * Parse enemy defeat events from session log text
 */
export function parseEnemyDefeatUpdates(text: string): ParsedEnemyUpdate[] {
  const updates: ParsedEnemyUpdate[] = [];

  for (const pattern of INSTANT_DEFEAT_PATTERNS) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    
    while ((match = regex.exec(text)) !== null) {
      const targetName = cleanEnemyName(match[1]);

      if (!isValidEnemyName(targetName)) continue;

      updates.push({
        id: generateId(),
        targetName: targetName.charAt(0).toUpperCase() + targetName.slice(1).toLowerCase(),
        updateType: 'defeat',
        sourceText: getContext(text, match.index, match[0].length),
        confidence: 'high',
        timestamp: Date.now(),
      });
    }
  }

  return updates;
}

/**
 * Parse all enemy update events from session log text
 */
export function parseAllEnemyUpdates(text: string): ParsedEnemyUpdate[] {
  const damageUpdates = parseEnemyDamageUpdates(text);
  const healingUpdates = parseEnemyHealingUpdates(text);
  const conditionUpdates = parseEnemyConditionUpdates(text);
  const defeatUpdates = parseEnemyDefeatUpdates(text);

  // Combine and sort by position in text (using sourceText as proxy)
  const allUpdates = [
    ...damageUpdates,
    ...healingUpdates,
    ...conditionUpdates,
    ...defeatUpdates,
  ];

  // Deduplicate: if same target has defeat + damage in quick succession, keep defeat
  const seenDefeats = new Set(
    defeatUpdates.map(u => u.targetName.toLowerCase())
  );

  return allUpdates.filter(u => {
    if (u.updateType === 'defeat') return true;
    // Don't include damage/healing for already-defeated enemies
    const isDefeated = seenDefeats.has(u.targetName.toLowerCase());
    if (isDefeated) {
      return false;
    }
    return true;
  });
}
