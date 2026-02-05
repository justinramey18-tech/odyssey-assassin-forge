// Chronicle Sync Enemy Detection Patterns
// Regex patterns for extracting enemies from session logs

import { ConfidenceLevel } from '../types';
import { CreatureType, CreatureSize } from '@/lib/combat/creatureTypes';

/**
 * Parsed enemy from session log
 */
export interface ParsedEnemy {
  name: string;
  quantity: number;
  ac?: number;
  estimatedHP?: number;
  creatureType?: CreatureType;
  size?: CreatureSize;
  notes?: string;
  status: 'active' | 'defeated' | 'fled';
  sourceText: string;
  confidence: ConfidenceLevel;
}

/**
 * Match result for internal processing
 */
interface EnemyMatch {
  fullMatch: string;
  name: string;
  quantity: number;
  ac?: number;
  hp?: number;
  status: 'active' | 'defeated' | 'fled';
  index: number;
  context: string;
}

// ===== CREATURE TYPE INFERENCE =====

const CREATURE_TYPE_KEYWORDS: Record<CreatureType, string[]> = {
  aberration: ['aberration', 'mind flayer', 'beholder', 'aboleth', 'illithid'],
  beast: ['wolf', 'bear', 'lion', 'tiger', 'snake', 'spider', 'rat', 'boar', 'hawk', 'eagle', 'horse', 'panther'],
  celestial: ['angel', 'celestial', 'deva', 'planetar', 'solar'],
  construct: ['golem', 'construct', 'automaton', 'animated', 'shield guardian'],
  dragon: ['dragon', 'drake', 'wyvern', 'wyrm'],
  elemental: ['elemental', 'fire elemental', 'water elemental', 'air elemental', 'earth elemental', 'mephit'],
  fey: ['fey', 'fairy', 'pixie', 'sprite', 'satyr', 'dryad', 'nymph'],
  fiend: ['demon', 'devil', 'fiend', 'imp', 'succubus', 'balor', 'pit fiend'],
  giant: ['giant', 'ogre', 'troll', 'ettin', 'cyclops'],
  humanoid: ['goblin', 'orc', 'hobgoblin', 'bugbear', 'kobold', 'gnoll', 'bandit', 'cultist', 'guard', 'soldier', 'knight', 'mage', 'thug', 'assassin', 'mercenary', 'pirate', 'human', 'elf', 'dwarf', 'halfling', 'tiefling', 'dragonborn'],
  monstrosity: ['owlbear', 'chimera', 'manticore', 'basilisk', 'medusa', 'hydra', 'griffon', 'hippogriff', 'bulette', 'displacer beast', 'mimic', 'phase spider', 'rust monster', 'carrion crawler'],
  ooze: ['ooze', 'slime', 'pudding', 'gelatinous cube', 'jelly'],
  plant: ['shambling mound', 'treant', 'blight', 'myconid', 'fungus', 'vine'],
  undead: ['zombie', 'skeleton', 'ghost', 'specter', 'wraith', 'wight', 'vampire', 'lich', 'mummy', 'ghoul', 'revenant', 'banshee', 'shadow'],
};

function inferCreatureType(name: string): CreatureType | undefined {
  const lowerName = name.toLowerCase();
  for (const [type, keywords] of Object.entries(CREATURE_TYPE_KEYWORDS) as [CreatureType, string[]][]) {
    for (const keyword of keywords) {
      if (lowerName.includes(keyword)) {
        return type;
      }
    }
  }
  return undefined;
}

// ===== SIZE INFERENCE =====

const SIZE_KEYWORDS: Record<CreatureSize, string[]> = {
  tiny: ['tiny', 'minuscule', 'imp', 'pixie', 'sprite', 'rat', 'bat', 'cat', 'raven'],
  small: ['small', 'goblin', 'kobold', 'halfling', 'gnome', 'mephit'],
  medium: ['medium', 'human', 'orc', 'hobgoblin', 'elf', 'dwarf', 'gnoll', 'skeleton', 'zombie'],
  large: ['large', 'ogre', 'minotaur', 'centaur', 'owlbear', 'hippogriff', 'griffon', 'troll', 'giant spider', 'dire'],
  huge: ['huge', 'giant', 'treant', 'hydra', 'young dragon', 'elephant', 'mammoth', 'roc'],
  gargantuan: ['gargantuan', 'ancient dragon', 'tarrasque', 'kraken', 'purple worm'],
};

function inferSize(name: string): CreatureSize | undefined {
  const lowerName = name.toLowerCase();
  for (const [size, keywords] of Object.entries(SIZE_KEYWORDS) as [CreatureSize, string[]][]) {
    for (const keyword of keywords) {
      if (lowerName.includes(keyword)) {
        return size;
      }
    }
  }
  return undefined;
}

// ===== ENEMY DETECTION PATTERNS =====

