// Offline logic-based TTRPG text processor
// Transforms game chat history into prose narrative without AI

export interface ProcessingOptions {
  removeRolls: boolean;
  removeStats: boolean;
  removeMechanics: boolean;
  enhanceDescriptions: boolean;
  narrativeStyle: 'fantasy' | 'noir' | 'literary' | 'action';
}

export const defaultProcessingOptions: ProcessingOptions = {
  removeRolls: true,
  removeStats: true,
  removeMechanics: true,
  enhanceDescriptions: true,
  narrativeStyle: 'fantasy',
};

// Regex patterns for identifying TTRPG elements
const patterns = {
  // Dice rolls: d20, 2d6+3, 1d8-1, etc.
  diceRolls: /\b\d*d\d+(?:\s*[+-]\s*\d+)?(?:\s*=\s*\d+)?/gi,
  
  // Roll results in various formats
  rollResults: /\[(?:Roll|Result|Check)(?::\s*)?\d+\]/gi,
  rollParentheses: /\((?:rolled?\s*)?\d+\s*(?:[+-]\s*\d+\s*)?(?:=\s*\d+)?\)/gi,
  
  // Skill checks: [Stealth Check], (Perception: 18), DC 15
  skillChecks: /\[(?:[\w\s]+)\s+(?:Check|Save|Roll)\]/gi,
  dcChecks: /\bDC\s*\d+/gi,
  
  // Stats and modifiers: STR 18, +5 modifier, (DEX), AC: 15
  statReferences: /\b(?:STR|DEX|CON|INT|WIS|CHA|AC|HP|PP|DC)\s*[:=]?\s*\d+/gi,
  modifiers: /(?<![a-z])[+-]\d+(?:\s*(?:bonus|modifier|mod))?(?![a-z\d])/gi,
  
  // Action economy: bonus action, reaction, free action
  actionEconomy: /\b(?:bonus\s+action|free\s+action|reaction|main\s+action|legendary\s+action|lair\s+action)\b/gi,
  
  // Game mechanic terms
  mechanicTerms: /\b(?:hit\s+points?|damage\s+dice|attack\s+roll|saving\s+throw|advantage|disadvantage|proficiency|initiative|critical\s+(?:hit|miss|success|failure))\b/gi,
  
  // Distance/movement: 30 feet, 6 squares
  distances: /\b\d+\s*(?:feet|ft\.?|squares?|spaces?)\b/gi,
  
  // Turn/round markers
  turnMarkers: /\b(?:on\s+your\s+turn|end\s+of\s+(?:your\s+)?turn|start\s+of\s+(?:your\s+)?turn|round\s+\d+|turn\s+\d+)\b/gi,
  
  // OOC markers: ((text)), [OOC], *OOC*
  oocMarkers: /\(\([^)]*\)\)|\[OOC[^\]]*\]|\*OOC[^*]*\*/gi,
  
  // System messages: [GM], <System>, etc.
  systemPrefixes: /^\s*(?:\[(?:GM|DM|System|Narrator|Bot)\]|<(?:GM|DM|System|Narrator|Bot)>)\s*/gim,
  
  // Timestamps in chat
  timestamps: /\[\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?\]/gi,
  
  // Ability/spell notation: 1/short rest, (recharge 5-6)
  usageLimits: /\b\d+\/(?:short|long)\s*rest\b|\(recharge\s*\d+(?:-\d+)?\)/gi,
  
  // Condition tracking: [Poisoned], {Stunned}
  conditionBrackets: /[\[{](?:Poisoned|Stunned|Frightened|Charmed|Unconscious|Prone|Grappled|Restrained|Invisible|Blinded|Deafened|Paralyzed|Petrified|Exhausted)[\]}]/gi,
};

// Enhancement templates for different narrative styles
const styleEnhancements: Record<string, Record<string, string>> = {
  fantasy: {
    'attacks': 'strikes with deadly precision',
    'hits': 'lands a devastating blow',
    'misses': 'the strike goes wide',
    'deals damage': 'wounds their foe',
    'takes damage': 'staggers from the impact',
    'casts a spell': 'weaves arcane energies',
    'moves': 'advances swiftly',
    'searches': 'examines their surroundings with keen eyes',
  },
  noir: {
    'attacks': 'makes their move',
    'hits': 'connects with brutal efficiency',
    'misses': 'the shot goes wild',
    'deals damage': 'leaves their mark',
    'takes damage': 'takes the hit without flinching',
    'casts a spell': 'works their dark craft',
    'moves': 'slips through the shadows',
    'searches': 'cases the joint',
  },
  literary: {
    'attacks': 'engages in combat',
    'hits': 'finds their mark with practiced ease',
    'misses': 'the attempt proves futile',
    'deals damage': 'inflicts a grievous wound',
    'takes damage': 'suffers under the assault',
    'casts a spell': 'invokes mystical forces',
    'moves': 'traverses the distance',
    'searches': 'surveys the environment',
  },
  action: {
    'attacks': 'launches into action',
    'hits': 'BOOM! Direct hit!',
    'misses': 'narrowly dodges!',
    'deals damage': 'lands a crushing blow',
    'takes damage': 'reels from the hit',
    'casts a spell': 'unleashes raw power',
    'moves': 'bursts into motion',
    'searches': 'scans the area',
  },
};

