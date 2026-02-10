import { describe, it, expect } from 'vitest';
import { parseSpellSlotMatches } from '../patterns/spellSlots';

describe('parseSpellSlotMatches', () => {
  it('detects "casts X using Nth-level slot"', () => {
    const r = parseSpellSlotMatches('The wizard casts Fireball using a 3rd-level slot.');
    expect(r).toHaveLength(1);
    expect(r[0].slotLevel).toBe(3);
    expect(r[0].spellName).toBe('Fireball');
  });

  it('detects "cast X at Nth level"', () => {
    const r = parseSpellSlotMatches('She casts Shield at 1st level.');
    expect(r).toHaveLength(1);
    expect(r[0].slotLevel).toBe(1);
    expect(r[0].spellName).toBe('Shield');
  });

  it('detects "expends a Nth-level spell slot"', () => {
    const r = parseSpellSlotMatches('He expends a 2nd-level spell slot.');
    expect(r).toHaveLength(1);
    expect(r[0].slotLevel).toBe(2);
    expect(r[0].spellName).toBeUndefined();
  });

  it('detects "uses Nth level slot"', () => {
    const r = parseSpellSlotMatches('Uses 4th level slot for the spell.');
    expect(r.length).toBeGreaterThanOrEqual(1);
    expect(r[0].slotLevel).toBe(4);
  });

  it('detects "Nth-level slot: spellname"', () => {
    const r = parseSpellSlotMatches('3rd-level slot: Counterspell');
    expect(r).toHaveLength(1);
    expect(r[0].slotLevel).toBe(3);
    expect(r[0].spellName).toBe('Counterspell');
  });

  it('detects "upcasts X at Nth level"', () => {
    const r = parseSpellSlotMatches('She upcasts Cure Wounds at 5th level.');
    expect(r.length).toBeGreaterThanOrEqual(1);
    const upcast = r.find(m => m.spellName === 'Cure Wounds');
    expect(upcast).toBeDefined();
    expect(upcast!.slotLevel).toBe(5);
  });

  it('rejects slot levels outside 1-9', () => {
    const r = parseSpellSlotMatches('Casts Wish using a 10th-level slot.');
    expect(r).toHaveLength(0);
  });

  it('handles multiple spell slots in one log', () => {
    const text = 'Casts Fireball using a 3rd-level slot. Later, casts Shield at 1st level.';
    const r = parseSpellSlotMatches(text);
    expect(r).toHaveLength(2);
    expect(r.map(m => m.slotLevel).sort()).toEqual([1, 3]);
  });

  it('returns empty for no matches', () => {
    expect(parseSpellSlotMatches('The party explores the dungeon.')).toHaveLength(0);
  });
});
