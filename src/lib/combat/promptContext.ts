// Unified Combat Prompt Context
// Single source of truth for context passed to all AI DM prompt generators

import { applyTimePrefix } from '../fourthWallTime';
import { ActiveCondition, formatDuration } from '../conditions';
import { 
  TargetPromptInfo, 
  getHealthStatus, 
  formatCreatureTypeSize, 
  formatConditionsForPrompt as formatTargetConditions,
  formatDamageModifiers,
} from './targetTypes';

export interface ActiveConditionInfo {
  name: string;
  duration: string;
}

export interface SetBonusInfo {
  name: string;
  count: number;
  maxPieces: number;
  effect: string;
}

// Re-export for convenience
export type { TargetPromptInfo };

/**
 * Unified context for generating AI DM prompts in combat.
 * This ensures all prompts have consistent information and formatting.
 */
export interface CombatPromptContext {
  // Character identity
  characterName: string;
  
  // Health status
  currentHP: number;
  maxHP: number;
  tempHP: number;
  
  // Combat stats
  armorClass: number;
  
  // Global D&D conditions (from useConditions - Poisoned, Frightened, etc.)
  activeConditions: ActiveConditionInfo[];
  
  // Combat-local modifiers (advantage, hidden, flanking, etc.)
  combatModifiers: string[];
  
  // Spellcasting state
  concentrationSpell: string | null;
  spellSaveDC: number;
  spellAttackBonus: number;
  
  // Equipment context
  activeSetBonuses: SetBonusInfo[];
  
  // Current target (enemy being attacked)
  currentTarget: TargetPromptInfo | null;
}

/**
 * Converts ActiveCondition array from useConditions hook to ActiveConditionInfo format.
 * Use this when building CombatPromptContext from hook state.
 */
export function convertConditionsToPromptFormat(conditions: ActiveCondition[]): ActiveConditionInfo[] {
  return conditions.map(c => ({
    name: c.name,
    duration: formatDuration(c.durationType, c.durationValue),
  }));
}

/**
 * Converts equipment stats' activeSetBonuses to SetBonusInfo format for prompts.
 */
export function convertSetBonusesToPromptFormat(
  setData: { setName: string; bonus: string; piecesActive: number; piecesTotal: number }[]
): SetBonusInfo[] {
  return setData.map(s => ({
    name: s.setName,
    count: s.piecesActive,
    maxPieces: s.piecesTotal,
    effect: s.bonus,
  }));
}

/**
 * Creates a default empty combat prompt context.
 * Use this as a starting point when building context.
 */
export function createEmptyCombatPromptContext(): CombatPromptContext {
  return {
    characterName: 'The Assassin',
    currentHP: 0,
    maxHP: 0,
    tempHP: 0,
    armorClass: 10,
    activeConditions: [],
    combatModifiers: [],
    concentrationSpell: null,
    spellSaveDC: 10,
    spellAttackBonus: 0,
    activeSetBonuses: [],
    currentTarget: null,
  };
}

/**
 * Formats the character status section for prompts.
 */
export function formatCharacterStatus(context: CombatPromptContext): string {
  const hpStatus = context.tempHP > 0 
    ? `${context.currentHP}/${context.maxHP} HP (+${context.tempHP} temp)`
    : `${context.currentHP}/${context.maxHP} HP`;
  
  const healthPercent = context.maxHP > 0 ? (context.currentHP / context.maxHP) * 100 : 0;
  const healthDescription = healthPercent >= 75 
    ? 'healthy' 
    : healthPercent >= 50 
      ? 'bloodied' 
      : healthPercent >= 25 
        ? 'badly wounded' 
        : healthPercent > 0 
          ? 'near death' 
          : 'unconscious';

  return `**${context.characterName}** (${hpStatus} - ${healthDescription})`;
}

/**
 * Formats active conditions for narrative inclusion in prompts.
 */
export function formatConditionsForPrompt(context: CombatPromptContext): string {
  if (context.activeConditions.length === 0) return '';
  
  const conditionNarratives: Record<string, string> = {
    'Poisoned': 'suffering from poison, movements sluggish and attacks imprecise',
    'Frightened': 'gripped by supernatural fear, fighting with desperate energy',
    'Blinded': 'striking blind, relying on hearing and instinct',
    'Deafened': 'in eerie silence, unable to hear ally warnings or enemy movements',
    'Charmed': 'magically compelled, judgement clouded',
    'Stunned': 'reeling from a devastating blow, struggling to act',
    'Paralyzed': 'frozen in place by magical or physical restraint',
    'Incapacitated': 'unable to take actions, vulnerable',
    'Restrained': 'movement restricted, struggling against bonds',
    'Prone': 'knocked to the ground, scrambling to rise',
    'Invisible': 'unseen by enemies, moving like a phantom',
    'Exhaustion': 'bone-weary, every action a struggle',
    'Concentration': 'maintaining magical focus while fighting',
  };
  
  const narratives = context.activeConditions.map(c => {
    const narrative = conditionNarratives[c.name] || `affected by ${c.name.toLowerCase()}`;
    return `${c.name} (${c.duration}): ${narrative}`;
  });
  
  return `### Active Conditions\n${narratives.map(n => `- ${n}`).join('\n')}`;
}

