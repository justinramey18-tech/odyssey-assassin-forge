import { describe, it, expect } from 'vitest';
import { parseDamageModifiers, parseConcentrationChecks } from '../patterns/resistanceAndConcentration';

describe('parseDamageModifiers', () => {
  it('detects "resistant to fire damage"', () => {
    const r = parseDamageModifiers('The golem is resistant to fire damage.');
    expect(r).toHaveLength(1);
    expect(r[0].type).toBe('resistance');
    expect(r[0].damageType).toBe('fire');
  });

  it('detects "cold resistance"', () => {
    const r = parseDamageModifiers('The creature has cold resistance.');
    expect(r).toHaveLength(1);
    expect(r[0].type).toBe('resistance');
    expect(r[0].damageType).toBe('cold');
  });

  it('detects "takes half damage from lightning"', () => {
    const r = parseDamageModifiers('The dragon takes half damage from lightning.');
    expect(r).toHaveLength(1);
    expect(r[0].type).toBe('resistance');
    expect(r[0].damageType).toBe('lightning');
  });

  it('detects "vulnerable to fire damage"', () => {
    const r = parseDamageModifiers('The troll is vulnerable to fire damage.');
    expect(r).toHaveLength(1);
    expect(r[0].type).toBe('vulnerability');
    expect(r[0].damageType).toBe('fire');
  });

  it('detects "takes double damage from radiant"', () => {
    const r = parseDamageModifiers('The undead takes double damage from radiant.');
    expect(r).toHaveLength(1);
    expect(r[0].type).toBe('vulnerability');
    expect(r[0].damageType).toBe('radiant');
  });

  it('detects "immune to poison damage"', () => {
    const r = parseDamageModifiers('The construct is immune to poison damage.');
    expect(r).toHaveLength(1);
    expect(r[0].type).toBe('immunity');
    expect(r[0].damageType).toBe('poison');
  });

  it('detects "unaffected by necrotic"', () => {
    const r = parseDamageModifiers('The lich is unaffected by necrotic damage.');
    expect(r).toHaveLength(1);
    expect(r[0].type).toBe('immunity');
    expect(r[0].damageType).toBe('necrotic');
  });

  it('detects multiple modifiers in one text', () => {
    const text = 'The demon has fire resistance and is immune to poison damage.';
    const r = parseDamageModifiers(text);
    expect(r).toHaveLength(2);
    expect(r.map(m => m.type).sort()).toEqual(['immunity', 'resistance']);
  });

  it('returns empty for no matches', () => {
    expect(parseDamageModifiers('The party walks through the forest.')).toHaveLength(0);
  });
});

describe('parseConcentrationChecks', () => {
  it('detects "concentration check DC 12"', () => {
    const r = parseConcentrationChecks('She makes a concentration check DC 12.');
    expect(r).toHaveLength(1);
    expect(r[0].dc).toBe(12);
  });

  it('detects "DC 14 concentration save"', () => {
    const r = parseConcentrationChecks('DC 14 concentration save required.');
    expect(r).toHaveLength(1);
    expect(r[0].dc).toBe(14);
  });

  it('detects "maintains concentration on Haste"', () => {
    const r = parseConcentrationChecks('She maintains concentration on Haste.');
    expect(r).toHaveLength(1);
    expect(r[0].result).toBe('maintained');
    expect(r[0].spellName).toBe('Haste');
  });

  it('detects "loses concentration on Bless"', () => {
    const r = parseConcentrationChecks('The cleric loses concentration on Bless.');
    expect(r).toHaveLength(1);
    expect(r[0].result).toBe('broken');
    expect(r[0].spellName).toBe('Bless');
  });

  it('detects "concentration is broken"', () => {
    const r = parseConcentrationChecks('Her concentration is broken by the hit.');
    expect(r).toHaveLength(1);
    expect(r[0].result).toBe('broken');
  });

  it('detects "fails the concentration check"', () => {
    const r = parseConcentrationChecks('He fails the concentration check.');
    expect(r).toHaveLength(1);
    expect(r[0].result).toBe('broken');
  });

  it('detects "passes the concentration save"', () => {
    const r = parseConcentrationChecks('She passes the concentration save.');
    expect(r).toHaveLength(1);
    expect(r[0].result).toBe('maintained');
  });

  it('returns empty for no matches', () => {
    expect(parseConcentrationChecks('The wizard reads a scroll.')).toHaveLength(0);
  });
});
