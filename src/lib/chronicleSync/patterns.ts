// Chronicle Sync Regex Patterns
// For offline Pattern Match mode parsing

export interface PatternMatch {
  fullMatch: string;
  value: string | number;
  context: string;
  index: number;
}

// ===== XP PATTERNS =====

export const XP_PATTERNS = [
  // "gain 450 XP", "earned 100 experience", "receive 50 xp"
  /(?:gain|earn|receive|award|get|got|given)(?:ed|s)?\s*(\d+)\s*(?:xp|experience(?:\s*points?)?)/gi,
  // "450 XP gained", "100 experience earned"
  /(\d+)\s*(?:xp|experience(?:\s*points?)?)\s*(?:gained|earned|awarded|received)/gi,
  // "XP: +450", "Experience: 100"
  /(?:xp|experience):\s*\+?(\d+)/gi,
];

export function parseXPMatches(text: string): PatternMatch[] {
  const matches: PatternMatch[] = [];
  
  for (const pattern of XP_PATTERNS) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    
    while ((match = regex.exec(text)) !== null) {
      const amount = parseInt(match[1], 10);
      if (!isNaN(amount) && amount > 0) {
        // Get surrounding context (50 chars before and after)
        const start = Math.max(0, match.index - 50);
        const end = Math.min(text.length, match.index + match[0].length + 50);
        const context = text.slice(start, end).replace(/\s+/g, ' ').trim();
        
        matches.push({
          fullMatch: match[0],
          value: amount,
          context,
          index: match.index,
        });
      }
    }
  }
  
  // Deduplicate by index (same match found by multiple patterns)
  const seen = new Set<number>();
  return matches.filter(m => {
    if (seen.has(m.index)) return false;
    seen.add(m.index);
    return true;
  });
}

// ===== DAMAGE/HEALING PATTERNS =====

export const DAMAGE_PATTERNS = [
  // "take 18 slashing damage", "suffer 12 fire damage"
  /(?:take|suffer|receive)(?:s|d)?\s*(\d+)\s*(?:\w+\s+)?damage/gi,
  // "deals 25 damage", "inflicts 10 damage"
  /(?:deal|inflict)(?:s|ed)?\s*(\d+)\s*(?:\w+\s+)?damage/gi,
  // "18 damage taken", "25 points of damage"
  /(\d+)\s*(?:points?\s+of\s+)?(?:\w+\s+)?damage\s*(?:taken|received)/gi,
  // Gap 4: "burns you for 28 points", "freezes you for 15"
  /(?:burn|freeze|shock|blast|strike|hit|slash|stab|pierce|crush|sear|scorch|rend|tear)(?:s|ed|ing)?\s+(?:you|him|her|them)\s+for\s+(\d+)\s*(?:points?)?/gi,
  // "loses 12 hit points", "lost 8 HP"
  /lose(?:s|d)?\s+(\d+)\s*(?:hp|hit\s*points?|health)/gi,
  // "for 28 points of fire damage"
  /for\s+(\d+)\s+points?\s+of\s+\w+\s+damage/gi,
];

export const HEALING_PATTERNS = [
  // "heal 12 HP", "restore 2d4+2 HP", "recover 15 hit points"
  /(?:heal|restore|recover|regain)(?:s|ed)?\s*(\d+)\s*(?:hp|hit\s*points?|health)/gi,
  // "12 HP healed", "15 hit points restored"
  /(\d+)\s*(?:hp|hit\s*points?|health)\s*(?:healed|restored|recovered|regained)/gi,
  // "gains 10 HP", "got 5 HP back"
  /(?:gain|get|got)(?:s|ed)?\s*(\d+)\s*(?:hp|hit\s*points?|health)(?:\s*back)?/gi,
];

// ===== TEMPORARY HP PATTERNS =====

