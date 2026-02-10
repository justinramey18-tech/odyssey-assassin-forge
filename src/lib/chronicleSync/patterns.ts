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
  // "each party member gains 200 XP", "each player earns 150 XP"
  /each\s+(?:party\s+member|player|character|adventurer)\s+(?:gain|earn|receive|get)s?\s+(\d+)\s*(?:xp|experience)/gi,
  // "split 800 XP among 4 players", "divide 1200 XP between the party"
  /(?:split|divide)\s+(\d+)\s*(?:xp|experience)\s+(?:among|between|amongst)/gi,
  // "100 XP per goblin", "worth 450 XP each"
  /(\d+)\s*(?:xp|experience)\s+(?:per|each|apiece)/gi,
  /worth\s+(\d+)\s*(?:xp|experience)\s*(?:each|apiece)?/gi,
  // "milestone reached: 1000 XP", "quest reward: 500 XP"
  /(?:milestone|quest\s+reward|reward|bounty|bonus)(?:\s+reached)?[:\s]+(\d+)\s*(?:xp|experience)/gi,
  // "XP reward of 300", "XP bounty: 200"
  /(?:xp|experience)\s+(?:reward|bounty|bonus)\s*(?:of|:)\s*(\d+)/gi,
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
  // "burns you for 28 points", "freezes you for 15"
  /(?:burn|freeze|shock|blast|strike|hit|slash|stab|pierce|crush|sear|scorch|rend|tear)(?:s|ed|ing)?\s+(?:you|him|her|them)\s+for\s+(\d+)\s*(?:points?)?/gi,
  // "loses 12 hit points", "lost 8 HP"
  /lose(?:s|d)?\s+(\d+)\s*(?:hp|hit\s*points?|health)/gi,
  // "for 28 points of fire damage"
  /for\s+(\d+)\s+points?\s+of\s+\w+\s+damage/gi,
  // Dice result damage: "deals 8d6 (28) fire damage", "taking 3d6 (10) damage"
  /(?:deals?|taking|inflicts?)\s+\d+d\d+(?:\s*[+\-]\s*\d+)?\s*\((\d+)\)\s*(?:\w+\s+)?damage/gi,
  // Named attacker: "The orc hits you for 12", "The dragon bites for 24"
  /(?:the\s+)?(?:[A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'-]+)?)\s+(?:hits?|bites?|claws?|slams?|strikes?)\s+(?:you|him|her|them)\s+for\s+(\d+)/gi,
  // Environmental/passive: "the lava deals 10 fire damage per round", "the trap deals 14 damage"
  /(?:the\s+)?(?:lava|fire|trap|spike|acid|water|fall(?:ing)?|poison|environment)\s+(?:deals?|inflicts?|causes?)\s+(\d+)\s*(?:\w+\s+)?damage/gi,
  // Failed save damage: "On a failed save, you take 14 radiant damage"
  /(?:on\s+a\s+)?failed\s+sav(?:e|ing)?\s*,?\s*(?:you\s+)?(?:take|suffer|receive)s?\s+(\d+)\s*(?:\w+\s+)?damage/gi,
  // HP reduction: "Your HP drops by 15", "HP reduced by 8"
  /(?:hp|hit\s*points?)\s+(?:drops?|reduced?|decreased?|lowered?)\s+by\s+(\d+)/gi,
  // "You fall 30 feet, taking 3d6 (10) damage"
  /taking\s+\d+d\d+(?:\s*[+\-]\s*\d+)?\s*\((\d+)\)\s*(?:\w+\s+)?damage/gi,
];

export const HEALING_PATTERNS = [
  // "heal 12 HP", "restore 2d4+2 HP", "recover 15 hit points"
  /(?:heal|restore|recover|regain)(?:s|ed)?\s*(\d+)\s*(?:hp|hit\s*points?|health)/gi,
  // "12 HP healed", "15 hit points restored"
  /(\d+)\s*(?:hp|hit\s*points?|health)\s*(?:healed|restored|recovered|regained)/gi,
  // "gains 10 HP", "got 5 HP back"
  /(?:gain|get|got)(?:s|ed)?\s*(\d+)\s*(?:hp|hit\s*points?|health)(?:\s*back)?/gi,
  // Named spell healing: "Cure Wounds heals you for 12 HP"
  /[A-Z][a-zA-Z\s']+?\s+heals?\s+(?:you|him|her|them)\s+for\s+(\d+)\s*(?:hp|hit\s*points?)?/gi,
  // Passive recovery: "You are healed for 8 hit points"
  /(?:you\s+(?:are|were)|is|was)\s+healed\s+for\s+(\d+)\s*(?:hp|hit\s*points?)?/gi,
  // Dice result healing: "heals 2d8+3 (14) HP"
  /heals?\s+\d+d\d+(?:\s*[+\-]\s*\d+)?\s*\((\d+)\)\s*(?:hp|hit\s*points?)/gi,
  // "recovers to full HP" (no amount - skip), "10 hit points return"
  /(\d+)\s*(?:hp|hit\s*points?)\s+(?:return|restored|come\s+back)/gi,
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
  // Magic items: "find a +1 Longsword", "loot a Ring of Protection"
  /(?:find|loot|receive|acquire|discover|obtain)(?:s|ed)?\s+(?:a\s+|an\s+|the\s+)?(\d+)?\s*(\+\d+\s+[A-Z][a-zA-Z\s]+)/gi,
  // Wondrous items: "Bag of Holding", "Cloak of Elvenkind" (as loot)
  /(?:find|loot|receive|acquire|discover|obtain|pick\s*up)(?:s|ed)?\s+(?:a\s+|an\s+|the\s+)?(\d+)?\s*((?:Bag|Cloak|Boots|Ring|Amulet|Belt|Bracers?|Gauntlets?|Helm|Rod|Staff|Wand|Cape|Robe|Mantle|Periapt|Circlet)\s+of\s+[A-Z][a-zA-Z\s]+)/gi,
  // Ammunition: "20 arrows", "a quiver of bolts", "3 silvered arrows"
  /(?:find|loot|receive|acquire|obtain)(?:s|ed)?\s+(?:a\s+)?(\d+)\s*((?:silvered?\s+)?(?:arrows?|bolts?|darts?|bullets?|ammunition|ammo))/gi,
  // Generic loot: "takes the amulet", "picks up the staff", "pockets the gem"
  /(?:takes?|picks?\s+up|pockets?|grabs?|claims?)(?:\s+the)?\s+(\d+)?\s*([A-Z][a-zA-Z\s]+(?:amulet|staff|wand|ring|gem|jewel|sword|shield|armor|weapon|bow|axe|mace|dagger|cloak|boots|helm|gauntlet))/gi,
  // Gift/reward items: "the king gives you a magical sword", "rewards you with a ring"
  /(?:gives?\s+you|rewards?\s+you\s+with|presents?\s+you\s+with|bestows?\s+upon\s+you)\s+(?:a\s+|an\s+|the\s+)?(\d+)?\s*([A-Z][a-zA-Z\s]+)/gi,
];

export const ITEM_USE_PATTERNS = [
  // "drink a health potion", "consume potion of healing"
  /(?:drink|consume|use|apply|read|quaff)(?:s|ed)?\s*(?:a\s+|the\s+)?(\d+)?\s*([a-zA-Z][a-zA-Z\s]+(?:potion|poison|scroll|vial|elixir)s?)/gi,
  // Activating magic items: "activates the Wand of Fireballs", "activates their Staff of Power"
  /(?:activate|invoke|trigger|channel)(?:s|ed|ing)?\s+(?:the\s+|their\s+|a\s+)?(\d+)?\s*([A-Z][a-zA-Z\s]+(?:Wand|Staff|Rod|Ring|Amulet|Orb|Gem|Crystal|Horn|Lantern|Figurine)(?:\s+of\s+[A-Z][a-zA-Z\s]+)?)/gi,
  // Throwing items: "throws a flask of oil", "throws an alchemist's fire"
  /(?:throw|hurl|toss|lob)(?:s|ed|ing)?\s+(?:a\s+|an\s+|the\s+)?(\d+)?\s*([a-zA-Z][a-zA-Z\s']+(?:flask|vial|bomb|fire|acid|oil|grenade))/gi,
  // Breaking/destroying items: "shatters the phylactery", "breaks the crystal"
  /(?:shatter|break|destroy|crush|smash)(?:s|ed|ing)?\s+(?:the\s+|a\s+)?(\d+)?\s*([A-Z][a-zA-Z\s]+?(?:phylactery|crystal|orb|gem|amulet|idol|totem|artifact|relic|seal|ward|focus|talisman|fetish|icon|statue|mirror|vessel|urn|skull|bone|stone|tablet|scroll|tome|book|key|lock|chain|cage|jar|flask|vial|crown|scepter|rod|staff|wand))/gi,
  // Equipping gear: "equips the +1 Shield", "dons the Cloak of Protection"
  /(?:equip|don|wear|wield|strap\s+on|put\s+on)(?:s|ed|ning)?\s+(?:the\s+|a\s+|an\s+)?(\d+)?\s*(\+\d+\s+[A-Z][a-zA-Z\s]+|[A-Z][a-zA-Z\s]+?(?:of\s+[A-Z][a-zA-Z\s]+|Shield|Armor|Armour|Sword|Bow|Axe|Mace|Staff|Wand|Ring|Amulet|Cloak|Boots|Gauntlets?|Helm|Helmet|Bracers?|Belt|Robe|Cape|Mantle))/gi,
  // Feeding/administering: "feeds them a potion", "administers the antidote"
  /(?:feed|administer|pour|give|force-feed)(?:s|ed|ing)?\s+(?:them|him|her|you)\s+(?:a\s+|an\s+|the\s+)?(\d+)?\s*([a-zA-Z][a-zA-Z\s]+(?:potion|antidote|elixir|draught|tonic))/gi,
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
  // Treasure hoard: "a hoard containing 500 gold", "the chest holds 200 gp"
  /(?:hoard|chest|coffer|strongbox|vault|stash|cache)\s+(?:containing|holds?|with)\s+(\d+)\s*(?:gp|gold(?:\s*pieces?)?)/gi,
  // Reward phrasing: "reward of 100 gold", "bounty: 300 gp", "payment of 50 gold"
  /(?:reward|bounty|payment|prize|stipend|fee)\s*(?:of|:)\s*(\d+)\s*(?:gp|gold(?:\s*pieces?)?)/gi,
  // Informal: "hands you 100 gold", "gives the party 250 gp"
  /(?:hands?|gives?|pays?|offers?)\s+(?:you|the\s+party|them)\s+(\d+)\s*(?:gp|gold(?:\s*pieces?)?)/gi,
  // Mixed currency comma list: removed — caused double-counting with patterns 0/1
  // Gold in comma lists like "15 gp, 30 sp" is already captured by the main gain patterns above
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
  const seen = new Set<number>();
  
  // Gain patterns: all GOLD_PATTERNS except index 2 (spend pattern)
  for (let i = 0; i < GOLD_PATTERNS.length; i++) {
    if (i === 2) continue; // skip spend pattern
    const pattern = GOLD_PATTERNS[i];
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((match = regex.exec(text)) !== null) {
      if (seen.has(match.index)) continue;
      seen.add(match.index);
      const amount = parseInt(match[1], 10);
      if (!isNaN(amount) && amount > 0) {
        const start = Math.max(0, match.index - 30);
        const end = Math.min(text.length, match.index + match[0].length + 30);
        const context = text.slice(start, end).replace(/\s+/g, ' ').trim();
        gained.push({ fullMatch: match[0], value: amount, context, index: match.index });
      }
    }
  }
  
  // Spend patterns: only index 2
  const spendRegex = new RegExp(GOLD_PATTERNS[2].source, GOLD_PATTERNS[2].flags);
  let match;
  while ((match = spendRegex.exec(text)) !== null) {
    if (seen.has(match.index)) continue;
    seen.add(match.index);
    const amount = parseInt(match[1], 10);
    if (!isNaN(amount) && amount > 0) {
      const start = Math.max(0, match.index - 30);
      const end = Math.min(text.length, match.index + match[0].length + 30);
      const context = text.slice(start, end).replace(/\s+/g, ' ').trim();
      spent.push({ fullMatch: match[0], value: amount, context, index: match.index });
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
  // "crits for 24 damage", "crits dealing 30"
  /crits?\s+(?:for|dealing)\s+(\d+)\s*(?:\w+\s+)?damage/gi,
  // "critical hit on the goblin", "crits on the orc"
  /crit(?:ical)?\s*(?:hit|strike)?\s+(?:on|against)\s+(?:the\s+)?([a-zA-Z\s]+)/gi,
  // Fumble/critical miss detection
  /natural\s*1/gi,
  /crit(?:ical)?\s*(?:miss|fail(?:ure)?|fumble)/gi,
  /fumbles?/gi,
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
  // Standard conditions
  /(poisoned|stunned|frightened|charmed|unconscious|blinded|deafened|paralyzed|petrified|prone|restrained|incapacitated|exhausted|invisible|grappled)/gi,
  // Exhaustion levels: "gains 1 level of exhaustion", "exhaustion level increases to 3"
  /(?:gains?\s+)?(\d+)\s+levels?\s+of\s+(exhaustion)/gi,
  /(exhaustion)\s+level\s+(?:increases?\s+to|is\s+now|reaches?)\s+(\d+)/gi,
  // Concentration broken: "loses concentration", "concentration is broken"
  /(concentration)\s+(?:is\s+)?(?:broken|lost|ended|disrupted)/gi,
  /loses?\s+(concentration)/gi,
  // Temp conditions: "is knocked prone", "falls prone", "knocked unconscious"
  /(?:is\s+)?knocked\s+(prone|unconscious)/gi,
  /falls?\s+(prone)/gi,
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
  /recovers?\s+from/i,
  /throws?\s+off/i,
  /resists?\s+the/i,
  /saves?\s+against/i,
];

// Fumble pattern indices (natural 1, critical miss/fail/fumble, fumbles)
const FUMBLE_PATTERN_INDICES = new Set([6, 7, 8]);

export function parseCritMatches(text: string): PatternMatch[] {
  const matches: PatternMatch[] = [];
  
  for (let i = 0; i < CRIT_PATTERNS.length; i++) {
    const pattern = CRIT_PATTERNS[i];
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    const isFumblePattern = FUMBLE_PATTERN_INDICES.has(i);
    
    while ((match = regex.exec(text)) !== null) {
      const start = Math.max(0, match.index - 40);
      const end = Math.min(text.length, match.index + match[0].length + 40);
      const context = text.slice(start, end).replace(/\s+/g, ' ').trim();
      
      matches.push({
        fullMatch: match[0],
        value: isFumblePattern ? 'fumble' : 'critical_hit',
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
  const seen = new Set<number>();
  
  for (const pattern of CONDITION_PATTERNS) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    
    while ((match = regex.exec(text)) !== null) {
      if (seen.has(match.index)) continue;
      seen.add(match.index);
      
      // Extract condition name from whichever capture group has it
      const condition = (match[1] || match[2] || match[0]).toLowerCase().trim();
      const start = Math.max(0, match.index - 40);
      const end = Math.min(text.length, match.index + match[0].length + 40);
      const context = text.slice(start, end).replace(/\s+/g, ' ').trim();
      
      // Check context to determine if applied or removed
      const isRemoved = CONDITION_REMOVAL_PHRASES.some(p => p.test(context));
      
      matches.push({
        fullMatch: match[0],
        value: `${isRemoved ? 'removed' : 'applied'}:${condition}`,
        context,
        index: match.index,
      });
    }
  }
  
  return matches;
}
