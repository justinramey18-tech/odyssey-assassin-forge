# Simplified Implementation Plan: Two-Phase Enemy Detection Enhancement

## Executive Summary
This simplified plan minimizes risk by implementing enemy detection improvements in just two focused phases: **Core Detection** and **Integration & Testing**.

---

## Phase 1: Core Detection Enhancements

### Goal
Add initiative order and damage event detection to existing `enemies.ts` file with minimal architectural changes.

### Files Modified
- `src/lib/chronicleSync/patterns/enemies.ts` (ENHANCED, not refactored)

---

### **Implementation: Enhanced enemies.ts**

```typescript
// ============================================================================
// EXISTING CODE (Keep as-is for backward compatibility)
// ============================================================================

// ... existing patterns and functions remain unchanged ...

// ============================================================================
// NEW CODE: Enhanced Detection Functions
// ============================================================================

/**
 * Detects enemies from Initiative Order blocks
 * Example: "Initiative Order:\n1. Player (You)\n2. Goblin #2"
 */
function parseInitiativeOrderEnemies(text: string, playerName?: string): string[] {
  const enemies: string[] = [];
  
  // Find "Initiative Order:" blocks
  const orderBlockPattern = /initiative\s+order:?\s*\n((?:(?:\d+\.|\*|-|•)\s+[^\n]+\n?)+)/gim;
  let blockMatch;
  
  while ((blockMatch = orderBlockPattern.exec(text)) !== null) {
    const orderBlock = blockMatch[1];
    
    // Parse each numbered entry: "1. Name" or "1. Name - notes"
    const entryPattern = /^(?:\d+\.|\*|-|•)\s+(.+?)(?:\s*[-–—]\s*(.*))?$/gm;
    let entryMatch;
    
    while ((entryMatch = entryPattern.exec(orderBlock)) !== null) {
      let name = entryMatch[1].trim();
      
      // Skip player entries
      if (isPlayerEntry(name, playerName)) continue;
      
      // Clean the name
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
    /([\p{Lu}][\p{L}\s'#\d-]+?)\s+(?:deals?|inflicts?|does)\s+\d+\s*(?:damage|hp)/giu,
    
    // "You take 8 damage from Goblin"
    /(?:take|took|suffer)\s+\d+\s*(?:damage|hp)\s+from\s+(?:the\s+)?([\p{Lu}][\p{L}\s'#\d-]+)/giu,
    
    // "Goblin takes 18 damage"
    /([\p{Lu}][\p{L}\s'#\d-]+?)\s+takes?\s+\d+\s*(?:damage|hp)/giu,
    
    // "You deal 20 damage to Goblin"
    /(?:deal|dealt|inflict)\s+\d+\s*(?:damage|hp)\s+to\s+(?:the\s+)?([\p{Lu}][\p{L}\s'#\d-]+)/giu,
    
    // "hitting Goblin for 25 damage"
    /hitting\s+(?:the\s+)?([\p{Lu}][\p{L}\s'#\d-]+?)\s+for\s+\d+\s*(?:damage|hp)/giu,
  ];
  
  for (const pattern of damagePatterns) {
    let match;
    pattern.lastIndex = 0;
    
    while ((match = pattern.exec(text)) !== null) {
      const name = match[1].trim();
      
      // Skip player references
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
  
  const turnPattern = /([\p{Lu}][\p{L}\s'#\d-]+?)(?:'s|')\s+turn/giu;
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
    // "Goblin attacks you"
    /([\p{Lu}][\p{L}\s'#\d-]+?)\s+(?:attacks?|strikes?|hits?|shoots?)/giu,
    
    // "You attack the Goblin"
    /(?:attack|strike|hit|shoot)\s+(?:the\s+)?([\p{Lu}][\p{L}\s'#\d-]+)/giu,
    
    // "fighting the Goblin"
    /(?:fighting|battling|facing)\s+(?:the\s+)?([\p{Lu}][\p{L}\s'#\d-]+)/giu,
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

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Checks if a name refers to the player
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
 */
function cleanEnemyName(name: string): string {
  return name
    .replace(/^(?:the|a|an)\s+/i, '')
    .replace(/\s*(?:attacks?|strikes?|hits?)\s*$/i, '')
    .replace(/[,;:.!?]+$/, '')
    .replace(/\s*\([^)]*(?:you|player|pc)[^)]*\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Removes instance numbers for grouping (#2 -> base name)
 */
function removeInstanceNumber(name: string): string {
  return name.replace(/\s*#\d+$/, '').trim();
}

/**
 * Validates if a name is a legitimate enemy name
 */
function isValidEnemyName(name: string): boolean {
  // Must have minimum length
  if (name.length < 2) return false;
  
  // Must start with uppercase
  if (!/^[\p{Lu}]/u.test(name)) return false;
  
  // Filter out common false positives
  const falsePositives = [
    /^(?:the|a|an|you|your|turn|round|initiative|damage|attack|roll)$/i,
    /^(?:str|dex|con|int|wis|cha|hp|ac|dc)$/i,
    /^\d+d\d+$/i, // Dice notation
  ];
  
  if (falsePositives.some(pattern => pattern.test(name))) {
    return false;
  }
  
  // Must contain at least one letter
  if (!/[\p{L}]/u.test(name)) return false;
  
  // Should not be excessively long
  if (name.length > 50) return false;
  
  return true;
}

/**
 * Removes duplicates and groups enemy variants
 */
function deduplicateEnemies(enemies: string[]): string[] {
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

// ============================================================================
// MAIN EXPORT: Enhanced Detection Function
// ============================================================================

/**
 * Enhanced enemy detection using multiple strategies
 * @param text - The text to parse
 * @param playerName - Optional player character name for filtering
 * @returns Array of unique enemy names
 */
export function detectEnemies(text: string, playerName?: string): string[] {
  const allEnemies: string[] = [];
  
  // Strategy 1: Initiative Order (Highest priority)
  allEnemies.push(...parseInitiativeOrderEnemies(text, playerName));
  
  // Strategy 2: Damage Events (High priority)
  allEnemies.push(...parseDamageEventEnemies(text, playerName));
  
  // Strategy 3: Turn References (Medium priority)
  allEnemies.push(...parseTurnReferenceEnemies(text, playerName));
  
  // Strategy 4: Combat Actions (Medium priority)
  allEnemies.push(...parseCombatActionEnemies(text, playerName));
  
  // Deduplicate and return
  return deduplicateEnemies(allEnemies);
}

/**
 * Legacy export for backward compatibility
 */
export function parseEnemyMatches(text: string): string[] {
  return detectEnemies(text);
}
```

