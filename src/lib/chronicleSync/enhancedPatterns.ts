// Enhanced Chronicle Sync Detection Patterns
// Rest cycles, spell slots, death saves, combat rounds, temp HP, inspiration, initiative

import { PatternMatch, parseTempHPMatches } from './patterns';
import { parseInspirationMatches } from './patterns/inspiration';
import { parseInitiativeMatches, InitiativeMatch } from './patterns/initiative';
import { 
  ParsedRestEvent, 
  ParsedSpellSlotUsage, 
  ParsedDeathSave, 
  ParsedCombatRound,
  ParsedKillEvent,
  ParsedTempHP,
  ParsedInspiration,
} from './enhancedTypes';

// Re-export InitiativeMatch for consumers
export type { InitiativeMatch } from './patterns/initiative';

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
  // Named spell casts (matched against SPELL_LEVELS lookup below)
  /casts?\s+([a-zA-Z][a-zA-Z\s']+?)(?:\s+(?:at|on|against|toward)|\s*[.!,]|\s*$)/gi,
  // Gap 7: "uses a spell slot" without level
  /uses?\s+(?:a\s+)?spell\s+slot/gi,
  // Gap 7: Ritual casting "casts X as a ritual"
  /casts?\s+([a-zA-Z][a-zA-Z\s']+?)\s+as\s+a\s+ritual/gi,
  // Gap 7: Concentration "concentrating on X", "loses concentration on X"
  /(?:concentrat(?:ing|es?|ed)|loses?\s+concentration)\s+(?:on\s+)?([a-zA-Z][a-zA-Z\s']+?)(?:\s*[.!,]|\s*$)/gi,
];

// Expanded spell level mapping (Gap 7) - PHB cantrips through 9th level
const SPELL_LEVELS: Record<string, number> = {
  // Cantrips (level 0 - no slot used)
  'fire bolt': 0, 'eldritch blast': 0, 'sacred flame': 0, 'toll the dead': 0,
  'minor illusion': 0, 'prestidigitation': 0, 'thaumaturgy': 0, 'druidcraft': 0,
  'mage hand': 0, 'light': 0, 'guidance': 0, 'vicious mockery': 0,
  'chill touch': 0, 'spare the dying': 0, 'ray of frost': 0, 'shocking grasp': 0,
  'poison spray': 0, 'mending': 0, 'message': 0, 'true strike': 0,
  'blade ward': 0, 'friends': 0, 'dancing lights': 0, 'produce flame': 0,
  'shillelagh': 0, 'thorn whip': 0, 'word of radiance': 0, 'green flame blade': 0,
  'booming blade': 0, 'mind sliver': 0, 'sapping sting': 0,
  // 1st level
  'shield': 1, 'magic missile': 1, 'cure wounds': 1, 'healing word': 1,
  'guiding bolt': 1, 'burning hands': 1, 'thunderwave': 1, 'sleep': 1,
  'mage armor': 1, 'detect magic': 1, 'identify': 1, 'feather fall': 1,
  'bless': 1, 'bane': 1, 'command': 1, 'sanctuary': 1, 'inflict wounds': 1,
  'hex': 1, 'armor of agathys': 1, 'hellish rebuke': 1, 'chromatic orb': 1,
  'witch bolt': 1, 'absorb elements': 1, 'faerie fire': 1, 'entangle': 1,
  'goodberry': 1, 'hunter\'s mark': 1, 'fog cloud': 1, 'grease': 1,
  'charm person': 1, 'disguise self': 1, 'expeditious retreat': 1,
  'find familiar': 1, 'comprehend languages': 1, 'unseen servant': 1,
  'dissonant whispers': 1, 'tasha\'s hideous laughter': 1, 'heroism': 1,
  'wrathful smite': 1, 'thunderous smite': 1, 'searing smite': 1,
  'divine favor': 1, 'shield of faith': 1, 'protection from evil and good': 1,
  'ray of sickness': 1, 'false life': 1, 'catapult': 1, 'ice knife': 1,
  'earth tremor': 1, 'zephyr strike': 1, 'ensnaring strike': 1,
  // 2nd level
  'hold person': 2, 'invisibility': 2, 'misty step': 2, 'darkness': 2,
  'suggestion': 2, 'shatter': 2, 'scorching ray': 2, 'spiritual weapon': 2,
  'lesser restoration': 2, 'prayer of healing': 2, 'aid': 2, 'silence': 2,
  'mirror image': 2, 'blur': 2, 'levitate': 2, 'web': 2, 'flaming sphere': 2,
  'cloud of daggers': 2, 'enlarge/reduce': 2, 'heat metal': 2, 'moonbeam': 2,
  'pass without trace': 2, 'spike growth': 2, 'barkskin': 2, 'warding bond': 2,
  'crown of madness': 2, 'phantasmal force': 2, 'calm emotions': 2,
  'detect thoughts': 2, 'locate object': 2, 'see invisibility': 2,
  'knock': 2, 'arcane lock': 2, 'branding smite': 2, 'find steed': 2,
  'zone of truth': 2, 'enthrall': 2, 'blindness/deafness': 2,
  'gentle repose': 2, 'ray of enfeeblement': 2,
  'dragon\'s breath': 2, 'shadow blade': 2, 'mind spike': 2,
  // 3rd level
  'fireball': 3, 'counterspell': 3, 'lightning bolt': 3, 'fly': 3,
  'haste': 3, 'slow': 3, 'dispel magic': 3, 'spirit guardians': 3,
  'revivify': 3, 'mass healing word': 3, 'beacon of hope': 3, 'crusader\'s mantle': 3,
  'animate dead': 3, 'vampiric touch': 3, 'bestow curse': 3, 'fear': 3,
  'hypnotic pattern': 3, 'major image': 3, 'sending': 3, 'tongues': 3,
  'remove curse': 3, 'protection from energy': 3, 'call lightning': 3,
  'conjure animals': 3, 'plant growth': 3, 'sleet storm': 3, 'wind wall': 3,
  'water breathing': 3, 'water walk': 3, 'daylight': 3, 'aura of vitality': 3,
  'blinding smite': 3, 'elemental weapon': 3, 'hunger of hadar': 3,
  'stinking cloud': 3, 'tiny hut': 3, 'leomund\'s tiny hut': 3,
  'thunder step': 3, 'enemies abound': 3, 'erupting earth': 3,
  'tidal wave': 3, 'wall of water': 3, 'summon lesser demons': 3,
  // 4th level
  'dimension door': 4, 'greater invisibility': 4, 'polymorph': 4,
  'wall of fire': 4, 'banishment': 4, 'death ward': 4, 'freedom of movement': 4,
  'guardian of faith': 4, 'ice storm': 4, 'blight': 4, 'phantasmal killer': 4,
  'stoneskin': 4, 'fire shield': 4, 'conjure woodland beings': 4,
  'giant insect': 4, 'dominate beast': 4, 'confusion': 4, 'fabricate': 4,
  'otiluke\'s resilient sphere': 4, 'locate creature': 4, 'compulsion': 4,
  'staggering smite': 4, 'find greater steed': 4, 'aura of purity': 4,
  'aura of life': 4, 'shadow of moil': 4, 'sickening radiance': 4,
  'summon greater demon': 4, 'storm sphere': 4, 'vitriolic sphere': 4,
  // 5th level
  'hold monster': 5, 'cone of cold': 5, 'cloudkill': 5, 'raise dead': 5,
  'wall of force': 5, 'telekinesis': 5, 'animate objects': 5, 'bigby\'s hand': 5,
  'dominate person': 5, 'flame strike': 5, 'greater restoration': 5,
  'mass cure wounds': 5, 'destructive wave': 5, 'banishing smite': 5,
  'circle of power': 5, 'holy weapon': 5, 'synaptic static': 5,
  'steel wind strike': 5, 'dawn': 5, 'wall of light': 5,
  'conjure elemental': 5, 'commune': 5, 'contact other plane': 5,
  'dream': 5, 'geas': 5, 'legend lore': 5, 'modify memory': 5,
  'planar binding': 5, 'scrying': 5, 'teleportation circle': 5,
  'tree stride': 5, 'insect plague': 5, 'reincarnate': 5, 'awaken': 5,
  'danse macabre': 5, 'enervation': 5, 'far step': 5, 'skill empowerment': 5,
  'negative energy flood': 5, 'infernal calling': 5,
  // 6th level
  'chain lightning': 6, 'disintegrate': 6, 'globe of invulnerability': 6,
  'heal': 6, 'heroes\' feast': 6, 'sunbeam': 6, 'true seeing': 6,
  'eyebite': 6, 'mass suggestion': 6, 'mental prison': 6,
  'scatter': 6, 'soul cage': 6, 'tenser\'s transformation': 6,
  'blade barrier': 6, 'create undead': 6, 'circle of death': 6,
  'contingency': 6, 'otto\'s irresistible dance': 6, 'programmed illusion': 6,
  'word of recall': 6, 'find the path': 6, 'forbiddance': 6,
  'planar ally': 6, 'transport via plants': 6, 'wall of thorns': 6,
  'wind walk': 6, 'conjure fey': 6, 'primordial ward': 6,
  'investiture of flame': 6, 'investiture of ice': 6, 'investiture of stone': 6,
  'investiture of wind': 6, 'bones of the earth': 6,
  // 7th level
  'teleport': 7, 'plane shift': 7, 'finger of death': 7, 'forcecage': 7,
  'fire storm': 7, 'regenerate': 7, 'resurrection': 7, 'divine word': 7,
  'crown of stars': 7, 'power word pain': 7, 'temple of the gods': 7,
  'delayed blast fireball': 7, 'etherealness': 7, 'mordenkainen\'s sword': 7,
  'prismatic spray': 7, 'project image': 7, 'reverse gravity': 7,
  'sequester': 7, 'simulacrum': 7, 'symbol': 7, 'mirage arcane': 7,
  'conjure celestial': 7, 'whirlwind': 7,
  // 8th level
  'maze': 8, 'power word stun': 8, 'dominate monster': 8, 'earthquake': 8,
  'sunburst': 8, 'holy aura': 8, 'antipathy/sympathy': 8, 'clone': 8,
  'feeblemind': 8, 'mind blank': 8, 'telepathy': 8, 'tsunami': 8,
  'demiplane': 8, 'incendiary cloud': 8, 'glibness': 8, 'control weather': 8,
  'abi-dalzim\'s horrid wilting': 8, 'illusory dragon': 8, 'maddening darkness': 8,
  'mighty fortress': 8, 'dark star': 8, 'reality break': 8,
  // 9th level
  'wish': 9, 'power word kill': 9, 'true polymorph': 9, 'meteor swarm': 9,
  'gate': 9, 'mass heal': 9, 'true resurrection': 9, 'foresight': 9,
  'prismatic wall': 9, 'time stop': 9, 'shapechange': 9, 'weird': 9,
  'astral projection': 9, 'imprisonment': 9, 'blade of disaster': 9,
  'psychic scream': 9, 'ravenous void': 9,
};

export function parseSpellSlotUsage(text: string): ParsedSpellSlotUsage[] {
  const usage: ParsedSpellSlotUsage[] = [];
  const seen = new Set<number>();

  // Patterns 1-3 and 5: explicit slot level mentions
  const explicitPatterns = SPELL_SLOT_PATTERNS.slice(0, 3).concat(SPELL_SLOT_PATTERNS[4] ? [SPELL_SLOT_PATTERNS[4]] : []);
  for (const pattern of explicitPatterns) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((match = regex.exec(text)) !== null) {
      if (seen.has(match.index)) continue;
      seen.add(match.index);

      const levelMatch = match[0].match(/(\d)(?:st|nd|rd|th)/i);
      if (levelMatch) {
        const level = parseInt(levelMatch[1], 10);
        if (level >= 1 && level <= 9) {
          const spellMatch = match[1]?.toLowerCase().trim();
          usage.push({
            level,
            spellName: spellMatch && SPELL_LEVELS[spellMatch] !== undefined ? spellMatch : undefined,
            sourceText: match[0],
            confidence: 'high',
          });
        }
      }
    }
  }

  // Pattern 4: named spell casts "casts X" - lookup in SPELL_LEVELS
  const namedCastPattern = /casts?\s+([a-zA-Z][a-zA-Z\s']+?)(?:\s+(?:at|on|against|toward)|\s*[.!,]|\s*$)/gi;
  let match;
  while ((match = namedCastPattern.exec(text)) !== null) {
    if (seen.has(match.index)) continue;
    const spellName = match[1].toLowerCase().trim();
    const level = SPELL_LEVELS[spellName];
    if (level !== undefined) {
      seen.add(match.index);
      // Cantrips (level 0) don't use a slot
      if (level === 0) continue;
      usage.push({
        level,
        spellName,
        sourceText: match[0],
        confidence: 'medium',
      });
    }
  }

  // Gap 7: Ritual casting detection - "casts X as a ritual" (no slot used, but track it)
  const ritualPattern = /casts?\s+([a-zA-Z][a-zA-Z\s']+?)\s+as\s+a\s+ritual/gi;
  while ((match = ritualPattern.exec(text)) !== null) {
    // Rituals don't consume slots, so we skip adding them to usage
    // but we track them for analytics by marking with level 0
    if (seen.has(match.index)) continue;
    seen.add(match.index);
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

// ===== TEMP HP PARSING =====

export function parseTempHPGains(text: string): ParsedTempHP[] {
  const matches = parseTempHPMatches(text);
  return matches.map(match => ({
    amount: match.value as number,
    source: match.context,
    sourceText: match.fullMatch,
    confidence: 'high' as const,
  }));
}

// ===== INSPIRATION PARSING =====

export function parseInspirationEvents(text: string): ParsedInspiration[] {
  const matches = parseInspirationMatches(text);
  return matches
    .filter(m => m.inspirationType === 'granted' || m.inspirationType === 'used')
    .map(match => ({
      type: (match.inspirationType === 'granted' ? 'gained' : 'used') as 'gained' | 'used',
      sourceText: match.fullMatch,
      context: match.context,
    }));
}

// ===== COMBINED ENHANCED PARSING =====

export interface EnhancedPatternResults {
  restEvents: ParsedRestEvent[];
  spellSlotUsage: ParsedSpellSlotUsage[];
  deathSaves: ParsedDeathSave[];
  combatRounds: ParsedCombatRound[];
  kills: ParsedKillEvent[];
  tempHPGains: ParsedTempHP[];
  inspirationEvents: ParsedInspiration[];
  initiativeRolls: InitiativeMatch[];
}

export function parseEnhancedPatterns(text: string): EnhancedPatternResults {
  return {
    restEvents: parseRestEvents(text),
    spellSlotUsage: parseSpellSlotUsage(text),
    deathSaves: parseDeathSaves(text),
    combatRounds: parseCombatRounds(text),
    kills: parseKillEvents(text),
    tempHPGains: parseTempHPGains(text),
    inspirationEvents: parseInspirationEvents(text),
    initiativeRolls: parseInitiativeMatches(text),
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
