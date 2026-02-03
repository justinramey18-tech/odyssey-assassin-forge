// Enhanced Chronicle Sync Detection Patterns
// Rest cycles, spell slots, death saves, combat rounds

import { PatternMatch } from './patterns';
import { 
  ParsedRestEvent, 
  ParsedSpellSlotUsage, 
  ParsedDeathSave, 
  ParsedCombatRound,
  ParsedKillEvent,
} from './enhancedTypes';

// ===== REST PATTERNS =====

export const SHORT_REST_PATTERNS = [
  /(?:take|took|complete|completed|finish|finished)\s+(?:a\s+)?short\s+rest/gi,
  /short\s+rest\s+(?:taken|completed|finished)/gi,
  /(?:during|after)\s+(?:the\s+)?short\s+rest/gi,
  /resting\s+(?:for\s+)?(?:an?\s+)?hour/gi,
  /catch(?:ing)?\s+(?:your|their)\s+breath/gi,
  /spend(?:ing)?\s+hit\s+dice/gi,
];

export const LONG_REST_PATTERNS = [
  /(?:take|took|complete|completed|finish|finished)\s+(?:a\s+)?long\s+rest/gi,
  /long\s+rest\s+(?:taken|completed|finished)/gi,
  /(?:during|after)\s+(?:the\s+)?long\s+rest/gi,
  /(?:sleep|slept|camp|camped)\s+(?:for\s+)?(?:the\s+)?night/gi,
  /(?:8|eight)\s+hours?\s+(?:of\s+)?(?:rest|sleep)/gi,
  /wake\s+up\s+(?:fully\s+)?(?:rested|refreshed)/gi,
  /overnight\s+(?:rest|camp|stay)/gi,
];

export function parseRestEvents(text: string): ParsedRestEvent[] {
  const events: ParsedRestEvent[] = [];
  const seen = new Set<number>();
  
  // Short rests
  for (const pattern of SHORT_REST_PATTERNS) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((match = regex.exec(text)) !== null) {
      if (seen.has(match.index)) continue;
      seen.add(match.index);
      
      events.push({
        type: 'short_rest',
        sourceText: match[0],
        confidence: 'high',
      });
    }
  }
  
  // Long rests
  for (const pattern of LONG_REST_PATTERNS) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((match = regex.exec(text)) !== null) {
      if (seen.has(match.index)) continue;
      seen.add(match.index);
      
      events.push({
        type: 'long_rest',
        sourceText: match[0],
        confidence: 'high',
      });
    }
  }
  
  return events;
}

// ===== SPELL SLOT PATTERNS =====

export const SPELL_SLOT_PATTERNS = [
  // "casts fireball at 3rd level", "cast hold person using a 2nd level slot"
  /cast(?:s|ing)?\s+([a-zA-Z\s]+)\s+(?:at|using)\s+(?:a\s+)?(\d)(?:st|nd|rd|th)\s*(?:-?\s*level)?(?:\s+slot)?/gi,
  // "expends a 2nd level spell slot", "uses 3rd level slot"
  /(?:expend|use|spend)s?\s+(?:a\s+)?(\d)(?:st|nd|rd|th)\s*(?:-?\s*level)?\s*(?:spell\s*)?slot/gi,
  // "1st level spell slot used", "3rd-level slot expended"
  /(\d)(?:st|nd|rd|th)\s*(?:-?\s*level)?\s*(?:spell\s*)?slot\s+(?:used|expended|spent)/gi,
  // "casts shield", "casts misty step" (1st/2nd level common spells)
  /casts?\s+(shield|magic\s*missile|cure\s*wounds|healing\s*word|guiding\s*bolt|burning\s*hands)/gi,
  // "casts hold person", "casts invisibility" (2nd level spells)
  /casts?\s+(hold\s*person|invisibility|misty\s*step|darkness|suggestion|shatter)/gi,
  // "casts fireball", "casts counterspell" (3rd level spells)
  /casts?\s+(fireball|counterspell|lightning\s*bolt|fly|haste|slow|dispel\s*magic)/gi,
];

// Common spell level mapping for unlabeled casts
const SPELL_LEVELS: Record<string, number> = {
  'shield': 1, 'magic missile': 1, 'cure wounds': 1, 'healing word': 1, 
  'guiding bolt': 1, 'burning hands': 1, 'thunderwave': 1, 'sleep': 1,
  'hold person': 2, 'invisibility': 2, 'misty step': 2, 'darkness': 2,
  'suggestion': 2, 'shatter': 2, 'scorching ray': 2, 'spiritual weapon': 2,
  'fireball': 3, 'counterspell': 3, 'lightning bolt': 3, 'fly': 3,
  'haste': 3, 'slow': 3, 'dispel magic': 3, 'spirit guardians': 3,
  'dimension door': 4, 'greater invisibility': 4, 'polymorph': 4,
  'wall of fire': 4, 'banishment': 4,
  'hold monster': 5, 'cone of cold': 5, 'cloudkill': 5, 'raise dead': 5,
};

