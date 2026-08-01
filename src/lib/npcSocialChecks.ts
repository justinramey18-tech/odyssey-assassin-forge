import type { CharacterContext } from '@/components/oracle/types';
import { getProficiencyBonus } from '@/lib/magic/calculations';
import { getScopedItem } from '@/lib/scoped-storage';
import { rollWeightedDie, loadDiceOddsMode } from '@/lib/diceOdds';
import { rollDie } from '@/lib/diceRoller';

export type SocialSkillId = 'persuasion' | 'intimidation' | 'insight' | 'deception';

export interface SocialSkillConfig {
  id: SocialSkillId;
  label: string;
  abilityFullName: 'wisdom' | 'charisma';
  opposingLabel: string;
  icon: string;
}

export const SOCIAL_SKILLS: SocialSkillConfig[] = [
  { id: 'persuasion', label: 'Persuasion', abilityFullName: 'charisma', opposingLabel: 'Insight', icon: '\uD83D\uDDE3\uFE0F' },
  { id: 'intimidation', label: 'Intimidation', abilityFullName: 'charisma', opposingLabel: 'Wisdom Save', icon: '\uD83D\uDE20' },
  { id: 'insight', label: 'Insight', abilityFullName: 'wisdom', opposingLabel: 'Deception', icon: '\uD83D\uDC41\uFE0F' },
  { id: 'deception', label: 'Deception', abilityFullName: 'charisma', opposingLabel: 'Insight', icon: '\uD83C\uDFAD' },
];

export interface SocialRollResult {
  die: number;
  modifier: number;
  total: number;
}

export interface SocialCheckResult {
  skill: SocialSkillId;
  skillLabel: string;
  opposingSkillLabel: string;
  playerRoll: SocialRollResult;
  npcRoll: SocialRollResult;
  outcome: 'success' | 'failure' | 'tie';
  rollBlockText: string;
}

export function getPlayerSocialModifier(ctx: CharacterContext, skillId: SocialSkillId): number {
  const config = SOCIAL_SKILLS.find((s) => s.id === skillId);
  if (!config || !ctx.abilityScores) return 0;
  const baseMod = (ctx.abilityScores as any)[config.abilityFullName]?.modifier ?? 0;
  const profBonus = getProficiencyBonus(ctx.level || 1);

  let proficientSkills = new Set<string>();
  let expertiseSkills = new Set<string>();
  try {
    const rawProf = getScopedItem('odyssey-proficient-skills');
    proficientSkills = new Set(rawProf ? JSON.parse(rawProf) : []);
  } catch {
    // ignore
  }
  try {
    const rawExp = getScopedItem('odyssey-expertise-skills');
    expertiseSkills = new Set(rawExp ? JSON.parse(rawExp) : []);
  } catch {
    // ignore
  }

  const isExpert = expertiseSkills.has(skillId);
  const isProf = proficientSkills.has(skillId);
  return baseMod + (isExpert ? profBonus * 2 : isProf ? profBonus : 0);
}

const NPC_MOD_BASE = 4;
const NPC_MOD_LEVEL_DIVISOR = 2;

export function rollPlayerSocialCheck(ctx: CharacterContext, skillId: SocialSkillId): SocialRollResult {
  const oddsMode = loadDiceOddsMode();
  const die = rollWeightedDie(20, oddsMode);
  const modifier = getPlayerSocialModifier(ctx, skillId);
  return { die, modifier, total: die + modifier };
}

export function rollNpcOpposingCheck(ctx: CharacterContext): SocialRollResult {
  const die = rollDie(20);
  const range = NPC_MOD_BASE + Math.floor((ctx.level || 1) / NPC_MOD_LEVEL_DIVISOR);
  const modifier = Math.floor(Math.random() * (range + 1));
  return { die, modifier, total: die + modifier };
}

export function resolveSocialCheck(ctx: CharacterContext, npcName: string, skillId: SocialSkillId): SocialCheckResult {
  const config = SOCIAL_SKILLS.find((s) => s.id === skillId)!;
  const playerRoll = rollPlayerSocialCheck(ctx, skillId);
  const npcRoll = rollNpcOpposingCheck(ctx);
  const outcome: 'success' | 'failure' | 'tie' =
    playerRoll.total > npcRoll.total ? 'success' : playerRoll.total < npcRoll.total ? 'failure' : 'tie';

  const fmt = (r: SocialRollResult) => `[${r.die}] ${r.modifier >= 0 ? '+' + r.modifier : r.modifier} = **${r.total}**`;
  const rollBlockText =
    '\uD83C\uDFB2 **${config.label} (You)**: ${fmt(playerRoll)}\n' +
    '\uD83C\uDFB2 **${config.opposingLabel} (${npcName}, opposing)**: ${fmt(npcRoll)}';

  return {
    skill: skillId,
    skillLabel: config.label,
    opposingSkillLabel: config.opposingLabel,
    playerRoll,
    npcRoll,
    outcome,
    rollBlockText,
  };
}
