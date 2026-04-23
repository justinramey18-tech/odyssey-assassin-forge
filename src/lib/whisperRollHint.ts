// src/lib/whisperRollHint.ts
//
// Parses an "action" whisper from the AI DM and extracts the intended roll:
// ability, skill, save-vs-check, and DC. Used to pre-select the dice roller.
//
// Intentionally conservative: returns null for any field it can't confidently match.
// The dice roller falls back to its default blank state when fields are null.

import type { AbilityScore } from '@/lib/diceRollerConfig';

export interface RollHint {
  /** The ability score to roll against, if detected */
  ability: AbilityScore | null;
  /** The skill id (e.g. 'perception') if detected; overrides ability if present */
  skillId: string | null;
  /** True if this is a saving throw, false if a check */
  isSave: boolean;
  /** Difficulty class if mentioned */
  dc: number | null;
  /** Whether the hint explicitly mentions advantage or disadvantage */
  rollMode: 'normal' | 'advantage' | 'disadvantage';
  /** Optional explicit verb provided by the DM via [verb: ...] syntax */
  explicitVerb: string | null;
}

const ABILITY_PATTERNS: Array<{ regex: RegExp; ability: AbilityScore }> = [
  { regex: /\bstrength\b/i,     ability: 'str' },
  { regex: /\bdexterity\b/i,    ability: 'dex' },
  { regex: /\bconstitution\b/i, ability: 'con' },
  { regex: /\bintelligence\b/i, ability: 'int' },
  { regex: /\bwisdom\b/i,       ability: 'wis' },
  { regex: /\bcharisma\b/i,     ability: 'cha' },
  { regex: /\bstr\b/i,          ability: 'str' },
  { regex: /\bdex\b/i,          ability: 'dex' },
  { regex: /\bcon\b/i,          ability: 'con' },
  { regex: /\bint\b/i,          ability: 'int' },
  { regex: /\bwis\b/i,          ability: 'wis' },
  { regex: /\bcha\b/i,          ability: 'cha' },
];

const SKILL_PATTERNS: Array<{ regex: RegExp; skillId: string }> = [
  { regex: /\bacrobatics\b/i,       skillId: 'acrobatics' },
  { regex: /\banimal[\s_-]handling\b/i, skillId: 'animal_handling' },
  { regex: /\barcana\b/i,           skillId: 'arcana' },
  { regex: /\bathletics\b/i,        skillId: 'athletics' },
  { regex: /\bdeception\b/i,        skillId: 'deception' },
  { regex: /\bhistory\b/i,          skillId: 'history' },
  { regex: /\binsight\b/i,          skillId: 'insight' },
  { regex: /\bintimidation\b/i,     skillId: 'intimidation' },
  { regex: /\binvestigation\b/i,    skillId: 'investigation' },
  { regex: /\bmedicine\b/i,         skillId: 'medicine' },
  { regex: /\bnature\b/i,           skillId: 'nature' },
  { regex: /\bperception\b/i,       skillId: 'perception' },
  { regex: /\bperformance\b/i,      skillId: 'performance' },
  { regex: /\bpersuasion\b/i,       skillId: 'persuasion' },
  { regex: /\breligion\b/i,         skillId: 'religion' },
  { regex: /\bsleight[\s_-]of[\s_-]hand\b/i, skillId: 'sleight_of_hand' },
  { regex: /\bstealth\b/i,          skillId: 'stealth' },
  { regex: /\bsurvival\b/i,         skillId: 'survival' },
];

const SAVE_REGEX = /\b(saving\s+throw|save)\b/i;
const DC_REGEX = /\bdc\s*(\d{1,2})\b/i;
const ADV_REGEX = /\badvantage\b/i;
const DIS_REGEX = /\bdisadvantage\b/i;

// Empyrean terminology mappings — DM outputs these instead of D&D terms.
const EMPYREAN_SKILL_PATTERNS: Array<{ regex: RegExp; skillId: string }> = [
  { regex: /\baerial[\s_-]combat\b/i,   skillId: 'athletics' },
  { regex: /\bawareness\b/i,            skillId: 'perception' },
  { regex: /\bsignet[\s_-]theory\b/i,   skillId: 'arcana' },
  { regex: /\briding\b/i,               skillId: 'animal_handling' },
  { regex: /\bdragonspeech\b/i,         skillId: 'persuasion' },
  { regex: /\bshadowcraft\b/i,          skillId: 'stealth' },
  { regex: /\bbattle[\s_-]sense\b/i,    skillId: 'insight' },
  { regex: /\bfieldcraft\b/i,           skillId: 'survival' },
  { regex: /\bcourt[\s_-]presence\b/i,  skillId: 'persuasion' },
  { regex: /\bintimidate(?:\s+tactics)?\b/i, skillId: 'intimidation' },
];

const EMPYREAN_ABILITY_PATTERNS: Array<{ regex: RegExp; ability: AbilityScore }> = [
  { regex: /\bbody\b/i,        ability: 'str' },
  { regex: /\breflexes\b/i,    ability: 'dex' },
  { regex: /\b(constitution\s+save|grit\s+save|grit\s+check)\b/i, ability: 'con' },
  { regex: /\bwill\b/i,        ability: 'wis' },
  { regex: /\bresolve\b/i,     ability: 'wis' },
  { regex: /\bpresence\b/i,    ability: 'cha' },
];

// Explicit verb syntax: "[verb: catch yourself]"
const VERB_REGEX = /\[verb:\s*([^\]]{1,60})\]/i;

export function parseRollHint(whisperContent: string): RollHint {
  const text = whisperContent || '';

  let ability: AbilityScore | null = null;
  for (const p of ABILITY_PATTERNS) {
    if (p.regex.test(text)) {
      ability = p.ability;
      break;
    }
  }

  let skillId: string | null = null;
  for (const p of SKILL_PATTERNS) {
    if (p.regex.test(text)) {
      skillId = p.skillId;
      break;
    }
  }

  // Check Empyrean skill synonyms if no D&D skill matched.
  if (!skillId) {
    for (const p of EMPYREAN_SKILL_PATTERNS) {
      if (p.regex.test(text)) {
        skillId = p.skillId;
        break;
      }
    }
  }

  // Check Empyrean ability synonyms if no D&D ability matched.
  if (!ability) {
    for (const p of EMPYREAN_ABILITY_PATTERNS) {
      if (p.regex.test(text)) {
        ability = p.ability;
        break;
      }
    }
  }

  const isSave = SAVE_REGEX.test(text);

  let dc: number | null = null;
  const dcMatch = text.match(DC_REGEX);
  if (dcMatch) {
    const n = parseInt(dcMatch[1], 10);
    if (!Number.isNaN(n) && n >= 1 && n <= 40) dc = n;
  }

  let rollMode: RollHint['rollMode'] = 'normal';
  if (DIS_REGEX.test(text)) rollMode = 'disadvantage';
  else if (ADV_REGEX.test(text)) rollMode = 'advantage';

  let explicitVerb: string | null = null;
  const verbMatch = text.match(VERB_REGEX);
  if (verbMatch) {
    explicitVerb = verbMatch[1].trim().slice(0, 60);
  }

  return { ability, skillId, isSave, dc, rollMode, explicitVerb };
}
