// Spell Slot Detection Patterns
// Detects spell casting with slot levels

import { PatternMatch } from '../patterns';

export const SPELL_SLOT_PATTERNS = [
  // "casts fireball using a 3rd-level slot", "cast shield at 1st level"
  /(?:cast|casts|casting)\s+([a-zA-Z][a-zA-Z\s]+?)\s+(?:using|at|with)\s+(?:a\s+)?(\d+)(?:st|nd|rd|th)[\s-]*level(?:\s+slot)?/gi,
  // "expends a 2nd-level spell slot", "uses 3rd level slot"
  /(?:expend|expends|use|uses)\s+(?:a\s+)?(\d+)(?:st|nd|rd|th)[\s-]*level\s+(?:spell\s+)?slot/gi,
  // "3rd-level slot: fireball", "Level 2 slot used for misty step"
  /(\d+)(?:st|nd|rd|th)?[\s-]*level\s+slot(?:\s*[:–-])?\s*(?:for\s+)?([a-zA-Z][a-zA-Z\s]+)/gi,
  // "upcasts fireball at 5th level"
  /upcast(?:s|ing)?\s+([a-zA-Z][a-zA-Z\s]+?)\s+(?:at|to)\s+(\d+)(?:st|nd|rd|th)[\s-]*level/gi,
];

export interface SpellSlotMatch extends PatternMatch {
  spellName?: string;
  slotLevel: number;
}

export function parseSpellSlotMatches(text: string): SpellSlotMatch[] {
  const matches: SpellSlotMatch[] = [];
  
  // Pattern 1: "casts X using Nth-level slot"
  const pattern1 = /(?:cast|casts|casting)\s+([a-zA-Z][a-zA-Z\s]+?)\s+(?:using|at|with)\s+(?:a\s+)?(\d+)(?:st|nd|rd|th)[\s-]*level(?:\s+slot)?/gi;
  let match;
  
  while ((match = pattern1.exec(text)) !== null) {
    const spellName = match[1].trim();
    const slotLevel = parseInt(match[2], 10);
    
    if (slotLevel >= 1 && slotLevel <= 9 && spellName.length > 1) {
      const start = Math.max(0, match.index - 30);
      const end = Math.min(text.length, match.index + match[0].length + 30);
      const context = text.slice(start, end).replace(/\s+/g, ' ').trim();
      
      matches.push({
        fullMatch: match[0],
        value: slotLevel,
        spellName,
        slotLevel,
        context,
        index: match.index,
      });
    }
  }
  
  // Pattern 2: "expends Nth-level slot"
  const pattern2 = /(?:expend|expends|use|uses)\s+(?:a\s+)?(\d+)(?:st|nd|rd|th)[\s-]*level\s+(?:spell\s+)?slot/gi;
  
  while ((match = pattern2.exec(text)) !== null) {
    const slotLevel = parseInt(match[1], 10);
    
    if (slotLevel >= 1 && slotLevel <= 9) {
      const start = Math.max(0, match.index - 30);
      const end = Math.min(text.length, match.index + match[0].length + 30);
      const context = text.slice(start, end).replace(/\s+/g, ' ').trim();
      
      matches.push({
        fullMatch: match[0],
        value: slotLevel,
        slotLevel,
        context,
        index: match.index,
      });
    }
  }
  
  // Pattern 3: "Nth-level slot: spellname"
  const pattern3 = /(\d+)(?:st|nd|rd|th)?[\s-]*level\s+slot(?:\s*[:–-])?\s*(?:for\s+)?([a-zA-Z][a-zA-Z\s]+)/gi;
  
  while ((match = pattern3.exec(text)) !== null) {
    const slotLevel = parseInt(match[1], 10);
    const spellName = match[2].trim();
    
    if (slotLevel >= 1 && slotLevel <= 9 && spellName.length > 1) {
      const start = Math.max(0, match.index - 30);
      const end = Math.min(text.length, match.index + match[0].length + 30);
      const context = text.slice(start, end).replace(/\s+/g, ' ').trim();
      
      matches.push({
        fullMatch: match[0],
        value: slotLevel,
        spellName,
        slotLevel,
        context,
        index: match.index,
      });
    }
  }
  
  // Pattern 4: "upcasts X at Nth level"
  const pattern4 = /upcast(?:s|ing)?\s+([a-zA-Z][a-zA-Z\s]+?)\s+(?:at|to)\s+(\d+)(?:st|nd|rd|th)[\s-]*level/gi;
  
  while ((match = pattern4.exec(text)) !== null) {
    const spellName = match[1].trim();
    const slotLevel = parseInt(match[2], 10);
    
    if (slotLevel >= 1 && slotLevel <= 9 && spellName.length > 1) {
      const start = Math.max(0, match.index - 30);
      const end = Math.min(text.length, match.index + match[0].length + 30);
      const context = text.slice(start, end).replace(/\s+/g, ' ').trim();
      
      matches.push({
        fullMatch: match[0],
        value: slotLevel,
        spellName,
        slotLevel,
        context,
        index: match.index,
      });
    }
  }
  
  // Deduplicate by index
  const seen = new Set<number>();
  return matches.filter(m => {
    if (seen.has(m.index)) return false;
    seen.add(m.index);
    return true;
  });
}