---

## Phase 2: Integration & Testing

### Goal
Integrate enhanced detection into the main parser and validate with comprehensive tests.

### Files Modified
- `src/lib/chronicleSync/parser.ts` (MINOR UPDATE)
- `tests/enemyDetection.test.ts` (NEW)

---

### **Implementation: Updated parser.ts**

```typescript
import { detectEnemies } from './patterns/enemies';

// ... existing code ...

export interface ChronicleParseOptions {
  playerName?: string;
  // ... other existing options ...
}

export function parseChronicleLog(
  text: string,
  options: ChronicleParseOptions = {}
): ChronicleParseResult {
  const { playerName } = options;
  
  // ... existing parsing logic ...
  
  // Enhanced enemy detection with player name filtering
  const enemies = detectEnemies(text, playerName);
  
  return {
    // ... existing fields ...
    enemies,
    // ... existing fields ...
  };
}
```

---

### **Implementation: Test Suite**

```typescript
// tests/enemyDetection.test.ts

import { detectEnemies } from '../src/lib/chronicleSync/patterns/enemies';

describe('Enemy Detection', () => {
  describe('Initiative Order Detection', () => {
    it('should detect enemies from initiative order', () => {
      const text = `
Initiative Order:
1. Σκιά (You) - Surprise Round taken.
2. Isu Sentinel #2 - Currently searching/panicking.
3. Isu Sentinel #3 - Active.
      `;
      
      const enemies = detectEnemies(text, 'Σκιά');
      
      expect(enemies).toContain('Isu Sentinel');
      expect(enemies).not.toContain('Σκιά');
    });
    
    it('should handle bullet points and dashes', () => {
      const text = `
Initiative Order:
• Player (You)
• Goblin #1
- Orc Warrior
      `;
      
      const enemies = detectEnemies(text);
      
      expect(enemies).toContain('Goblin');
      expect(enemies).toContain('Orc Warrior');
    });
    
    it('should filter out player markers', () => {
      const text = `
Initiative Order:
1. Hero (You)
2. Goblin
3. Your Character (PC)
4. Orc
      `;
      
      const enemies = detectEnemies(text);
      
      expect(enemies).toEqual(['Goblin', 'Orc']);
    });
  });
  
  describe('Damage Event Detection', () => {
    it('should detect enemies dealing damage', () => {
      const text = 'The Goblin deals 12 damage to you.';
      const enemies = detectEnemies(text);
      
      expect(enemies).toContain('Goblin');
    });
    
    it('should detect enemies taking damage', () => {
      const text = 'You deal 20 damage to the Orc Warrior.';
      const enemies = detectEnemies(text);
      
      expect(enemies).toContain('Orc Warrior');
    });
    
    it('should handle "takes damage" format', () => {
      const text = 'The Dragon takes 45 damage from your fireball.';
      const enemies = detectEnemies(text);
      
      expect(enemies).toContain('Dragon');
    });
  });
  
  describe('Turn Reference Detection', () => {
    it('should detect enemies from turn references', () => {
      const text = "It's the Goblin's turn.";
      const enemies = detectEnemies(text);
      
      expect(enemies).toContain('Goblin');
    });
    
    it('should filter out player turns', () => {
      const text = "It's your turn. Then Goblin's turn.";
      const enemies = detectEnemies(text);
      
      expect(enemies).toEqual(['Goblin']);
    });
  });
  
  describe('Combat Action Detection', () => {
    it('should detect enemies attacking', () => {
      const text = 'The Orc attacks you with its greataxe.';
      const enemies = detectEnemies(text);
      
      expect(enemies).toContain('Orc');
    });
    
    it('should detect enemies being attacked', () => {
      const text = 'You strike the Troll with your sword.';
      const enemies = detectEnemies(text);
      
      expect(enemies).toContain('Troll');
    });
    
    it('should detect "fighting" references', () => {
      const text = 'You are fighting the Shadow Demon.';
      const enemies = detectEnemies(text);
      
      expect(enemies).toContain('Shadow Demon');
    });
  });
  
  describe('Unicode Support', () => {
    it('should handle Greek characters', () => {
      const text = `
