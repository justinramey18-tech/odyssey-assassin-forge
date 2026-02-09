// Wild Shape Special Ability Prompt Generator
// Generates rich AI DM prompts for tappable beast form abilities

import { applyTimePrefix } from './fourthWallTime';
import { formatCR } from './magic/wildShape';

export interface WildShapeAbilityPromptParams {
  abilityName: string;
  characterName: string;
  formName: string;
  formCR: number;
  formHP: number;
  formMaxHP: number;
  formAC: number;
  formSpeed: string;
}

/**
 * Generate a context-aware AI DM prompt for a Wild Shape special ability.
 * Includes character name, beast form stats, and 4th Wall Time.
 */
export function generateWildShapeAbilityPrompt(params: WildShapeAbilityPromptParams): string {
  const {
    abilityName,
    characterName,
    formName,
    formCR,
    formHP,
    formMaxHP,
    formAC,
    formSpeed,
  } = params;

  const crDisplay = formatCR(formCR);
  const healthPct = formMaxHP > 0 ? Math.round((formHP / formMaxHP) * 100) : 0;
  const healthStatus = healthPct > 75 ? 'healthy' : healthPct > 40 ? 'bloodied' : healthPct > 0 ? 'badly wounded' : 'at death\'s door';

  const prompt = `## 🐾 Wild Shape Ability: ${abilityName}

**Character:** ${characterName} in ${formName} form (CR ${crDisplay})
**Beast HP:** ${formHP}/${formMaxHP} (${healthStatus}) | **AC:** ${formAC}
**Speed:** ${formSpeed}
**Ability Used:** ${abilityName}

${characterName}'s ${formName} form uses **${abilityName}**.

Narrate ${characterName}'s ${formName} unleashing ${abilityName} with primal ferocity. Describe the beast's movements, the ability's visual effect, and its tactical impact on the battlefield. Factor in the form's current condition (${healthStatus}).`;

  return applyTimePrefix(prompt);
}
