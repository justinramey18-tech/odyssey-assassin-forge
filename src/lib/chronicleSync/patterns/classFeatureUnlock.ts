// Class Feature Unlock Detection Patterns
// Detects class feature acquisitions from session logs

import { PatternMatch } from '../patterns';

// Well-known D&D 5e class features across all classes
export const KNOWN_CLASS_FEATURES: Record<string, string[]> = {
  rogue: [
    'sneak attack', 'cunning action', 'uncanny dodge', 'evasion',
    'reliable talent', 'blindsense', 'slippery mind', 'elusive',
    'stroke of luck', 'expertise', 'thieves\' cant',
  ],
  wizard: [
    'arcane recovery', 'spell mastery', 'signature spells',
    'arcane tradition', 'arcane ward', 'portent',
  ],
  sorcerer: [
    'sorcery points', 'metamagic', 'font of magic',
    'sorcerous restoration', 'sorcerous origin',
  ],
  warlock: [
    'eldritch invocations', 'pact boon', 'pact of the blade',
    'pact of the chain', 'pact of the tome', 'mystic arcanum',
    'eldritch master',
  ],
  cleric: [
    'channel divinity', 'turn undead', 'destroy undead',
    'divine intervention', 'divine domain',
  ],
  druid: [
    'wild shape', 'druid circle', 'beast spells',
    'timeless body', 'archdruid',
  ],
  bard: [
    'bardic inspiration', 'jack of all trades', 'song of rest',
    'countercharm', 'magical secrets', 'superior inspiration',
    'bard college',
  ],
  fighter: [
    'fighting style', 'second wind', 'action surge',
    'extra attack', 'indomitable', 'martial archetype',
  ],
  paladin: [
    'divine sense', 'lay on hands', 'divine smite',
    'aura of protection', 'aura of courage', 'cleansing touch',
    'sacred oath',
  ],
  ranger: [
    'favored enemy', 'natural explorer', 'primeval awareness',
    'land\'s stride', 'hide in plain sight', 'vanish',
    'feral senses', 'foe slayer', 'ranger archetype',
  ],
  barbarian: [
    'rage', 'unarmored defense', 'reckless attack',
    'danger sense', 'brutal critical', 'relentless rage',
    'persistent rage', 'indomitable might', 'primal path',
  ],
  monk: [
    'ki', 'unarmored movement', 'deflect missiles',
    'slow fall', 'stunning strike', 'ki-empowered strikes',
    'stillness of mind', 'diamond soul', 'timeless body',
    'empty body', 'perfect self', 'monastic tradition',
  ],
};

