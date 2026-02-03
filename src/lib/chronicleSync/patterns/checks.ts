// Skill Check and Saving Throw Detection Patterns
// Detects skill checks, saving throws, and their outcomes

import { PatternMatch } from '../patterns';

// Common D&D skills
export const SKILLS = [
  'acrobatics', 'animal handling', 'arcana', 'athletics', 'deception',
  'history', 'insight', 'intimidation', 'investigation', 'medicine',
  'nature', 'perception', 'performance', 'persuasion', 'religion',
  'sleight of hand', 'stealth', 'survival',
] as const;

export type SkillName = typeof SKILLS[number];

// Ability scores for saving throws
export const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
export const ABILITY_FULL = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'] as const;
export type AbilityShort = typeof ABILITIES[number];
export type AbilityFull = typeof ABILITY_FULL[number];

// ===== SKILL CHECK PATTERNS =====

export const SKILL_CHECK_PATTERNS = [
  // "Athletics check: 18", "Stealth check: 14 (success)"
  new RegExp(`(${SKILLS.join('|')})\\s+check[:\\s]+(\\d+)(?:\\s*\\(?(success|fail(?:ure)?|passed|failed)?\\)?)?`, 'gi'),
  // "rolls Athletics: 18", "rolls a 15 for Perception"
  new RegExp(`roll(?:s|ed)?\\s+(?:a\\s+)?(\\d+)\\s+(?:for\\s+)?(${SKILLS.join('|')})`, 'gi'),
  // "makes a Perception check and gets 22"
  new RegExp(`(?:make|makes|made)\\s+(?:a\\s+)?(${SKILLS.join('|')})\\s+check.*?(\\d+)`, 'gi'),
];

export interface SkillCheckMatch extends PatternMatch {
  skill: string;
  roll: number;
  outcome?: 'success' | 'failure';
  dc?: number;
}

export function parseSkillCheckMatches(text: string): SkillCheckMatch[] {
  const matches: SkillCheckMatch[] = [];
  const skillsPattern = SKILLS.join('|');
  
  // Pattern 1: "Skill check: roll"
  const pattern1 = new RegExp(`(${skillsPattern})\\s+check[:\\s]+(\\d+)(?:\\s*\\(?(success|fail(?:ure)?|passed|failed)?\\)?)?`, 'gi');
  let match;
  
  while ((match = pattern1.exec(text)) !== null) {
    const skill = match[1].toLowerCase();
    const roll = parseInt(match[2], 10);
    let outcome: 'success' | 'failure' | undefined;
    
    if (match[3]) {
      const outcomeText = match[3].toLowerCase();
      outcome = (outcomeText === 'success' || outcomeText === 'passed') ? 'success' : 'failure';
    }
    
    if (roll >= 1 && roll <= 40) {
      const start = Math.max(0, match.index - 30);
      const end = Math.min(text.length, match.index + match[0].length + 30);
      const context = text.slice(start, end).replace(/\s+/g, ' ').trim();
      
      matches.push({
        fullMatch: match[0],
        value: roll,
        skill,
        roll,
        outcome,
        context,
        index: match.index,
      });
    }
  }
  
  // Pattern 2: "rolls X for Skill"
  const pattern2 = new RegExp(`roll(?:s|ed)?\\s+(?:a\\s+)?(\\d+)\\s+(?:for\\s+)?(${skillsPattern})`, 'gi');
  
  while ((match = pattern2.exec(text)) !== null) {
    const roll = parseInt(match[1], 10);
    const skill = match[2].toLowerCase();
    
    if (roll >= 1 && roll <= 40) {
      const start = Math.max(0, match.index - 30);
      const end = Math.min(text.length, match.index + match[0].length + 30);
      const context = text.slice(start, end).replace(/\s+/g, ' ').trim();
      
      matches.push({
        fullMatch: match[0],
        value: roll,
        skill,
        roll,
        context,
        index: match.index,
      });
    }
  }
  
  // Deduplicate by index
  const seen = new Set<number>();
  return matches.filter(m => {
    if (seen.has(m.index)) return false;
    seen.add(m.index);
    return true;
  });
}

// ===== SAVING THROW PATTERNS =====