// Pattern: "fighting 3 goblins", "attacked by an orc", "facing a dragon"
const ENCOUNTER_PATTERNS = [
  // "fighting X creatures" or "fighting creatures"
  /(?:fighting|facing|attacked\s+by|battling|engaging|confronted\s+by|ambushed\s+by|surrounded\s+by|versus|vs\.?)\s+(?:a\s+)?(\d+)?\s*([a-zA-Z][a-zA-Z\s'-]*?)(?:\s*(?:and|,|\.|\!|$))/gi,
  // "X goblins attack", "3 orcs emerge"
  /(\d+)\s+([a-zA-Z][a-zA-Z\s'-]*?)\s+(?:attack|approach|emerge|appear|charge|strike|rush|surround)/gi,
  // "the orc" (with definite article suggesting known enemy)
  /the\s+([a-zA-Z][a-zA-Z\s'-]*?)\s+(?:attacks?|strikes?|swings?|casts?|breathes?|lunges?|charges?)/gi,
];

// Pattern: "goblin (AC 13)", "dragon with AC 18"
const AC_PATTERNS = [
  /([a-zA-Z][a-zA-Z\s'-]*?)\s*\(?(?:AC|armor\s*class)\s*[:=]?\s*(\d+)\)?/gi,
  /([a-zA-Z][a-zA-Z\s'-]*?)\s+(?:with|has|have)\s+(?:an?\s+)?(?:AC|armor\s*class)\s*(?:of\s+)?(\d+)/gi,
];

// Pattern: "the dragon has 120 HP", "monster with 45 hit points"
const HP_PATTERNS = [
  /([a-zA-Z][a-zA-Z\s'-]*?)\s*\(?(\d+)\s*(?:HP|hp|hit\s*points?)\)?/gi,
  /([a-zA-Z][a-zA-Z\s'-]*?)\s+(?:has|have|with)\s+(\d+)\s*(?:HP|hp|hit\s*points?)/gi,
];

// Pattern: "killed the goblin", "slays the orc", "defeated"
const DEFEAT_PATTERNS = [
  /(?:kill(?:s|ed)?|slay(?:s|ed)?|defeat(?:s|ed)?|destroy(?:s|ed)?|vanquish(?:ed)?|finish(?:es|ed)?|slaughter(?:s|ed)?|fell(?:s|ed)?)\s+(?:the\s+)?([a-zA-Z][a-zA-Z\s'-]*)/gi,
  /([a-zA-Z][a-zA-Z\s'-]*?)\s+(?:is\s+)?(?:killed|slain|defeated|destroyed|vanquished|falls?|dies?|collapses?|drops?\s+dead)/gi,
  /([a-zA-Z][a-zA-Z\s'-]*?)\s+(?:has\s+)?(?:0|zero)\s*(?:HP|hp|hit\s*points?)/gi,
];

// Pattern: "the goblin flees", "orc retreats"
const FLED_PATTERNS = [
  /([a-zA-Z][a-zA-Z\s'-]*?)\s+(?:flees?|retreats?|escapes?|runs?\s+away|disappears?)/gi,
];

// Common non-enemy words to filter out
const NON_ENEMY_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'player', 'character', 'party', 'group',
  'attack', 'damage', 'roll', 'dice', 'hit', 'miss', 'save', 'check', 'action',
  'spell', 'weapon', 'armor', 'item', 'gold', 'xp', 'hp', 'ac', 'dc',
  'round', 'turn', 'initiative', 'advantage', 'disadvantage', 'critical',
]);

function cleanEnemyName(name: string): string {
  // Remove common prefixes/suffixes and clean up
  return name
    .replace(/^(?:the|a|an|one|two|three|four|five|six|seven|eight|nine|ten)\s+/i, '')
    .replace(/\s*(?:attack(?:s|ed)?|strike(?:s)?|approach(?:es)?|emerge(?:s)?|appear(?:s)?)\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isValidEnemyName(name: string): boolean {
  const cleaned = cleanEnemyName(name).toLowerCase();
  if (cleaned.length < 3) return false;
  if (NON_ENEMY_WORDS.has(cleaned)) return false;
  if (/^\d+$/.test(cleaned)) return false;
  if (/^(?:you|your|i|me|we|us|they|them|he|she|it)$/i.test(cleaned)) return false;
  return true;
}

function getContext(text: string, index: number, length: number): string {
  const start = Math.max(0, index - 40);
  const end = Math.min(text.length, index + length + 40);
  return text.slice(start, end).replace(/\s+/g, ' ').trim();
}

/**
 * Parse enemies from session log text
 */
export function parseEnemyMatches(text: string): ParsedEnemy[] {
  const matches: Map<string, EnemyMatch> = new Map();
  
  // Track defeated enemies
  const defeatedNames = new Set<string>();
  const fledNames = new Set<string>();
  
  // First pass: find defeated/fled enemies
  for (const pattern of DEFEAT_PATTERNS) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((match = regex.exec(text)) !== null) {
      const name = cleanEnemyName(match[1]);
      if (isValidEnemyName(name)) {
        defeatedNames.add(name.toLowerCase());
      }
    }
  }
  
  for (const pattern of FLED_PATTERNS) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((match = regex.exec(text)) !== null) {
      const name = cleanEnemyName(match[1]);
      if (isValidEnemyName(name)) {
        fledNames.add(name.toLowerCase());
      }
    }
  }
  
  // Second pass: find all enemies
  for (const pattern of ENCOUNTER_PATTERNS) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((match = regex.exec(text)) !== null) {
      const quantity = match[1] ? parseInt(match[1], 10) : 1;
      const name = cleanEnemyName(match[2] || match[1]);
      
      if (!isValidEnemyName(name)) continue;
      
      const key = name.toLowerCase();
      const lowerName = key;
      
      // Determine status
      let status: 'active' | 'defeated' | 'fled' = 'active';
      if (defeatedNames.has(lowerName)) status = 'defeated';
      else if (fledNames.has(lowerName)) status = 'fled';
      
      // Only add if not already tracked or if this has more info
      if (!matches.has(key) || quantity > (matches.get(key)?.quantity || 0)) {
        matches.set(key, {
          fullMatch: match[0],
          name: name.charAt(0).toUpperCase() + name.slice(1).toLowerCase(),
          quantity,
          status,
          index: match.index,
          context: getContext(text, match.index, match[0].length),
        });
      }
    }
  }
  
  // Third pass: extract AC information
  for (const pattern of AC_PATTERNS) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((match = regex.exec(text)) !== null) {
      const name = cleanEnemyName(match[1]);
      const ac = parseInt(match[2], 10);
      
      if (!isValidEnemyName(name) || isNaN(ac)) continue;
      
      const key = name.toLowerCase();
      const existing = matches.get(key);
      
      if (existing) {
        existing.ac = ac;
      } else if (ac >= 5 && ac <= 30) {
        matches.set(key, {
          fullMatch: match[0],
          name: name.charAt(0).toUpperCase() + name.slice(1).toLowerCase(),
          quantity: 1,
          ac,
          status: defeatedNames.has(key) ? 'defeated' : fledNames.has(key) ? 'fled' : 'active',
          index: match.index,
          context: getContext(text, match.index, match[0].length),
        });
      }
    }
  }
  
  // Fourth pass: extract HP information
  for (const pattern of HP_PATTERNS) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((match = regex.exec(text)) !== null) {
      const name = cleanEnemyName(match[1]);
      const hp = parseInt(match[2], 10);
      
      if (!isValidEnemyName(name) || isNaN(hp)) continue;
      
      const key = name.toLowerCase();
      const existing = matches.get(key);
      
      if (existing) {
        existing.hp = hp;
      } else if (hp > 0) {
        matches.set(key, {
          fullMatch: match[0],
          name: name.charAt(0).toUpperCase() + name.slice(1).toLowerCase(),
          quantity: 1,
          hp,
          status: defeatedNames.has(key) ? 'defeated' : fledNames.has(key) ? 'fled' : 'active',
          index: match.index,
          context: getContext(text, match.index, match[0].length),
        });
      }
    }
  }
  
  // Convert to ParsedEnemy array
  const results: ParsedEnemy[] = [];
  
  for (const enemy of matches.values()) {
    const creatureType = inferCreatureType(enemy.name);
    const size = inferSize(enemy.name) || (creatureType === 'humanoid' ? 'medium' : undefined);
    
    // Determine confidence based on available data
    let confidence: ConfidenceLevel = 'medium';
    if (enemy.ac && enemy.hp) {
      confidence = 'high';
    } else if (!enemy.ac && !enemy.hp && enemy.quantity === 1) {
      confidence = 'low';
    }
    
    results.push({
      name: enemy.name,
      quantity: enemy.quantity,
      ac: enemy.ac,
      estimatedHP: enemy.hp,
      creatureType,
      size,
      status: enemy.status,
      sourceText: enemy.context.slice(0, 100),
      confidence,
    });
  }
  
  // Sort by status (active first) then by name
  return results.sort((a, b) => {
    const statusOrder = { active: 0, fled: 1, defeated: 2 };
    const statusDiff = statusOrder[a.status] - statusOrder[b.status];
    if (statusDiff !== 0) return statusDiff;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Count total active enemies from parsed results
 */
export function countActiveEnemies(enemies: ParsedEnemy[]): number {
  return enemies
    .filter(e => e.status === 'active')
    .reduce((sum, e) => sum + e.quantity, 0);
}

/**
 * Count defeated enemies from parsed results
 */
export function countDefeatedEnemies(enemies: ParsedEnemy[]): number {
  return enemies
    .filter(e => e.status === 'defeated')
    .reduce((sum, e) => sum + e.quantity, 0);
}
