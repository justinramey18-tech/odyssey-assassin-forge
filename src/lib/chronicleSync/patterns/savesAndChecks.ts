// Chronicle Sync: Saving Throw & Ability Check Detection
// Parses saving throws (DEX/CON/WIS save) and skill checks (Perception, Stealth, etc.)

import { PatternMatch } from '../patterns';
import { ConfidenceLevel } from '../types';

// ===== TYPES =====

export interface ParsedSavingThrow {
  ability: string; // 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA'
  result: 'success' | 'failure' | 'unknown';
  dc?: number;
  roll?: number;
  sourceText: string;
  confidence: ConfidenceLevel;
}

export interface ParsedAbilityCheck {
  skill: string; // e.g. 'Perception', 'Stealth', 'Athletics'
  ability?: string; // parent ability
  result?: 'success' | 'failure' | 'unknown';
  dc?: number;
  roll?: number;
  sourceText: string;
  confidence: ConfidenceLevel;
}

// ===== ABILITY MAPPINGS =====

const ABILITY_ALIASES: Record<string, string> = {
  str: 'STR', strength: 'STR',
  dex: 'DEX', dexterity: 'DEX',
  con: 'CON', constitution: 'CON',
  int: 'INT', intelligence: 'INT',
  wis: 'WIS', wisdom: 'WIS',
  cha: 'CHA', charisma: 'CHA',
};

const SKILL_TO_ABILITY: Record<string, string> = {
  athletics: 'STR',
  acrobatics: 'DEX', 'sleight of hand': 'DEX', stealth: 'DEX',
  arcana: 'INT', history: 'INT', investigation: 'INT', nature: 'INT', religion: 'INT',
  'animal handling': 'WIS', insight: 'WIS', medicine: 'WIS', perception: 'WIS', survival: 'WIS',
  deception: 'CHA', intimidation: 'CHA', performance: 'CHA', persuasion: 'CHA',
};

const ALL_SKILLS = Object.keys(SKILL_TO_ABILITY);
const SKILL_PATTERN = ALL_SKILLS.map(s => s.replace(/\s+/g, '\\s+')).join('|');

// ===== SAVING THROW PATTERNS =====

const SAVE_PATTERNS = [
  // "makes a DEX save", "fails a Constitution saving throw"
  /(?:make|roll|attempt)s?\s+(?:a\s+)?(\w+)\s+sav(?:e|ing)?\s*(?:throw)?/gi,
  // "DEX save: success", "CON saving throw: failure"
  /(\w+)\s+sav(?:e|ing)?\s*(?:throw)?[\s:]+(?:(\d+)\s*)?(?:–\s*)?(\w+)/gi,
  // "succeeds/fails on a DEX save", "passes the WIS save"
  /(succeed|success|pass|fail|failure)(?:s|ed)?\s+(?:on\s+)?(?:a\s+|the\s+)?(\w+)\s+sav(?:e|ing)?/gi,
  // "DC 15 Dexterity save" or "Dexterity save (DC 15)"
  /DC\s*(\d+)\s+(\w+)\s+sav(?:e|ing)?/gi,
  /(\w+)\s+sav(?:e|ing)?\s*\(?\s*DC\s*(\d+)\s*\)?/gi,
  // "rolls a 14 on their DEX save"
  /rolls?\s+(?:a\s+)?(\d+)\s+(?:on\s+)?(?:a\s+|the\s+|their\s+)?(\w+)\s+sav(?:e|ing)?/gi,
];

