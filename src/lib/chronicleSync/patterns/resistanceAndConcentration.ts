// Chronicle Sync: Resistance, Vulnerability, and Immunity Detection
// Parses damage resistance/vulnerability/immunity and concentration checks

import { ConfidenceLevel } from '../types';

// ===== RESISTANCE / VULNERABILITY / IMMUNITY =====

export type DamageModifierType = 'resistance' | 'vulnerability' | 'immunity';

export interface ParsedDamageModifier {
  type: DamageModifierType;
  damageType: string;
  sourceText: string;
  confidence: ConfidenceLevel;
}

const DAMAGE_TYPES_LIST = [
  'acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning',
  'necrotic', 'piercing', 'poison', 'psychic', 'radiant',
  'slashing', 'thunder',
  // Non-magical variants
  'nonmagical', 'magical',
];

const DAMAGE_TYPE_GROUP = DAMAGE_TYPES_LIST.join('|');

const RESISTANCE_PATTERNS = [
  // "resistant to fire damage", "has resistance to cold"
  new RegExp(`(?:resistant|resistance)\\s+to\\s+(${DAMAGE_TYPE_GROUP})(?:\\s+damage)?`, 'gi'),
  // "fire resistance", "cold resistance"
  new RegExp(`(${DAMAGE_TYPE_GROUP})\\s+resistance`, 'gi'),
  // "resists the fire damage", "resists 10 cold damage"
  new RegExp(`resists?\\s+(?:the\\s+)?(?:\\d+\\s+)?(${DAMAGE_TYPE_GROUP})(?:\\s+damage)?`, 'gi'),
  // "takes half damage from fire" (implies resistance)
  new RegExp(`takes?\\s+half\\s+(?:the\\s+)?(?:damage\\s+)?(?:from\\s+)?(${DAMAGE_TYPE_GROUP})`, 'gi'),
];

const VULNERABILITY_PATTERNS = [
  // "vulnerable to fire damage", "has vulnerability to cold"
  new RegExp(`(?:vulnerable|vulnerability)\\s+to\\s+(${DAMAGE_TYPE_GROUP})(?:\\s+damage)?`, 'gi'),
  // "fire vulnerability"
  new RegExp(`(${DAMAGE_TYPE_GROUP})\\s+vulnerability`, 'gi'),
  // "takes double damage from fire"
  new RegExp(`takes?\\s+double\\s+(?:the\\s+)?(?:damage\\s+)?(?:from\\s+)?(${DAMAGE_TYPE_GROUP})`, 'gi'),
];

const IMMUNITY_PATTERNS = [
  // "immune to fire damage", "has immunity to poison"
  new RegExp(`(?:immune|immunity)\\s+to\\s+(${DAMAGE_TYPE_GROUP})(?:\\s+damage)?`, 'gi'),
  // "fire immunity", "poison immunity"
  new RegExp(`(${DAMAGE_TYPE_GROUP})\\s+immunity`, 'gi'),
  // "the fire damage has no effect", "unaffected by poison"
  new RegExp(`(?:unaffected|no\\s+effect)\\s+(?:by|from)\\s+(${DAMAGE_TYPE_GROUP})`, 'gi'),
];

export function parseDamageModifiers(text: string): ParsedDamageModifier[] {
  const results: ParsedDamageModifier[] = [];
  const seen = new Set<number>();

  const processPatterns = (
    patterns: RegExp[],
    type: DamageModifierType,
  ) => {
    for (const pattern of patterns) {
      const regex = new RegExp(pattern.source, pattern.flags);
      let match;
      while ((match = regex.exec(text)) !== null) {
        if (seen.has(match.index)) continue;
        seen.add(match.index);

        const damageType = match[1].toLowerCase().trim();
        results.push({
          type,
          damageType,
          sourceText: match[0],
          confidence: 'high',
        });
      }
    }
  };

  processPatterns(RESISTANCE_PATTERNS, 'resistance');
  processPatterns(VULNERABILITY_PATTERNS, 'vulnerability');
  processPatterns(IMMUNITY_PATTERNS, 'immunity');

  return results;
}

// ===== CONCENTRATION CHECKS =====

export interface ParsedConcentrationCheck {
  dc?: number;
  result?: 'maintained' | 'broken' | 'unknown';
  spellName?: string;
  sourceText: string;
  confidence: ConfidenceLevel;
}

const CONCENTRATION_PATTERNS = [
  // "makes a concentration check DC 12", "concentration save DC 10"
  /(?:concentration\s+(?:check|save|saving\s+throw))\s*(?:DC|dc)\s*(\d+)/gi,
  // "DC 14 concentration check", "DC 10 concentration save"
  /(?:DC|dc)\s*(\d+)\s+concentration\s+(?:check|save)/gi,
  // "rolls concentration: 18 vs DC 12"
  /(?:rolls?\s+)?concentration[:\s]+(\d+)\s+(?:vs\.?\s+)?(?:DC|dc)\s*(\d+)/gi,
  // "maintains concentration on Haste", "keeps concentration"
  /(?:maintains?|keeps?|holds?)\s+concentration(?:\s+on\s+([a-zA-Z][a-zA-Z\s']+?))?(?:\s*[.!,]|\s*$)/gi,
  // "loses concentration on Bless", "concentration broken on Fly"
  /(?:loses?|drops?|breaks?)\s+concentration(?:\s+on\s+([a-zA-Z][a-zA-Z\s']+?))?(?:\s*[.!,]|\s*$)/gi,
  /concentration\s+(?:is\s+)?(?:broken|lost|disrupted)(?:\s+on\s+([a-zA-Z][a-zA-Z\s']+?))?/gi,
  // "fails the concentration check"
  /fails?\s+(?:the\s+)?concentration\s+(?:check|save)/gi,
  // "passes the concentration check"
  /(?:passes?|succeeds?)\s+(?:on\s+)?(?:the\s+)?concentration\s+(?:check|save)/gi,
];

export function parseConcentrationChecks(text: string): ParsedConcentrationCheck[] {
  const results: ParsedConcentrationCheck[] = [];
  const seen = new Set<number>();

  for (const pattern of CONCENTRATION_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (seen.has(match.index)) continue;
      seen.add(match.index);

      let dc: number | undefined;
      let result: ParsedConcentrationCheck['result'] = 'unknown';
      let spellName: string | undefined;

      // Extract DC from captures
      for (let i = 1; i < match.length; i++) {
        const val = match[i];
        if (!val) continue;
        const num = parseInt(val, 10);
        if (!isNaN(num) && num >= 5 && num <= 30) {
          dc = dc ?? num; // first numeric = DC
        } else if (val.length > 2 && !/^\d/.test(val)) {
          spellName = val.trim();
        }
      }

      // Determine result from keywords
      const lower = match[0].toLowerCase();
      if (/maintains?|keeps?|holds?|passes?|succeeds?/i.test(lower)) {
        result = 'maintained';
      } else if (/loses?|drops?|breaks?|broken|lost|disrupted|fails?/i.test(lower)) {
        result = 'broken';
      }

      results.push({
        dc,
        result,
        spellName,
        sourceText: match[0],
        confidence: dc !== undefined ? 'high' : 'medium',
      });
    }
  }

  return results;
}
