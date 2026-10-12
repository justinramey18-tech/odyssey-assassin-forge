// How each spell resolves, from its own fields: a roll to hit, a saving throw, an automatic hit,
// healing, or a pure effect with no dice. Pure functions only (no React, no network), so they are tested.
//
//   attack  - damage + melee/ranged attack (or damage with no attack type and no save): d20 to hit vs AC
//   save    - damage + a save (attackType 'save', or a save stat): each target saves vs the caster's DC, half on a success
//   auto    - damage + attackType 'auto' or 'none': hits, no roll to hit, no save
//   heal    - healing and no damage: rolls healing, lands on whoever the caster picks
//   utility - no damage and no healing (buffs, control, tricks): no dice; the DM narrates the effect

import { parseDiceFormula, scaleForUpcast, formatDiceFormula } from '@/lib/magic/castResolver';

export type SpellMode = 'attack' | 'save' | 'auto' | 'heal' | 'utility';

export interface SpellFacts {
  attackType?: string | null;
  damageFormula?: string | null;
  healingFormula?: string | null;
  saveStat?: string | null;
  range?: string | null;
  description?: string | null;
}

/** Most enemies an area spell can hit in a Live NPC fight. */
export const AREA_MAX_TARGETS = 3;

/** "1d8+mod" with mod = 3 becomes "1d8+3"; "2d6 - mod" with mod = 2 becomes "2d6-2". */
export function resolveMod(formula: string, mod: number): string {
  return formula
    .replace(/([+-])\s*(?:spellcasting\s+)?mod(?:ifier)?\b/gi, (_m, sign: string) => {
      const v = sign === '-' ? -mod : mod;
      return v >= 0 ? `+${v}` : `${v}`;
    })
    .replace(/\b(?:spellcasting\s+)?mod(?:ifier)?\b/gi, String(mod));
}

/** True when a formula field actually holds dice or a positive number. */
export function hasDice(formula: string | null | undefined): boolean {
  if (!formula || typeof formula !== 'string' || !formula.trim()) return false;
  const p = parseDiceFormula(resolveMod(formula, 0));
  return !!p && (p.count > 0 || p.flat > 0);
}

