// Chronicle Sync Core Processor
// Handles offline parsing and AI prompt generation

import { allConsumables } from '@/lib/consumables';
import { ACHIEVEMENT_NAMES } from './achievementMatcher';
import { 
  ChronicleParseResult, 
  ParsedXPChange, 
  ParsedHPChange, 
  ParsedItemChange,
  ParsedGoldChange,
  ParsedShopItem,
  ParsedCondition,
  ParsedCombatEvent,
  ParsedLevelUp,
  ConfidenceLevel,
} from './types';
import {
  parseXPMatches,
  parseDamageMatches,
  parseHealingMatches,
  parseItemAcquireMatches,
  parseItemUseMatches,
  parseGoldMatches,
  parseCritMatches,
  parseLevelUpMatches,
  parseConditionMatches,
  parseMultiCurrencyMatches,
} from './patterns';
import { parseEnemyMatches } from './patterns/enemies';
import { matchAchievements, buildAchievementTriggers } from './achievementMatcher';
import { findBestConsumableMatch, parseItemQuantity } from './fuzzyMatch';
import { extractAssistantContent } from '@/lib/scribe/smartParsing';
import { parseShopItemMatches } from './patterns/shopItems';
import { deduplicateByProximity, deduplicateBySourceText } from './deduplication';

/**
 * Parse session log using offline regex patterns
 * No AI required - instant results
 */
