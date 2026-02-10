// Chronicle Sync: Attack Roll Detection
// Parses attack rolls, hit/miss results, AC targets, and sneak attack damage

import { ConfidenceLevel } from '../types';

export interface ParsedAttackRoll {
  roll?: number;
  targetAC?: number;
  result: 'hit' | 'miss' | 'critical_hit' | 'critical_miss' | 'unknown';
  attackBonus?: number;
  weaponName?: string;
  isSneakAttack?: boolean;
  sneakAttackDamage?: number;
  sourceText: string;
  confidence: ConfidenceLevel;
  /** @internal Match position for sneak attack proximity linking */
  _matchIndex?: number;
}

// ===== ATTACK ROLL PATTERNS =====

const ATTACK_PATTERNS = [
  // "rolls 18 to hit (AC 15) -- hit!", "attack roll: 12 vs AC 16 -- miss"
  /(?:rolls?|attack\s+roll)[:\s]+(\d+)\s+(?:to\s+hit\s*)?(?:\(?AC\s*(\d+)\)?)?\s*(?:[–—-]+\s*)?(hit|miss|critical)?/gi,
  // "18 to hit", "22 to hit against AC 15"
  /(\d+)\s+to\s+hit(?:\s+(?:against|vs\.?)\s+AC\s*(\d+))?/gi,
  // "swings the greataxe -- 22 to hit", "fires an arrow -- 17 to hit"
  /(?:swings?|fires?|thrusts?|throws?|strikes?\s+with)\s+(?:the\s+|a\s+)?([a-zA-Z][a-zA-Z\s]+?)\s*[–—-]+\s*(\d+)\s+to\s+hit/gi,
  // "attacks with a longsword: 19 to hit"
  /attacks?\s+with\s+(?:a\s+|the\s+)?([a-zA-Z][a-zA-Z\s]+?)[:\s]+(\d+)\s+to\s+hit/gi,
  // "+7 to hit", "attack bonus: +5"
  /(?:attack\s+bonus|to\s+hit)[:\s]+\+(\d+)/gi,
  // "the attack hits", "the attack misses"
  /the\s+attack\s+(hits?|misses?|is\s+a\s+(?:hit|miss|critical))/gi,
  // "natural 20 to hit" or "nat 1 on the attack"
  /(?:nat(?:ural)?)\s+(20|1)\s+(?:to\s+hit|on\s+(?:the\s+)?attack)/gi,
];

// Sneak attack patterns
const SNEAK_ATTACK_PATTERNS = [
  // "adds 3d6 sneak attack damage", "sneak attack for 14 extra damage"
  /(?:adds?|deals?|rolls?)\s+(\d+d\d+)\s+sneak\s+attack\s+damage/gi,
  /sneak\s+attack\s+(?:for|dealing)\s+(\d+)\s+(?:extra\s+)?damage/gi,
  // "sneak attack damage: 14", "sneak attack: 3d6 (14)"
  /sneak\s+attack(?:\s+damage)?[:\s]+(?:\d+d\d+\s*\()?(\d+)\)?/gi,
];

export function parseAttackRolls(text: string): ParsedAttackRoll[] {
  const attacks: ParsedAttackRoll[] = [];
  const seen = new Set<number>();

  for (const pattern of ATTACK_PATTERNS) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((match = regex.exec(text)) !== null) {
      if (seen.has(match.index)) continue;
      seen.add(match.index);

      const fullMatch = match[0];
      let roll: number | undefined;
      let targetAC: number | undefined;
      let result: ParsedAttackRoll['result'] = 'unknown';
      let attackBonus: number | undefined;
      let weaponName: string | undefined;

      // Extract numbers from capture groups
      for (let i = 1; i < match.length; i++) {
        const val = match[i];
        if (!val) continue;

        const num = parseInt(val, 10);
        if (!isNaN(num)) {
          if (fullMatch.toLowerCase().includes('bonus') || fullMatch.toLowerCase().includes('+' + val)) {
            attackBonus = num;
          } else if (fullMatch.toLowerCase().includes('ac') && num >= 5 && num <= 30 && !roll) {
            // Could be AC
            if (i > 1 || /ac/i.test(fullMatch)) targetAC = num;
            else roll = num;
          } else if (num >= 1 && num <= 30 && roll === undefined) {
            roll = num;
          } else if (num >= 5 && num <= 30 && targetAC === undefined) {
            targetAC = num;
          }
        } else if (/hit|miss|critical/i.test(val)) {
          if (/critical/i.test(val) || /critical/i.test(fullMatch)) result = 'critical_hit';
          else if (/hit/i.test(val)) result = 'hit';
          else if (/miss/i.test(val)) result = 'miss';
        } else if (val.length > 2 && !/^\d/.test(val)) {
          weaponName = val.trim().replace(/[,;:.!?]+$/, '');
        }
      }

      // Determine result from roll if not explicit
      if (result === 'unknown') {
        if (roll === 20) result = 'critical_hit';
        else if (roll === 1) result = 'critical_miss';
        else if (roll !== undefined && targetAC !== undefined) {
          result = roll >= targetAC ? 'hit' : 'miss';
        } else if (/\bhit\b/i.test(fullMatch)) result = 'hit';
        else if (/\bmiss\b/i.test(fullMatch)) result = 'miss';
      }

      attacks.push({
        roll,
        targetAC,
        result,
        attackBonus,
        weaponName,
        sourceText: fullMatch,
        confidence: roll !== undefined ? (targetAC !== undefined ? 'high' : 'medium') : 'low',
        _matchIndex: match.index, // Store for sneak attack proximity linking
      });
    }
  }

  // Check for sneak attack on nearby attacks (use stored _matchIndex for accurate proximity)
  for (const pattern of SNEAK_ATTACK_PATTERNS) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((match = regex.exec(text)) !== null) {
      const sneakDmg = parseInt(match[1], 10);
      // Find nearest attack within 200 chars using stored index
      const nearest = attacks.reduce<ParsedAttackRoll | null>((best, atk) => {
        const atkPos = atk._matchIndex ?? -1;
        if (atkPos === -1) return best;
        const dist = Math.abs(atkPos - match!.index);
        const bestPos = best?._matchIndex ?? -1;
        if (dist < 200 && (bestPos === -1 || dist < Math.abs(bestPos - match!.index))) {
          return atk;
        }
        return best;
      }, null);

      if (nearest && !isNaN(sneakDmg)) {
        nearest.isSneakAttack = true;
        nearest.sneakAttackDamage = sneakDmg;
      }
    }
  }

  // Clean up internal index before returning
  for (const atk of attacks) {
    delete atk._matchIndex;
  }

  return attacks;
}