export function parseSavingThrows(text: string): ParsedSavingThrow[] {
  const saves: ParsedSavingThrow[] = [];
  const seen = new Set<number>();

  for (const pattern of SAVE_PATTERNS) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((match = regex.exec(text)) !== null) {
      if (seen.has(match.index)) continue;
      seen.add(match.index);

      const fullMatch = match[0];
      let ability: string | undefined;
      let result: 'success' | 'failure' | 'unknown' = 'unknown';
      let dc: number | undefined;
      let roll: number | undefined;

      // Extract ability from all capture groups
      for (let i = 1; i <= match.length - 1; i++) {
        const val = match[i]?.toLowerCase();
        if (!val) continue;
        if (ABILITY_ALIASES[val]) ability = ABILITY_ALIASES[val];
        if (/succeed|success|pass/i.test(val)) result = 'success';
        if (/fail/i.test(val)) result = 'failure';
        const num = parseInt(val, 10);
        if (!isNaN(num) && num >= 1 && num <= 30) {
          if (fullMatch.toLowerCase().includes('dc')) dc = num;
          else roll = num;
        }
      }

      // Also check the full match for result keywords
      if (result === 'unknown') {
        if (/succeed|success|pass/i.test(fullMatch)) result = 'success';
        else if (/fail/i.test(fullMatch)) result = 'failure';
      }

      // Extract DC from full match if not found
      if (dc === undefined) {
        const dcMatch = fullMatch.match(/DC\s*(\d+)/i);
        if (dcMatch) dc = parseInt(dcMatch[1], 10);
      }

      if (!ability) continue;

      saves.push({
        ability,
        result,
        dc,
        roll,
        sourceText: fullMatch,
        confidence: dc !== undefined ? 'high' : (result !== 'unknown' ? 'medium' : 'low'),
      });
    }
  }

  return saves;
}

// ===== ABILITY CHECK PATTERNS =====

const CHECK_PATTERNS = [
  // "makes a Perception check", "rolls Stealth"
  new RegExp(`(?:make|roll|attempt)s?\\s+(?:a\\s+)?(?:an?\\s+)?(${SKILL_PATTERN})\\s*(?:check|roll)?`, 'gi'),
  // "Perception check: 18", "Stealth: 14"
  new RegExp(`(${SKILL_PATTERN})\\s*(?:check)?[\\s:]+(?:(\\d+)\\s*)?`, 'gi'),
  // "succeeds/fails on a Perception check"
  new RegExp(`(succeed|success|pass|fail|failure)(?:s|ed)?\\s+(?:on\\s+)?(?:a\\s+|the\\s+)?(${SKILL_PATTERN})\\s*(?:check)?`, 'gi'),
  // "DC 15 Perception check"
  new RegExp(`DC\\s*(\\d+)\\s+(${SKILL_PATTERN})\\s*(?:check)?`, 'gi'),
  // "rolls a 14 on their Perception check"
  new RegExp(`rolls?\\s+(?:a\\s+)?(\\d+)\\s+(?:on\\s+)?(?:a\\s+|the\\s+|their\\s+)?(${SKILL_PATTERN})`, 'gi'),
];

export function parseAbilityChecks(text: string): ParsedAbilityCheck[] {
  const checks: ParsedAbilityCheck[] = [];
  const seen = new Set<number>();

  for (const pattern of CHECK_PATTERNS) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((match = regex.exec(text)) !== null) {
      if (seen.has(match.index)) continue;
      seen.add(match.index);

      const fullMatch = match[0];
      let skill: string | undefined;
      let result: 'success' | 'failure' | 'unknown' = 'unknown';
      let dc: number | undefined;
      let roll: number | undefined;

      for (let i = 1; i <= match.length - 1; i++) {
        const val = match[i]?.toLowerCase();
        if (!val) continue;
        if (ALL_SKILLS.includes(val)) skill = val.charAt(0).toUpperCase() + val.slice(1);
        if (/succeed|success|pass/i.test(val)) result = 'success';
        if (/fail/i.test(val)) result = 'failure';
        const num = parseInt(val, 10);
        if (!isNaN(num) && num >= 1 && num <= 30) {
          if (fullMatch.toLowerCase().includes('dc')) dc = num;
          else roll = num;
        }
      }

      if (result === 'unknown') {
        if (/succeed|success|pass/i.test(fullMatch)) result = 'success';
        else if (/fail/i.test(fullMatch)) result = 'failure';
      }

      if (dc === undefined) {
        const dcMatch = fullMatch.match(/DC\s*(\d+)/i);
        if (dcMatch) dc = parseInt(dcMatch[1], 10);
      }

      if (!skill) continue;

      checks.push({
        skill,
        ability: SKILL_TO_ABILITY[skill.toLowerCase()],
        result,
        dc,
        roll,
        sourceText: fullMatch,
        confidence: dc !== undefined ? 'high' : (roll !== undefined ? 'medium' : 'low'),
      });
    }
  }

  return checks;
}