export function parseLogOffline(rawInput: string): ChronicleParseResult {
  // Gap 2: Smart Parse filtering - strip player messages from chat logs
  const parseResult = extractAssistantContent(rawInput);
  const input = parseResult.isChatFormat ? parseResult.filteredText : rawInput;

  const xpChanges: ParsedXPChange[] = [];
  const hpChanges: ParsedHPChange[] = [];
  const itemChanges: ParsedItemChange[] = [];
  const goldChanges: ParsedGoldChange[] = [];
  const conditions: ParsedCondition[] = [];
  const combatEvents: ParsedCombatEvent[] = [];
  let levelUp: ParsedLevelUp | null = null;
  
  // Parse XP (with deduplication - Gap 6)
  const xpMatches = deduplicateByProximity(parseXPMatches(input), 500, input);
  for (const match of xpMatches) {
    xpChanges.push({
      amount: match.value as number,
      context: match.context,
      confidence: 'high',
      sourceText: match.fullMatch,
    });
  }
  
  // Parse Damage (Gap 4: expanded patterns now included in patterns.ts)
  const damageMatches = parseDamageMatches(input);
  for (const match of damageMatches) {
    hpChanges.push({
      amount: -(match.value as number),
      type: 'damage',
      source: match.context,
      sourceText: match.fullMatch,
    });
  }
  
  // Parse Healing
  const healingMatches = parseHealingMatches(input);
  for (const match of healingMatches) {
    hpChanges.push({
      amount: match.value as number,
      type: 'healing',
      source: match.context,
      sourceText: match.fullMatch,
    });
  }
  
  // Parse Item Acquisitions
  const itemAcquireMatches = parseItemAcquireMatches(input);
  for (const match of itemAcquireMatches) {
    const parsed = parseItemQuantity(match.value as string);
    const consumableMatch = findBestConsumableMatch(parsed.itemName, allConsumables);
    
    itemChanges.push({
      name: parsed.itemName,
      quantity: parsed.quantity,
      action: 'acquired',
      consumableId: consumableMatch?.consumable.id,
      confidence: consumableMatch?.confidence || 'low',
      sourceText: match.fullMatch,
    });
  }
  
  // Parse Item Usage
  const itemUseMatches = parseItemUseMatches(input);
  for (const match of itemUseMatches) {
    const parsed = parseItemQuantity(match.value as string);
    const consumableMatch = findBestConsumableMatch(parsed.itemName, allConsumables);
    
    itemChanges.push({
      name: parsed.itemName,
      quantity: parsed.quantity,
      action: 'consumed',
      consumableId: consumableMatch?.consumable.id,
      confidence: consumableMatch?.confidence || 'low',
      sourceText: match.fullMatch,
    });
  }
  
  // Parse Gold (with deduplication - Gap 6)
  const goldMatches = parseGoldMatches(input);
  const dedupedGoldGained = deduplicateByProximity(goldMatches.gained, 500, input);
  const dedupedGoldSpent = deduplicateByProximity(goldMatches.spent, 500, input);
  for (const match of dedupedGoldGained) {
    goldChanges.push({
      amount: match.value as number,
      action: 'gained',
      sourceText: match.fullMatch,
    });
  }
  for (const match of dedupedGoldSpent) {
    goldChanges.push({
      amount: match.value as number,
      action: 'spent',
      sourceText: match.fullMatch,
    });
  }

  // Gap 3: Multi-currency support (sp, cp, ep, pp → gold equivalent)
  const multiCurrency = parseMultiCurrencyMatches(input);
  for (const match of multiCurrency.gained) {
    goldChanges.push({
      amount: match.value as number,
      action: 'gained',
      sourceText: match.fullMatch,
    });
  }
  for (const match of multiCurrency.spent) {
    goldChanges.push({
      amount: match.value as number,
      action: 'spent',
      sourceText: match.fullMatch,
    });
  }
  
  // Parse Crits/Combat Events
  const critMatches = parseCritMatches(input);
  for (const match of critMatches) {
    combatEvents.push({
      type: 'critical_hit',
      sourceText: match.context,
    });
  }
  
  // Parse Level Up
  const levelUpMatches = parseLevelUpMatches(input);
  if (levelUpMatches.length > 0) {
    const highestLevel = Math.max(...levelUpMatches.map(m => m.value as number));
    levelUp = {
      newLevel: highestLevel,
      sourceText: levelUpMatches[0].fullMatch,
    };
  }
  
  // Parse Conditions (Gap 5: expanded removal detection in patterns.ts)
  const conditionMatches = parseConditionMatches(input);
  for (const match of conditionMatches) {
    const [action, name] = (match.value as string).split(':');
    conditions.push({
      name,
      action: action as 'applied' | 'removed',
      sourceText: match.context,
    });
  }
  
  // Match Achievements
  const achievementMatches = matchAchievements(input);
  const achievementTriggers = buildAchievementTriggers(achievementMatches);
  
  // Parse enemies from the log
  const enemies = parseEnemyMatches(input);

  // Gap 1: Parse shop items offline
  const shopItems = parseShopItemMatches(input);
  
  return {
    xpChanges,
    hpChanges,
    itemChanges,
    achievementTriggers,
    goldChanges,
    shopItems,
    conditions,
    combatEvents,
    enemies,
    levelUp,
    parseMode: 'offline',
    parsedAt: new Date().toISOString(),
    inputLength: rawInput.length,
  };
}

/**
 * Build AI prompt for structured extraction
 */
export function buildAIPrompt(input: string): string {
  const achievementList = Object.entries(ACHIEVEMENT_NAMES)
    .map(([id, name]) => `  - ${id}: ${name}`)
    .join('\n');
  
  const consumableList = allConsumables
    .map(c => c.name)
    .slice(0, 50) // Top 50 for context limit
    .join(', ');

  return `You are a TTRPG session log parser. Extract mechanical game data from the following session transcript.

## Instructions
1. Identify all XP gains with amounts and context
2. Identify all HP changes (damage taken, healing received)
3. Identify items acquired or consumed (potions, scrolls, etc.)
4. Identify gold/currency changes
5. Identify conditions applied or removed
6. Identify if a level-up occurred
7. Match narrative events to achievement categories

## Achievement Categories
${achievementList}

## Known Consumables
${consumableList}

## Response Format
Return ONLY valid JSON with this structure:
{
  "xp_changes": [{"amount": number, "context": "brief description", "confidence": "high"|"medium"|"low", "source_text": "quoted text"}],
  "hp_changes": [{"amount": number, "type": "damage"|"healing", "source": "what caused it", "source_text": "quoted text"}],
  "items": [{"name": "item name", "quantity": number, "action": "acquired"|"consumed", "confidence": "high"|"medium"|"low", "source_text": "quoted text"}],
  "gold_changes": [{"amount": number, "action": "gained"|"spent", "source_text": "quoted text"}],
  "conditions": [{"name": "condition name", "action": "applied"|"removed", "source_text": "quoted text"}],
  "level_up": {"new_level": number, "source_text": "quoted text"} or null,
  "achievements": [{"id": "achievement-id", "evidence": "key phrase matched", "confidence": "high"|"medium"|"low", "source_text": "quoted text"}]
}

## Rules
- Only extract explicit game mechanics, not implied ones
- For items, match to known consumable names when possible
- Use "high" confidence for explicit mentions, "medium" for inferred, "low" for uncertain
- Include the source_text as a short quote from the log
- Achievement IDs must match the list above exactly

## Session Log
${input.slice(0, 45000)}`;
}