const STAT_WORDS: Record<string, string> = {
  str: 'STR', strength: 'STR', dex: 'DEX', dexterity: 'DEX', con: 'CON', constitution: 'CON',
  int: 'INT', intelligence: 'INT', wis: 'WIS', wisdom: 'WIS', cha: 'CHA', charisma: 'CHA',
};
const TEXT_SAVE_RE = /\b(STR|DEX|CON|INT|WIS|CHA|Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\b\s+sav(?:e|ing\s+throw)/i;
const TEXT_ATTACK_RE = /\b(?:melee|ranged)\s+spell\s+attack\b/i;

/** The save stat field, cleaned ("none" and blanks count as no save). */
function fieldSaveStat(v: unknown): string {
  const t = String(v ?? '').trim();
  if (!t || /^none$/i.test(t)) return '';
  return STAT_WORDS[t.toLowerCase()] ?? t.toUpperCase().slice(0, 3);
}

/** The ability the target saves with: the save stat field, else the rules text ("DC 13 WIS save"), else DEX. */
export function saveStatOf(s: SpellFacts): string {
  const field = fieldSaveStat(s.saveStat);
  if (field) return field;
  const m = TEXT_SAVE_RE.exec(String(s.description ?? ''));
  return m ? STAT_WORDS[m[1].toLowerCase()] ?? 'DEX' : 'DEX';
}

/**
 * Which way this spell resolves. The spell's own fields decide; the rules text is only read when a damage
 * spell has no attack type and no save stat (e.g. "Creatures make DEX save..." or "Ranged spell attack: 2d8").
 */
export function spellModeOf(s: SpellFacts): SpellMode {
  const damage = hasDice(s.damageFormula);
  const healing = hasDice(s.healingFormula);
  if (!damage) return healing ? 'heal' : 'utility';
  const atk = String(s.attackType ?? '').trim().toLowerCase();
  if (atk === 'melee' || atk === 'ranged') return 'attack';
  if (atk === 'save') return 'save';
  if (atk === 'auto' || atk === 'none') return 'auto';
  if (fieldSaveStat(s.saveStat)) return 'save';
  const text = String(s.description ?? '');
  if (TEXT_ATTACK_RE.test(text)) return 'attack';
  if (TEXT_SAVE_RE.test(text)) return 'save';
  return 'attack';
}

const AREA_RE = /\b\d+[-\s]?(?:foot|feet|ft\.?)[-\s]?(?:radius|cone|line|cube|sphere|cylinder|square|emanation|wide)\b|\b(?:each|every|all)\s+(?:other\s+)?(?:creatures?|allies|ally)\b|\bcreatures?\s+of\s+your\s+choice\b|\bany\s+number\s+of\s+(?:creatures|targets|allies)\b|\bup\s+to\s+(?:two|three|four|five|six|2|3|4|5|6)\s+(?:creatures|targets|allies)\b/i;

/** True when the spell hits an area or several creatures (in a fight it lands on up to AREA_MAX_TARGETS enemies, or allies for a heal). */
export function isAreaSpell(s: SpellFacts): boolean {
  return AREA_RE.test(`${s.range ?? ''} ${s.description ?? ''}`);
}

/** Spellcasting modifier from the spell attack bonus and the character's level (bonus minus proficiency). */
export function spellcastingMod(level: number | null | undefined, spellAttackBonus: number | null | undefined): number {
  const lvl = Number.isFinite(level) ? Math.min(20, Math.max(1, Math.round(level as number))) : 1;
  const prof = Math.ceil(lvl / 4) + 1;
  const atk = Number.isFinite(spellAttackBonus) ? Math.round(spellAttackBonus as number) : prof;
  return atk - prof;
}

export interface SpellDice {
  count: number;
  die: number;
  bonus: number;
  /** e.g. "3d8+3". */
  label: string;
}

/** A formula's dice with "mod" filled in, plus one die per slot level above the spell's own level. */
export function spellDice(formula: string | null | undefined, mod: number, spellLevel?: number | null, slotLevel?: number | null): SpellDice | null {
  if (!hasDice(formula)) return null;
  const parsed = parseDiceFormula(resolveMod(formula as string, mod));
  if (!parsed) return null;
  const scaled = typeof spellLevel === 'number' && spellLevel > 0 && typeof slotLevel === 'number'
    ? scaleForUpcast(parsed, spellLevel, slotLevel)
    : parsed;
  return { count: Math.max(0, scaled.count), die: scaled.die > 0 ? scaled.die : 4, bonus: scaled.flat, label: formatDiceFormula(scaled) };
}

const FINAL = 'These dice results are FINAL. Narrate around them; do not roll again or override them.';

/** DM text for a saving-throw spell. */
export function saveSpellText(o: { saveStat: string; dc: number; damageLabel: string; rolls: number[]; total: number; area: boolean }): string {
  const who = o.area ? 'Each creature in the area' : 'The target';
  const stat = String(o.saveStat || 'DEX').toUpperCase();
  return `\n\n[DICE] SAVING-THROW SPELL: there is no attack roll. ${who} makes a ${stat} save against DC ${o.dc}. Damage rolled: ${o.rolls.length ? o.rolls.join(' + ') : '0'} (${o.damageLabel}) = ${o.total}. A creature that fails takes ${o.total}; a creature that succeeds takes half (${Math.floor(o.total / 2)}). In a Live NPC fight the ⚔ lines say who saved. ${FINAL}`;
}

/** DM text for a spell that hits automatically. */
export function autoSpellText(o: { damageLabel: string; rolls: number[]; total: number; area: boolean }): string {
  return `\n\n[DICE] AUTOMATIC HIT: no attack roll and no save; it lands on ${o.area ? 'every creature it targets' : 'the target'}. Damage: ${o.rolls.length ? o.rolls.join(' + ') : '0'} (${o.damageLabel}) = ${o.total}. ${FINAL}`;
}

/** DM text for a spell with no damage and no healing. */
export function utilitySpellText(tableD20?: number): string {
  return `\n\n[SPELL] No attack roll, no damage and no healing: narrate the effect exactly as the rules text says${typeof tableD20 === 'number' ? `, using the table row for d20 ${tableD20}` : ''}. Do not invent damage or HP changes for it.`;
}

/** Added to a healing spell's text: the app applies the HP, so the DM must not change it again. */
export const HEAL_APPLIED_NOTE = ' The app applies this healing to whoever the caster picks; do NOT change any character\'s HP numbers for it.';
