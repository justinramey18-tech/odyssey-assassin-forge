import { Ability } from './types';
import { DiceRoll } from './diceRoller';
import { applyTimePrefix } from './fourthWallTime';
import { HomebrewAttackType } from './abilityCustomization/types';

/**
 * Get descriptive text for an attack type
 */
function getAttackTypeDescription(attackType?: HomebrewAttackType): string | null {
  if (!attackType || attackType === 'none') return null;
  
  const descriptions: Record<HomebrewAttackType, string> = {
    none: '',
    unarmed: 'an unarmed strike (fists, elbows, knees, or other natural weapons)',
    primary: 'their primary weapon',
    secondary: 'their secondary/off-hand weapon',
    ranged: 'their ranged weapon',
    any_melee: 'a melee weapon of their choice',
    any_weapon: 'any equipped weapon',
  };
  
  return descriptions[attackType];
}

// Generate high-granularity RP prompts for AI DM based on ability and roll
export function generateRPPrompt(
  ability: Ability & { attackType?: HomebrewAttackType; isHomebrew?: boolean },
  tier: 1 | 2 | 3,
  roll: DiceRoll,
  characterName: string
): string {
  const tierEffect = ability.tierEffects.find(e => e.tier === tier)?.description || '';
  const isHighRoll = roll.total >= (roll.count * parseInt(roll.die.slice(1)) * 0.7);
  // For ability dice (d6/d8/d10), max roll on ANY die = crit, ALL 1s = fumble
  const maxDieValue = parseInt(roll.die.slice(1));
  const isCritical = roll.rolls.some(r => r === maxDieValue);
  const isFumble = roll.rolls.every(r => r === 1);
  
  const rollQuality = isCritical ? 'CRITICAL SUCCESS' : isFumble ? 'CRITICAL FAILURE' : isHighRoll ? 'Strong Success' : 'Standard Result';
  
  const treeContext = {
    hunter: 'precision, patience, and predatory instinct',
    warrior: 'raw power, battle fury, and martial prowess',
    assassin: 'shadow, deception, and lethal finesse',
  };

  const actionVerbs = {
    action: 'executes',
    bonus_action: 'swiftly activates',
    reaction: 'instinctively triggers',
    passive: 'channels',
  };

  // Attack type context for homebrew abilities
  const attackTypeDesc = getAttackTypeDescription(ability.attackType);
  const attackTypeSection = attackTypeDesc 
    ? `\n**Attack Method:** This ability is performed using ${attackTypeDesc}. Incorporate this weapon/method into the narrative.\n`
    : '';

  // Homebrew indicator
  const homebrewBadge = ability.isHomebrew ? ' [HOMEBREW]' : '';

  const prompt = `## Ability Activation: ${ability.name}${homebrewBadge}

**Character:** ${characterName || 'The Assassin'}
**Ability:** ${ability.name} (Tier ${tier}/3)${ability.isHomebrew ? ' — Custom Ability' : ''}
**Tree:** ${ability.tree.charAt(0).toUpperCase() + ability.tree.slice(1)} — embodying ${treeContext[ability.tree]}
**Action Type:** ${ability.actionType.replace('_', ' ').toUpperCase()}
**Roll Result:** ${roll.count}${roll.die} → [${roll.rolls.join(', ')}] = **${roll.total}** (${rollQuality})
${attackTypeSection}
---

### Current Effect
${tierEffect}

---

### Scene Direction for AI DM

${characterName || 'The character'} ${actionVerbs[ability.actionType]} **${ability.name}**.

${isCritical ? `
**CRITICAL SUCCESS!** Describe this moment with dramatic flair. The ability manifests at peak effectiveness with an unexpected bonus effect or narrative advantage. The enemy is caught completely off-guard, allies are inspired, or the environment itself seems to bend to ${characterName || "the character"}'s will.
` : isFumble ? `
**CRITICAL FAILURE!** Something goes wrong. Perhaps the ability partially backfires, alerts unintended targets, or leaves ${characterName || "the character"} momentarily vulnerable. Describe the complication while keeping it recoverable—this is a setback, not a catastrophe.
` : isHighRoll ? `
**Strong execution.** The ability works as intended with notable effectiveness. Describe the action with confidence and impact. ${characterName || "The character"}'s training shows clearly.
` : `
**Standard execution.** The ability functions but without particular flourish. Describe competent use with room for the situation to develop in either direction.
`}

**Sensory Details to Include:**
- Visual: How does this ${ability.tree} ability manifest? (${ability.tree === 'hunter' ? 'precise movements, keen awareness' : ability.tree === 'warrior' ? 'powerful stance, intimidating presence' : 'shadows coiling, silent motion'})${attackTypeDesc ? `\n- Weapon: How does ${attackTypeDesc} factor into the execution?` : ''}
- Sound: What does the target or environment hear?
- Tactical: How does this change the immediate situation?

**Narrative Hooks:**
- How might enemies react to witnessing this ability?
- What opportunity or complication does this create for the next moment?

---

*Roll: ${roll.count}${roll.die} = ${roll.total} | Tier ${tier} ${ability.name}${ability.isHomebrew ? ' (Homebrew)' : ''}*`;

  return applyTimePrefix(prompt);
}
