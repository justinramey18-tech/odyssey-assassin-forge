// Chronicle Sync Validation
// Honest Mode enforcement for Chronicle Sync imports

import { allConsumables, getConsumableById } from '@/lib/consumables';
import { 
  ChronicleParseResult, 
  ParsedXPChange, 
  ParsedItemChange, 
  ParsedAchievementTrigger,
  ConfidenceLevel,
} from './types';

export interface HonestModeChronicleRules {
  requireChronicleEvidence: boolean;
  chronicleItemValidation: boolean;
  chronicleXPCap: number;
}

export interface ValidationResult {
  isValid: boolean;
  warnings: string[];
  errors: string[];
  filtered: ChronicleParseResult;
}

/**
 * Validate and filter parse results according to Honest Mode rules
 */
export function validateWithHonestMode(
  result: ChronicleParseResult,
  rules: HonestModeChronicleRules
): ValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  
  // Clone the result for filtering
  const filtered: ChronicleParseResult = {
    ...result,
    xpChanges: [...result.xpChanges],
    itemChanges: [...result.itemChanges],
    achievementTriggers: [...result.achievementTriggers],
    hpChanges: [...result.hpChanges],
    goldChanges: [...result.goldChanges],
    shopItems: [...result.shopItems],
    conditions: [...result.conditions],
    combatEvents: [...result.combatEvents],
    enemies: [...result.enemies],
    levelUp: result.levelUp,
  };
  
  // === XP CAP VALIDATION ===
  if (rules.chronicleXPCap > 0) {
    const totalXP = filtered.xpChanges.reduce((sum, xp) => sum + xp.amount, 0);
    
    if (totalXP > rules.chronicleXPCap) {
      warnings.push(`XP total (${totalXP}) exceeds Honest Mode cap (${rules.chronicleXPCap}). Capped to maximum.`);
      
      // Cap to maximum by proportionally reducing all XP gains
      const ratio = rules.chronicleXPCap / totalXP;
      filtered.xpChanges = filtered.xpChanges.map(xp => ({
        ...xp,
        amount: Math.floor(xp.amount * ratio),
      }));
    }
  }
  
  // === ITEM VALIDATION ===
  if (rules.chronicleItemValidation) {
    const validItems: ParsedItemChange[] = [];
    const rejectedItems: string[] = [];
    
    for (const item of filtered.itemChanges) {
      if (item.consumableId) {
        // Verify the consumable exists in our database
        const consumable = getConsumableById(item.consumableId);
        if (consumable) {
          validItems.push(item);
        } else {
          rejectedItems.push(item.name);
        }
      } else {
        // No matched consumable ID
        rejectedItems.push(item.name);
      }
    }
    
    if (rejectedItems.length > 0) {
      warnings.push(`Unknown items rejected: ${rejectedItems.join(', ')}`);
    }
    
    filtered.itemChanges = validItems;
  }
  
  // === ACHIEVEMENT EVIDENCE VALIDATION ===
  if (rules.requireChronicleEvidence) {
    const validAchievements: ParsedAchievementTrigger[] = [];
    const rejectedAchievements: string[] = [];
    
    for (const trigger of filtered.achievementTriggers) {
      // Require high confidence AND meaningful source text
      if (trigger.confidence === 'high' && trigger.sourceText.length >= 20) {
        validAchievements.push(trigger);
      } else {
        rejectedAchievements.push(trigger.achievementName);
      }
    }
    
    if (rejectedAchievements.length > 0) {
      warnings.push(`Achievements rejected (insufficient evidence): ${rejectedAchievements.join(', ')}`);
    }
    
    filtered.achievementTriggers = validAchievements;
  }
  
  const isValid = errors.length === 0;
  
  return {
    isValid,
    warnings,
    errors,
    filtered,
  };
}

/**
 * Validate a single XP change
 */
export function validateXPChange(xp: ParsedXPChange, cap: number): { valid: boolean; reason?: string } {
  if (xp.amount <= 0) {
    return { valid: false, reason: 'Invalid XP amount' };
  }
  
  if (xp.amount > cap) {
    return { valid: false, reason: `Exceeds XP cap of ${cap}` };
  }
  
  return { valid: true };
}

/**
 * Validate an item change against consumables database
 */
export function validateItemChange(item: ParsedItemChange): { valid: boolean; reason?: string } {
  if (!item.consumableId) {
    return { valid: false, reason: `Unknown item: ${item.name}` };
  }
  
  const consumable = getConsumableById(item.consumableId);
  if (!consumable) {
    return { valid: false, reason: `Consumable not found: ${item.consumableId}` };
  }
  
  if (item.quantity <= 0) {
    return { valid: false, reason: 'Invalid quantity' };
  }
  
  return { valid: true };
}

/**
 * Validate achievement evidence requirements
 */
export function validateAchievementEvidence(
  trigger: ParsedAchievementTrigger,
  requireEvidence: boolean
): { valid: boolean; reason?: string } {
  if (!requireEvidence) {
    return { valid: true };
  }
  
  if (trigger.confidence !== 'high') {
    return { valid: false, reason: `Low confidence detection: ${trigger.confidence}` };
  }
  
  if (trigger.sourceText.length < 20) {
    return { valid: false, reason: 'Insufficient source text evidence' };
  }
  
  return { valid: true };
}

/**
 * Get confidence level color for UI
 */
export function getConfidenceColor(confidence: ConfidenceLevel): string {
  switch (confidence) {
    case 'high':
      return 'text-emerald-400';
    case 'medium':
      return 'text-amber-400';
    case 'low':
      return 'text-red-400';
    default:
      return 'text-zinc-400';
  }
}

/**
 * Get confidence level icon name for UI
 */
export function getConfidenceIcon(confidence: ConfidenceLevel): string {
  switch (confidence) {
    case 'high':
      return 'CheckCircle';
    case 'medium':
      return 'AlertTriangle';
    case 'low':
      return 'HelpCircle';
    default:
      return 'Circle';
  }
}

/**
 * Check if a parse result has any actionable changes
 */
export function hasActionableChanges(result: ChronicleParseResult): boolean {
  return (
    result.xpChanges.length > 0 ||
    result.itemChanges.length > 0 ||
    result.achievementTriggers.length > 0 ||
    result.goldChanges.length > 0 ||
    result.shopItems.length > 0 ||
    result.levelUp !== null
  );
}

/**
 * Check if a parse result has any display-only changes
 */
export function hasDisplayOnlyChanges(result: ChronicleParseResult): boolean {
  return (
    result.hpChanges.length > 0 ||
    result.goldChanges.length > 0 ||
    result.conditions.length > 0
  );
}
