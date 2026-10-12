import { describe, expect, it } from 'vitest';
import { AREA_MAX_TARGETS, hasDice, isAreaSpell, resolveMod, saveStatOf, spellcastingMod, spellDice, spellModeOf } from '@/lib/spellResolve';

// Real spells from the table, by the fields they are saved with.
describe('spellModeOf', () => {
  it('roll-to-hit spells', () => {
    expect(spellModeOf({ attackType: 'ranged', damageFormula: '2d10' })).toBe('attack'); // Used Catheter Yeet
    expect(spellModeOf({ attackType: 'melee', damageFormula: '2d8' })).toBe('attack'); // Capriole
    expect(spellModeOf({ attackType: 'ranged', damageFormula: '3d8', saveStat: 'CON' })).toBe('attack'); // Mjolnir's Echo
    expect(spellModeOf({ damageFormula: '2d6' })).toBe('attack'); // damage, no attack type, no save
  });
  it('saving-throw spells', () => {
    expect(spellModeOf({ attackType: 'save', damageFormula: '4d8', saveStat: 'WIS' })).toBe('save'); // Libido Lobotomy
    expect(spellModeOf({ damageFormula: '3d6', saveStat: 'STR' })).toBe('save'); // Berserker's Reckoning
  });
  it('automatic hits', () => {
    expect(spellModeOf({ attackType: 'auto', damageFormula: '3d4+3' })).toBe('auto');
    expect(spellModeOf({ attackType: 'none', damageFormula: '2d6' })).toBe('auto'); // Glue Factory Grudge
  });
  it('healing spells', () => {
    expect(spellModeOf({ attackType: 'auto', healingFormula: '2d4+2' })).toBe('heal'); // Loogie of Life
    expect(spellModeOf({ attackType: 'none', healingFormula: '1d8+mod' })).toBe('heal');
    expect(spellModeOf({ healingFormula: '1' })).toBe('heal');
  });
  it('utility spells (no damage, no healing)', () => {
    expect(spellModeOf({ attackType: 'none' })).toBe('utility'); // Big Boy Pill
    expect(spellModeOf({ attackType: 'save', saveStat: 'WIS' })).toBe('utility'); // Whippets for Everybody
    expect(spellModeOf({})).toBe('utility');
    expect(spellModeOf({ damageFormula: '' , healingFormula: '  ' })).toBe('utility');
  });
  it('reads the rules text only when a damage spell has no attack type or save stat', () => {
    const wrath = { damageFormula: '6d8', description: 'Creatures make DEX save, taking 6d8 damage on fail, half on success.' }; // Spring Equinox Wrath
    expect(spellModeOf(wrath)).toBe('save');
    expect(saveStatOf(wrath)).toBe('DEX');
    expect(spellModeOf({ damageFormula: '1d4', description: 'Target must make DC 14 WIS save or take 1d4 psychic damage.' })).toBe('save'); // Aggressive Negotiations
    expect(spellModeOf({ damageFormula: '2d8+1d6', description: 'Ranged spell attack. 2d8 + 1d6 damage.' })).toBe('attack');
    expect(spellModeOf({ attackType: 'ranged', damageFormula: '6d8', saveStat: 'none' })).toBe('attack'); // Bussy breaker
  });
  it('save stat: the field first, then the rules text, then DEX', () => {
    expect(saveStatOf({ saveStat: 'wis' })).toBe('WIS');
    expect(saveStatOf({ description: 'must make a Wisdom saving throw' })).toBe('WIS');
    expect(saveStatOf({ saveStat: 'none' })).toBe('DEX');
  });
  it('damage and healing together resolves as the damage spell', () => {
    expect(spellModeOf({ attackType: 'ranged', damageFormula: '2d6', healingFormula: '1d6' })).toBe('attack'); // DIY Appendectomy
  });
});

describe('dice', () => {
  it('fills in the spellcasting modifier', () => {
    expect(resolveMod('1d8+mod', 3)).toBe('1d8+3');
    expect(resolveMod('1d8 + mod', -1).replace(/\s/g, '')).toBe('1d8-1');
    expect(resolveMod('2d6 - mod', 2).replace(/\s/g, '')).toBe('2d6-2');
  });
  it('spots empty formulas', () => {
    expect(hasDice('1d8+mod')).toBe(true);
    expect(hasDice('')).toBe(false);
    expect(hasDice(undefined)).toBe(false);
    expect(hasDice('0')).toBe(false);
  });
  it('scales for an upcast slot', () => {
    expect(spellDice('1d8+mod', 3, 1, 3)?.label).toBe('3d8+3');
    expect(spellDice('2d4+2', 2, 1, 1)?.label).toBe('2d4+2');
    expect(spellDice('1', 2)?.label).toBe('1');
    expect(spellDice('', 2)).toBeNull();
  });
  it('works out the modifier from the attack bonus and level', () => {
    expect(spellcastingMod(6, 5)).toBe(2);
    expect(spellcastingMod(9, 8)).toBe(4);
  });
});

describe('area spells', () => {
  it('spots areas in the range or the rules text', () => {
    expect(isAreaSpell({ range: 'Self (60-foot line)' })).toBe(true); // Stall Flush
    expect(isAreaSpell({ range: '90 feet', description: 'Each creature in a 20-foot radius around a point you choose' })).toBe(true); // Bass Drop
    expect(isAreaSpell({ range: 'Self (30-foot radius)', description: 'Every creature of your choice within 30 feet' })).toBe(true);
  });
  it('spots heals for several allies', () => {
    expect(isAreaSpell({ range: 'Self (10-foot radius)', description: 'Each ally within 10 feet regains 1d8 + 3 hit points.' })).toBe(true); // Lather, Rinse, Repeat
    expect(isAreaSpell({ range: '30 feet', description: 'Up to three allies who reach it gain 1d8 + 2 temporary hit points' })).toBe(true); // Craft Services
    expect(isAreaSpell({ range: '60 feet', description: 'A creature you can see regains 1d4+3 HP.' })).toBe(false); // Walk It Off
  });
  it('leaves single targets alone', () => {
    expect(isAreaSpell({ range: '60 feet', description: 'You force a surge of chaotic erotic energy into one creature you can see within range.' })).toBe(false);
  });
  it('caps area targets at 3', () => {
    expect(AREA_MAX_TARGETS).toBe(3);
  });
});
