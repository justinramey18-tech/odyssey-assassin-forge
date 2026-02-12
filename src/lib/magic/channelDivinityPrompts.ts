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
  domainName?: string,
  deityName?: string,
): string {
  const name = characterName || 'The Cleric';
  const domainTag = isDomain ? ' (Domain)' : '';
  const deityLine = deityName ? `**Deity:** ${deityName}\n` : '';
  const domainLine = domainName ? `**Domain:** ${domainName}\n` : '';
  const deityNarration = deityName
    ? `${name} raises their holy symbol — a sigil of **${deityName}** — and`
    : `${name} raises their holy symbol and`;
  const domainFlavor = domainName
    ? `\n- **Domain Essence:** How does the ${domainName} domain color this divine manifestation? (${getDomainFlavor(domainName)})`
    : '';

  return applyTimePrefix(
    `## ☀️ Channel Divinity: ${optionName}${domainTag}

**Character:** ${name}
**Ability:** ${optionName}
${deityLine}${domainLine}**Source:** Channel Divinity${isDomain ? ' — Domain Feature' : ' — Base Cleric'}

---

### Effect
${description}
${mechanicalEffect ? `\n**Mechanical:** ${mechanicalEffect}\n` : ''}
---

### Scene Direction for AI DM

${deityNarration} **channels divine energy** to invoke **${optionName}**.

Describe the moment with reverence and power:
- **Visual:** How does the divine energy manifest? A radiant glow, a thunderous aura, shadows recoiling?${domainFlavor}
- **Sound:** Does the air hum with celestial resonance, or does silence fall before the burst?
- **Reaction:** How do nearby allies, enemies, or undead respond to the divine power?
- **Tactical:** What immediate battlefield impact does this create?
${deityName ? `\nWeave **${deityName}**'s presence into the narration — their symbol glows, their voice echoes, or their will visibly shapes reality.\n` : ''}
Give this moment weight — Channel Divinity is a limited divine resource and should feel significant.

---

*Channel Divinity: ${optionName} | ${name}${deityName ? ` · ${deityName}` : ''}${domainName ? ` · ${domainName}` : ''}*`
  );
}

/** Domain-specific flavor hints for AI narration */
function getDomainFlavor(domainName: string): string {
  const flavors: Record<string, string> = {
    'Life': 'warm golden light, soothing warmth, wounds closing',
    'Light': 'blinding radiance, searing brilliance, sunfire',
    'War': 'martial fury, weapon glow, thunderous battle cry',
    'Knowledge': 'whispering voices, glowing runes, all-seeing eyes',
    'Nature': 'vines surging, animal calls, earth trembling',
    'Tempest': 'crackling lightning, roaring thunder, howling wind',
    'Trickery': 'shifting shadows, mirrored illusions, misdirection',
    'Death': 'necrotic chill, spectral energy, life-draining darkness',
  };
  return flavors[domainName] || 'divine energy shaped by faith';
}