// Clean up excessive whitespace and formatting
function cleanWhitespace(text: string): string {
  return text
    .replace(/\n{3,}/g, '\n\n')  // Max 2 newlines
    .replace(/[ \t]+/g, ' ')      // Single spaces
    .replace(/^\s+|\s+$/gm, '')   // Trim lines
    .trim();
}

// Capitalize sentences properly
function capitalizeSentences(text: string): string {
  return text.replace(/(^|[.!?]\s+)([a-z])/g, (match, prefix, letter) => {
    return prefix + letter.toUpperCase();
  });
}

// Apply narrative style enhancements
function applyStyleEnhancements(text: string, style: string): string {
  const enhancements = styleEnhancements[style] || styleEnhancements.fantasy;
  let result = text;
  
  for (const [pattern, replacement] of Object.entries(enhancements)) {
    const regex = new RegExp(`\\b${pattern}\\b`, 'gi');
    // Only replace sometimes to avoid over-processing
    result = result.replace(regex, (match, offset) => {
      // Random chance to apply enhancement for variety
      if (Math.random() > 0.7) return match;
      return replacement;
    });
  }
  
  return result;
}

// Main processing function for offline mode
export function processTextOffline(input: string, options: ProcessingOptions = defaultProcessingOptions): string {
  let result = input;
  
  // Remove OOC content first
  result = result.replace(patterns.oocMarkers, '');
  
  // Remove system prefixes
  result = result.replace(patterns.systemPrefixes, '');
  
  // Remove timestamps
  result = result.replace(patterns.timestamps, '');
  
  if (options.removeRolls) {
    result = result.replace(patterns.diceRolls, '');
    result = result.replace(patterns.rollResults, '');
    result = result.replace(patterns.rollParentheses, '');
    result = result.replace(patterns.skillChecks, '');
    result = result.replace(patterns.dcChecks, '');
  }
  
  if (options.removeStats) {
    result = result.replace(patterns.statReferences, '');
    result = result.replace(patterns.modifiers, '');
    result = result.replace(patterns.distances, match => {
      // Convert distances to prose
      const num = parseInt(match);
      if (num <= 5) return 'within arm\'s reach';
      if (num <= 15) return 'a few paces away';
      if (num <= 30) return 'across the room';
      if (num <= 60) return 'at a distance';
      return 'far away';
    });
  }
  
  if (options.removeMechanics) {
    result = result.replace(patterns.actionEconomy, '');
    result = result.replace(patterns.mechanicTerms, match => {
      // Replace some mechanics with narrative equivalents
      const replacements: Record<string, string> = {
        'hit points': 'health',
        'hit point': 'health',
        'damage dice': 'devastating force',
        'attack roll': 'strike',
        'saving throw': 'desperate attempt',
        'advantage': 'favorable position',
        'disadvantage': 'difficult circumstances',
        'proficiency': 'expertise',
        'initiative': 'quick reflexes',
        'critical hit': 'devastating strike',
        'critical miss': 'fumble',
        'critical success': 'remarkable success',
        'critical failure': 'catastrophic failure',
      };
      return replacements[match.toLowerCase()] || '';
    });
    result = result.replace(patterns.turnMarkers, '');
    result = result.replace(patterns.usageLimits, '');
    result = result.replace(patterns.conditionBrackets, match => {
      // Keep condition names but remove brackets
      return match.slice(1, -1).toLowerCase();
    });
  }
  
  // Apply style enhancements
  if (options.enhanceDescriptions) {
    result = applyStyleEnhancements(result, options.narrativeStyle);
  }
  
  // Clean up formatting
  result = cleanWhitespace(result);
  result = capitalizeSentences(result);
  
  return result;
}

// Get a preview of what will be removed
export function getRemovalPreview(input: string): { element: string; count: number }[] {
  const preview: { element: string; count: number }[] = [];
  
  const addCount = (name: string, pattern: RegExp) => {
    const matches = input.match(pattern);
    if (matches && matches.length > 0) {
      preview.push({ element: name, count: matches.length });
    }
  };
  
  addCount('Dice rolls', patterns.diceRolls);
  addCount('Roll results', patterns.rollResults);
  addCount('Skill checks', patterns.skillChecks);
  addCount('Stat references', patterns.statReferences);
  addCount('Modifiers', patterns.modifiers);
  addCount('Game mechanics', patterns.mechanicTerms);
  addCount('OOC content', patterns.oocMarkers);
  addCount('System messages', patterns.systemPrefixes);
  addCount('Distances', patterns.distances);
  addCount('Turn markers', patterns.turnMarkers);
  
  return preview;
}
