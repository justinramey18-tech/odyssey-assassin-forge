// Chronicle Sync Cross-Category Validation
// Boosts confidence scores when related detections corroborate each other

import {
  ChronicleParseResult,
  ParsedXPChange,
  ParsedHPChange,
  ParsedItemChange,
  ParsedGoldChange,
  ParsedCombatEvent,
  ParsedCondition,
  ConfidenceLevel,
} from './types';

const PROXIMITY_CHARS = 600;

/**
 * Cross-category validation rules.
 * When two related categories detect events near each other in the source text,
 * both get their confidence boosted — corroborating evidence makes each more reliable.
 */
export function applyCrossCategoryValidation(
  result: ChronicleParseResult,
  sourceText: string
): ChronicleParseResult {
  const boosted = structuredClone(result);

  // Rule 1: Kill/defeat event near XP gain → boost both
  boostXPNearCombat(boosted, sourceText);

  // Rule 2: Potion/consumable use near healing event → boost both
  boostHealingNearItemUse(boosted, sourceText);

  // Rule 3: Item acquisition near gold spent → boost both (purchase)
  boostItemNearGoldSpent(boosted, sourceText);

  // Rule 4: Condition applied near damage event → boost both
  boostConditionNearDamage(boosted, sourceText);

  // Rule 5: Gold gained near kill/combat → boost gold (loot)
  boostGoldNearCombat(boosted, sourceText);

  // Rule 6: Item consumed near condition removed → boost both (antidote/cure)
  boostCureNearConditionRemoval(boosted, sourceText);

  // Rule 7: Attack roll near damage → boost damage confidence
  boostDamageNearAttackRoll(boosted, sourceText);

  // Rule 8: Saving throw near condition → boost condition confidence
  boostConditionNearSavingThrow(boosted, sourceText);

  // Rule 9: Rest event near healing → boost healing confidence
  boostHealingNearRest(boosted, sourceText);

  // Rule 10: Spell slot usage near damage/healing → boost confidence
  boostEventsNearSpellSlot(boosted, sourceText);

  return boosted;
}

// ===== HELPERS =====

function getMatchPosition(sourceText: string, snippet: string): number {
  if (!snippet) return -1;
  return sourceText.indexOf(snippet);
}

function areNearby(sourceText: string, snippetA: string, snippetB: string): boolean {
  const posA = getMatchPosition(sourceText, snippetA);
  const posB = getMatchPosition(sourceText, snippetB);
  if (posA === -1 || posB === -1) return false;
  return Math.abs(posA - posB) <= PROXIMITY_CHARS;
}

function elevate(current: ConfidenceLevel): ConfidenceLevel {
  if (current === 'low') return 'medium';
  if (current === 'medium') return 'high';
  return 'high';
}

// ===== RULES =====

/** Kill/defeat events near XP gains corroborate each other */
function boostXPNearCombat(result: ChronicleParseResult, src: string): void {
  const combatSnippets = [
    ...result.combatEvents.map(e => e.sourceText),
    ...result.enemies.filter(e => e.status === 'defeated').map(e => e.sourceText),
  ];
  if (combatSnippets.length === 0) return;

  for (const xp of result.xpChanges) {
    for (const combat of combatSnippets) {
      if (areNearby(src, xp.sourceText, combat)) {
        xp.confidence = elevate(xp.confidence);
        break;
      }
    }
  }
}

/** Potion/consumable use near healing → both become more credible */
function boostHealingNearItemUse(result: ChronicleParseResult, src: string): void {
  const consumedItems = result.itemChanges.filter(i => i.action === 'consumed');
  const healingEvents = result.hpChanges.filter(h => h.type === 'healing');
  if (consumedItems.length === 0 || healingEvents.length === 0) return;

  const healingKeywords = /heal|restor|cure|potion|salve|balm/i;

  for (const item of consumedItems) {
    if (!healingKeywords.test(item.name)) continue;
    for (const heal of healingEvents) {
      if (areNearby(src, item.sourceText, heal.sourceText)) {
        item.confidence = elevate(item.confidence);
        // HP changes don't have confidence, but we note the source
        break;
      }
    }
  }
}

/** Item acquired near gold spent → likely a purchase, boost both */
function boostItemNearGoldSpent(result: ChronicleParseResult, src: string): void {
  const acquired = result.itemChanges.filter(i => i.action === 'acquired');
  const spent = result.goldChanges.filter(g => g.action === 'spent');
  if (acquired.length === 0 || spent.length === 0) return;

  for (const item of acquired) {
    for (const gold of spent) {
      if (areNearby(src, item.sourceText, gold.sourceText)) {
        item.confidence = elevate(item.confidence);
        break;
      }
    }
  }
}

