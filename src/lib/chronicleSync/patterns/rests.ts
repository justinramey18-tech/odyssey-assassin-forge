// Rest Detection Patterns
// Detects short rests, long rests, and downtime activities

import { PatternMatch } from '../patterns';

export const REST_PATTERNS = {
  shortRest: [
    // "takes a short rest", "short rest taken"
    /(?:take|takes|took|taking)\s+(?:a\s+)?short\s+rest/gi,
    /short\s+rest\s+(?:taken|completed|finished)/gi,
    // "rests for an hour", "1-hour rest"
    /rest(?:s|ed|ing)?\s+(?:for\s+)?(?:an?\s+)?(?:1\s+)?hour/gi,
  ],
  longRest: [
    // "takes a long rest", "long rest completed"
    /(?:take|takes|took|taking)\s+(?:a\s+)?long\s+rest/gi,
    /long\s+rest\s+(?:taken|completed|finished)/gi,
    // "rests for the night", "sleeps through the night"
    /(?:rest|sleep)(?:s|ed|ing)?\s+(?:for\s+)?(?:the\s+)?(?:night|8\s+hours)/gi,
    // "overnight rest", "makes camp for the night"
    /overnight\s+rest/gi,
    /(?:make|makes|made)\s+camp\s+for\s+the\s+night/gi,
  ],
};

export interface RestMatch extends PatternMatch {
  restType: 'short' | 'long';
}

export function parseRestMatches(text: string): RestMatch[] {
  const matches: RestMatch[] = [];
  
  // Short rest patterns
  for (const pattern of REST_PATTERNS.shortRest) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      const start = Math.max(0, match.index - 30);
      const end = Math.min(text.length, match.index + match[0].length + 30);
      const context = text.slice(start, end).replace(/\s+/g, ' ').trim();
      
      matches.push({
        fullMatch: match[0],
        value: 'short_rest',
        restType: 'short',
        context,
        index: match.index,
      });
    }
  }
  
  // Long rest patterns
  for (const pattern of REST_PATTERNS.longRest) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      const start = Math.max(0, match.index - 30);
      const end = Math.min(text.length, match.index + match[0].length + 30);
      const context = text.slice(start, end).replace(/\s+/g, ' ').trim();
      
      matches.push({
        fullMatch: match[0],
        value: 'long_rest',
        restType: 'long',
        context,
        index: match.index,
      });
    }
  }
  
  // Deduplicate by proximity — same rest type within 100 chars is likely the same event
  const sorted = [...matches].sort((a, b) => a.index - b.index);
  const kept: RestMatch[] = [];
  for (const m of sorted) {
    const isDup = kept.some(k => 
      k.restType === m.restType && Math.abs(k.index - m.index) < 100
    );
    if (!isDup) kept.push(m);
  }
  return kept;
}

// ===== DOWNTIME ACTIVITY PATTERNS =====

export const DOWNTIME_PATTERNS = [
  // "spends 5 days crafting", "3 days of downtime"
  /(?:spend|spends|spent)\s+(\d+)\s+(?:day|days|week|weeks)\s+(?:on\s+)?([a-zA-Z][a-zA-Z\s]+)/gi,
  // "downtime: crafting for 2 weeks"
  /downtime:?\s+([a-zA-Z][a-zA-Z\s]+?)\s+(?:for\s+)?(\d+)\s+(?:day|days|week|weeks)/gi,
  // "practices swordplay for a week"
  /(?:practice|practices|practiced|train|trains|trained|research|researches|researched|craft|crafts|crafted)\s+([a-zA-Z][a-zA-Z\s]+?)\s+(?:for\s+)?(\d+)\s+(?:day|days|week|weeks)/gi,
];

export interface DowntimeMatch extends PatternMatch {
  activity: string;
  duration: number;
  unit: 'days' | 'weeks';
}

export function parseDowntimeMatches(text: string): DowntimeMatch[] {
  const matches: DowntimeMatch[] = [];
  
  // Pattern 1: "spends X days/weeks on activity"
  const pattern1 = /(?:spend|spends|spent)\s+(\d+)\s+(day|days|week|weeks)\s+(?:on\s+)?([a-zA-Z][a-zA-Z\s]+)/gi;
  let match;
  
  while ((match = pattern1.exec(text)) !== null) {
    const duration = parseInt(match[1], 10);
    const unit = match[2].toLowerCase().startsWith('week') ? 'weeks' : 'days';
    const activity = match[3].trim();
    
    if (duration > 0 && activity.length > 2) {
      const start = Math.max(0, match.index - 20);
      const end = Math.min(text.length, match.index + match[0].length + 20);
      const context = text.slice(start, end).replace(/\s+/g, ' ').trim();
      
      matches.push({
        fullMatch: match[0],
        value: `${duration} ${unit}: ${activity}`,
        activity,
        duration,
        unit,
        context,
        index: match.index,
      });
    }
  }
  
  // Pattern 2: "downtime: activity for X days/weeks"
  const pattern2 = /downtime:?\s+([a-zA-Z][a-zA-Z\s]+?)\s+(?:for\s+)?(\d+)\s+(day|days|week|weeks)/gi;
  
  while ((match = pattern2.exec(text)) !== null) {
    const activity = match[1].trim();
    const duration = parseInt(match[2], 10);
    const unit = match[3].toLowerCase().startsWith('week') ? 'weeks' : 'days';
    
    if (duration > 0 && activity.length > 2) {
      const start = Math.max(0, match.index - 20);
      const end = Math.min(text.length, match.index + match[0].length + 20);
      const context = text.slice(start, end).replace(/\s+/g, ' ').trim();
      
      matches.push({
        fullMatch: match[0],
        value: `${duration} ${unit}: ${activity}`,
        activity,
        duration,
        unit,
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
