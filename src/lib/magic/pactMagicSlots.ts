// Warlock Pact Magic Spell Slots
// Separate progression from regular spell slots per 5e rules

export interface PactSlots {
  slotLevel: number;  // All pact slots are the same level
  slotCount: number;  // Number of pact slots available
}

/**
 * Warlock pact magic slot progression
 * Warlocks have fewer slots but they're all at the highest level
 * and regenerate on short rest
 */
export const PACT_MAGIC_SLOTS: Record<number, PactSlots> = {
  1:  { slotLevel: 1, slotCount: 1 },
  2:  { slotLevel: 1, slotCount: 2 },
  3:  { slotLevel: 2, slotCount: 2 },
  4:  { slotLevel: 2, slotCount: 2 },
  5:  { slotLevel: 3, slotCount: 2 },
  6:  { slotLevel: 3, slotCount: 2 },
  7:  { slotLevel: 4, slotCount: 2 },
  8:  { slotLevel: 4, slotCount: 2 },
  9:  { slotLevel: 5, slotCount: 2 },
  10: { slotLevel: 5, slotCount: 2 },
  11: { slotLevel: 5, slotCount: 3 },
  12: { slotLevel: 5, slotCount: 3 },
  13: { slotLevel: 5, slotCount: 3 },
  14: { slotLevel: 5, slotCount: 3 },
  15: { slotLevel: 5, slotCount: 3 },
  16: { slotLevel: 5, slotCount: 3 },
  17: { slotLevel: 5, slotCount: 4 },
  18: { slotLevel: 5, slotCount: 4 },
  19: { slotLevel: 5, slotCount: 4 },
  20: { slotLevel: 5, slotCount: 4 },
};

/**
 * Get pact magic slots for a warlock level
 */
export function getPactSlotsForLevel(warlockLevel: number): PactSlots | null {
  if (warlockLevel < 1) return null;
  const clampedLevel = Math.min(warlockLevel, 20);
  return PACT_MAGIC_SLOTS[clampedLevel] ?? null;
}

/**
 * Check if pact slots should regenerate (on short rest)
 */
export function pactSlotsRegenerateOnShortRest(): boolean {
  return true; // Always true for warlock pact magic
}
