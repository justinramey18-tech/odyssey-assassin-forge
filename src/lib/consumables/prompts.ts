import { Consumable } from './types';
import { applyTimePrefix } from '../fourthWallTime';

// Combat context for enriched consumable prompts
export interface ConsumableCombatContext {
  conditions?: Array<{ name: string; duration?: string }>;
  setBonus?: { name: string; effect: string };
  concentrationSpell?: { name: string; level?: number };
}

export function generatePotionPrompt(
  consumable: Consumable, 
  characterName: string,
  context?: ConsumableCombatContext
): string {
  let prompt = `I'm using ${consumable.name} in D&D 5e. It ${consumable.effect.toLowerCase()}. Describe the visual and sensory experience of ${characterName} drinking this potion in vivid, immersive detail. Include taste, color, texture, and immediate physical sensations.`;
  
  // Add condition context
  if (context?.conditions && context.conditions.length > 0) {
    const conditionNames = context.conditions.map(c => c.name).join(', ');
    prompt += ` Note: ${characterName} is currently affected by: ${conditionNames}. Consider how these conditions might affect the drinking process or the potion's efficacy narrative.`;
  }
  
  // Add concentration context
  if (context?.concentrationSpell) {
    prompt += ` ${characterName} is maintaining concentration on ${context.concentrationSpell.name}—describe any visual interplay between the potion's magic and the active spell.`;
  }
  
  // Add set bonus context
  if (context?.setBonus) {
    prompt += ` Their ${context.setBonus.name} resonates with the potion's energy (${context.setBonus.effect}).`;
  }
  
  prompt += ` Keep it under 100 words.`;
  return prompt;
}

export function generatePoisonPrompt(
  consumable: Consumable, 
  characterName: string,
  context?: ConsumableCombatContext
): string {
  const applicationMethod = getApplicationMethod(consumable.usageType);
  let prompt = `I'm ${applicationMethod} ${consumable.name} in D&D 5e. It ${consumable.effect.toLowerCase()}. Describe ${characterName}'s preparation process in vivid detail—the appearance, smell, and how it's deployed.`;
  
  // Add condition context
  if (context?.conditions && context.conditions.length > 0) {
    const conditionNames = context.conditions.map(c => c.name).join(', ');
    prompt += ` Note: ${characterName} is currently affected by: ${conditionNames}. Consider how these conditions might complicate the application.`;
  }
  
  // Add set bonus context
  if (context?.setBonus) {
    prompt += ` Their ${context.setBonus.name} enhances the lethal aesthetic (${context.setBonus.effect}).`;
  }
  
  prompt += ` Keep it under 100 words.`;
  return prompt;
}

export function generateScrollPrompt(
  consumable: Consumable, 
  characterName: string,
  context?: ConsumableCombatContext
): string {
  const spellName = consumable.name.replace('Scroll of ', '');
  let prompt = `I'm reading a ${consumable.name} to cast ${spellName} in D&D 5e. It ${consumable.effect.toLowerCase()}. Describe ${characterName} unfurling the scroll—the glowing runes activating, the magical energy manifesting from the parchment, and the spell's visual impact.`;
  
  // Add condition context
  if (context?.conditions && context.conditions.length > 0) {
    const conditionNames = context.conditions.map(c => c.name).join(', ');
    prompt += ` Note: ${characterName} is currently affected by: ${conditionNames}. Describe how these conditions affect the incantation.`;
  }
  
  // Add concentration context - important for scrolls
  if (context?.concentrationSpell) {
    prompt += ` WARNING: ${characterName} is maintaining concentration on ${context.concentrationSpell.name}. If this scroll requires concentration, describe the difficult choice or the moment concentration breaks.`;
  }
  
  // Add set bonus context
  if (context?.setBonus) {
    prompt += ` Their ${context.setBonus.name} harmonizes with the arcane script (${context.setBonus.effect}).`;
  }
  
  prompt += ` Keep it under 100 words.`;
  return prompt;
}

export function generateConsumablePrompt(
  consumable: Consumable, 
  characterName: string = 'The Assassin',
  context?: ConsumableCombatContext
): string {
  let prompt: string;
  switch (consumable.type) {
    case 'potion':
      prompt = generatePotionPrompt(consumable, characterName, context);
      break;
    case 'poison':
      prompt = generatePoisonPrompt(consumable, characterName, context);
      break;
    case 'scroll':
      prompt = generateScrollPrompt(consumable, characterName, context);
      break;
    default:
      prompt = `${characterName} uses ${consumable.name}. ${consumable.effect}.`;
  }
  return applyTimePrefix(prompt);
}

function getApplicationMethod(usageType: string): string {
  switch (usageType) {
    case 'injury':
      return 'applying';
    case 'ingested':
      return 'slipping';
    case 'contact':
      return 'coating with';
    case 'inhale':
      return 'deploying';
    default:
      return 'using';
  }
}
