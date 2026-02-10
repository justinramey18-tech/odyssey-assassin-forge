// Chronicle Sync: Movement & Positioning Detection
// Parses movement distances, positioning, opportunity attacks, and tactical actions

import { ConfidenceLevel } from '../types';

export interface ParsedMovement {
  type: 'move' | 'dash' | 'disengage' | 'dodge' | 'opportunity_attack' | 'position';
  distance?: number; // in feet
  detail?: string;
  sourceText: string;
  confidence: ConfidenceLevel;
}

// ===== MOVEMENT PATTERNS =====

const MOVEMENT_PATTERNS: Array<{ pattern: RegExp; type: ParsedMovement['type'] }> = [
  // Distance moved: "moves 30 feet", "moves 30 ft", "walks 20 feet"
  { pattern: /(?:moves?|walks?|runs?|steps?|advances?|retreats?|charges?)\s+(\d+)\s*(?:feet|ft\.?|foot)/gi, type: 'move' },
  // Dashing: "dashes 60 feet", "uses Dash to move 60 feet"
  { pattern: /(?:dashes?|sprints?)\s+(\d+)\s*(?:feet|ft\.?)/gi, type: 'dash' },
  { pattern: /(?:uses?\s+)?(?:the\s+)?Dash(?:\s+action)?\s+(?:to\s+)?(?:move\s+)?(\d+)?\s*(?:feet|ft\.?)?/gi, type: 'dash' },
  // Disengage: "takes the Disengage action", "disengages"
  { pattern: /(?:takes?\s+(?:the\s+)?)?Disengage(?:\s+action)?/gi, type: 'disengage' },
  { pattern: /disengages?\s+(?:from|and)/gi, type: 'disengage' },
  // Dodge: "takes the Dodge action", "uses Dodge"
  { pattern: /(?:takes?\s+(?:the\s+)?|uses?\s+)?Dodge(?:\s+action)?/gi, type: 'dodge' },
  // Opportunity attacks: "provokes an opportunity attack", "AoO from the guard"
  { pattern: /(?:provokes?\s+)?(?:an?\s+)?opportunity\s+attack/gi, type: 'opportunity_attack' },
  { pattern: /AoO\s+(?:from|against|by)/gi, type: 'opportunity_attack' },
  // Positioning: "flanking the orc", "within 5 feet of", "30 feet away"
  { pattern: /flanking\s+(?:the\s+)?([a-zA-Z][a-zA-Z\s'-]+)/gi, type: 'position' },
  { pattern: /within\s+(\d+)\s*(?:feet|ft\.?)\s+of/gi, type: 'position' },
  { pattern: /(\d+)\s*(?:feet|ft\.?)\s+away(?:\s+from)?/gi, type: 'position' },
];

export function parseMovementEvents(text: string): ParsedMovement[] {
  const events: ParsedMovement[] = [];
  const seen = new Set<number>();

  for (const { pattern, type } of MOVEMENT_PATTERNS) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((match = regex.exec(text)) !== null) {
      if (seen.has(match.index)) continue;
      seen.add(match.index);

      let distance: number | undefined;
      let detail: string | undefined;

      for (let i = 1; i < match.length; i++) {
        const val = match[i];
        if (!val) continue;
        const num = parseInt(val, 10);
        if (!isNaN(num)) {
          distance = num;
        } else if (val.length > 2) {
          detail = val.trim();
        }
      }

      events.push({
        type,
        distance,
        detail,
        sourceText: match[0],
        confidence: distance !== undefined ? 'high' : 'medium',
      });
    }
  }

  return events;
}