export function parseSpellSlotUsage(text: string): ParsedSpellSlotUsage[] {
  const usage: ParsedSpellSlotUsage[] = [];
  const seen = new Set<number>();
  
  for (const pattern of SPELL_SLOT_PATTERNS) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    
    while ((match = regex.exec(text)) !== null) {
      if (seen.has(match.index)) continue;
      seen.add(match.index);
      
      let level: number | undefined;
      let spellName: string | undefined;
      
      // Check if it's a numbered slot usage
      const levelMatch = match[0].match(/(\d)(?:st|nd|rd|th)/i);
      if (levelMatch) {
        level = parseInt(levelMatch[1], 10);
      }
      
      // Check for spell name
      const spellMatch = match[1]?.toLowerCase().trim();
      if (spellMatch && SPELL_LEVELS[spellMatch]) {
        spellName = spellMatch;
        if (!level) {
          level = SPELL_LEVELS[spellMatch];
        }
      }
      
      if (level && level >= 1 && level <= 9) {
        usage.push({
          level,
          spellName,
          sourceText: match[0],
          confidence: levelMatch ? 'high' : 'medium',
        });
      }
    }
  }
  
  return usage;
}

// ===== DEATH SAVE PATTERNS =====

export const DEATH_SAVE_PATTERNS = [
  // Explicit death saving throw mentions
  /death\s+sav(?:e|ing)?\s+(?:throw\s+)?(?:success|passed|made)/gi,
  /(?:success|passed|made)\s+(?:a\s+)?death\s+sav(?:e|ing)?(?:\s+throw)?/gi,
  /death\s+sav(?:e|ing)?\s+(?:throw\s+)?(?:failure|failed)/gi,
  /(?:failure|failed)\s+(?:a\s+)?death\s+sav(?:e|ing)?(?:\s+throw)?/gi,
  // Natural 20 on death save
  /(?:natural|nat)\s+20\s+(?:on\s+)?death\s+sav/gi,
  /death\s+sav(?:e|ing)?.*?(?:natural|nat)\s+20/gi,
  // Natural 1 on death save (counts as 2 failures)
  /(?:natural|nat)\s+1\s+(?:on\s+)?death\s+sav/gi,
  /death\s+sav(?:e|ing)?.*?(?:natural|nat)\s+1/gi,
  // Generic "rolls death save" with result
  /rolls?\s+(?:a\s+)?death\s+sav(?:e|ing)?.*?(\d+)/gi,
];

export function parseDeathSaves(text: string): ParsedDeathSave[] {
  const saves: ParsedDeathSave[] = [];
  const seen = new Set<number>();
  
  for (const pattern of DEATH_SAVE_PATTERNS) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    
    while ((match = regex.exec(text)) !== null) {
      if (seen.has(match.index)) continue;
      seen.add(match.index);
      
      const matchText = match[0].toLowerCase();
      let type: ParsedDeathSave['type'];
      
      if (/nat(?:ural)?\s*20/i.test(matchText)) {
        type = 'critical_success';
      } else if (/nat(?:ural)?\s*1/i.test(matchText)) {
        type = 'critical_failure';
      } else if (/success|passed|made/i.test(matchText)) {
        type = 'success';
      } else if (/failure|failed/i.test(matchText)) {
        type = 'failure';
      } else {
        // Check for numeric result
        const numMatch = match[0].match(/(\d+)/);
        if (numMatch) {
          const roll = parseInt(numMatch[1], 10);
          if (roll === 20) type = 'critical_success';
          else if (roll === 1) type = 'critical_failure';
          else if (roll >= 10) type = 'success';
          else type = 'failure';
        } else {
          continue; // Couldn't determine type
        }
      }
      
      saves.push({ type, sourceText: match[0] });
    }
  }
  
  return saves;
}

// ===== COMBAT ROUND PATTERNS =====

export const COMBAT_ROUND_PATTERNS = [
  // "Round 3", "Round 5 begins", "Start of round 2"
  /(?:round|turn)\s+(\d+)/gi,
  /(?:start|begin(?:ning)?)\s+(?:of\s+)?round\s+(\d+)/gi,
  /round\s+(\d+)\s+(?:start|begin)s?/gi,
  // "Initiative round 4", "Combat round 6"
  /(?:initiative|combat)\s+round\s+(\d+)/gi,
  // "Top of round 3", "End of round 2"
  /(?:top|end)\s+of\s+round\s+(\d+)/gi,
];