/**
 * Parse AI response into structured result
 */
export function parseAIResponse(response: unknown): ChronicleParseResult | null {
  try {
    const data = response as Record<string, unknown>;
    
    const xpChanges: ParsedXPChange[] = [];
    const hpChanges: ParsedHPChange[] = [];
    const itemChanges: ParsedItemChange[] = [];
    const goldChanges: ParsedGoldChange[] = [];
    const conditions: ParsedCondition[] = [];
    const combatEvents: ParsedCombatEvent[] = [];
    let levelUp: ParsedLevelUp | null = null;
    
    // Parse XP changes
    if (Array.isArray(data.xp_changes)) {
      for (const xp of data.xp_changes) {
        if (typeof xp.amount === 'number' && xp.amount > 0) {
          xpChanges.push({
            amount: xp.amount,
            context: String(xp.context || ''),
            confidence: validateConfidence(xp.confidence),
            sourceText: String(xp.source_text || ''),
          });
        }
      }
    }
    
    // Parse HP changes
    if (Array.isArray(data.hp_changes)) {
      for (const hp of data.hp_changes) {
        if (typeof hp.amount === 'number') {
          hpChanges.push({
            amount: hp.type === 'damage' ? -Math.abs(hp.amount) : Math.abs(hp.amount),
            type: hp.type === 'healing' ? 'healing' : 'damage',
            source: String(hp.source || ''),
            sourceText: String(hp.source_text || ''),
          });
        }
      }
    }
    
    // Parse items
    if (Array.isArray(data.items)) {
      for (const item of data.items) {
        if (typeof item.name === 'string' && item.name.length > 0) {
          const consumableMatch = findBestConsumableMatch(item.name, allConsumables);
          
          itemChanges.push({
            name: item.name,
            quantity: typeof item.quantity === 'number' ? item.quantity : 1,
            action: item.action === 'consumed' ? 'consumed' : 'acquired',
            consumableId: consumableMatch?.consumable.id,
            confidence: consumableMatch?.confidence || validateConfidence(item.confidence),
            sourceText: String(item.source_text || ''),
          });
        }
      }
    }
    
    // Parse gold
    if (Array.isArray(data.gold_changes)) {
      for (const gold of data.gold_changes) {
        if (typeof gold.amount === 'number' && gold.amount > 0) {
          goldChanges.push({
            amount: gold.amount,
            action: gold.action === 'spent' ? 'spent' : 'gained',
            sourceText: String(gold.source_text || ''),
          });
        }
      }
    }
    
    // Parse conditions
    if (Array.isArray(data.conditions)) {
      for (const cond of data.conditions) {
        if (typeof cond.name === 'string' && cond.name.length > 0) {
          conditions.push({
            name: cond.name.toLowerCase(),
            action: cond.action === 'removed' ? 'removed' : 'applied',
            sourceText: String(cond.source_text || ''),
          });
        }
      }
    }
    
    // Parse level up
    if (data.level_up && typeof (data.level_up as Record<string, unknown>).new_level === 'number') {
      const levelData = data.level_up as Record<string, unknown>;
      const newLevel = levelData.new_level as number;
      if (newLevel >= 1 && newLevel <= 20) {
        levelUp = {
          newLevel,
          sourceText: String(levelData.source_text || ''),
        };
      }
    }
    
    // Parse achievements
    const achievementTriggers = [];
    if (Array.isArray(data.achievements)) {
      for (const ach of data.achievements) {
        if (typeof ach.id === 'string' && ACHIEVEMENT_NAMES[ach.id]) {
          achievementTriggers.push({
            achievementId: ach.id,
            achievementName: ACHIEVEMENT_NAMES[ach.id],
            increment: 1,
            evidence: String(ach.evidence || ''),
            confidence: validateConfidence(ach.confidence),
            sourceText: String(ach.source_text || ''),
          });
        }
      }
    }
    
    // Parse shop items
    const shopItems: ParsedShopItem[] = [];
    if (Array.isArray(data.shop_items)) {
      for (const item of data.shop_items) {
        if (typeof item.name === 'string' && typeof item.cost_gold === 'number') {
          shopItems.push({
            name: item.name,
            itemType: item.item_type || 'miscellaneous',
            category: item.category,
            costGold: item.cost_gold,
            mechanics: item.mechanics || {},
            rarity: item.rarity || 'common',
            description: item.description || '',
            lore: item.lore || '',
            sourceText: String(item.source_text || '').slice(0, 100),
            confidence: validateConfidence(item.confidence),
          });
        }
      }
    }
    
    return {
      xpChanges,
      hpChanges,
      itemChanges,
      achievementTriggers,
      goldChanges,
      shopItems,
      conditions,
      combatEvents,
      enemies: [], // Will be populated from AI response or offline parsing
      levelUp,
      parseMode: 'ai',
      parsedAt: new Date().toISOString(),
      inputLength: 0, // Will be set by caller
    };
  } catch (error) {
    console.error('Failed to parse AI response:', error);
    return null;
  }
}

