// Multiclass Spell Slot Tests
// Tests for combined caster level and spell slot progression

import { describe, it, expect } from 'vitest';
import {
  getMulticlassSpellSlots,
  getMulticlassMaxSpellLevel,
  hasSpellcasting,
} from './multiclassSlots';
import { FULL_CASTER_SLOTS } from './fullCasterSlots';
import { PACT_MAGIC_SLOTS } from './pactMagicSlots';

describe('getMulticlassSpellSlots', () => {
  describe('Single Class Full Casters', () => {
    it('returns correct slots for Wizard 1', () => {
      const slots = getMulticlassSpellSlots('wizard', 1, {});
      expect(slots.regularSlots[1]).toBe(2); // 2 first level slots
      expect(slots.regularSlots[2]).toBeUndefined();
      expect(slots.pactSlots).toBeNull();
    });

    it('returns correct slots for Cleric 5', () => {
      const slots = getMulticlassSpellSlots('cleric', 5, {});
      expect(slots.regularSlots[1]).toBe(4);
      expect(slots.regularSlots[2]).toBe(3);
      expect(slots.regularSlots[3]).toBe(2);
      expect(slots.regularSlots[4]).toBeUndefined();
    });

    it('returns correct slots for Wizard 20', () => {
      const slots = getMulticlassSpellSlots('wizard', 20, {});
      expect(slots.regularSlots[1]).toBe(4);
      expect(slots.regularSlots[9]).toBe(1);
    });
  });

  describe('Warlock Pact Magic', () => {
    it('returns pact slots for Warlock only', () => {
      const slots = getMulticlassSpellSlots('warlock', 3, {});
      expect(slots.pactSlots).not.toBeNull();
      expect(slots.pactSlots?.slotCount).toBe(2);
      expect(slots.pactSlots?.slotLevel).toBe(2);
      // Warlock should NOT have regular slots (pact only)
      expect(slots.regularSlots[1]).toBeUndefined();
    });

    it('Warlock 9 has 5th level pact slots', () => {
      const slots = getMulticlassSpellSlots('warlock', 9, {});
      expect(slots.pactSlots?.slotLevel).toBe(5);
      expect(slots.pactSlots?.slotCount).toBe(2);
    });
  });

  describe('Rogue (No Base Spellcasting)', () => {
    it('returns no slots for base Rogue', () => {
      const slots = getMulticlassSpellSlots('rogue', 10, {});
      expect(Object.keys(slots.regularSlots).length).toBe(0);
      expect(slots.pactSlots).toBeNull();
    });
  });

  describe('Multiclass Combinations', () => {
    it('combines full caster levels for spell slots', () => {
      // Wizard 3 + Cleric 2 = Caster level 5
      const slots = getMulticlassSpellSlots('wizard', 3, { cleric: 2 });
      
      // Should have slots as if caster level 5
      expect(slots.regularSlots[1]).toBe(4);
      expect(slots.regularSlots[2]).toBe(3);
      expect(slots.regularSlots[3]).toBe(2);
    });

    it('Warlock multiclass adds pact slots separately', () => {
      // Wizard 5 + Warlock 3
      const slots = getMulticlassSpellSlots('wizard', 5, { warlock: 3 });
      
      // Regular slots from Wizard 5
      expect(slots.regularSlots[1]).toBe(4);
      expect(slots.regularSlots[2]).toBe(3);
      expect(slots.regularSlots[3]).toBe(2);
      
      // Pact slots from Warlock 3
      expect(slots.pactSlots).not.toBeNull();
      expect(slots.pactSlots?.slotCount).toBe(2);
      expect(slots.pactSlots?.slotLevel).toBe(2);
    });

    it('three-way multiclass calculates correctly', () => {
      // Wizard 5 + Cleric 5 + Bard 5 = Caster level 15
      const slots = getMulticlassSpellSlots('wizard', 5, { cleric: 5, bard: 5 });
      
      // Should have slots as caster level 15
      expect(slots.regularSlots[8]).toBe(1);
    });
  });
});

describe('getMulticlassMaxSpellLevel', () => {
  it('returns correct max level for Wizard 1', () => {
    expect(getMulticlassMaxSpellLevel('wizard', 1, {})).toBe(1);
  });

  it('returns correct max level for Wizard 5', () => {
    expect(getMulticlassMaxSpellLevel('wizard', 5, {})).toBe(3);
  });

  it('returns correct max level for Wizard 9', () => {
    expect(getMulticlassMaxSpellLevel('wizard', 9, {})).toBe(5);
  });

  it('returns correct max level for multiclass', () => {
    // Wizard 3 + Cleric 4 = caster level 7 = 4th level spells
    expect(getMulticlassMaxSpellLevel('wizard', 3, { cleric: 4 })).toBe(4);
  });

  it('returns 0 for Rogue with no multiclass', () => {
    expect(getMulticlassMaxSpellLevel('rogue', 10, {})).toBe(0);
  });

  it('Warlock max level based on pact slot level', () => {
    expect(getMulticlassMaxSpellLevel('warlock', 5, {})).toBe(3);
    expect(getMulticlassMaxSpellLevel('warlock', 9, {})).toBe(5);
  });
});

describe('hasSpellcasting', () => {
  it('returns true for full casters', () => {
    expect(hasSpellcasting('wizard', 1, {})).toBe(true);
    expect(hasSpellcasting('cleric', 1, {})).toBe(true);
    expect(hasSpellcasting('druid', 1, {})).toBe(true);
    expect(hasSpellcasting('bard', 1, {})).toBe(true);
    expect(hasSpellcasting('sorcerer', 1, {})).toBe(true);
  });

  it('returns true for Warlock', () => {
    expect(hasSpellcasting('warlock', 1, {})).toBe(true);
  });

  it('returns false for base Rogue', () => {
    expect(hasSpellcasting('rogue', 20, {})).toBe(false);
  });

  it('returns true for Rogue multiclassed with caster', () => {
    expect(hasSpellcasting('rogue', 10, { wizard: 1 })).toBe(true);
  });
});

describe('Spell Slot Progression Tables', () => {
  it('FULL_CASTER_SLOTS has entries for levels 1-20', () => {
    for (let level = 1; level <= 20; level++) {
      expect(FULL_CASTER_SLOTS[level], `Level ${level} missing`).toBeDefined();
    }
  });

  it('PACT_MAGIC_SLOTS has entries for levels 1-20', () => {
    for (let level = 1; level <= 20; level++) {
      expect(PACT_MAGIC_SLOTS[level], `Level ${level} missing`).toBeDefined();
    }
  });

  it('Pact slots cap at level 5', () => {
    expect(PACT_MAGIC_SLOTS[20].slotLevel).toBe(5);
  });

  it('Pact slot count progression is correct', () => {
    expect(PACT_MAGIC_SLOTS[1].slotCount).toBe(1);
    expect(PACT_MAGIC_SLOTS[2].slotCount).toBe(2);
    expect(PACT_MAGIC_SLOTS[11].slotCount).toBe(3);
    expect(PACT_MAGIC_SLOTS[17].slotCount).toBe(4);
  });
});