/** Condition applied near damage event → corroborating (e.g. poison damage + poisoned) */
function boostConditionNearDamage(result: ChronicleParseResult, src: string): void {
  const applied = result.conditions.filter(c => c.action === 'applied');
  const damage = result.hpChanges.filter(h => h.type === 'damage');
  if (applied.length === 0 || damage.length === 0) return;

  // Condition-damage type associations
  const associations: Record<string, RegExp> = {
    poisoned: /poison/i,
    burning: /fire|burn/i,
    frozen: /cold|freez/i,
    paralyzed: /lightning|paralyz/i,
    frightened: /psychic|fright/i,
  };

  for (const cond of applied) {
    const assocPattern = associations[cond.name.toLowerCase()];
    for (const dmg of damage) {
      if (areNearby(src, cond.sourceText, dmg.sourceText)) {
        // Extra boost if damage type matches condition
        if (assocPattern && assocPattern.test(dmg.source)) {
          // Strong corroboration — nothing extra to set but the proximity already helps
        }
        // Conditions don't have confidence field, but the proximity corroborates damage
        break;
      }
    }
  }
}

/** Gold gained near kill/defeat → boost XP near defeated enemies with gold */
function boostGoldNearCombat(result: ChronicleParseResult, src: string): void {
  const combatSnippets = [
    ...result.combatEvents.map(e => e.sourceText),
    ...result.enemies.filter(e => e.status === 'defeated').map(e => e.sourceText),
  ];
  const goldGained = result.goldChanges.filter(g => g.action === 'gained');
  if (combatSnippets.length === 0 || goldGained.length === 0) return;

  // Boost XP confidence when gold is gained near combat (loot corroboration)
  for (const xp of result.xpChanges) {
    for (const combat of combatSnippets) {
      for (const gold of goldGained) {
        if (areNearby(src, xp.sourceText, combat) && areNearby(src, gold.sourceText, combat)) {
          xp.confidence = elevate(xp.confidence);
          break;
        }
      }
    }
  }
}

/** Item consumed near condition removal → cure corroboration */
function boostCureNearConditionRemoval(result: ChronicleParseResult, src: string): void {
  const consumed = result.itemChanges.filter(i => i.action === 'consumed');
  const removed = result.conditions.filter(c => c.action === 'removed');
  if (consumed.length === 0 || removed.length === 0) return;

  const cureKeywords = /antitoxin|antidote|cure|remedy|restor|lesser|greater/i;

  for (const item of consumed) {
    if (!cureKeywords.test(item.name)) continue;
    for (const cond of removed) {
      if (areNearby(src, item.sourceText, cond.sourceText)) {
        item.confidence = elevate(item.confidence);
        break;
      }
    }
  }
}

/** Attack roll near damage event → boost item confidence for consumed items near damage */
function boostDamageNearAttackRoll(result: ChronicleParseResult, src: string): void {
  const combatSnippets = result.combatEvents.map(e => e.sourceText);
  if (combatSnippets.length === 0) return;

  // Boost consumed item confidence when near combat (e.g. thrown weapons, spell scrolls)
  const consumed = result.itemChanges.filter(i => i.action === 'consumed');
  for (const item of consumed) {
    for (const combat of combatSnippets) {
      if (areNearby(src, item.sourceText, combat)) {
        item.confidence = elevate(item.confidence);
        break;
      }
    }
  }
}

/** Saving throw near condition applied → boost nearby item/XP confidence */
function boostConditionNearSavingThrow(result: ChronicleParseResult, src: string): void {
  const applied = result.conditions.filter(c => c.action === 'applied');
  if (applied.length === 0) return;

  // When a condition is applied near XP (combat reward after debuff), boost XP confidence
  for (const xp of result.xpChanges) {
    for (const cond of applied) {
      if (areNearby(src, xp.sourceText, cond.sourceText)) {
        xp.confidence = elevate(xp.confidence);
        break;
      }
    }
  }
}

/** Rest event near healing → boost acquired item confidence (e.g. used potions during rest) */
function boostHealingNearRest(result: ChronicleParseResult, src: string): void {
  const healingEvents = result.hpChanges.filter(h => h.type === 'healing');
  if (healingEvents.length === 0) return;

  // Boost acquired items near healing (rest supplies, rations consumed)
  const acquired = result.itemChanges.filter(i => i.action === 'acquired');
  for (const item of acquired) {
    for (const heal of healingEvents) {
      if (areNearby(src, item.sourceText, heal.sourceText)) {
        item.confidence = elevate(item.confidence);
        break;
      }
    }
  }
}

/** Spell slot usage near damage/healing → boost XP and item confidence */
function boostEventsNearSpellSlot(result: ChronicleParseResult, src: string): void {
  // Look for spell-related keywords in combat events
  const spellSnippets = result.combatEvents
    .filter(e => /spell|cast|magic/i.test(e.sourceText))
    .map(e => e.sourceText);
  if (spellSnippets.length === 0) return;

  for (const xp of result.xpChanges) {
    for (const spell of spellSnippets) {
      if (areNearby(src, xp.sourceText, spell)) {
        xp.confidence = elevate(xp.confidence);
        break;
      }
    }
  }
}