function validateConfidence(value: unknown): ConfidenceLevel {
  if (value === 'high' || value === 'medium' || value === 'low') {
    return value;
  }
  return 'medium';
}

/**
 * Calculate totals for display
 */
export function calculateChangeSummary(result: ChronicleParseResult): {
  totalXP: number;
  totalItems: number;
  totalAchievements: number;
  hasLevelUp: boolean;
  totalHP: { damage: number; healing: number };
  totalGold: { gained: number; spent: number };
  totalConditions: number;
  totalShopItems: number;
  totalEnemies: { active: number; defeated: number };
} {
  const totalXP = result.xpChanges.reduce((sum, xp) => sum + xp.amount, 0);
  const totalItems = result.itemChanges.length;
  const totalAchievements = result.achievementTriggers.length;
  const hasLevelUp = result.levelUp !== null;
  
  const totalHP = {
    damage: result.hpChanges
      .filter(hp => hp.type === 'damage')
      .reduce((sum, hp) => sum + Math.abs(hp.amount), 0),
    healing: result.hpChanges
      .filter(hp => hp.type === 'healing')
      .reduce((sum, hp) => sum + hp.amount, 0),
  };
  
  const totalGold = {
    gained: result.goldChanges
      .filter(g => g.action === 'gained')
      .reduce((sum, g) => sum + g.amount, 0),
    spent: result.goldChanges
      .filter(g => g.action === 'spent')
      .reduce((sum, g) => sum + g.amount, 0),
  };
  
  const totalConditions = result.conditions.length;
  const totalShopItems = result.shopItems.length;
  
  // Enemy totals
  const totalEnemies = {
    active: result.enemies
      .filter(e => e.status === 'active')
      .reduce((sum, e) => sum + e.quantity, 0),
    defeated: result.enemies
      .filter(e => e.status === 'defeated')
      .reduce((sum, e) => sum + e.quantity, 0),
  };
  
  return {
    totalXP,
    totalItems,
    totalAchievements,
    hasLevelUp,
    totalHP,
    totalGold,
    totalConditions,
    totalShopItems,
    totalEnemies,
  };
}
