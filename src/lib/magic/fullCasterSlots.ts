// Full Caster Spell Slot Progression Table
// D&D 5e PHB Table - Spell Slots per Spell Level

export interface SpellSlotLevel {
  1?: number;
  2?: number;
  3?: number;
  4?: number;
  5?: number;
  6?: number;
  7?: number;
  8?: number;
  9?: number;
}

/**
 * Full caster spell slot progression (Wizard, Sorcerer, Cleric, Druid, Bard)
 * Key = caster level, Value = slots per spell level
 */
export const FULL_CASTER_SLOTS: Record<number, SpellSlotLevel> = {
  1:  { 1: 2 },
  2:  { 1: 3 },
  3:  { 1: 4, 2: 2 },
  4:  { 1: 4, 2: 3 },
  5:  { 1: 4, 2: 3, 3: 2 },
  6:  { 1: 4, 2: 3, 3: 3 },
  7:  { 1: 4, 2: 3, 3: 3, 4: 1 },
  8:  { 1: 4, 2: 3, 3: 3, 4: 2 },
  9:  { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 },
  10: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
  11: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 },
  12: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 },
  13: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1 },
  14: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1 },
  15: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1 },
  16: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1 },
  17: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1, 9: 1 },
  18: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 1, 7: 1, 8: 1, 9: 1 },
  19: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 1, 8: 1, 9: 1 },
  20: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 2, 8: 1, 9: 1 },
};

/**
 * Get spell slots for a given caster level
 */
export function getSpellSlotsForLevel(casterLevel: number): SpellSlotLevel {
  const clampedLevel = Math.max(0, Math.min(casterLevel, 20));
  return FULL_CASTER_SLOTS[clampedLevel] ?? {};
}

/**
 * Get maximum spell level available at a caster level
 */
export function getMaxSpellLevel(casterLevel: number): number {
  if (casterLevel < 1) return 0;
  if (casterLevel < 3) return 1;
  if (casterLevel < 5) return 2;
  if (casterLevel < 7) return 3;
  if (casterLevel < 9) return 4;
  if (casterLevel < 11) return 5;
  if (casterLevel < 13) return 6;
  if (casterLevel < 15) return 7;
  if (casterLevel < 17) return 8;
  return 9;
}
