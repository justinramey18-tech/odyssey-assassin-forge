// Chronicle Sync: NPC Name Learning
// Builds a per-session name registry to recognize shortened NPC references

export interface NPCEntry {
  fullName: string;
  shortNames: string[];
  firstMentionIndex: number;
}

// Patterns for NPC introductions
const NPC_INTRO_PATTERNS = [
  // "a merchant named Garrick", "a dwarf called Thordak"
  /(?:a|an|the)\s+\w+\s+(?:named|called|known\s+as|who\s+goes\s+by)\s+([A-Z][a-zA-Z']+(?:\s+[A-Z][a-zA-Z']+)?)/g,
  // "introduces herself as Lady Vex'ahlia"
  /introduces?\s+(?:him|her|them)self\s+as\s+([A-Z][a-zA-Z']+(?:\s+[A-Z][a-zA-Z']+){0,2})/g,
  // "Garrick the Merchant", "Thordak the Red" (Title pattern)
  /([A-Z][a-zA-Z']+)\s+the\s+([A-Z][a-zA-Z']+)/g,
  // Dialogue introductions: "I am Garrick", "My name is Thordak", "Call me Vex"
  /["'""](?:I\s+am|My\s+name\s+is|They\s+call\s+me|Call\s+me|I'm)\s+([A-Z][a-zA-Z']+(?:\s+[A-Z][a-zA-Z']+)?)/g,
  // Role/title: "Captain Thordak", "Mayor Garrick", "Priestess Elara"
  /(?:Captain|Mayor|Lord|Lady|King|Queen|Prince|Princess|Duke|Duchess|Baron|Baroness|Count|Countess|Chief|Elder|Priestess|Priest|Commander|General|Admiral|Archmage|Archdruid|High\s+Priest(?:ess)?)\s+([A-Z][a-zA-Z']+(?:\s+[A-Z][a-zA-Z']+)?)/g,
  // "Garrick, the town blacksmith", "Elara, a local healer"
  /([A-Z][a-zA-Z']+),\s+(?:the|a|an)\s+(?:\w+\s+){0,2}(?:blacksmith|healer|merchant|innkeeper|guard|wizard|sorcerer|priest|cleric|ranger|knight|soldier|farmer|scholar|sage|bard|druid|monk|paladin|warlock|rogue|thief|assassin|noble|king|queen|chief|elder)/g,
];

// Words that shouldn't be treated as NPC names
const EXCLUDED_NAMES = new Set([
  'the', 'and', 'you', 'your', 'they', 'their', 'them',
  'attack', 'damage', 'hit', 'miss', 'roll', 'turn', 'round',
  'player', 'character', 'party', 'group',
  'north', 'south', 'east', 'west',
  'potion', 'scroll', 'sword', 'shield', 'armor',
  'gold', 'silver', 'copper', 'platinum',
  'initiative', 'combat', 'battle',
]);

/**
 * Build an NPC registry from the session text.
 * Extracts full names and generates shortName variants for later reference resolution.
 */
export function buildNPCRegistry(text: string): NPCEntry[] {
  const registry: NPCEntry[] = [];
  const seenNames = new Set<string>();

  for (const pattern of NPC_INTRO_PATTERNS) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((match = regex.exec(text)) !== null) {
      const fullName = match[1]?.trim();
      if (!fullName || fullName.length < 2 || fullName.length > 40) continue;

      const nameLower = fullName.toLowerCase();
      if (EXCLUDED_NAMES.has(nameLower)) continue;
      if (seenNames.has(nameLower)) continue;
      seenNames.add(nameLower);

      const shortNames = generateShortNames(fullName);

      registry.push({
        fullName,
        shortNames,
        firstMentionIndex: match.index,
      });
    }
  }

  // Also detect repeated capitalized names that appear 3+ times (likely important NPCs)
  const nameFrequency = new Map<string, number>();
  const capitalNamePattern = /\b([A-Z][a-z]{2,}(?:'[a-z]+)?)\b/g;
  let nameMatch;
  while ((nameMatch = capitalNamePattern.exec(text)) !== null) {
    const name = nameMatch[1];
    if (EXCLUDED_NAMES.has(name.toLowerCase())) continue;
    nameFrequency.set(name, (nameFrequency.get(name) || 0) + 1);
  }

  for (const [name, count] of nameFrequency) {
    if (count >= 3 && !seenNames.has(name.toLowerCase())) {
      seenNames.add(name.toLowerCase());
      registry.push({
        fullName: name,
        shortNames: generateShortNames(name),
        firstMentionIndex: text.indexOf(name),
      });
    }
  }

  return registry;
}

function generateShortNames(fullName: string): string[] {
  const parts = fullName.split(/\s+/);
  const shorts: string[] = [];

  // First name only
  if (parts.length > 1) {
    shorts.push(parts[0]);
  }

  // Last name only (if 2+ word name)
  if (parts.length === 2) {
    shorts.push(parts[1]);
  }

  // Initials + last
  if (parts.length >= 2) {
    shorts.push(parts[0][0] + '. ' + parts[parts.length - 1]);
  }

  return shorts;
}

/**
 * Resolve a short name reference to a full NPC name using the registry
 */
export function resolveNPCName(shortRef: string, registry: NPCEntry[]): string | null {
  const refLower = shortRef.toLowerCase().trim();

  for (const entry of registry) {
    if (entry.fullName.toLowerCase() === refLower) return entry.fullName;
    for (const short of entry.shortNames) {
      if (short.toLowerCase() === refLower) return entry.fullName;
    }
  }

  return null;
}