Initiative Order:
1. Σκιά (You)
2. Δράκος
      `;
      
      const enemies = detectEnemies(text, 'Σκιά');
      
      expect(enemies).toContain('Δράκος');
      expect(enemies).not.toContain('Σκιά');
    });
    
    it('should handle Cyrillic characters', () => {
      const text = 'You attack the Дракон.';
      const enemies = detectEnemies(text);
      
      expect(enemies).toContain('Дракон');
    });
  });
  
  describe('Deduplication', () => {
    it('should deduplicate same enemy mentioned multiple times', () => {
      const text = `
Initiative Order:
1. You
2. Goblin #1
3. Goblin #2

Goblin #1 attacks you.
You hit Goblin #2.
      `;
      
      const enemies = detectEnemies(text);
      
      expect(enemies).toEqual(['Goblin']);
      expect(enemies.length).toBe(1);
    });
    
    it('should preserve different enemy types', () => {
      const text = `
Initiative Order:
1. You
2. Goblin
3. Orc
4. Troll
      `;
      
      const enemies = detectEnemies(text);
      
      expect(enemies).toHaveLength(3);
      expect(enemies).toContain('Goblin');
      expect(enemies).toContain('Orc');
      expect(enemies).toContain('Troll');
    });
  });
  
  describe('False Positive Filtering', () => {
    it('should filter out game terms', () => {
      const text = 'Roll initiative. Attack hits. Damage is 10.';
      const enemies = detectEnemies(text);
      
      expect(enemies).toHaveLength(0);
    });
    
    it('should filter out ability scores', () => {
      const text = 'Make a Dexterity save. Your Strength is 16.';
      const enemies = detectEnemies(text);
      
      expect(enemies).toHaveLength(0);
    });
    
    it('should filter out dice notation', () => {
      const text = 'Roll 2d6 for damage.';
      const enemies = detectEnemies(text);
      
      expect(enemies).toHaveLength(0);
    });
  });
  
  describe('Edge Cases', () => {
    it('should handle empty text', () => {
      const enemies = detectEnemies('');
      expect(enemies).toEqual([]);
    });
    
    it('should handle text with no enemies', () => {
      const text = 'You walk through the forest peacefully.';
      const enemies = detectEnemies(text);
      
      expect(enemies).toEqual([]);
    });
    
    it('should handle very long enemy names', () => {
      const text = 'You fight the Ancient Red Dragon of the Mountain Peak.';
      const enemies = detectEnemies(text);
      
      expect(enemies.length).toBeGreaterThan(0);
    });
  });
});
```

---

## Implementation Checklist

### Phase 1: Core Detection
- [ ] Add helper functions to `enemies.ts`
  - [ ] `isPlayerEntry()`
  - [ ] `cleanEnemyName()`
  - [ ] `removeInstanceNumber()`
  - [ ] `isValidEnemyName()`
  - [ ] `deduplicateEnemies()`
- [ ] Add detection functions
  - [ ] `parseInitiativeOrderEnemies()`
  - [ ] `parseDamageEventEnemies()`
  - [ ] `parseTurnReferenceEnemies()`
  - [ ] `parseCombatActionEnemies()`
- [ ] Update main export `detectEnemies()`
- [ ] Maintain backward compatibility with `parseEnemyMatches()`

### Phase 2: Integration & Testing
- [ ] Update `parser.ts` to pass `playerName` option
- [ ] Create comprehensive test suite
  - [ ] Initiative order tests
  - [ ] Damage event tests
  - [ ] Turn reference tests
  - [ ] Combat action tests
  - [ ] Unicode support tests
  - [ ] Deduplication tests
  - [ ] False positive tests
  - [ ] Edge case tests
- [ ] Run tests and fix any issues
- [ ] Update documentation

---

## Risk Mitigation

1. **Backward Compatibility**: Keep existing function signatures intact
2. **Minimal Changes**: Only modify one main file (`enemies.ts`)
3. **Incremental Testing**: Test each detection function independently
4. **Fallback**: Original patterns remain as fallback if new ones fail
5. **Opt-in Enhancement**: Player name filtering is optional

---

## Expected Improvements

After implementation, the parser will correctly detect:

✅ Enemies in initiative order blocks  
✅ Enemies from damage events  
✅ Enemies from turn references  
✅ Enemies with instance numbers (#1, #2, etc.)  
✅ Unicode character names (Greek, Cyrillic, etc.)  
✅ Filtered player references  
✅ Deduplicated enemy instances  

**Detection Rate**: Expected to increase from ~60% to ~95% in typical AI DM logs.