export const TEMP_HP_PATTERNS = [
  // "gain 10 temporary HP", "receives 15 temp hit points"
  /(?:gain|receive|get|got)(?:s|ed)?\s*(\d+)\s*(?:temp(?:orary)?)\s*(?:hp|hit\s*points?)/gi,
  // "10 temporary HP", "15 temp hit points gained"
  /(\d+)\s*(?:temp(?:orary)?)\s*(?:hp|hit\s*points?)(?:\s*(?:gained|received))?/gi,
  // "temporary hit points: 8", "temp HP: 12"
  /(?:temp(?:orary)?)\s*(?:hp|hit\s*points?):\s*(\d+)/gi,
  // "grants 10 temporary hit points", "provides 8 temp HP"
  /(?:grants?|provides?|gives?)(?:\s+you)?\s*(\d+)\s*(?:temp(?:orary)?)\s*(?:hp|hit\s*points?)/gi,
  // "armor of agathys" style: "5 temp HP from armor of agathys"
  /(\d+)\s*(?:temp(?:orary)?)\s*(?:hp|hit\s*points?)\s*(?:from|via|through)/gi,
];

export function parseTempHPMatches(text: string): PatternMatch[] {
  const matches: PatternMatch[] = [];
  
  for (const pattern of TEMP_HP_PATTERNS) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    
    while ((match = regex.exec(text)) !== null) {
      const amount = parseInt(match[1], 10);
      if (!isNaN(amount) && amount > 0) {
        const start = Math.max(0, match.index - 50);
        const end = Math.min(text.length, match.index + match[0].length + 50);
        const context = text.slice(start, end).replace(/\s+/g, ' ').trim();
        
        matches.push({
          fullMatch: match[0],
          value: amount,
          context,
          index: match.index,
        });
      }
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

export function parseDamageMatches(text: string): PatternMatch[] {
  const matches: PatternMatch[] = [];
  
  for (const pattern of DAMAGE_PATTERNS) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    
    while ((match = regex.exec(text)) !== null) {
      const amount = parseInt(match[1], 10);
      if (!isNaN(amount) && amount > 0) {
        const start = Math.max(0, match.index - 50);
        const end = Math.min(text.length, match.index + match[0].length + 50);
        const context = text.slice(start, end).replace(/\s+/g, ' ').trim();
        
        matches.push({
          fullMatch: match[0],
          value: amount,
          context,
          index: match.index,
        });
      }
    }
  }
  
  return matches;
}

export function parseHealingMatches(text: string): PatternMatch[] {
  const matches: PatternMatch[] = [];
  
  for (const pattern of HEALING_PATTERNS) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    
    while ((match = regex.exec(text)) !== null) {
      const amount = parseInt(match[1], 10);
      if (!isNaN(amount) && amount > 0) {
        const start = Math.max(0, match.index - 50);
        const end = Math.min(text.length, match.index + match[0].length + 50);
        const context = text.slice(start, end).replace(/\s+/g, ' ').trim();
        
        matches.push({
          fullMatch: match[0],
          value: amount,
          context,
          index: match.index,
        });
      }
    }
  }
  
  return matches;
}

// ===== ITEM PATTERNS =====

export const ITEM_ACQUIRE_PATTERNS = [
  // "find 3 health potions", "loot a potion of healing"
  /(?:find|loot|receive|acquire|pick\s*up|discover|obtain|get)(?:s|ed)?\s*(?:a\s+)?(\d+)?\s*([a-zA-Z][a-zA-Z\s]+(?:potion|poison|scroll|vial|elixir)s?)/gi,
  // "3 health potions found", "potion of healing looted"
  /(\d+)?\s*([a-zA-Z][a-zA-Z\s]+(?:potion|poison|scroll|vial|elixir)s?)\s*(?:found|looted|acquired|obtained)/gi,
];

export const ITEM_USE_PATTERNS = [
  // "drink a health potion", "consume potion of healing"
  /(?:drink|consume|use|apply|read|quaff)(?:s|ed)?\s*(?:a\s+|the\s+)?(\d+)?\s*([a-zA-Z][a-zA-Z\s]+(?:potion|poison|scroll|vial|elixir)s?)/gi,
];

