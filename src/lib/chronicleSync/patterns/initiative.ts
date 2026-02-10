// Initiative Detection Patterns
// Detects initiative rolls and combat order

import { PatternMatch } from '../patterns';

export const INITIATIVE_PATTERNS = [
  // "Initiative: 18", "rolls initiative: 15"
  /(?:roll(?:s|ed)?)?(?:\s+)?initiative[:\s]+(\d+)/gi,
  // "Initiative order: Player 18, Goblin 12"
  /initiative\s+(?:order|roll)[:\s]+([^\n]+)/gi,
  // "rolls a 18 for initiative"
  /roll(?:s|ed)?\s+(?:a\s+)?(\d+)\s+(?:for\s+)?initiative/gi,
  // "gets 15 on initiative"
  /get(?:s)?\s+(?:a\s+)?(\d+)\s+(?:on\s+)?initiative/gi,
  // Surprise: "surprise round", "caught off guard", "surprised"
  /surprise\s+round/gi,
  /caught\s+(?:off\s+guard|by\s+surprise|unaware)/gi,
  // Priority: "goes first", "acts first"
  /(?:goes?|acts?)\s+first\s+(?:in\s+)?(?:initiative|combat)?/gi,
  // Win/lose initiative: "wins initiative", "loses initiative"
  /(?:wins?|loses?)\s+initiative/gi,
];

export interface InitiativeEntry {
  name: string;
  roll: number;
}

export interface InitiativeMatch extends PatternMatch {
  rolls: InitiativeEntry[];
  singleRoll?: number;
}

export function parseInitiativeMatches(text: string): InitiativeMatch[] {
  const matches: InitiativeMatch[] = [];
  
  // Pattern 1: Simple "Initiative: X" (but NOT "initiative order:" which is pattern 2)
  const pattern1 = /(?:roll(?:s|ed)?)?(?:\s+)?initiative[:\s]+(\d+)/gi;
  let match;
  
  while ((match = pattern1.exec(text)) !== null) {
    const roll = parseInt(match[1], 10);
    
    if (roll >= 1 && roll <= 40) {
      // Skip if this is part of an "initiative order:" block (pattern 2 handles that)
      const beforeSlice = text.slice(Math.max(0, match.index - 10), match.index + 15).toLowerCase();
      if (/initiative\s+order/i.test(beforeSlice)) continue;
      
      const start = Math.max(0, match.index - 40);
      const end = Math.min(text.length, match.index + match[0].length + 20);
      const context = text.slice(start, end).replace(/\s+/g, ' ').trim();
      
      // Try to find who rolled by looking for a name before "initiative"
      const beforeMatch = text.slice(Math.max(0, match.index - 50), match.index);
      const nameMatch = beforeMatch.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*(?:rolls?|gets?)?$/);
      
      matches.push({
        fullMatch: match[0],
        value: roll,
        rolls: nameMatch ? [{ name: nameMatch[1], roll }] : [],
        singleRoll: roll,
        context,
        index: match.index,
      });
    }
  }
  
  // Pattern 2: Initiative order with multiple entries
  const pattern2 = /initiative\s+(?:order|rolls?)[:\s]+([^\n]+)/gi;
  
  while ((match = pattern2.exec(text)) !== null) {
    const orderText = match[1];
    const entries: InitiativeEntry[] = [];
    
    // Parse "Name 18, Name 15" or "Name: 18, Name: 15" format
    const entryPattern = /([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)\s*[:\s]?\s*(\d+)/g;
    let entryMatch;
    
    while ((entryMatch = entryPattern.exec(orderText)) !== null) {
      const name = entryMatch[1].trim();
      const roll = parseInt(entryMatch[2], 10);
      
      if (roll >= 1 && roll <= 40 && name.length > 1) {
        entries.push({ name, roll });
      }
    }
    
    if (entries.length > 0) {
      const start = Math.max(0, match.index - 20);
      const end = Math.min(text.length, match.index + match[0].length + 20);
      const context = text.slice(start, end).replace(/\s+/g, ' ').trim();
      
      matches.push({
        fullMatch: match[0],
        value: `${entries.length} combatants`,
        rolls: entries,
        context,
        index: match.index,
      });
    }
  }
  
  // Pattern 3: "rolls X for initiative"
  const pattern3 = /roll(?:s|ed)?\s+(?:a\s+)?(\d+)\s+(?:for\s+)?initiative/gi;
  
  while ((match = pattern3.exec(text)) !== null) {
    const roll = parseInt(match[1], 10);
    
    if (roll >= 1 && roll <= 40) {
      const start = Math.max(0, match.index - 40);
      const end = Math.min(text.length, match.index + match[0].length + 20);
      const context = text.slice(start, end).replace(/\s+/g, ' ').trim();
      
      // Try to find who rolled
      const beforeMatch = text.slice(Math.max(0, match.index - 50), match.index);
      const nameMatch = beforeMatch.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*$/);
      
      matches.push({
        fullMatch: match[0],
        value: roll,
        rolls: nameMatch ? [{ name: nameMatch[1], roll }] : [],
        singleRoll: roll,
        context,
        index: match.index,
      });
    }
  }
  
  // Deduplicate by proximity (within 10 chars = same event)
  const kept: InitiativeMatch[] = [];
  for (const m of matches) {
    const isDup = kept.some(k => Math.abs(k.index - m.index) < 10);
    if (!isDup) kept.push(m);
  }
  return kept;
}
