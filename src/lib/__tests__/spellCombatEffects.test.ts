import { describe, expect, it } from 'vitest';
import { isAreaSpell, spellCombatModeOf, spellModeOf, validateCombatEffects } from '@/lib/spellResolve';

const effect = { kind: 'ac_bonus', amount: 2, durationSeconds: 60 };
describe('explicit combat support metadata', () => {
  it('keeps missing and empty metadata compatible', () => {
    expect(validateCombatEffects(undefined)).toEqual({ effects: [], errors: [] });
    expect(validateCombatEffects([])).toEqual({ effects: [], errors: [] });
    expect(spellModeOf({ combatEffects: [] })).toBe('utility');
  });
  it('supports only AC, attack and temporary HP effects', () => {
    const rows = [effect, { kind: 'attack_bonus', amount: 3, durationSeconds: 120 }, { kind: 'temporary_hp', formula: ' 2d8 + 3 ', durationSeconds: 600 }];
    expect(validateCombatEffects(rows)).toEqual({ effects: [effect, rows[1], { ...rows[2], formula: '2d8+3' }], errors: [] });
    expect(spellCombatModeOf({ combatEffects: rows })).toBe('buff');
    expect(spellModeOf({ combatEffects: rows })).toBe('utility');
  });
  it.each(['save_bonus', 'damage_bonus', 'regeneration'])('rejects unsupported %s', kind => {
    expect(validateCombatEffects([{ ...effect, kind }]).errors.length).toBeGreaterThan(0);
    expect(spellCombatModeOf({ combatEffects: [{ ...effect, kind }] })).toBe('utility');
  });
  it.each([null, {}, 'AC +2', [null], [{ ...effect, extra: true }]])('rejects malformed settings %j', raw => {
    expect(validateCombatEffects(raw).errors.length).toBeGreaterThan(0);
  });
  it.each([NaN, Infinity, -Infinity, 0, -1, 1.5, '2', 31])('rejects invalid AC amount %s', amount => {
    expect(validateCombatEffects([{ ...effect, amount }]).errors.length).toBeGreaterThan(0);
  });
  it('enforces the AC and attack envelopes', () => {
    expect(validateCombatEffects([{ ...effect, amount: 30 }]).errors).toEqual([]);
    expect(validateCombatEffects([{ ...effect, kind: 'attack_bonus', amount: 20 }]).errors).toEqual([]);
    expect(validateCombatEffects([{ ...effect, kind: 'attack_bonus', amount: 21 }]).errors.length).toBeGreaterThan(0);
  });
  it.each([NaN, Infinity, 0, -1, 0.5, '60', 86401])('rejects invalid duration %s', durationSeconds => {
    expect(validateCombatEffects([{ ...effect, durationSeconds }]).errors.length).toBeGreaterThan(0);
  });
  it('accepts whole-second duration boundaries', () => {
    for (const durationSeconds of [1, 86400]) expect(validateCombatEffects([{ ...effect, durationSeconds }]).errors).toEqual([]);
  });
  it('rejects duplicate kinds and never returns partially valid effects', () => {
    expect(validateCombatEffects([effect, effect])).toMatchObject({ effects: [] });
    expect(validateCombatEffects([effect, effect]).errors.length).toBeGreaterThan(0);
  });
  it('uses the current 200 HP healing cap for flat and dice temporary HP', () => {
    for (const amount of [1, 200]) expect(validateCombatEffects([{ kind: 'temporary_hp', amount, durationSeconds: 60 }]).errors).toEqual([]);
    expect(validateCombatEffects([{ kind: 'temporary_hp', amount: 201, durationSeconds: 60 }]).errors.length).toBeGreaterThan(0);
    expect(validateCombatEffects([{ kind: 'temporary_hp', formula: '20d10', durationSeconds: 60 }]).errors).toEqual([]);
  });
  it.each(['1d8 garbage', '1d8+2d6', '51d4', '21d4', '1d5', '1d0', '0d8', '3d100', '1d8+1000', '1d8-9', 'NaN', 'Infinity', '1d8+mod'])('rejects invalid or out-of-cap HP dice %s', formula => {
    expect(validateCombatEffects([{ kind: 'temporary_hp', formula, durationSeconds: 60 }]).errors.length).toBeGreaterThan(0);
  });
  it('rejects dice for bonuses and ambiguous temporary HP', () => {
    expect(validateCombatEffects([{ ...effect, formula: '1d4' }]).errors.length).toBeGreaterThan(0);
    expect(validateCombatEffects([{ kind: 'temporary_hp', amount: 5, formula: '1d4', durationSeconds: 60 }]).errors.length).toBeGreaterThan(0);
  });
  it('never derives buffs from prose', () => {
    expect(spellCombatModeOf({ description: 'Gain +2 AC, +3 attack and 1d8 temporary HP for 60 seconds.' })).toBe('utility');
  });
  it('preserves every existing classification even with buff metadata', () => {
    const combatEffects = [effect];
    expect(spellModeOf({ attackType: 'ranged', damageFormula: '2d6', combatEffects })).toBe('attack');
    expect(spellModeOf({ attackType: 'save', damageFormula: '2d6', combatEffects })).toBe('save');
    expect(spellModeOf({ attackType: 'auto', damageFormula: '2d6', combatEffects })).toBe('auto');
    expect(spellModeOf({ healingFormula: '2d6', combatEffects })).toBe('heal');
    expect(spellModeOf({})).toBe('utility');
    expect(isAreaSpell({ range: 'Self (30-foot radius)', combatEffects })).toBe(true);
  });
});