// Flatten all features for pattern matching
const ALL_FEATURES = Object.values(KNOWN_CLASS_FEATURES)
  .flat()
  .map(f => f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

// Remove duplicates (e.g. "timeless body" appears twice)
const UNIQUE_FEATURES = [...new Set(ALL_FEATURES)];
const FEATURES_PATTERN = UNIQUE_FEATURES.join('|');

export interface ClassFeatureUnlockMatch extends PatternMatch {
  featureName: string;
  className?: string;
  level?: number;
  isKnownFeature: boolean;
}

/**
 * Parse class feature unlock events from session text.
 * Detects patterns like:
 * - "unlocks Uncanny Dodge"
 * - "gains the Extra Attack feature"
 * - "learns Metamagic"
 * - "Channel Divinity unlocked at level 2"
 * - "new class feature: Evasion"
 * - "Rogue level 5: Uncanny Dodge"
 */
export function parseClassFeatureUnlockMatches(text: string): ClassFeatureUnlockMatch[] {
  const matches: ClassFeatureUnlockMatch[] = [];

  // Pattern 1: "unlocks/gains/learns [the] FEATURE [feature]"
  const p1 = new RegExp(
    `(?:unlocks?|gains?|learns?|acquires?|obtains?|receives?)\\s+(?:the\\s+)?(${FEATURES_PATTERN})\\s*(?:feature|ability|class feature)?`,
    'gi'
  );
  let m;
  while ((m = p1.exec(text)) !== null) {
    const name = m[1].trim();
    const cls = findClassForFeature(name);
    matches.push(buildFeatureMatch(text, m, name, cls, true));
  }

  // Pattern 2: "FEATURE unlocked" / "FEATURE gained"
  const p2 = new RegExp(
    `(${FEATURES_PATTERN})\\s+(?:unlocked|gained|learned|acquired|obtained)`,
    'gi'
  );
  while ((m = p2.exec(text)) !== null) {
    const name = m[1].trim();
    const cls = findClassForFeature(name);
    matches.push(buildFeatureMatch(text, m, name, cls, true));
  }

  // Pattern 3: "new class feature: NAME" / "class feature: NAME"
  const p3 = /(?:new\s+)?class\s+feature[:\s]+([A-Z][A-Za-z\s']{2,40}?)(?:\.|,|;|\n|$)/gi;
  while ((m = p3.exec(text)) !== null) {
    const name = m[1].trim();
    if (name.length > 2) {
      const cls = findClassForFeature(name);
      matches.push(buildFeatureMatch(text, m, name, cls, cls !== undefined));
    }
  }

  // Pattern 4: "CLASS level X: FEATURE" (e.g. "Rogue level 5: Uncanny Dodge")
  const classNames = Object.keys(KNOWN_CLASS_FEATURES).join('|');
  const p4 = new RegExp(
    `(${classNames})\\s+level\\s+(\\d+)[:\\s]+([A-Z][A-Za-z\\s']{2,40}?)(?:\\.|,|;|\\n|$)`,
    'gi'
  );
  while ((m = p4.exec(text)) !== null) {
    const cls = m[1].toLowerCase();
    const level = parseInt(m[2], 10);
    const name = m[3].trim();
    if (level >= 1 && level <= 20 && name.length > 2) {
      const result = buildFeatureMatch(text, m, name, cls, isKnownFeature(name));
      result.level = level;
      matches.push(result);
    }
  }

  // Pattern 5: "at level X, gains FEATURE" / "reaching level X unlocks FEATURE"
  // This pattern matches both known features and generic feature names
  const p5 = new RegExp(
    `(?:at|reaching|upon reaching)\\s+level\\s+(\\d+)\\s*,?\\s*(?:gains?|unlocks?|learns?)\\s+(?:the\\s+)?([A-Z][A-Za-z\\s']{1,40}?)(?:\\s+(?:feature|ability))?(?:\\.|,|;|\\s+for|\\n|$)`,
    'gi'
  );
  while ((m = p5.exec(text)) !== null) {
    const level = parseInt(m[1], 10);
    const name = m[2].trim();
    if (level >= 1 && level <= 20 && name.length > 1 && !isCommonPhrase(name)) {
      const cls = findClassForFeature(name);
      const result = buildFeatureMatch(text, m, name, cls, cls !== undefined);
      result.level = level;
      // Replace existing match for same feature without level
      const existingIdx = matches.findIndex(k => k.featureName.toLowerCase() === name.toLowerCase() && !k.level);
      if (existingIdx >= 0) {
        matches[existingIdx] = result;
      } else {
        matches.push(result);
      }
    }
  }

  // Pattern 6: Generic "unlocks FEATURE_NAME" for unknown features (capitalized names)
  const p6 = /(?:unlocks?|gains?\s+(?:the\s+)?(?:class\s+)?(?:feature|ability))\s*[:\s]+([A-Z][A-Za-z\s']{2,40}?)(?:\.|,|;|\n|$)/gi;
  while ((m = p6.exec(text)) !== null) {
    const name = m[1].trim();
    if (name.length > 2 && !isCommonPhrase(name)) {
      const cls = findClassForFeature(name);
      matches.push(buildFeatureMatch(text, m, name, cls, cls !== undefined));
    }
  }

  return dedup(matches);
}

function findClassForFeature(name: string): string | undefined {
  const lower = name.toLowerCase();
  for (const [cls, features] of Object.entries(KNOWN_CLASS_FEATURES)) {
    if (features.some(f => f.toLowerCase() === lower)) return cls;
  }
  return undefined;
}

function isKnownFeature(name: string): boolean {
  return findClassForFeature(name) !== undefined;
}

const COMMON_PHRASES = new Set([
  'the party', 'the group', 'the enemy', 'the monster',
  'the dungeon', 'the cave', 'the room', 'the door',
]);

function isCommonPhrase(name: string): boolean {
  return COMMON_PHRASES.has(name.toLowerCase().trim());
}

function buildFeatureMatch(
  text: string, m: RegExpExecArray,
  featureName: string, className: string | undefined,
  isKnown: boolean
): ClassFeatureUnlockMatch {
  const start = Math.max(0, m.index - 30);
  const end = Math.min(text.length, m.index + m[0].length + 30);
  const context = text.slice(start, end).replace(/\s+/g, ' ').trim();
  return {
    fullMatch: m[0],
    value: featureName,
    featureName,
    className,
    isKnownFeature: isKnown,
    context,
    index: m.index,
  };
}

function dedup(matches: ClassFeatureUnlockMatch[]): ClassFeatureUnlockMatch[] {
  const kept: ClassFeatureUnlockMatch[] = [];
  for (const m of matches) {
    const isDup = kept.some(k =>
      Math.abs(k.index - m.index) < 30 &&
      k.featureName.toLowerCase() === m.featureName.toLowerCase()
    );
    if (!isDup) kept.push(m);
  }
  return kept;
}
