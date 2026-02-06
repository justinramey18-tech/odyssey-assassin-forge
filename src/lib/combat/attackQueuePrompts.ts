// Attack Queue Prompt Generation
// Generates AI DM prompts for multi-attack sequences

import { ExecutedAttack } from './attackQueue';
import { applyTimePrefix } from '../fourthWallTime';
import { TargetPromptInfo, getHealthStatus } from './targetTypes';
import { DiceRoll } from '@/lib/diceRoller';

/**
 * Format a single attack within a multi-attack sequence
 */
function formatSingleAttack(
  attack: ExecutedAttack,
  attackNumber: number,
  totalAttacks: number
): string {
  const { weapon, rollType, roll, damageBreakdown, targetName, targetInfo, isOffhand } = attack;
  
  // Attack header
  let header = `### Attack ${attackNumber}/${totalAttacks}: ${weapon.name}`;
  if (targetName) {
    header += ` → ${targetName}`;
  }
  
  const lines: string[] = [header];
  
  // Roll info
  const rollDisplay = roll.rolls.length > 1
    ? `${roll.rolls.map(r => `[${r}]`).join(', ')} → ${roll.total}`
    : `[${roll.rolls[0]}]+${roll.modifier} = **${roll.total}**`;
  
  lines.push(`**Attack Roll:** d20${roll.modifier >= 0 ? '+' : ''}${roll.modifier} = ${rollDisplay}`);
  
  // Damage
  lines.push(`**Damage on Hit:** ${damageBreakdown}`);
  
  // Target context
  if (targetInfo) {
    const healthStatus = getHealthStatus(targetInfo.currentHP, targetInfo.maxHP);
    lines.push(`🎯 **Target:** ${targetInfo.name} (AC ${targetInfo.ac}, ${healthStatus.label} - ${targetInfo.currentHP}/${targetInfo.maxHP} HP)`);
  }
  
  // Roll type notes
  if (rollType === 'sneak') {
    lines.push(`*Sneak Attack applied*`);
  } else if (rollType === 'assassinate') {
    lines.push(`*🗡️ ASSASSINATE - Auto-Critical on hit against surprised target*`);
  }
  
  if (isOffhand) {
    lines.push(`*Offhand attack (bonus action)*`);
  }
  
  return lines.join('\n');
}

/**
 * Group attacks by target for narrative flow
 */
function groupAttacksByTarget(attacks: ExecutedAttack[]): Map<string, ExecutedAttack[]> {
  const groups = new Map<string, ExecutedAttack[]>();
  
  for (const attack of attacks) {
    const key = attack.targetName || 'unspecified';
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(attack);
  }
  
  return groups;
}

/**
 * Generate narration guide based on attack patterns
 */
function generateNarrationGuide(
  attacks: ExecutedAttack[],
  characterName: string
): string {
  const targetGroups = groupAttacksByTarget(attacks);
  const targetCount = targetGroups.size;
  const hasUnspecified = targetGroups.has('unspecified');
  
  const parts: string[] = [];
  
  if (attacks.length === 1) {
    // Single attack
    const attack = attacks[0];
    if (attack.targetName) {
      parts.push(`${characterName} strikes at ${attack.targetName} with their ${attack.weapon.name}.`);
    } else {
      parts.push(`${characterName} launches an attack with their ${attack.weapon.name}.`);
    }
  } else if (targetCount === 1 && !hasUnspecified) {
    // Multiple attacks on same target
    const targetName = Array.from(targetGroups.keys())[0];
    const attackCount = attacks.length;
    parts.push(`${characterName} focuses their fury on ${targetName}, unleashing ${attackCount} rapid strikes.`);
  } else {
    // Multiple targets
    const targetList: string[] = [];
    targetGroups.forEach((groupAttacks, targetName) => {
      if (targetName !== 'unspecified') {
        targetList.push(`${groupAttacks.length} attack${groupAttacks.length > 1 ? 's' : ''} on ${targetName}`);
      }
    });
    
    if (hasUnspecified) {
      const unspecifiedCount = targetGroups.get('unspecified')!.length;
      targetList.push(`${unspecifiedCount} attack${unspecifiedCount > 1 ? 's' : ''} on other enemies`);
    }
    
    parts.push(`${characterName} whirls through combat: ${targetList.join(', ')}.`);
  }
  
  // Add flavor based on roll types
  const hasAssassinate = attacks.some(a => a.rollType === 'assassinate');
  const hasSneakAttack = attacks.some(a => a.rollType === 'sneak');
  
  if (hasAssassinate) {
    parts.push('The assassin strikes from the shadows with deadly precision.');
  } else if (hasSneakAttack) {
    parts.push('Each strike finds its mark with practiced precision.');
  }
  
  return parts.join(' ');
}

