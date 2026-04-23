/**
 * Whisper Auto-Roll — one-tap intent-based rolling.
 *
 * Given a parsed RollHint from a DM action whisper:
 *  - resolveWhisperAutoRoll() returns the user-facing button label and whether
 *    the hint is specific enough to auto-roll
 *  - performWhisperRoll() does the dice math and returns a chat-ready narrative result
 *
 * Verb precedence:
 *  1. explicit verb provided by the DM via [verb: ...] in the whisper
 *  2. skill-based mapping (perception → "try to notice")
 *  3. ability-based mapping (DEX save → "try to dodge")
 *  4. fallback "Roll for it" — caller opens the dice roller
 */

import { rollDie } from '@/lib/diceRoller';
import { rollWeightedDie, loadDiceOddsMode } from '@/lib/diceOdds';
import { getProficiencyBonus } from '@/lib/magic/calculations';
import type { RollHint } from '@/lib/whisperRollHint';
import type { AbilityScore } from '@/lib/diceRollerConfig';
import type { CharacterContext } from '@/components/oracle/types';

// ─── Verb mapping tables ───────────────────────────────────────────────────

const SKILL_VERB: Record<string, string> = {
  acrobatics:       'try to keep your footing',
  animal_handling:  'try to calm them',
  arcana:           'recall what you know',
  athletics:        'push through',
  deception:        'try to mislead them',
  history:          'recall what you know',
  insight:          'read them',
  intimidation:     'try to intimidate them',
  investigation:    'piece it together',
  medicine:         'tend to it',
  nature:           'recall what you know',
  perception:       'try to notice',
  performance:      'perform',
  persuasion:       'try to convince them',
  religion:         'recall what you know',
  sleight_of_hand:  'try it unseen',
  stealth:          'try to sneak past',
  survival:         'find the way',
};

const ABILITY_CHECK_VERB: Record<AbilityScore, string> = {
  str: 'muscle through',
  dex: 'try to react',
  con: 'endure it',
  int: 'think it through',
  wis: 'trust your gut',
  cha: 'work the moment',
};

const ABILITY_SAVE_VERB: Record<AbilityScore, string> = {
  str: 'hold your ground',
  dex: 'try to dodge',
  con: 'endure it',
  int: 'steel your mind',
  wis: 'resist the pull',
  cha: 'hold your composure',
};

// ─── Verb resolver ─────────────────────────────────────────────────────────

export interface WhisperAutoRoll {
  canAutoRoll: boolean;
  label: string;
  actionPhrase: string | null;
}

export function resolveWhisperAutoRoll(hint: RollHint | null): WhisperAutoRoll {
  if (!hint) {
    return { canAutoRoll: false, label: 'Roll for it', actionPhrase: null };
  }

  if (hint.explicitVerb && hint.explicitVerb.trim().length > 0) {
    const verb = hint.explicitVerb.trim();
    return {
      canAutoRoll: true,
      label: capitalize(verb),
      actionPhrase: pastTenseIfPossible(verb),
    };
  }

  if (hint.skillId && SKILL_VERB[hint.skillId]) {
    const verb = SKILL_VERB[hint.skillId];
    return {
      canAutoRoll: true,
      label: capitalize(verb),
      actionPhrase: pastTenseIfPossible(verb),
    };
  }

  if (hint.ability) {
    const verb = hint.isSave
      ? ABILITY_SAVE_VERB[hint.ability]
      : ABILITY_CHECK_VERB[hint.ability];
    return {
      canAutoRoll: true,
      label: capitalize(verb),
      actionPhrase: pastTenseIfPossible(verb),
    };
  }

  return { canAutoRoll: false, label: 'Roll for it', actionPhrase: null };
}

// ─── Roll execution ────────────────────────────────────────────────────────

export interface WhisperRollResult {
  rolls: number[];
  kept: number;
  total: number;
  modifier: number;
  isCrit: boolean;
  isFumble: boolean;
  outcome: 'success' | 'failure' | 'neutral';
  chatMessage: string;
}

export function performWhisperRoll(params: {
  hint: RollHint;
  actionPhrase: string;
  characterContext: CharacterContext;
}): WhisperRollResult {
  const { hint, actionPhrase, characterContext } = params;

  const oddsMode = loadDiceOddsMode();
  const rollD20 = () => oddsMode === 'fair' ? rollDie(20) : rollWeightedDie(20, oddsMode);

  const ability: AbilityScore =
    hint.ability ??
    abilityForSkill(hint.skillId) ??
    'dex';

  const abilityScore = getAbilityScore(characterContext, ability);
  const abilityMod = Math.floor((abilityScore - 10) / 2);

  let proficiencyBonus = 0;
  const level = (characterContext as any)?.level ?? 1;
  if (hint.skillId && isProficientInSkill(characterContext, hint.skillId)) {
    proficiencyBonus = getProficiencyBonus(level);
  } else if (hint.isSave && isProficientInSave(characterContext, ability)) {
    proficiencyBonus = getProficiencyBonus(level);
  }

  const modifier = abilityMod + proficiencyBonus;

  let rolls: number[];
  let kept: number;
  if (hint.rollMode === 'advantage') {
    rolls = [rollD20(), rollD20()];
    kept = Math.max(rolls[0], rolls[1]);
  } else if (hint.rollMode === 'disadvantage') {
    rolls = [rollD20(), rollD20()];
    kept = Math.min(rolls[0], rolls[1]);
  } else {
    rolls = [rollD20()];
    kept = rolls[0];
  }

  const total = kept + modifier;
  const isCrit = kept === 20;
  const isFumble = kept === 1;

  let outcome: WhisperRollResult['outcome'] = 'neutral';
  if (hint.dc !== null && hint.dc !== undefined) {
    outcome = total >= hint.dc ? 'success' : 'failure';
  }

  const chatMessage = formatNarrativeResult({
    actionPhrase,
    outcome,
    isCrit,
    isFumble,
    total,
    hasDC: hint.dc !== null && hint.dc !== undefined,
  });

  return { rolls, kept, total, modifier, isCrit, isFumble, outcome, chatMessage };
}

