// Ability Score Increase (ASI) Detection Patterns
// Detects ability score increases from session logs

import { PatternMatch } from '../patterns';

// Ability names in various forms
const ABILITY_NAMES = [
  'strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma',
  'str', 'dex', 'con', 'int', 'wis', 'cha',
] as const;

const ABILITY_PATTERN = ABILITY_NAMES.join('|');

// Normalize to full ability name
function normalizeAbility(raw: string): string {
  const map: Record<string, string> = {
    str: 'strength', dex: 'dexterity', con: 'constitution',
    int: 'intelligence', wis: 'wisdom', cha: 'charisma',
  };
  const lower = raw.toLowerCase().trim();
  return map[lower] || lower;
}

export interface AbilityScoreIncreaseMatch extends PatternMatch {
  ability: string;
  increase: number;
  newScore?: number;
  source?: string;
}

/**
 * Parse ability score increase events from session text.
 */
export function parseAbilityScoreIncreaseMatches(text: string): AbilityScoreIncreaseMatch[] {
  const matches: AbilityScoreIncreaseMatch[] = [];

  // Pattern 1: "increases/raises ABILITY by X" / "ABILITY increases by X"
  const p1 = new RegExp(
    `(?:(?:increases?|raises?|improved?|boosts?)\\s+(?:(?:his|her|their|your)\\s+)?(${ABILITY_PATTERN})\\s+(?:score\\s+)?by\\s+(\\d+))` +
    `|(?:(${ABILITY_PATTERN})\\s+(?:score\\s+)?(?:increases?|goes\\s+up|raises?|improved?)\\s+by\\s+(\\d+))`,
    'gi'
  );
  let m;
  while ((m = p1.exec(text)) !== null) {
    const ability = normalizeAbility(m[1] || m[3]);
    const increase = parseInt(m[2] || m[4], 10);
    if (increase >= 1 && increase <= 10) {
      matches.push(buildMatch(text, m, ability, increase));
    }
  }

  // Pattern 2: "ABILITY goes up to X" / "ABILITY is now X" / "ABILITY score is now X"
  const p2 = new RegExp(
    `(${ABILITY_PATTERN})\\s+(?:score\\s+)?(?:goes\\s+up\\s+to|is\\s+now|increases?\\s+to|becomes?|raised?\\s+to)\\s+(\\d+)`,
    'gi'
  );
  while ((m = p2.exec(text)) !== null) {
    const ability = normalizeAbility(m[1]);
    const newScore = parseInt(m[2], 10);
    if (newScore >= 1 && newScore <= 30) {
      const result = buildMatch(text, m, ability, 0);
      result.newScore = newScore;
      matches.push(result);
    }
  }

  // Pattern 3: "gains +X to ABILITY" / "+X ABILITY"
  const p3 = new RegExp(
    `(?:gains?|receives?|gets?)\\s+\\+?(\\d+)\\s+(?:to\\s+)?(${ABILITY_PATTERN})` +
    `|\\+(\\d+)\\s+(${ABILITY_PATTERN})\\s+(?:score)?`,
    'gi'
  );
  while ((m = p3.exec(text)) !== null) {
    const increase = parseInt(m[1] || m[3], 10);
    const ability = normalizeAbility(m[2] || m[4]);
    if (increase >= 1 && increase <= 10) {
      matches.push(buildMatch(text, m, ability, increase));
    }
  }

  // Pattern 4: "Ability Score Improvement: +X ABILITY, +X ABILITY"
  const p4 = /ability\s+score\s+(?:improvement|increase|asi)[:\s]+([^\n.]+)/gi;
  while ((m = p4.exec(text)) !== null) {
    const block = m[1];
    const entryPattern = new RegExp(`\\+?(\\d+)\\s+(?:to\\s+)?(${ABILITY_PATTERN})`, 'gi');
    let entry;
    while ((entry = entryPattern.exec(block)) !== null) {
      const increase = parseInt(entry[1], 10);
      const ability = normalizeAbility(entry[2]);
      if (increase >= 1 && increase <= 10) {
        const result = buildMatch(text, m, ability, increase);
        result.source = 'ASI';
        matches.push(result);
      }
    }
  }

  // Pattern 5: Tome/Manual items - "reads Tome of X" / "uses Manual of X"
  const p5 = /(?:reads?|uses?|consumes?|studies)\s+(?:a\s+)?(?:the\s+)?((?:tome|manual|book)\s+of\s+\w+(?:\s+\w+)?)/gi;
  while ((m = p5.exec(text)) !== null) {
    const itemName = m[1];
    // Map tome/manual names to abilities
    const tomeMap: Record<string, string> = {
      'tome of clear thought': 'intelligence',
      'tome of understanding': 'wisdom',
      'tome of leadership': 'charisma',
      'tome of leadership and influence': 'charisma',
      'manual of gainful exercise': 'strength',
      'manual of quickness of action': 'dexterity',
      'manual of bodily health': 'constitution',
    };
    const itemLower = itemName.toLowerCase();
    // Find the best matching key
    let ability: string | undefined;
    for (const [key, val] of Object.entries(tomeMap)) {
      if (itemLower.includes(key) || key.includes(itemLower)) {
        ability = val;
        break;
      }
    }
    if (ability) {
      const result = buildMatch(text, m, ability, 2);
      result.source = itemName;
      matches.push(result);
    }
  }

  // Deduplicate by proximity
  return dedup(matches);
}

function buildMatch(text: string, m: RegExpExecArray, ability: string, increase: number): AbilityScoreIncreaseMatch {
  const start = Math.max(0, m.index - 30);
  const end = Math.min(text.length, m.index + m[0].length + 30);
  const context = text.slice(start, end).replace(/\s+/g, ' ').trim();
  return {
    fullMatch: m[0],
    value: increase,
    ability,
    increase,
    context,
    index: m.index,
  };
}

function dedup(matches: AbilityScoreIncreaseMatch[]): AbilityScoreIncreaseMatch[] {
  const kept: AbilityScoreIncreaseMatch[] = [];
  for (const m of matches) {
    const isDup = kept.some(k => Math.abs(k.index - m.index) < 20 && k.ability === m.ability);
    if (!isDup) kept.push(m);
  }
  return kept;
}
