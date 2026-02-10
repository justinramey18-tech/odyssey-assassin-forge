// Shop Item Detection Patterns (Gap 1)
// Detects merchant/shop items with prices from session logs offline

import { PatternMatch } from '../patterns';
import { ParsedShopItem, ConfidenceLevel } from '../types';

// Patterns for merchant item offerings with prices
export const SHOP_ITEM_PATTERNS = [
  // "offers a Cloak of Protection for 500 gold", "selling Boots of Speed for 200 gp"
  /(?:offers?|sells?|selling|has)\s+(?:a\s+|an\s+)?([A-Z][a-zA-Z\s']+?)\s+(?:for|at|costing)\s+(\d+)\s*(?:gp|gold(?:\s*pieces?)?)/gi,
  // "Cloak of Protection (500 gp)", "Boots of Speed (200 gold)"
  /([A-Z][a-zA-Z\s']+?)\s*\((\d+)\s*(?:gp|gold(?:\s*pieces?)?)\)/g,
  // "Cloak of Protection - 500 gp", "Boots of Speed — 200 gold"
  /([A-Z][a-zA-Z\s']+?)\s*[–—-]\s*(\d+)\s*(?:gp|gold(?:\s*pieces?)?)/g,
  // "costs 500 gp: Cloak of Protection", "500 gp for a Cloak of Protection"
  /(\d+)\s*(?:gp|gold(?:\s*pieces?)?)\s+(?:for|:)\s+(?:a\s+|an\s+)?([A-Z][a-zA-Z\s']+)/g,
  // "purchase a Cloak of Protection for 500 gold"
  /(?:buy|purchase)\s+(?:a\s+|an\s+)?([A-Z][a-zA-Z\s']+?)\s+(?:for|at)\s+(\d+)\s*(?:gp|gold(?:\s*pieces?)?)/gi,
  // "Potion of Healing: 50 gp" (colon-separated price list format)
  /^([A-Z][a-zA-Z\s']+?):\s*(\d+)\s*(?:gp|gold(?:\s*pieces?)?)\s*$/gm,
  // Bullet list: "* Healing Potion - 50 gp", "- Longsword - 15 gp", "• Shield - 10 gp"
  /^[\s]*[*•\-]\s+([A-Z][a-zA-Z\s']+?)\s*[–—-]\s*(\d+)\s*(?:gp|gold(?:\s*pieces?)?)/gm,
  // Numbered list: "1. Longsword - 15 gp", "2) Healing Potion - 50 gp"
  /^\s*\d+[.)]\s+([A-Z][a-zA-Z\s']+?)\s*[–—-]\s*(\d+)\s*(?:gp|gold(?:\s*pieces?)?)/gm,
  // Quantity in shop: "3x Potion of Healing at 50 gp each", "Arrows (20) - 1 gp"
  /\d+x?\s+([A-Z][a-zA-Z\s']+?)\s+(?:at|for)\s+(\d+)\s*(?:gp|gold(?:\s*pieces?)?)\s*(?:each|apiece)?/gi,
  // Discount/haggle: "reduced to 40 gp", "offers it for 80 gp instead"
  /([A-Z][a-zA-Z\s']+?)\s+(?:reduced|marked\s+down|discounted)\s+to\s+(\d+)\s*(?:gp|gold(?:\s*pieces?)?)/gi,
  // Multi-currency: "costs 5 pp", "selling for 50 sp" (converted to gold in parser)
  /(?:offers?|sells?|selling|costs?)\s+(?:a\s+|an\s+)?([A-Z][a-zA-Z\s']+?)\s+(?:for|at)\s+(\d+)\s*(pp|sp|cp|ep)/gi,
];

// Guess item type from name keywords
function guessItemType(name: string): 'equipment' | 'consumable' | 'miscellaneous' {
  const lower = name.toLowerCase();
  if (/potion|scroll|vial|elixir|poison|bomb|oil|balm|salve|antidote|draught/i.test(lower)) {
    return 'consumable';
  }
  if (/sword|shield|armor|armour|bow|axe|mace|staff|wand|ring|amulet|cloak|boots|gauntlet|helm|helmet|bracers?|belt|robe/i.test(lower)) {
    return 'equipment';
  }
  return 'miscellaneous';
}

// Guess rarity from name keywords
function guessRarity(name: string): string {
  const lower = name.toLowerCase();
  if (/legendary|artifact/i.test(lower)) return 'legendary';
  if (/very\s+rare/i.test(lower)) return 'very rare';
  if (/rare/i.test(lower)) return 'rare';
  if (/uncommon/i.test(lower)) return 'uncommon';
  return 'common';
}

// Words that shouldn't be item names
const EXCLUDED_SHOP_NAMES = new Set([
  'the', 'a', 'an', 'it', 'this', 'that', 'he', 'she', 'they', 'you', 'we',
  'room', 'shop', 'store', 'merchant', 'vendor', 'trader',
]);

/** Convert non-gold currency amounts to gold equivalent */
function convertToGold(amount: number, currency: string): number {
  switch (currency) {
    case 'pp': return amount * 10;
    case 'sp': return Math.round(amount / 10 * 100) / 100 || 1; // min 1 gp
    case 'cp': return Math.round(amount / 100 * 100) / 100 || 1;
    case 'ep': return Math.round(amount / 2 * 100) / 100 || 1;
    default: return amount;
  }
}

function isValidItemName(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length < 3 || trimmed.length > 60) return false;
  if (EXCLUDED_SHOP_NAMES.has(trimmed.toLowerCase())) return false;
  // Must have at least one letter
  if (!/[a-zA-Z]/.test(trimmed)) return false;
  return true;
}

export function parseShopItemMatches(text: string): ParsedShopItem[] {
  const items: ParsedShopItem[] = [];
  const seen = new Set<string>(); // Deduplicate by normalized name

  for (const pattern of SHOP_ITEM_PATTERNS) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);

    while ((match = regex.exec(text)) !== null) {
      let itemName: string;
      let cost: number;

      // Pattern index 3 has reversed capture groups (price first, then name)
      // Detect by checking if match[1] is a number and match[2] is a name
      const firstIsNumber = /^\d+$/.test(match[1]?.trim() || '');
      const secondIsName = match[2] && /[a-zA-Z]/.test(match[2]);
      
      if (firstIsNumber && secondIsName) {
        cost = parseInt(match[1], 10);
        itemName = match[2]?.trim() || '';
      } else {
        itemName = match[1]?.trim() || '';
        cost = parseInt(match[2], 10);
      }

      // Convert multi-currency to gold equivalent
      // match[3] will contain the currency type for the multi-currency pattern
      const currencyType = match[3]?.toLowerCase();
      if (currencyType) {
        cost = convertToGold(cost, currencyType);
      }

      if (!isValidItemName(itemName) || isNaN(cost) || cost <= 0) continue;

      // Clean trailing punctuation
      itemName = itemName.replace(/[.,;:!?]+$/, '').trim();

      const key = itemName.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      const start = Math.max(0, match.index - 30);
      const end = Math.min(text.length, match.index + match[0].length + 30);
      const sourceText = text.slice(start, end).replace(/\s+/g, ' ').trim();

      items.push({
        name: itemName,
        itemType: guessItemType(itemName),
        costGold: cost,
        rarity: guessRarity(itemName),
        description: '',
        lore: '',
        sourceText: sourceText.slice(0, 100),
        confidence: 'medium' as ConfidenceLevel,
      });
    }
  }

  return items;
}
