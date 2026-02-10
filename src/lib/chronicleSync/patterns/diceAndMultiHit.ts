// Chronicle Sync: Dice Roll Parsing
// Extracts dice expressions, totals, modifiers, and natural 20s/1s

import { ConfidenceLevel } from '../types';

export interface ParsedDiceRoll {
  expression?: string; // e.g. "2d6+3"
  total: number;
  modifier?: number;
  naturalRoll?: number; // The raw d20 value if detectable
  isCrit?: boolean; // Natural 20
  isFumble?: boolean; // Natural 1
  context: string;
  sourceText: string;
  confidence: ConfidenceLevel;
}

// Patterns for dice roll results
const DICE_PATTERNS = [
  // "rolls 14 + 5 for 19", "rolls a 14 + 5 = 19"
  /rolls?\s+(?:a\s+)?(\d+)\s*\+\s*(\d+)\s*(?:for|=|total(?:ing)?)\s*(\d+)/gi,
  // "rolls a natural 20", "rolls nat 1"
  /rolls?\s+(?:a\s+)?(?:natural|nat)\s*(\d+)/gi,
  // "rolls 18 on the d20", "rolled a 15"
  /rolls?\s+(?:a\s+)?(\d+)\s*(?:on\s+(?:the\s+)?d20)?/gi,
  // "2d6+3 = 11", "1d8 + 2 for 7"
  /(\d+d\d+)\s*(?:\+\s*(\d+))?\s*(?:=|for|total(?:ing)?)\s*(\d+)/gi,
  // "deals 2d6 + 3 (11) slashing damage"
  /(\d+d\d+)\s*(?:\+\s*(\d+))?\s*\((\d+)\)/gi,
  // "(14 + 5 = 19)" parenthetical roll results
  /\((\d+)\s*\+\s*(\d+)\s*=\s*(\d+)\)/g,
  // "total: 19", "result: 15"
  /(?:total|result)[\s:]+(\d+)/gi,
];

export function parseDiceRolls(text: string): ParsedDiceRoll[] {
  const rolls: ParsedDiceRoll[] = [];
  const seen = new Set<number>();

  for (const pattern of DICE_PATTERNS) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((match = regex.exec(text)) !== null) {
      if (seen.has(match.index)) continue;
      seen.add(match.index);

      const fullMatch = match[0];
      const start = Math.max(0, match.index - 40);
      const end = Math.min(text.length, match.index + fullMatch.length + 40);
      const context = text.slice(start, end).replace(/\s+/g, ' ').trim();

      let expression: string | undefined;
      let total: number | undefined;
      let modifier: number | undefined;
      let naturalRoll: number | undefined;

      // Natural roll pattern
      if (/nat(?:ural)?/i.test(fullMatch)) {
        const natVal = parseInt(match[1], 10);
        if (!isNaN(natVal)) {
          naturalRoll = natVal;
          total = natVal;
        }
      }
      // Dice expression pattern (XdY+Z)
      else if (/\d+d\d+/i.test(fullMatch)) {
        expression = match[1];
        if (match[2]) modifier = parseInt(match[2], 10);
        if (match[3]) total = parseInt(match[3], 10);
      }
      // Roll + modifier = total
      else if (match[3] && match[1] && match[2]) {
        naturalRoll = parseInt(match[1], 10);
        modifier = parseInt(match[2], 10);
        total = parseInt(match[3], 10);
      }
      // Simple roll value
      else if (match[1]) {
        total = parseInt(match[1], 10);
      }

      if (total === undefined && naturalRoll === undefined) continue;
      if (total !== undefined && (total < 1 || total > 200)) continue;

      rolls.push({
        expression,
        total: total ?? naturalRoll!,
        modifier,
        naturalRoll,
        isCrit: naturalRoll === 20,
        isFumble: naturalRoll === 1,
        context,
        sourceText: fullMatch,
        confidence: expression ? 'high' : (naturalRoll !== undefined ? 'high' : 'medium'),
      });
    }
  }

  return rolls;
}

// ===== MULTI-HIT CONSOLIDATION =====

export interface ConsolidatedHit {
  totalDamage: number;
  hitCount: number;
  individualHits: number[];
  source: string;
  sourceText: string;
}

/**
 * Consolidate sequential damage events that appear to be from the same attack
 * (e.g., Magic Missile's 3 darts, Extra Attack's multiple strikes)
 */
export function consolidateMultiHits(
  damageEvents: Array<{ amount: number; source: string; sourceText: string; index?: number }>,
  sourceText: string
): ConsolidatedHit[] {
  if (damageEvents.length <= 1) return [];

  const consolidated: ConsolidatedHit[] = [];
  let currentGroup: typeof damageEvents = [];
  let lastIndex = -1;

  // Sort by position in source text
  const sorted = [...damageEvents]
    .map(e => ({
      ...e,
      index: e.index ?? sourceText.indexOf(e.sourceText),
    }))
    .sort((a, b) => a.index - b.index);

  for (const event of sorted) {
    // Group events within 200 chars of each other
    if (currentGroup.length > 0 && event.index - lastIndex > 200) {
      if (currentGroup.length >= 2) {
        consolidated.push(buildConsolidated(currentGroup));
      }
      currentGroup = [];
    }
    currentGroup.push(event);
    lastIndex = event.index;
  }

  // Final group
  if (currentGroup.length >= 2) {
    consolidated.push(buildConsolidated(currentGroup));
  }

  return consolidated;
}

function buildConsolidated(group: Array<{ amount: number; source: string; sourceText: string }>): ConsolidatedHit {
  return {
    totalDamage: group.reduce((sum, e) => sum + Math.abs(e.amount), 0),
    hitCount: group.length,
    individualHits: group.map(e => Math.abs(e.amount)),
    source: group[0].source,
    sourceText: group.map(e => e.sourceText).join('; '),
  };
}
