import { Consumable } from './types';

export function generatePotionPrompt(consumable: Consumable, characterName: string): string {
  return `I'm using ${consumable.name} in D&D 5e. It ${consumable.effect.toLowerCase()}. Describe the visual and sensory experience of ${characterName} drinking this potion in vivid, immersive detail. Include taste, color, texture, and immediate physical sensations. Keep it under 100 words.`;
}

export function generatePoisonPrompt(consumable: Consumable, characterName: string): string {
  const applicationMethod = getApplicationMethod(consumable.usageType);
  return `I'm ${applicationMethod} ${consumable.name} in D&D 5e. It ${consumable.effect.toLowerCase()}. Describe ${characterName}'s preparation process in vivid detail—the appearance, smell, and how it's deployed. Keep it under 100 words.`;
}

export function generateScrollPrompt(consumable: Consumable, characterName: string): string {
  const spellName = consumable.name.replace('Scroll of ', '');
  return `I'm reading a ${consumable.name} to cast ${spellName} in D&D 5e. It ${consumable.effect.toLowerCase()}. Describe ${characterName} unfurling the scroll—the glowing runes activating, the magical energy manifesting from the parchment, and the spell's visual impact. Keep it under 100 words.`;
}

export function generateConsumablePrompt(consumable: Consumable, characterName: string = 'The Assassin'): string {
  switch (consumable.type) {
    case 'potion':
      return generatePotionPrompt(consumable, characterName);
    case 'poison':
      return generatePoisonPrompt(consumable, characterName);
    case 'scroll':
      return generateScrollPrompt(consumable, characterName);
    default:
      return `${characterName} uses ${consumable.name}. ${consumable.effect}.`;
  }
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