export function parseCombatRounds(text: string): ParsedCombatRound[] {
  const rounds: ParsedCombatRound[] = [];
  const roundsSeen = new Set<number>();
  
  for (const pattern of COMBAT_ROUND_PATTERNS) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    
    while ((match = regex.exec(text)) !== null) {
      const roundNum = parseInt(match[1], 10);
      if (isNaN(roundNum) || roundNum < 1 || roundNum > 100) continue;
      if (roundsSeen.has(roundNum)) continue;
      roundsSeen.add(roundNum);
      
      // Get context around this round mention
      const start = Math.max(0, match.index - 100);
      const end = Math.min(text.length, match.index + match[0].length + 300);
      const context = text.slice(start, end);
      
      rounds.push({
        roundNumber: roundNum,
        events: [context.trim()],
        sourceText: match[0],
      });
    }
  }
  
  // Sort by round number
  return rounds.sort((a, b) => a.roundNumber - b.roundNumber);
}

// ===== KILL PATTERNS =====

export const KILL_PATTERNS = [
  // "kills the goblin", "slays the dragon"
  /(?:kill|slay|defeat|destroy|vanquish|finish(?:\s+off)?)s?\s+(?:the\s+)?([a-zA-Z\s]+?)(?:\.|!|,|$)/gi,
  // "the goblin falls", "the dragon dies"
  /(?:the\s+)?([a-zA-Z\s]+?)\s+(?:falls|dies|is\s+(?:killed|slain|defeated|destroyed))/gi,
  // "goblin is dead", "dragon has fallen"
  /(?:the\s+)?([a-zA-Z\s]+?)\s+(?:is\s+dead|has\s+fallen|drops\s+dead)/gi,
  // "finishing blow", "lethal strike on the goblin"
  /(?:finishing|lethal|killing)\s+(?:blow|strike)\s+(?:on|to|against)\s+(?:the\s+)?([a-zA-Z\s]+)/gi,
];

// Excluded words that aren't enemies
const KILL_EXCLUDED = new Set([
  'time', 'it', 'that', 'this', 'him', 'her', 'them', 'enemy', 'foe', 'target',
  'creature', 'monster', 'beast', 'one', 'another',
]);

export function parseKillEvents(text: string): ParsedKillEvent[] {
  const kills: ParsedKillEvent[] = [];
  const seen = new Set<string>();
  
  for (const pattern of KILL_PATTERNS) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    
    while ((match = regex.exec(text)) !== null) {
      let targetName = match[1]?.trim().toLowerCase();
      if (!targetName || targetName.length < 3 || targetName.length > 30) continue;
      
      // Clean up the target name
      targetName = targetName.replace(/^(the|a|an)\s+/i, '').trim();
      
      // Skip excluded words
      if (KILL_EXCLUDED.has(targetName)) continue;
      
      // Deduplicate by name
      if (seen.has(targetName)) continue;
      seen.add(targetName);
      
      kills.push({
        targetName: targetName.charAt(0).toUpperCase() + targetName.slice(1),
        sourceText: match[0],
      });
    }
  }
  
  return kills;
}

// ===== COMBINED ENHANCED PARSING =====

export interface EnhancedPatternResults {
  restEvents: ParsedRestEvent[];
  spellSlotUsage: ParsedSpellSlotUsage[];
  deathSaves: ParsedDeathSave[];
  combatRounds: ParsedCombatRound[];
  kills: ParsedKillEvent[];
}

export function parseEnhancedPatterns(text: string): EnhancedPatternResults {
  return {
    restEvents: parseRestEvents(text),
    spellSlotUsage: parseSpellSlotUsage(text),
    deathSaves: parseDeathSaves(text),
    combatRounds: parseCombatRounds(text),
    kills: parseKillEvents(text),
  };
}

// ===== ANALYTICS COMPUTATION =====

export function computeEnhancedAnalytics(results: EnhancedPatternResults): {
  spellSlotsByLevel: Record<string, number>;
  deathSaveResults: { successes: number; failures: number };
  restCount: { short: number; long: number };
  combatRoundCount: number;
  killCount: number;
} {
  // Spell slots by level
  const spellSlotsByLevel: Record<string, number> = {};
  for (const spell of results.spellSlotUsage) {
    const key = String(spell.level);
    spellSlotsByLevel[key] = (spellSlotsByLevel[key] || 0) + 1;
  }
  
  // Death saves
  let successes = 0;
  let failures = 0;
  for (const save of results.deathSaves) {
    if (save.type === 'success') successes++;
    else if (save.type === 'critical_success') successes += 3; // Nat 20 = back up
    else if (save.type === 'failure') failures++;
    else if (save.type === 'critical_failure') failures += 2; // Nat 1 = 2 failures
  }
  
  // Rests
  let shortRests = 0;
  let longRests = 0;
  for (const rest of results.restEvents) {
    if (rest.type === 'short_rest') shortRests++;
    else if (rest.type === 'long_rest') longRests++;
  }
  
  // Combat rounds
  const combatRoundCount = results.combatRounds.length > 0
    ? Math.max(...results.combatRounds.map(r => r.roundNumber))
    : 0;
  
  return {
    spellSlotsByLevel,
    deathSaveResults: { successes, failures },
    restCount: { short: shortRests, long: longRests },
    combatRoundCount,
    killCount: results.kills.length,
  };
}
