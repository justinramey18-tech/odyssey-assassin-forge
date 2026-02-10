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
  // Summoned creatures: "summons a fire elemental", "conjures 4 wolves"
  /(?:summons?|conjures?|calls?\s+forth|raises?)\s+(?:a\s+)?(\d+)?\s*([a-zA-Z][a-zA-Z\s'-]+)/gi,
  // Revealed enemies: "a mimic reveals itself", "the chest is actually a mimic"
  /(?:a\s+)?([a-zA-Z][a-zA-Z\s'-]*?)\s+(?:reveals?\s+(?:itself|themselves)|springs?\s+to\s+life)/gi,
  /(?:is\s+actually|turns?\s+out\s+to\s+be|was\s+really)\s+(?:a\s+|an\s+)?(\d+)?\s*([a-zA-Z][a-zA-Z\s'-]+)/gi,
  // Lair/guarded: "guarded by 2 wights", "protected by a golem"
  /(?:guarded|protected|watched|defended)\s+by\s+(?:a\s+)?(\d+)?\s*([a-zA-Z][a-zA-Z\s'-]+)/gi,
  // Multi-enemy: "3 goblins and 2 hobgoblins" (split on "and")
  /(\d+)\s+([a-zA-Z][a-zA-Z\s'-]*?)\s+and\s+(\d+)\s+([a-zA-Z][a-zA-Z\s'-]+)/gi,
  // Reinforcements: "reinforcements arrive: 4 more orcs", "2 additional skeletons rise"
  /(?:reinforcements?|more\s+enemies?)\s*(?:arrive|appear|come)?:?\s*(\d+)\s+(?:more\s+)?([a-zA-Z][a-zA-Z\s'-]+)/gi,
  /(\d+)\s+(?:additional|more|extra)\s+([a-zA-Z][a-zA-Z\s'-]+)\s+(?:arrive|appear|rise|emerge|join)/gi,
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

// ===== ENHANCED HELPER FUNCTIONS =====

/**
 * Checks if a name refers to the player character
 */
function isPlayerEntry(name: string, playerName?: string): boolean {
  const playerMarkers = [
    /\(you\)/i,
    /\(player\)/i,
    /\(pc\)/i,
    /^(?:you|your|yourself)$/i,
  ];
  
  // Check for explicit markers
  if (playerMarkers.some(marker => marker.test(name))) {
    return true;
  }
  
  // Check against known player name
  if (playerName && name.toLowerCase().includes(playerName.toLowerCase())) {
    return true;
  }
  
  return false;
}

/**
 * Cleans enemy name by removing articles, punctuation, etc.
 * Preserves numbered suffixes (#1, #2) for enemy variants
 */
function cleanEnemyName(name: string): string {
  return name
    .replace(/^(?:the|a|an|one|two|three|four|five|six|seven|eight|nine|ten)\s+/i, '')
    .replace(/\s*(?:attack(?:s|ed)?|strike(?:s)?|approach(?:es)?|emerge(?:s)?|appear(?:s)?)\s*$/i, '')
    .replace(/[,;:.!?]+$/, '')
    .replace(/\s*\([^)]*(?:you|player|pc)[^)]*\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Removes instance numbers for deduplication (#2 -> base name)
 */
function removeInstanceNumber(name: string): string {
  return name.replace(/\s*#\d+$/, '').trim();
}

/**
 * Validates if a name is a legitimate enemy name
 */
function isValidEnemyName(name: string): boolean {
  const cleaned = cleanEnemyName(name);
  
  // Must have minimum length
  if (cleaned.length < 2) return false;
  
  // Filter out common false positives
  const lowerCleaned = cleaned.toLowerCase();
  if (NON_ENEMY_WORDS.has(lowerCleaned)) return false;
  
  // Filter pronouns
  if (/^(?:you|your|i|me|we|us|they|them|he|she|it|yourself)$/i.test(cleaned)) return false;
  
  // Filter pure numbers
  if (/^\d+$/.test(cleaned)) return false;
  
  // Filter dice notation
  if (/^\d+d\d+$/i.test(cleaned)) return false;
  
  // Filter ability score abbreviations
  if (/^(?:str|dex|con|int|wis|cha)$/i.test(cleaned)) return false;
  
  // Must contain at least one letter
  if (!/[\p{L}]/u.test(cleaned)) return false;
  
  // Should not be excessively long
  if (cleaned.length > 50) return false;
  
  return true;
}

/**
 * Removes duplicates and groups enemy variants
 */
function deduplicateEnemyNames(enemies: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  
  for (const enemy of enemies) {
    const baseKey = removeInstanceNumber(enemy).toLowerCase();
    
    if (!seen.has(baseKey)) {
      seen.add(baseKey);
      unique.push(removeInstanceNumber(enemy));
    }
  }
  
  return unique;
}

function getContext(text: string, index: number, length: number): string {
  const start = Math.max(0, index - 40);
  const end = Math.min(text.length, index + length + 40);
  return text.slice(start, end).replace(/\s+/g, ' ').trim();
}

// ===== ENHANCED DETECTION FUNCTIONS =====

/**
 * Detects enemies from Initiative Order blocks
 * Example: "Initiative Order:\n1. Player (You)\n2. Goblin #2"
 */
function parseInitiativeOrderEnemies(text: string, playerName?: string): string[] {
  const enemies: string[] = [];
  
  // Find "Initiative Order:" blocks with numbered/bullet entries
  const orderBlockPattern = /initiative\s+order:?\s*\n((?:(?:\d+\.|\*|-|•)\s+[^\n]+\n?)+)/gim;
  let blockMatch;
  
  while ((blockMatch = orderBlockPattern.exec(text)) !== null) {
    const orderBlock = blockMatch[1];
    
    // Parse each entry: "1. Name" or "1. Name - notes"
    const entryPattern = /^(?:\d+\.|\*|-|•)\s+(.+?)(?:\s*[-–—]\s*(.*))?$/gm;
    let entryMatch;
    
    while ((entryMatch = entryPattern.exec(orderBlock)) !== null) {
      const name = entryMatch[1].trim();
      
      // Skip player entries
      if (isPlayerEntry(name, playerName)) continue;
      
      const cleanName = cleanEnemyName(name);
      
      if (isValidEnemyName(cleanName)) {
        enemies.push(cleanName);
      }
    }
  }
  
  return enemies;
}

/**
 * Detects enemies from damage events
 * Example: "Goblin deals 12 damage" or "You deal 20 damage to Goblin"
 */
function parseDamageEventEnemies(text: string, playerName?: string): string[] {
  const enemies: string[] = [];
  
  const damagePatterns = [
    // "Goblin deals 12 damage to you"
    /\b([\p{Lu}][\p{L}]+(?:\s+[\p{Lu}][\p{L}]+)*(?:\s*#\d+)?)\s+(?:deals?|inflicts?|does)\s+\d+\s*(?:damage|hp)/giu,
    
    // "You take 8 damage from Goblin"
    /(?:take|took|suffer)\s+\d+\s*(?:damage|hp)\s+from\s+(?:the\s+)?([\p{Lu}][\p{L}]+(?:\s+[\p{Lu}][\p{L}]+)*(?:\s*#\d+)?)/giu,
    
    // "Goblin takes 18 damage"
    /\b([\p{Lu}][\p{L}]+(?:\s+[\p{Lu}][\p{L}]+)*(?:\s*#\d+)?)\s+takes?\s+\d+\s*(?:damage|hp)/giu,
    
    // "You deal 20 damage to Goblin"
    /(?:deal|dealt|inflict)\s+\d+\s*(?:damage|hp)\s+to\s+(?:the\s+)?([\p{Lu}][\p{L}]+(?:\s+[\p{Lu}][\p{L}]+)*(?:\s*#\d+)?)/giu,
    
    // "hitting Goblin for 25 damage"
    /hitting\s+(?:the\s+)?([\p{Lu}][\p{L}]+(?:\s+[\p{Lu}][\p{L}]+)*(?:\s*#\d+)?)\s+for\s+\d+\s*(?:damage|hp)/giu,
  ];
  
  for (const pattern of damagePatterns) {
    let match;
    pattern.lastIndex = 0;
    
    while ((match = pattern.exec(text)) !== null) {
      const name = match[1].trim();
      
      if (isPlayerEntry(name, playerName)) continue;
      
      const cleanName = cleanEnemyName(name);
      
      if (isValidEnemyName(cleanName)) {
        enemies.push(cleanName);
      }
    }
  }
  
  return enemies;
}

/**
 * Detects enemies from turn references
 * Example: "Goblin's turn"
 */
function parseTurnReferenceEnemies(text: string, playerName?: string): string[] {
  const enemies: string[] = [];
  
  // Match "the Goblin's turn" or "Goblin's turn" - capture only the name after optional "the"
  const turnPattern = /(?:the\s+)?([\p{Lu}][\p{L}]+(?:\s+[\p{Lu}][\p{L}]+)*(?:\s*#\d+)?)(?:'s|')\s+turn/giu;
  let match;
  
  while ((match = turnPattern.exec(text)) !== null) {
    const name = match[1].trim();
    
    if (isPlayerEntry(name, playerName)) continue;
    
    const cleanName = cleanEnemyName(name);
    
    if (isValidEnemyName(cleanName)) {
      enemies.push(cleanName);
    }
  }
  
  return enemies;
}

/**
 * Detects enemies from combat actions
 * Example: "Goblin attacks you" or "You attack Goblin"
 */
function parseCombatActionEnemies(text: string, playerName?: string): string[] {
  const enemies: string[] = [];
  
  const combatPatterns = [
    // "Goblin attacks you" or "The Orc attacks you"
    /(?:the\s+)?([\p{Lu}][\p{L}]+(?:\s+[\p{Lu}][\p{L}]+)?(?:\s*#\d+)?)\s+attacks?\b/giu,
    
    // "You attack the Goblin" - limit capture to avoid greedy matching
    /(?:attack|strike)\s+(?:the\s+)?([\p{Lu}][\p{L}]+(?:\s+[\p{Lu}][\p{L}]+)?(?:\s*#\d+)?)(?:\s|$|\.)/giu,
    
    // "fighting the Goblin"
    /(?:fighting|battling|facing)\s+(?:the\s+)?([\p{Lu}][\p{L}]+(?:\s+[\p{Lu}][\p{L}]+)?(?:\s*#\d+)?)(?:\s|$|\.)/giu,
  ];
  
  for (const pattern of combatPatterns) {
    let match;
    pattern.lastIndex = 0;
    
    while ((match = pattern.exec(text)) !== null) {
      const name = match[1].trim();
      
      if (isPlayerEntry(name, playerName)) continue;
      
      const cleanName = cleanEnemyName(name);
      
      if (isValidEnemyName(cleanName)) {
        enemies.push(cleanName);
      }
    }
  }
  
  return enemies;
}

/**
 * Enhanced enemy detection using multiple strategies
 * @param text - The text to parse
 * @param playerName - Optional player character name for filtering
 * @returns Array of unique enemy names
 */
export function detectEnemies(text: string, playerName?: string): string[] {
  const allEnemies: string[] = [];
  
  // Strategy 1: Initiative Order (Highest priority - most explicit)
  allEnemies.push(...parseInitiativeOrderEnemies(text, playerName));
  
  // Strategy 2: Damage Events (High priority - combat confirmation)
  allEnemies.push(...parseDamageEventEnemies(text, playerName));
  
  // Strategy 3: Turn References (Medium priority)
  allEnemies.push(...parseTurnReferenceEnemies(text, playerName));
  
  // Strategy 4: Combat Actions (Medium priority)
  allEnemies.push(...parseCombatActionEnemies(text, playerName));
  
  // Deduplicate and return
  return deduplicateEnemyNames(allEnemies);
}

/**
 * Parse enemies from session log text
 * Uses enhanced multi-strategy detection for comprehensive coverage
 */
export function parseEnemyMatches(text: string, playerName?: string): ParsedEnemy[] {
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
        defeatedNames.add(removeInstanceNumber(name).toLowerCase());
      }
    }
  }
  
  for (const pattern of FLED_PATTERNS) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((match = regex.exec(text)) !== null) {
      const name = cleanEnemyName(match[1]);
      if (isValidEnemyName(name)) {
        fledNames.add(removeInstanceNumber(name).toLowerCase());
      }
    }
  }
  
  // NEW: Enhanced detection pass - Initiative Order, Damage Events, Turn References, Combat Actions
  const enhancedEnemies = detectEnemies(text, playerName);
  for (const enemyName of enhancedEnemies) {
    const key = removeInstanceNumber(enemyName).toLowerCase();
    
    // Determine status
    let status: 'active' | 'defeated' | 'fled' = 'active';
    if (defeatedNames.has(key)) status = 'defeated';
    else if (fledNames.has(key)) status = 'fled';
    
    if (!matches.has(key)) {
      matches.set(key, {
        fullMatch: enemyName,
        name: enemyName.charAt(0).toUpperCase() + enemyName.slice(1),
        quantity: 1,
        status,
        index: 0,
        context: `Detected from enhanced patterns`,
      });
    }
  }
  
  // Legacy pass: find enemies from encounter patterns
  for (const pattern of ENCOUNTER_PATTERNS) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((match = regex.exec(text)) !== null) {
      const quantity = match[1] ? parseInt(match[1], 10) : 1;
      const name = cleanEnemyName(match[2] || match[1]);
      
      if (!isValidEnemyName(name)) continue;
      if (isPlayerEntry(name, playerName)) continue;
      
      const key = removeInstanceNumber(name).toLowerCase();
      
      // Determine status
      let status: 'active' | 'defeated' | 'fled' = 'active';
      if (defeatedNames.has(key)) status = 'defeated';
      else if (fledNames.has(key)) status = 'fled';
      
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
      if (isPlayerEntry(name, playerName)) continue;
      
      const key = removeInstanceNumber(name).toLowerCase();
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
      if (isPlayerEntry(name, playerName)) continue;
      
      const key = removeInstanceNumber(name).toLowerCase();
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
