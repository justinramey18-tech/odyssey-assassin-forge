// Loot AI DM Prompt Generator
// Generates contextual prompts for usable loot items

import { LootItem } from './types';
import { applyTimePrefix } from '@/lib/fourthWallTime';

export interface LootPromptContext {
  characterName: string;
  currentHP?: number;
  maxHP?: number;
  conditions?: Array<{ name: string; duration?: string }>;
  activeSetBonus?: { name: string; effect: string };
  storyContext?: string; // Extracted from sourceText
}

/**
 * Generate an AI DM prompt for a usable loot item
 */
export function generateLootUsePrompt(
  item: LootItem,
  context: LootPromptContext
): string {
  const { characterName, currentHP, maxHP, conditions, activeSetBonus, storyContext } = context;
  
  const parts: string[] = [];
  
  // Header
  parts.push(`**[ITEM USE: ${item.name}]**`);
  parts.push('');
  
  // Character context
  parts.push(`${characterName} uses their ${item.name}.`);
  
  // Health context for desperation/confidence
  if (currentHP !== undefined && maxHP !== undefined) {
    const healthPercent = (currentHP / maxHP) * 100;
    if (healthPercent <= 25) {
      parts.push(`*Desperate circumstances - only ${currentHP}/${maxHP} HP remaining.*`);
    } else if (healthPercent >= 90) {
      parts.push(`*Acting from a position of strength - ${currentHP}/${maxHP} HP.*`);
    }
  }
  
  // Condition context
  if (conditions && conditions.length > 0) {
    const conditionNames = conditions.map(c => c.name).join(', ');
    parts.push(`*Current conditions: ${conditionNames}*`);
  }
  
  // Set bonus flavor
  if (activeSetBonus) {
    parts.push(`*${activeSetBonus.name} set bonus active: ${activeSetBonus.effect}*`);
  }
  
  parts.push('');
  
  // Item description
  parts.push(`**Item**: ${item.name} (${item.rarity})`);
  parts.push(`*${item.description}*`);
  
  // Mechanics
  if (item.mechanics) {
    parts.push('');
    parts.push('**Mechanics:**');
    
    if (item.mechanics.effect) {
      parts.push(`- Effect: ${item.mechanics.effect}`);
    }
    if (item.mechanics.damage) {
      parts.push(`- Damage: ${item.mechanics.damage}`);
    }
    if (item.mechanics.diceRoll) {
      parts.push(`- Roll: ${item.mechanics.diceRoll}`);
    }
    if (item.mechanics.savingThrow) {
      parts.push(`- Save: ${item.mechanics.savingThrow}`);
    }
    if (item.mechanics.duration) {
      parts.push(`- Duration: ${item.mechanics.duration}`);
    }
  }
  
  // Lore/story context
  if (item.lore) {
    parts.push('');
    parts.push(`**Lore**: ${item.lore}`);
  }
  
  // Story context from Chronicle
  if (storyContext || item.sourceText) {
    parts.push('');
    parts.push('**Story Context:**');
    parts.push(`*${storyContext || item.sourceText}*`);
  }
  
  parts.push('');
  parts.push('---');
  parts.push('*Narrate the dramatic use of this item, incorporating any dice rolls or saves required. Describe the visual effects and immediate impact.*');
  
  const prompt = parts.join('\n');
  
  // Apply 4th wall time prefix
  return applyTimePrefix(prompt);
}

/**
 * Build a short player-action text for the Use button based on available
 * effect/dice metadata. Falls back to a simple "I use the X." sentence.
 */
export function buildLootUseText(item: {
  name: string;
  effect?: string;
  dice?: string;
  mechanics?: { effect?: string; diceRoll?: string };
}): string {
  const effect = item.effect?.trim() || item.mechanics?.effect?.trim();
  const dice = item.dice?.trim() || item.mechanics?.diceRoll?.trim();

  if (effect && dice) {
    return `I use the ${item.name} to ${effect} (${dice}).`;
  }
  if (effect) {
    return `I use the ${item.name} to ${effect}.`;
  }
  if (dice) {
    return `I use the ${item.name} (${dice}).`;
  }
  return `I use the ${item.name}.`;
}

/**
 * Generate a prompt for discovering/appraising loot
 */
export function generateLootDiscoveryPrompt(
  item: LootItem,
  characterName: string
): string {
  const parts: string[] = [];
  
  parts.push(`**[LOOT DISCOVERED: ${item.name}]**`);
  parts.push('');
  parts.push(`${characterName} examines a newly discovered item.`);
  parts.push('');
  parts.push(`**Item**: ${item.name}`);
  parts.push(`**Apparent Quality**: ${item.rarity}`);
  parts.push(`**Estimated Value**: ~${item.goldValue} gp`);
  parts.push('');
  parts.push(`*${item.description}*`);
  
  if (item.mechanics) {
    parts.push('');
    parts.push('**Properties Noticed:**');
    if (item.mechanics.damage) parts.push(`- Weapon: ${item.mechanics.damage}`);
    if (item.mechanics.ac) parts.push(`- Armor bonus: +${item.mechanics.ac} AC`);
    if (item.mechanics.effect) parts.push(`- Special: ${item.mechanics.effect}`);
    if (item.mechanics.properties) parts.push(`- Traits: ${item.mechanics.properties.join(', ')}`);
  }
  
  parts.push('');
  parts.push('---');
  parts.push('*Describe the item\'s appearance and any hints about its origin or magical properties.*');
  
  return applyTimePrefix(parts.join('\n'));
}

/**
 * Generate a prompt for selling loot
 */
export function generateLootSellPrompt(
  item: LootItem,
  goldReceived: number,
  characterName: string
): string {
  const parts: string[] = [];
  
  parts.push(`**[ITEM SOLD: ${item.name}]**`);
  parts.push('');
  parts.push(`${characterName} sells their ${item.name} for ${goldReceived} gold.`);
  parts.push('');
  parts.push(`*${item.description}*`);
  parts.push('');
  parts.push(`**Transaction**: ${item.name} → ${goldReceived} gp`);
  parts.push('');
  parts.push('---');
  parts.push('*Briefly narrate the sale—was the merchant impressed? Did they haggle? Any commentary on parting with this item?*');
  
  return applyTimePrefix(parts.join('\n'));
}