/**
 * Generate a complete multi-attack AI DM prompt
 */
export function generateMultiAttackPrompt(
  attacks: ExecutedAttack[],
  characterName: string
): string {
  if (attacks.length === 0) {
    return '';
  }
  
  const lines: string[] = [];
  
  // Header
  lines.push(`## ⚔️ MULTI-ATTACK SEQUENCE`);
  lines.push('');
  lines.push(`**Character:** ${characterName}`);
  lines.push(`**Total Attacks:** ${attacks.length}`);
  lines.push('');
  lines.push('---');
  
  // Each attack
  attacks.forEach((attack, index) => {
    lines.push('');
    lines.push(formatSingleAttack(attack, index + 1, attacks.length));
    if (index < attacks.length - 1) {
      lines.push('');
      lines.push('---');
    }
  });
  
  // Narration guide
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('### Narration Guide');
  lines.push(generateNarrationGuide(attacks, characterName));
  
  const prompt = lines.join('\n');
  return applyTimePrefix(prompt);
}

/**
 * Generate individual attack prompt (for logging each attack separately)
 */
export function generateQueuedAttackPrompt(
  attack: ExecutedAttack,
  characterName: string
): string {
  const { weapon, rollType, roll, damageBreakdown, targetName, targetInfo, isOffhand } = attack;
  
  const lines: string[] = [];
  
  // Header with attack type
  const attackType = rollType === 'assassinate' ? '🗡️ ASSASSINATE' :
                    rollType === 'sneak' ? '🎯 SNEAK ATTACK' :
                    isOffhand ? '⚡ OFFHAND ATTACK' : '⚔️ WEAPON ATTACK';
  
  lines.push(`## ${attackType}: ${weapon.name.toUpperCase()}`);
  lines.push('');
  lines.push(`**Character:** ${characterName}`);
  
  // Target
  if (targetName) {
    lines.push(`**Target:** ${targetName}`);
    if (targetInfo) {
      const healthStatus = getHealthStatus(targetInfo.currentHP, targetInfo.maxHP);
      lines.push(`**Target Status:** AC ${targetInfo.ac} | ${healthStatus.label} (${targetInfo.currentHP}/${targetInfo.maxHP} HP)`);
    }
  }
  
  lines.push('');
  lines.push('---');
  lines.push('');
  
  // Roll details
  const rollDisplay = roll.rolls.length > 1
    ? `${roll.rolls.map(r => `[${r}]`).join(', ')} → ${roll.total}`
    : `[${roll.rolls[0]}]+${roll.modifier} = **${roll.total}**`;
  
  lines.push(`### Attack Roll`);
  lines.push(`d20${roll.modifier >= 0 ? '+' : ''}${roll.modifier} = ${rollDisplay}`);
  lines.push('');
  lines.push(`### Damage on Hit`);
  lines.push(damageBreakdown);
  
  // Weapon properties
  if (weapon.properties.length > 0) {
    lines.push('');
    lines.push(`**Weapon Properties:** ${weapon.properties.join(', ')}`);
  }
  
  // Roll type flavor
  if (rollType === 'assassinate') {
    lines.push('');
    lines.push('*🗡️ ASSASSINATE: The target is surprised. This attack automatically crits on hit.*');
  } else if (rollType === 'sneak') {
    lines.push('');
    lines.push('*Sneak Attack damage applies - ally within 5ft or attacking with advantage.*');
  }
  
  if (isOffhand) {
    lines.push('');
    lines.push('*Offhand attack (bonus action) - no ability modifier added to damage unless you have Two-Weapon Fighting style.*');
  }
  
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(`*Narrate ${characterName}'s ${weapon.name.toLowerCase()} strike${targetName ? ` against ${targetName}` : ''}.*`);
  
  const prompt = lines.join('\n');
  return applyTimePrefix(prompt);
}