export function parseItemAcquireMatches(text: string): PatternMatch[] {
  const matches: PatternMatch[] = [];
  
  for (const pattern of ITEM_ACQUIRE_PATTERNS) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    
    while ((match = regex.exec(text)) !== null) {
      const quantity = match[1] ? parseInt(match[1], 10) : 1;
      const itemName = match[2].trim();
      
      if (itemName.length > 2) {
        const start = Math.max(0, match.index - 30);
        const end = Math.min(text.length, match.index + match[0].length + 30);
        const context = text.slice(start, end).replace(/\s+/g, ' ').trim();
        
        matches.push({
          fullMatch: match[0],
          value: `${quantity}x ${itemName}`,
          context,
          index: match.index,
        });
      }
    }
  }
  
  return matches;
}

export function parseItemUseMatches(text: string): PatternMatch[] {
  const matches: PatternMatch[] = [];
  
  for (const pattern of ITEM_USE_PATTERNS) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    
    while ((match = regex.exec(text)) !== null) {
      const quantity = match[1] ? parseInt(match[1], 10) : 1;
      const itemName = match[2].trim();
      
      if (itemName.length > 2) {
        const start = Math.max(0, match.index - 30);
        const end = Math.min(text.length, match.index + match[0].length + 30);
        const context = text.slice(start, end).replace(/\s+/g, ' ').trim();
        
        matches.push({
          fullMatch: match[0],
          value: `${quantity}x ${itemName}`,
          context,
          index: match.index,
        });
      }
    }
  }
  
  return matches;
}

// ===== GOLD PATTERNS =====

export const GOLD_PATTERNS = [
  // "find 75 gold", "loot 100 gold pieces", "50 gp"
  /(?:find|loot|receive|gain|get|got|earn)(?:s|ed)?\s*(\d+)\s*(?:gp|gold(?:\s*pieces?)?|coins?)/gi,
  // "75 gold found", "100 gp looted"
  /(\d+)\s*(?:gp|gold(?:\s*pieces?)?|coins?)\s*(?:found|looted|gained|earned|received)/gi,
  // "spend 50 gold", "pay 100 gp"
  /(?:spend|pay|lose|lost)(?:s|ed)?\s*(\d+)\s*(?:gp|gold(?:\s*pieces?)?|coins?)/gi,
];

// ===== MULTI-CURRENCY PATTERNS (Gap 3) =====

// Conversion rates to gold
export const CURRENCY_TO_GOLD: Record<string, number> = {
  cp: 0.01,
  sp: 0.1,
  ep: 0.5,
  gp: 1,
  pp: 10,
};

export const MULTI_CURRENCY_GAIN_PATTERNS = [
  // "find 50 silver", "loot 200 copper", "receive 10 platinum"
  /(?:find|loot|receive|gain|get|got|earn)(?:s|ed)?\s*(\d+)\s*(?:(cp|sp|ep|pp)|copper(?:\s*pieces?)?|silver(?:\s*pieces?)?|electrum(?:\s*pieces?)?|platinum(?:\s*pieces?)?)/gi,
  // "50 silver found", "200 copper looted"
  /(\d+)\s*(?:(cp|sp|ep|pp)|copper(?:\s*pieces?)?|silver(?:\s*pieces?)?|electrum(?:\s*pieces?)?|platinum(?:\s*pieces?)?)\s*(?:found|looted|gained|earned|received)/gi,
];

export const MULTI_CURRENCY_SPEND_PATTERNS = [
  /(?:spend|pay|lose|lost)(?:s|ed)?\s*(\d+)\s*(?:(cp|sp|ep|pp)|copper(?:\s*pieces?)?|silver(?:\s*pieces?)?|electrum(?:\s*pieces?)?|platinum(?:\s*pieces?)?)/gi,
];

