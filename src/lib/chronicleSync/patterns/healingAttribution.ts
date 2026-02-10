// Chronicle Sync: Healing Source Attribution
// Links healing amounts to specific spells, potions, or class features

import { ConfidenceLevel } from '../types';

export interface HealingAttribution {
  amount: number;
  source: string;
  sourceType: 'spell' | 'potion' | 'feature' | 'rest' | 'unknown';
  spellLevel?: number;
  sourceText: string;
  confidence: ConfidenceLevel;
}

// Known healing spells with expected levels
const HEALING_SPELLS: Record<string, number> = {
  'cure wounds': 1,
  'healing word': 1,
  'goodberry': 1,
  'prayer of healing': 2,
  'lesser restoration': 2,
  'aid': 2,
  'mass healing word': 3,
  'beacon of hope': 3,
  'aura of vitality': 3,
  'revivify': 3,
  'mass cure wounds': 5,
  'greater restoration': 5,
  'heal': 6,
  'heroes\' feast': 6,
  'regenerate': 7,
  'mass heal': 9,
};

// Healing class features
const HEALING_FEATURES = [
  'lay on hands',
  'second wind',
  'hit dice', 'hit die',
  'song of rest',
  'healing light',
  'balm of the summer court',
  'wholeness of body',
  'celestial resilience',
  // Subclass features
  'twilight sanctuary',
  'circle of dreams',
  'life transference',
  'healing spirit',
  'aura of vitality',
  'inspiring leader',
  'chef feat',
  'gift of the ever-living ones',
  'blessed healer',
  'supreme healing',
  'preserve life',
  'disciple of life',
  // Racial features (HP-related)
  'dwarven fortitude',
  'relentless endurance',
  'durable feat',
  'periapt of wound closure',
  'staff of healing',
  'ring of regeneration',
  // Environmental
  'fountain',
  'blessed water',
  'healing spring',
  'pool of radiance',
];

// Potion keywords
const POTION_KEYWORDS = /potion|elixir|draught|balm|salve|tonic|vial/i;

/**
 * Attribute a healing event to its most likely source based on surrounding context
 */
// Sort spells by name length descending so "mass cure wounds" matches before "cure wounds"
const HEALING_SPELLS_SORTED = Object.entries(HEALING_SPELLS)
  .sort((a, b) => b[0].length - a[0].length);

/**
 * Attribute a healing event to its most likely source based on surrounding context.
 * 
 * Priority: rest/potion keywords checked first when context contains them,
 * then spells (longest-first to avoid substring false positives), then features.
 */
export function attributeHealing(
  amount: number,
  sourceContext: string,
  sourceText: string
): HealingAttribution {
  const lower = sourceContext.toLowerCase();

  // 1. Check rest FIRST — rest keywords are unambiguous and prevent "heals" matching "heal" spell
  if (/short\s+rest|long\s+rest|overnight|sleep|camp/i.test(lower)) {
    return {
      amount,
      source: /long\s+rest|overnight|sleep/i.test(lower) ? 'Long Rest' : 'Short Rest',
      sourceType: 'rest',
      sourceText,
      confidence: 'medium',
    };
  }

  // 2. Check potions BEFORE spells — "potion of healing" should not match "heal" spell
  if (POTION_KEYWORDS.test(lower)) {
    const potionMatch = lower.match(/((?:potion|elixir|draught)\s+of\s+[\w\s]+)/i);
    return {
      amount,
      source: potionMatch ? potionMatch[1].trim() : 'Potion',
      sourceType: 'potion',
      sourceText,
      confidence: 'medium',
    };
  }

  // 3. Check for healing spells (sorted longest-first to prevent substring collisions)
  for (const [spell, level] of HEALING_SPELLS_SORTED) {
    if (lower.includes(spell)) {
      return {
        amount,
        source: spell.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        sourceType: 'spell',
        spellLevel: level,
        sourceText,
        confidence: 'high',
      };
    }
  }

  // 4. Check for class features
  for (const feature of HEALING_FEATURES) {
    if (lower.includes(feature)) {
      return {
        amount,
        source: feature.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        sourceType: 'feature',
        sourceText,
        confidence: 'high',
      };
    }
  }

  // 5. Unknown source
  return {
    amount,
    source: 'Unknown',
    sourceType: 'unknown',
    sourceText,
    confidence: 'low',
  };
}
