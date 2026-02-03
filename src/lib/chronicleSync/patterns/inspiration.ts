// Inspiration Detection Patterns
// Detects inspiration granted, used, and bardic inspiration

import { PatternMatch } from '../patterns';

export const INSPIRATION_PATTERNS = {
  granted: [
    // "DM grants inspiration", "GM awards inspiration"
    /(?:dm|gm|dungeon\s+master|game\s+master)\s+(?:grant|grants|award|awards|give|gives)\s+inspiration/gi,
    // "gains inspiration", "receives inspiration"
    /(?:gain|gains|receive|receives|earn|earns|get|gets)\s+inspiration/gi,
    // "Inspiration granted", "awarded inspiration"
    /inspiration\s+(?:granted|awarded|given|earned)/gi,
  ],
  used: [
    // "uses inspiration", "spends inspiration"
    /(?:use|uses|used|spend|spends|spent)\s+(?:their\s+)?inspiration/gi,
    // "inspiration used", "with inspiration"
    /inspiration\s+(?:used|spent)/gi,
    /(?:roll(?:s|ed)?|reroll(?:s|ed)?)\s+with\s+inspiration/gi,
  ],
  bardic: [
    // "grants bardic inspiration", "uses bardic inspiration d8"
    /(?:grant|grants|give|gives|use|uses)\s+(?:a\s+)?bardic\s+inspiration(?:\s+d(\d+))?/gi,
    // "bardic inspiration: d10", "adds bardic inspiration"
    /bardic\s+inspiration[:\s]+d(\d+)/gi,
    /add(?:s|ed)?\s+(?:a\s+)?bardic\s+inspiration(?:\s+d(\d+))?/gi,
  ],
};

export type InspirationType = 'granted' | 'used' | 'bardic_granted' | 'bardic_used';

export interface InspirationMatch extends PatternMatch {
  inspirationType: InspirationType;
  bardicDie?: number; // d6, d8, d10, d12
}

export function parseInspirationMatches(text: string): InspirationMatch[] {
  const matches: InspirationMatch[] = [];
  
  // Granted inspiration
  for (const pattern of INSPIRATION_PATTERNS.granted) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      const start = Math.max(0, match.index - 30);
      const end = Math.min(text.length, match.index + match[0].length + 30);
      const context = text.slice(start, end).replace(/\s+/g, ' ').trim();
      
      matches.push({
        fullMatch: match[0],
        value: 'inspiration_granted',
        inspirationType: 'granted',
        context,
        index: match.index,
      });
    }
  }
  
  // Used inspiration
  for (const pattern of INSPIRATION_PATTERNS.used) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      const start = Math.max(0, match.index - 30);
      const end = Math.min(text.length, match.index + match[0].length + 30);
      const context = text.slice(start, end).replace(/\s+/g, ' ').trim();
      
      matches.push({
        fullMatch: match[0],
        value: 'inspiration_used',
        inspirationType: 'used',
        context,
        index: match.index,
      });
    }
  }
  
  // Bardic inspiration
  for (const pattern of INSPIRATION_PATTERNS.bardic) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      const isUsed = /use|uses|add|adds/i.test(match[0]);
      const bardicDie = match[1] ? parseInt(match[1], 10) : undefined;
      
      const start = Math.max(0, match.index - 30);
      const end = Math.min(text.length, match.index + match[0].length + 30);
      const context = text.slice(start, end).replace(/\s+/g, ' ').trim();
      
      matches.push({
        fullMatch: match[0],
        value: isUsed ? 'bardic_used' : 'bardic_granted',
        inspirationType: isUsed ? 'bardic_used' : 'bardic_granted',
        bardicDie,
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