function detectCurrencyType(matchText: string): string {
  const lower = matchText.toLowerCase();
  if (/\bcp\b|copper/i.test(lower)) return 'cp';
  if (/\bsp\b|silver/i.test(lower)) return 'sp';
  if (/\bep\b|electrum/i.test(lower)) return 'ep';
  if (/\bpp\b|platinum/i.test(lower)) return 'pp';
  return 'gp';
}

export function parseMultiCurrencyMatches(text: string): { gained: PatternMatch[]; spent: PatternMatch[] } {
  const gained: PatternMatch[] = [];
  const spent: PatternMatch[] = [];

  for (const pattern of MULTI_CURRENCY_GAIN_PATTERNS) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((match = regex.exec(text)) !== null) {
      const rawAmount = parseInt(match[1], 10);
      const currency = detectCurrencyType(match[0]);
      const goldEquiv = Math.round(rawAmount * (CURRENCY_TO_GOLD[currency] ?? 1) * 100) / 100;
      if (!isNaN(goldEquiv) && goldEquiv > 0) {
        const start = Math.max(0, match.index - 30);
        const end = Math.min(text.length, match.index + match[0].length + 30);
        const context = text.slice(start, end).replace(/\s+/g, ' ').trim();
        gained.push({ fullMatch: match[0], value: goldEquiv, context, index: match.index });
      }
    }
  }

  for (const pattern of MULTI_CURRENCY_SPEND_PATTERNS) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((match = regex.exec(text)) !== null) {
      const rawAmount = parseInt(match[1], 10);
      const currency = detectCurrencyType(match[0]);
      const goldEquiv = Math.round(rawAmount * (CURRENCY_TO_GOLD[currency] ?? 1) * 100) / 100;
      if (!isNaN(goldEquiv) && goldEquiv > 0) {
        const start = Math.max(0, match.index - 30);
        const end = Math.min(text.length, match.index + match[0].length + 30);
        const context = text.slice(start, end).replace(/\s+/g, ' ').trim();
        spent.push({ fullMatch: match[0], value: goldEquiv, context, index: match.index });
      }
    }
  }

  return { gained, spent };
}

export function parseGoldMatches(text: string): { gained: PatternMatch[]; spent: PatternMatch[] } {
  const gained: PatternMatch[] = [];
  const spent: PatternMatch[] = [];
  
  // Gain patterns
  const gainPattern = /(?:find|loot|receive|gain|get|got|earn)(?:s|ed)?\s*(\d+)\s*(?:gp|gold(?:\s*pieces?)?|coins?)/gi;
  const foundPattern = /(\d+)\s*(?:gp|gold(?:\s*pieces?)?|coins?)\s*(?:found|looted|gained|earned|received)/gi;
  
  for (const pattern of [gainPattern, foundPattern]) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const amount = parseInt(match[1], 10);
      if (!isNaN(amount) && amount > 0) {
        const start = Math.max(0, match.index - 30);
        const end = Math.min(text.length, match.index + match[0].length + 30);
        const context = text.slice(start, end).replace(/\s+/g, ' ').trim();
        
        gained.push({
          fullMatch: match[0],
          value: amount,
          context,
          index: match.index,
        });
      }
    }
  }
  
  // Spend patterns
  const spendPattern = /(?:spend|pay|lose|lost)(?:s|ed)?\s*(\d+)\s*(?:gp|gold(?:\s*pieces?)?|coins?)/gi;
  let match;
  while ((match = spendPattern.exec(text)) !== null) {
    const amount = parseInt(match[1], 10);
    if (!isNaN(amount) && amount > 0) {
      const start = Math.max(0, match.index - 30);
      const end = Math.min(text.length, match.index + match[0].length + 30);
      const context = text.slice(start, end).replace(/\s+/g, ' ').trim();
      
      spent.push({
        fullMatch: match[0],
        value: amount,
        context,
        index: match.index,
      });
    }
  }
  
  return { gained, spent };
}