/**
 * Formats concentration status for prompts.
 */
export function formatConcentrationStatus(context: CombatPromptContext): string {
  if (!context.concentrationSpell) return '';
  
  return `**⚡ Maintaining Concentration:** ${context.concentrationSpell}
*Warning: Taking damage requires a Constitution save (DC = 10 or half damage, whichever is higher) to maintain concentration.*`;
}

/**
 * Formats active set bonuses for prompts.
 */
export function formatSetBonuses(context: CombatPromptContext): string {
  if (context.activeSetBonuses.length === 0) return '';
  
  const bonusLines = context.activeSetBonuses.map(s => 
    `- **${s.name}** (${s.count}/${s.maxPieces}): ${s.effect}`
  );
  
  return `### Active Set Bonuses\n${bonusLines.join('\n')}`;
}

/**
 * Formats current target for narrative inclusion in prompts.
 */
export function formatTargetForPrompt(target: TargetPromptInfo | null): string {
  if (!target) return '';
  
  const healthStatus = getHealthStatus(target.currentHP, target.maxHP);
  const typeSizeLabel = formatCreatureTypeSize(target.creatureType, target.size);
  
  let section = `### 🎯 Target
**Enemy:** ${target.name}`;

  if (typeSizeLabel) {
    section += `\n**Type:** ${typeSizeLabel}`;
  }

  section += `\n**AC:** ${target.ac} | **HP:** ${target.currentHP}/${target.maxHP} (${healthStatus.label.toLowerCase()})`;
  
  // Add conditions if any
  if (target.conditions && target.conditions.length > 0) {
    section += `\n**Conditions:** ${formatTargetConditions(target.conditions)}`;
  }
  
  // Add damage modifiers if any
  const damageModifiers = formatDamageModifiers(
    target.resistances || [], 
    target.vulnerabilities || [], 
    target.immunities || []
  );
  if (damageModifiers) {
    section += `\n**Damage Modifiers:** ${damageModifiers}`;
  }
  
  section += `\n*The ${target.name.toLowerCase()} ${healthStatus.narrative}.*`;
  
  if (target.notes) {
    section += `\n**Intel:** ${target.notes}`;
  }
  
  return section;
}

/**
 * Wraps a prompt with the 4th Wall Time prefix if enabled.
 * This should be called as the final step when generating any AI DM prompt.
 */
export function finalizePrompt(prompt: string): string {
  return applyTimePrefix(prompt);
}

/**
 * Generates a full context header for combat prompts.
 * Use this at the top of detailed prompts to provide character state.
 */
export function generateContextHeader(context: CombatPromptContext): string {
  const parts: string[] = [];
  
  // Character status
  parts.push(formatCharacterStatus(context));
  
  // AC
  parts.push(`**AC:** ${context.armorClass}`);
  
  // Concentration
  if (context.concentrationSpell) {
    parts.push(`**Concentration:** ${context.concentrationSpell}`);
  }
  
  // Active conditions (brief list)
  if (context.activeConditions.length > 0) {
    const conditionNames = context.activeConditions.map(c => c.name).join(', ');
    parts.push(`**Conditions:** ${conditionNames}`);
  }
  
  // Combat modifiers (brief list)
  if (context.combatModifiers.length > 0) {
    const modifierLabels = context.combatModifiers.join(', ');
    parts.push(`**Combat Modifiers:** ${modifierLabels}`);
  }
  
  // Current target (enhanced)
  if (context.currentTarget) {
    const targetHealth = getHealthStatus(context.currentTarget.currentHP, context.currentTarget.maxHP);
    const typeSizeLabel = formatCreatureTypeSize(context.currentTarget.creatureType, context.currentTarget.size);
    let targetStr = `**Target:** ${context.currentTarget.name}`;
    if (typeSizeLabel) targetStr += ` (${typeSizeLabel})`;
    targetStr += ` (AC ${context.currentTarget.ac}, ${targetHealth.label})`;
    if (context.currentTarget.conditions && context.currentTarget.conditions.length > 0) {
      targetStr += ` [${formatTargetConditions(context.currentTarget.conditions)}]`;
    }
    parts.push(targetStr);
  }
  
  return parts.join(' | ');
}
