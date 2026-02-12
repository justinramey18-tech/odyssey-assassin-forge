// Channel Divinity AI DM Prompt Generator

import { applyTimePrefix } from '@/lib/fourthWallTime';

/**
 * Generate an AI DM prompt for a Channel Divinity activation.
 */
export function generateChannelDivinityPrompt(
  optionName: string,
  description: string,
  characterName: string,
  mechanicalEffect?: string,
  isDomain?: boolean,
): string {
  const name = characterName || 'The Cleric';
  const domainTag = isDomain ? ' (Domain)' : '';

  return applyTimePrefix(
    `## ☀️ Channel Divinity: ${optionName}${domainTag}

**Character:** ${name}
**Ability:** ${optionName}
**Source:** Channel Divinity${isDomain ? ' — Domain Feature' : ' — Base Cleric'}

---

### Effect
${description}
${mechanicalEffect ? `\n**Mechanical:** ${mechanicalEffect}\n` : ''}
---

### Scene Direction for AI DM

${name} raises their holy symbol and **channels divine energy** to invoke **${optionName}**.

Describe the moment with reverence and power:
- **Visual:** How does the divine energy manifest? A radiant glow, a thunderous aura, shadows recoiling?
- **Sound:** Does the air hum with celestial resonance, or does silence fall before the burst?
- **Reaction:** How do nearby allies, enemies, or undead respond to the divine power?
- **Tactical:** What immediate battlefield impact does this create?

Give this moment weight — Channel Divinity is a limited divine resource and should feel significant.

---

*Channel Divinity: ${optionName} | ${name}*`
  );
}