// ===== COMBAT PATTERNS =====

export const CRIT_PATTERNS = [
  /natural\s*20/gi,
  /crit(?:ical)?\s*(?:hit|success)/gi,
  /critical\s*strike/gi,
  /rolls?\s*(?:a\s+)?20/gi,
];

export const LEVEL_UP_PATTERNS = [
  // "reach level 5", "advance to level 7"
  /(?:reach|advance|level\s*up\s*to|hit|attain)(?:ed|es)?\s*level\s*(\d+)/gi,
  // "now level 5", "is now level 7"
  /(?:now|is\s+now)\s*level\s*(\d+)/gi,
  // "level 5 reached", "reached level 7"
  /level\s*(\d+)\s*(?:reached|attained|achieved)/gi,
];

export const CONDITION_PATTERNS = [
  // Conditions to detect
  /(poisoned|stunned|frightened|charmed|unconscious|blinded|deafened|paralyzed|petrified|prone|restrained|incapacitated|exhausted|invisible|grappled)/gi,
];

// Gap 5: Expanded removal context phrases
const CONDITION_REMOVAL_PHRASES = [
  /no\s+longer/i,
  /cure|cured/i,
  /remove|removed/i,
  /end(?:s|ed)?/i,
  /recover|recovered/i,
  /free|freed/i,
  /wears?\s+off/i,
  /fades?/i,
  /lifts?/i,
  /shakes?\s+(?:it\s+)?off/i,
  /breaks?\s+free/i,
  /snaps?\s+out/i,
  /overcomes?/i,
  /expires?/i,
  /dissipates?/i,
  /subsides?/i,
];

export function parseCritMatches(text: string): PatternMatch[] {
  const matches: PatternMatch[] = [];
  
  for (const pattern of CRIT_PATTERNS) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    
    while ((match = regex.exec(text)) !== null) {
      const start = Math.max(0, match.index - 40);
      const end = Math.min(text.length, match.index + match[0].length + 40);
      const context = text.slice(start, end).replace(/\s+/g, ' ').trim();
      
      matches.push({
        fullMatch: match[0],
        value: 'critical_hit',
        context,
        index: match.index,
      });
    }
  }
  
  return matches;
}

export function parseLevelUpMatches(text: string): PatternMatch[] {
  const matches: PatternMatch[] = [];
  
  for (const pattern of LEVEL_UP_PATTERNS) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    
    while ((match = regex.exec(text)) !== null) {
      const level = parseInt(match[1], 10);
      if (!isNaN(level) && level >= 1 && level <= 20) {
        const start = Math.max(0, match.index - 30);
        const end = Math.min(text.length, match.index + match[0].length + 30);
        const context = text.slice(start, end).replace(/\s+/g, ' ').trim();
        
        matches.push({
          fullMatch: match[0],
          value: level,
          context,
          index: match.index,
        });
      }
    }
  }
  
  return matches;
}

export function parseConditionMatches(text: string): PatternMatch[] {
  const matches: PatternMatch[] = [];
  const pattern = CONDITION_PATTERNS[0];
  
  let match;
  const regex = new RegExp(pattern.source, pattern.flags);
  
  while ((match = regex.exec(text)) !== null) {
    const condition = match[1].toLowerCase();
    const start = Math.max(0, match.index - 40);
    const end = Math.min(text.length, match.index + match[0].length + 40);
    const context = text.slice(start, end).replace(/\s+/g, ' ').trim();
    
    // Check context to determine if applied or removed (Gap 5: expanded phrases)
    const isRemoved = CONDITION_REMOVAL_PHRASES.some(p => p.test(context));
    
    matches.push({
      fullMatch: match[0],
      value: `${isRemoved ? 'removed' : 'applied'}:${condition}`,
      context,
      index: match.index,
    });
  }
  
  return matches;
}
