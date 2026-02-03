// Death Saving Throw Detection Patterns
// Detects death saves with success/failure/crit outcomes

import { PatternMatch } from '../patterns';

export const DEATH_SAVE_PATTERNS = [
  // "rolls death save: 15 (success)", "death save: natural 20!"
  /death\s+sav(?:e|ing)(?:\s+throw)?[:\s]+(?:rolls?\s+)?(?:a?\s+)?(?:natural\s+)?(\d+)/gi,
  // "makes a death saving throw and rolls a 12"
  /(?:make|makes|made)\s+(?:a\s+)?death\s+sav(?:e|ing)(?:\s+throw)?.*?(?:roll(?:s|ed)?|get(?:s)?|got)?\s*(?:a\s+)?(?:natural\s+)?(\d+)/gi,
  // "death save success", "death save failure"
  /death\s+sav(?:e|ing)(?:\s+throw)?[:\s]*(success|failure|fail|passed|failed)/gi,
  // "rolls a nat 1 on death save", "natural 20 death save"
  /(?:natural|nat)\s+(1|20)\s+(?:on\s+)?death\s+sav/gi,
  /death\s+sav.*?(?:natural|nat)\s+(1|20)/gi,
];

export type DeathSaveOutcome = 'success' | 'failure' | 'critical_success' | 'critical_failure';

export interface DeathSaveMatch extends PatternMatch {
  outcome: DeathSaveOutcome;
  roll?: number;
}

export function parseDeathSaveMatches(text: string): DeathSaveMatch[] {
  const matches: DeathSaveMatch[] = [];
  
  // Pattern 1 & 2: death save with numeric roll
  const numericPatterns = [
    /death\s+sav(?:e|ing)(?:\s+throw)?[:\s]+(?:rolls?\s+)?(?:a?\s+)?(?:natural\s+)?(\d+)/gi,
    /(?:make|makes|made)\s+(?:a\s+)?death\s+sav(?:e|ing)(?:\s+throw)?.*?(?:roll(?:s|ed)?|get(?:s)?|got)?\s*(?:a\s+)?(?:natural\s+)?(\d+)/gi,
  ];
  
  for (const pattern of numericPatterns) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      const roll = parseInt(match[1], 10);
      
      if (roll >= 1 && roll <= 20) {
        let outcome: DeathSaveOutcome;
        
        if (roll === 20) {
          outcome = 'critical_success';
        } else if (roll === 1) {
          outcome = 'critical_failure';
        } else if (roll >= 10) {
          outcome = 'success';
        } else {
          outcome = 'failure';
        }
        
        const start = Math.max(0, match.index - 30);
        const end = Math.min(text.length, match.index + match[0].length + 30);
        const context = text.slice(start, end).replace(/\s+/g, ' ').trim();
        
        matches.push({
          fullMatch: match[0],
          value: outcome,
          outcome,
          roll,
          context,
          index: match.index,
        });
      }
    }
  }
  
  // Pattern 3: text-based success/failure
  const textPattern = /death\s+sav(?:e|ing)(?:\s+throw)?[:\s]*(success|failure|fail|passed|failed)/gi;
  let match;
  
  while ((match = textPattern.exec(text)) !== null) {
    const resultText = match[1].toLowerCase();
    const outcome: DeathSaveOutcome = 
      (resultText === 'success' || resultText === 'passed') ? 'success' : 'failure';
    
    const start = Math.max(0, match.index - 30);
    const end = Math.min(text.length, match.index + match[0].length + 30);
    const context = text.slice(start, end).replace(/\s+/g, ' ').trim();
    
    matches.push({
      fullMatch: match[0],
      value: outcome,
      outcome,
      context,
      index: match.index,
    });
  }
  
  // Pattern 4 & 5: natural 1 or 20
  const critPatterns = [
    /(?:natural|nat)\s+(1|20)\s+(?:on\s+)?death\s+sav/gi,
    /death\s+sav.*?(?:natural|nat)\s+(1|20)/gi,
  ];
  
  for (const pattern of critPatterns) {
    const regex = new RegExp(pattern.source, pattern.flags);
    
    while ((match = regex.exec(text)) !== null) {
      const roll = parseInt(match[1], 10);
      const outcome: DeathSaveOutcome = roll === 20 ? 'critical_success' : 'critical_failure';
      
      const start = Math.max(0, match.index - 30);
      const end = Math.min(text.length, match.index + match[0].length + 30);
      const context = text.slice(start, end).replace(/\s+/g, ' ').trim();
      
      matches.push({
        fullMatch: match[0],
        value: outcome,
        outcome,
        roll,
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