export const SAVING_THROW_PATTERNS = [
  // "CON save: 12 vs DC 15", "Dexterity saving throw: 18"
  new RegExp(`(${ABILITIES.join('|')}|${ABILITY_FULL.join('|')})\\s+(?:sav(?:e|ing)?(?:\\s+throw)?)[:\\s]+(\\d+)(?:\\s*(?:vs\\.?|versus|against)\\s*(?:DC)?\\s*(\\d+))?`, 'gi'),
  // "makes a Wisdom save: 14", "rolls a CON save"
  new RegExp(`(?:make|makes|made|roll|rolls|rolled)\\s+(?:a\\s+)?(${ABILITIES.join('|')}|${ABILITY_FULL.join('|')})\\s+(?:sav(?:e|ing)?(?:\\s+throw)?)[:\\s]+(\\d+)`, 'gi'),
  // "saving throw (DEX): 16 vs DC 14"
  new RegExp(`(?:sav(?:e|ing)?(?:\\s+throw)?)\\s*\\((${ABILITIES.join('|')}|${ABILITY_FULL.join('|')})\\)[:\\s]+(\\d+)`, 'gi'),
];

export interface SavingThrowMatch extends PatternMatch {
  ability: string;
  roll: number;
  dc?: number;
  outcome?: 'success' | 'failure';
}

export function parseSavingThrowMatches(text: string): SavingThrowMatch[] {
  const matches: SavingThrowMatch[] = [];
  const abilitiesPattern = `${ABILITIES.join('|')}|${ABILITY_FULL.join('|')}`;
  
  // Pattern 1: "ABILITY save: roll vs DC X"
  const pattern1 = new RegExp(`(${abilitiesPattern})\\s+(?:sav(?:e|ing)?(?:\\s+throw)?)[:\\s]+(\\d+)(?:\\s*(?:vs\\.?|versus|against)\\s*(?:DC)?\\s*(\\d+))?`, 'gi');
  let match;
  
  while ((match = pattern1.exec(text)) !== null) {
    const ability = normalizeAbility(match[1]);
    const roll = parseInt(match[2], 10);
    const dc = match[3] ? parseInt(match[3], 10) : undefined;
    
    let outcome: 'success' | 'failure' | undefined;
    if (dc !== undefined) {
      outcome = roll >= dc ? 'success' : 'failure';
    }
    
    if (roll >= 1 && roll <= 40) {
      const start = Math.max(0, match.index - 30);
      const end = Math.min(text.length, match.index + match[0].length + 30);
      const context = text.slice(start, end).replace(/\s+/g, ' ').trim();
      
      matches.push({
        fullMatch: match[0],
        value: roll,
        ability,
        roll,
        dc,
        outcome,
        context,
        index: match.index,
      });
    }
  }
  
  // Pattern 2: "makes/rolls ABILITY save: roll"
  const pattern2 = new RegExp(`(?:make|makes|made|roll|rolls|rolled)\\s+(?:a\\s+)?(${abilitiesPattern})\\s+(?:sav(?:e|ing)?(?:\\s+throw)?)[:\\s]+(\\d+)`, 'gi');
  
  while ((match = pattern2.exec(text)) !== null) {
    const ability = normalizeAbility(match[1]);
    const roll = parseInt(match[2], 10);
    
    if (roll >= 1 && roll <= 40) {
      const start = Math.max(0, match.index - 30);
      const end = Math.min(text.length, match.index + match[0].length + 30);
      const context = text.slice(start, end).replace(/\s+/g, ' ').trim();
      
      matches.push({
        fullMatch: match[0],
        value: roll,
        ability,
        roll,
        context,
        index: match.index,
      });
    }
  }
  
  // Deduplicate by index
  const seen = new Set<number>();
  return matches.filter(m => {
    if (seen.has(m.index)) return false;
    seen.add(m.index);
    return true;
  });
}

// Helper to normalize ability abbreviations
function normalizeAbility(ability: string): string {
  const lower = ability.toLowerCase();
  const abbrevMap: Record<string, string> = {
    str: 'strength',
    dex: 'dexterity',
    con: 'constitution',
    int: 'intelligence',
    wis: 'wisdom',
    cha: 'charisma',
  };
  return abbrevMap[lower] || lower;
}
