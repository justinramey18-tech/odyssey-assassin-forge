// Healing consumables: detecting them and parsing their dice.
//
// characterContext.consumables only carries { name, quantity, type }, so the
// healing dice have to be looked up by name against the static consumable
// registry and the shop catalog (shop-bought potions are not in the registry).

import { allConsumables } from '@/lib/consumables';
import { catalogConsumables } from '@/lib/shop/catalog/consumables';

export interface HealingDice {
  count: number;
  die: number;
  bonus: number;
  /** Human-readable formula, e.g. "2d4+2" */
  formula: string;
}

function normalize(name: string): string {
  return name.trim().toLowerCase();
}

/** Effect text for a consumable name, from either source. */
function lookupEffect(name: string): string | null {
  const key = normalize(name);
  const registry = allConsumables.find(c => normalize(c.name) === key);
  if (registry?.effect) return registry.effect;
  const catalog = catalogConsumables.find(c => normalize(c.name) === key);
  if (catalog?.effect) return catalog.effect;
  return null;
}

/**
 * Parse a healing dice formula out of an effect string.
 * Matches "Restores 2d4+2 HP", "Regain 4d4 + 4 hit points", etc.
 * Returns null when the text is not about restoring health.
 */
export function parseHealingFormula(effect: string | null | undefined): HealingDice | null {
  if (!effect) return null;
  const text = effect.toLowerCase();

  const healsHealth = /(restore|regain|heal|recover)/.test(text)
    && /(hp|hit point)/.test(text);
  if (!healsHealth) return null;
  // Temporary hit points are not healing.
  if (/temporary hit point|temp hp/.test(text)) return null;

  const m = /(\d{1,2})\s*d\s*(\d{1,3})\s*(?:([+-])\s*(\d{1,3}))?/.exec(text);
  if (!m) return null;

  const count = Math.min(20, Math.max(1, parseInt(m[1], 10)));
  const die = Math.max(2, parseInt(m[2], 10));
  const rawBonus = m[4] ? parseInt(m[4], 10) : 0;
  const bonus = m[3] === '-' ? -rawBonus : rawBonus;

  if (!Number.isFinite(count) || !Number.isFinite(die) || !Number.isFinite(bonus)) return null;

  const formula = `${count}d${die}${bonus > 0 ? `+${bonus}` : bonus < 0 ? `${bonus}` : ''}`;
  return { count, die, bonus, formula };
}

/** Healing dice for a consumable by name, or null if it is not a healing item. */
export function getHealingDiceForItem(name: string): HealingDice | null {
  return parseHealingFormula(lookupEffect(name));
}

/**
 * Prompt sent to the DM after a healing item resolves locally.
 * HP is already applied — the DM must not touch the sheet, just acknowledge it.
 */
export function buildHealingPrompt(opts: {
  characterName: string;
  itemName: string;
  rolls: number[];
  bonus: number;
  healed: number;
  newHP: number;
  maxHP: number;
  wasFullHealth: boolean;
}): string {
  const { characterName, itemName, rolls, bonus, healed, newHP, maxHP, wasFullHealth } = opts;
  const breakdown = `${rolls.join(' + ')}${bonus ? ` ${bonus > 0 ? '+' : '-'} ${Math.abs(bonus)}` : ''}`;

  const outcome = wasFullHealth
    ? `${characterName} was already at full health, so the potion did nothing.`
    : `It restored ${healed} HP. ${characterName} is now at ${newHP}/${maxHP} HP.`;

  return `[ITEM USED — ALREADY RESOLVED] ${characterName} drinks a ${itemName}. Roll: ${breakdown} = ${rolls.reduce((a, b) => a + b, 0) + bonus}. ${outcome}

Respond with ONE OR TWO SHORT LINES only: acknowledge the potion being drunk and the relief it brings. Do not advance the scene, do not introduce events or NPCs, do not roll anything, and do NOT change any character numbers — the HP change is already applied. Do not include a sync footer.`;
}
