// Feat Acquisition Detection Patterns
// Detects when a character gains a feat from session logs

import { PatternMatch } from '../patterns';

// Common D&D 5e feats
export const KNOWN_FEATS = [
  'alert', 'athlete', 'actor', 'charger', 'crossbow expert',
  'defensive duelist', 'dual wielder', 'dungeon delver', 'durable',
  'elemental adept', 'grappler', 'great weapon master', 'healer',
  'heavily armored', 'heavy armor master', 'inspiring leader',
  'keen mind', 'lightly armored', 'linguist', 'lucky', 'mage slayer',
  'magic initiate', 'martial adept', 'medium armor master', 'mobile',
  'moderately armored', 'mounted combatant', 'observant',
  'polearm master', 'resilient', 'ritual caster', 'savage attacker',
  'sentinel', 'sharpshooter', 'shield master', 'skilled',
  'skulker', 'spell sniper', 'tavern brawler', 'tough',
  'war caster', 'weapon master',
  // 2024 / popular homebrew
  'crusher', 'elven accuracy', 'fey touched', 'fighting initiate',
  'gift of the chromatic dragon', 'gift of the gem dragon',
  'gift of the metallic dragon', 'gunner', 'metamagic adept',
  'piercer', 'poisoner', 'shadow touched', 'skill expert',
  'slasher', 'telekinetic', 'telepathic', 'chef', 'fey teleportation',
] as const;

// Build a pattern from known feats (escape special chars)
const FEAT_NAMES_PATTERN = KNOWN_FEATS
  .map(f => f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|');

export interface FeatAcquisitionMatch extends PatternMatch {
  featName: string;
  isKnownFeat: boolean;
  source?: string; // e.g. "ASI", "level up", "variant human"
}

/**
 * Parse feat acquisition events from session text.
 * Detects patterns like:
 * - "takes the Sentinel feat"
 * - "gains feat: Great Weapon Master"
 * - "chooses Lucky as their feat"
 * - "selects the Sharpshooter feat at level 4"
 * - "learns War Caster"
 */
export function parseFeatAcquisitionMatches(text: string): FeatAcquisitionMatch[] {
  const matches: FeatAcquisitionMatch[] = [];

  // Pattern 1: Known feats by name — "takes/gains/selects/chooses [the] FEAT [feat]"
  const p1 = new RegExp(
    `(?:takes?|gains?|acquires?|selects?|chooses?|picks?|learns?)\\s+(?:the\\s+)?(${FEAT_NAMES_PATTERN})\\s*(?:feat)?`,
    'gi'
  );
  let m;
  while ((m = p1.exec(text)) !== null) {
    matches.push(buildFeatMatch(text, m, m[1].trim(), true));
  }

  // Pattern 2: "feat: NAME" / "new feat: NAME" (but not if it starts with "Variant Human feat:")
  const p2 = /(?<![Vv]ariant\s[Hh]uman\s)(?:new\s+)?feat[:\s]+([A-Z][A-Za-z\s]{2,30}?)(?:\.|,|;|\n|$)/gi;
  while ((m = p2.exec(text)) !== null) {
    const name = m[1].trim();
    if (name.length > 2 && !isCommonWord(name)) {
      const isKnown = isKnownFeat(name);
      // Skip if already matched by p1 nearby
      const isDup = matches.some(k => Math.abs(k.index - m!.index) < 40 && k.featName.toLowerCase() === name.toLowerCase());
      if (!isDup) {
        matches.push(buildFeatMatch(text, m, name, isKnown));
      }
    }
  }

  // Pattern 3: "FEAT feat" with known feat names
  const p3 = new RegExp(`(${FEAT_NAMES_PATTERN})\\s+feat`, 'gi');
  while ((m = p3.exec(text)) !== null) {
    const name = m[1].trim();
    // Skip if already matched by p1 nearby
    const isDup = matches.some(k => Math.abs(k.index - m!.index) < 40 && k.featName.toLowerCase() === name.toLowerCase());
    if (!isDup) {
      matches.push(buildFeatMatch(text, m, name, true));
    }
  }

  // Pattern 4: Generic "gains a feat" / "takes a feat" with nearby name context
  const p4 = /(?:takes?|gains?|acquires?|selects?|chooses?)\s+(?:a\s+)?(?:new\s+)?feat\b/gi;
  while ((m = p4.exec(text)) !== null) {
    // Look for a feat name within 50 chars after
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 60);
    const nameMatch = after.match(/[:\s-]+([A-Z][A-Za-z\s]{2,30}?)(?:\.|,|;|\n|$)/);
    if (nameMatch) {
      const name = nameMatch[1].trim();
      if (!isCommonWord(name)) {
        matches.push(buildFeatMatch(text, m, name, isKnownFeat(name)));
      }
    }
  }

  // Pattern 5: Variant Human / Custom Lineage feat at level 1
  const p5 = /(?:variant\s+human|custom\s+lineage)\s+(?:feat|bonus\s+feat)[:\s]+([A-Z][A-Za-z\s]{2,30}?)(?:\.|,|;|\n|$)/gi;
  while ((m = p5.exec(text)) !== null) {
    const name = m[1].trim();
    if (!isCommonWord(name)) {
      const result = buildFeatMatch(text, m, name, isKnownFeat(name));
      result.source = 'variant human';
      // Replace any existing match for same feat without source
      const existingIdx = matches.findIndex(k => k.featName.toLowerCase() === name.toLowerCase());
      if (existingIdx >= 0) {
        matches[existingIdx] = result;
      } else {
        matches.push(result);
      }
    }
  }

  return dedup(matches);
}

function isKnownFeat(name: string): boolean {
  return KNOWN_FEATS.some(f => f.toLowerCase() === name.toLowerCase());
}

const COMMON_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'this', 'that', 'then',
  'they', 'their', 'there', 'will', 'have', 'been', 'were',
  'what', 'when', 'where', 'which', 'while', 'after', 'before',
]);

function isCommonWord(name: string): boolean {
  return COMMON_WORDS.has(name.toLowerCase().trim());
}

function buildFeatMatch(text: string, m: RegExpExecArray, featName: string, isKnown: boolean): FeatAcquisitionMatch {
  const start = Math.max(0, m.index - 30);
  const end = Math.min(text.length, m.index + m[0].length + 30);
  const context = text.slice(start, end).replace(/\s+/g, ' ').trim();
  return {
    fullMatch: m[0],
    value: featName,
    featName,
    isKnownFeat: isKnown,
    context,
    index: m.index,
  };
}

function dedup(matches: FeatAcquisitionMatch[]): FeatAcquisitionMatch[] {
  const kept: FeatAcquisitionMatch[] = [];
  for (const m of matches) {
    const isDup = kept.some(k =>
      k.featName.toLowerCase() === m.featName.toLowerCase()
    );
    if (!isDup) kept.push(m);
  }
  return kept;
}