// ─── Chat message formatter ────────────────────────────────────────────────

function formatNarrativeResult(args: {
  actionPhrase: string;
  outcome: 'success' | 'failure' | 'neutral';
  isCrit: boolean;
  isFumble: boolean;
  total: number;
  hasDC: boolean;
}): string {
  const { actionPhrase, outcome, isCrit, isFumble, total, hasDC } = args;

  const phrase = `*${capitalize(actionPhrase)}.*`;

  let outcomeEmoji = '';
  let outcomeLabel = '';

  if (isCrit) {
    outcomeEmoji = '⭐';
    outcomeLabel = hasDC && outcome === 'success' ? 'Critical success' : 'Critical';
  } else if (isFumble) {
    outcomeEmoji = '💀';
    outcomeLabel = hasDC && outcome === 'failure' ? 'Critical failure' : 'Fumble';
  } else if (hasDC && outcome === 'success') {
    outcomeEmoji = '✨';
    outcomeLabel = 'Success';
  } else if (hasDC && outcome === 'failure') {
    outcomeEmoji = '💥';
    outcomeLabel = 'Failure';
  } else {
    outcomeEmoji = '🎲';
    outcomeLabel = 'Rolled';
  }

  return `${phrase} ${outcomeEmoji} **${outcomeLabel}** (${total}).`;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function pastTenseIfPossible(phrase: string): string {
  const trimmed = phrase.trim().toLowerCase();
  const overrides: Record<string, string> = {
    'try to dodge': 'I tried to dodge',
    'try to notice': 'I tried to notice',
    'try to sneak past': 'I tried to sneak past',
    'try to convince them': 'I tried to convince them',
    'try to mislead them': 'I tried to mislead them',
    'try to intimidate them': 'I tried to intimidate them',
    'try to calm them': 'I tried to calm them',
    'try to keep your footing': 'I kept my footing',
    'try to react': 'I reacted',
    'try it unseen': 'I tried it unseen',
    'push through': 'I pushed through',
    'muscle through': 'I muscled through',
    'endure it': 'I endured it',
    'think it through': 'I thought it through',
    'trust your gut': 'I trusted my gut',
    'work the moment': 'I worked the moment',
    'hold your ground': 'I held my ground',
    'steel your mind': 'I steeled my mind',
    'resist the pull': 'I resisted the pull',
    'hold your composure': 'I held my composure',
    'recall what you know': 'I recalled what I knew',
    'read them': 'I read them',
    'piece it together': 'I pieced it together',
    'tend to it': 'I tended to it',
    'find the way': 'I found the way',
    'perform': 'I performed',
  };
  if (overrides[trimmed]) return overrides[trimmed];
  return `I ${trimmed}`;
}

function abilityForSkill(skillId: string | null): AbilityScore | null {
  if (!skillId) return null;
  const map: Record<string, AbilityScore> = {
    acrobatics: 'dex', animal_handling: 'wis', arcana: 'int', athletics: 'str',
    deception: 'cha', history: 'int', insight: 'wis', intimidation: 'cha',
    investigation: 'int', medicine: 'wis', nature: 'int', perception: 'wis',
    performance: 'cha', persuasion: 'cha', religion: 'int', sleight_of_hand: 'dex',
    stealth: 'dex', survival: 'wis',
  };
  return map[skillId] ?? null;
}

function getAbilityScore(ctx: CharacterContext, ability: AbilityScore): number {
  const scores = (ctx as any)?.abilityScores ?? (ctx as any)?.stats ?? {};
  const raw =
    scores[ability] ??
    scores[ability.toUpperCase()] ??
    scores[fullAbilityName(ability)] ??
    10;
  const n = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
  return Number.isFinite(n) ? n : 10;
}

function fullAbilityName(a: AbilityScore): string {
  return ({ str: 'strength', dex: 'dexterity', con: 'constitution', int: 'intelligence', wis: 'wisdom', cha: 'charisma' } as const)[a];
}

function isProficientInSkill(ctx: CharacterContext, skillId: string): boolean {
  const profs = (ctx as any)?.skillProficiencies ?? (ctx as any)?.proficiencies?.skills ?? [];
  if (!Array.isArray(profs)) return false;
  return profs.some((p: any) => String(p).toLowerCase().replace(/\s+/g, '_') === skillId);
}

function isProficientInSave(ctx: CharacterContext, ability: AbilityScore): boolean {
  const saves = (ctx as any)?.savingThrowProficiencies ?? (ctx as any)?.proficiencies?.saves ?? [];
  if (!Array.isArray(saves)) return false;
  return saves.some((s: any) => String(s).toLowerCase().startsWith(ability));
}
