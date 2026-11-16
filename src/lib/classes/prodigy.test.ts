import { describe, expect, it } from 'vitest';
import { CLASS_REGISTRY, getAllClasses, getClassById, getFeaturesForLevel, getSpellcasterClasses } from './index';
import { calculateMulticlassMaxHP, calculateMaxHP } from '../hpCalculation';
import { meetsMulticlassPrerequisites } from './prerequisites';
import { CLASS_SUGGESTED_ARRAYS } from '@/components/wizard/types';

describe('Prodigy engine class', () => {
  it('keeps exactly the existing seven ordinary class choices', () => {
    expect(getAllClasses().map(c => c.id)).toEqual(['rogue', 'wizard', 'sorcerer', 'warlock', 'cleric', 'druid', 'bard']);
    expect(getSpellcasterClasses().map(c => c.id)).not.toContain('prodigy');
    expect(getClassById('prodigy').empyreanOnly).toBe(true);
  });
  it('has a d10 hit die and no spellcasting', () => {
    expect(CLASS_REGISTRY.prodigy).toMatchObject({ hitDie: 'd10', hitDieMax: 10, hitDieAvg: 6, spellcasting: { type: 'none', prepared: false } });
  });
  it('uses d10 health while the legacy health formula stays unchanged', () => {
    expect(calculateMulticlassMaxHP('prodigy', 1, {}, 2)).toBe(12);
    expect(calculateMulticlassMaxHP('prodigy', 5, {}, 2)).toBe(44);
    expect(calculateMulticlassMaxHP('prodigy', 5, {}, 2, 3)).toBe(50);
    expect(calculateMaxHP(5, 2)).toBe(38);
  });
  it('unlocks Ascension features at levels one, five, ten, fifteen and twenty', () => {
    expect(getFeaturesForLevel('prodigy', 20).map(f => f.level)).toEqual([1, 5, 10, 15, 20]);
    expect(getFeaturesForLevel('prodigy', 4)).toHaveLength(1);
    expect(getFeaturesForLevel('prodigy', 10)).toHaveLength(3);
  });
  it('does not meet multiclass requirements with maximum ordinary ability scores', () => {
    expect(meetsMulticlassPrerequisites(CLASS_REGISTRY.prodigy, {
      strength: 20, dexterity: 20, constitution: 20, intelligence: 20, wisdom: 20, charisma: 20,
    }).allowed).toBe(false);
  });
  it('uses the supplied suggested ability scores', () => {
    expect(CLASS_SUGGESTED_ARRAYS.prodigy).toEqual({ strength: 8, dexterity: 13, constitution: 14, intelligence: 10, wisdom: 12, charisma: 15 });
  });
});