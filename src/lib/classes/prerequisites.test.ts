// Multiclass Prerequisites Tests
// Tests for ability score requirements and level cap validation

import { describe, it, expect } from 'vitest';
import {
  meetsMulticlassPrerequisites,
  canAddMulticlassLevel,
} from './prerequisites';
import { CLASS_REGISTRY } from './index';
import { BaseAbilityScores } from '@/lib/abilityScores/types';

// Standard array scores for testing
const standardArray: BaseAbilityScores = {
  strength: 15,
  dexterity: 14,
  constitution: 13,
  intelligence: 12,
  wisdom: 10,
  charisma: 8,
};

// High stats (meets all requirements)
const highStats: BaseAbilityScores = {
  strength: 16,
  dexterity: 16,
  constitution: 16,
  intelligence: 16,
  wisdom: 16,
  charisma: 16,
};

// Minimum stats (fails most requirements)
const lowStats: BaseAbilityScores = {
  strength: 8,
  dexterity: 8,
  constitution: 8,
  intelligence: 8,
  wisdom: 8,
  charisma: 8,
};

describe('meetsMulticlassPrerequisites', () => {
  describe('Wizard (INT 13)', () => {
    it('passes with INT 13+', () => {
      const result = meetsMulticlassPrerequisites(
        CLASS_REGISTRY.wizard,
        { ...lowStats, intelligence: 13 }
      );
      expect(result.allowed).toBe(true);
      expect(result.missingRequirements ?? []).toHaveLength(0);
    });

    it('fails with INT < 13', () => {
      const result = meetsMulticlassPrerequisites(
        CLASS_REGISTRY.wizard,
        { ...lowStats, intelligence: 12 }
      );
      expect(result.allowed).toBe(false);
      expect(result.missingRequirements?.some(r => r.ability === 'intelligence')).toBe(true);
    });
  });

  describe('Cleric (WIS 13)', () => {
    it('passes with WIS 13+', () => {
      const result = meetsMulticlassPrerequisites(
        CLASS_REGISTRY.cleric,
        { ...lowStats, wisdom: 14 }
      );
      expect(result.allowed).toBe(true);
    });

    it('fails with WIS < 13', () => {
      const result = meetsMulticlassPrerequisites(
        CLASS_REGISTRY.cleric,
        { ...lowStats, wisdom: 10 }
      );
      expect(result.allowed).toBe(false);
      expect(result.missingRequirements?.some(r => r.ability === 'wisdom')).toBe(true);
    });
  });

  describe('Warlock (CHA 13)', () => {
    it('passes with CHA 13+', () => {
      const result = meetsMulticlassPrerequisites(
        CLASS_REGISTRY.warlock,
        { ...lowStats, charisma: 13 }
      );
      expect(result.allowed).toBe(true);
    });

    it('fails with CHA < 13', () => {
      const result = meetsMulticlassPrerequisites(
        CLASS_REGISTRY.warlock,
        lowStats
      );
      expect(result.allowed).toBe(false);
    });
  });

  describe('Bard (CHA 13)', () => {
    it('passes with high stats', () => {
      const result = meetsMulticlassPrerequisites(
        CLASS_REGISTRY.bard,
        highStats
      );
      expect(result.allowed).toBe(true);
    });
  });

  describe('Sorcerer (CHA 13)', () => {
    it('passes with CHA 13+', () => {
      const result = meetsMulticlassPrerequisites(
        CLASS_REGISTRY.sorcerer,
        { ...lowStats, charisma: 15 }
      );
      expect(result.allowed).toBe(true);
    });
  });

  describe('Druid (WIS 13)', () => {
    it('passes with WIS 13+', () => {
      const result = meetsMulticlassPrerequisites(
        CLASS_REGISTRY.druid,
        { ...lowStats, wisdom: 13 }
      );
      expect(result.allowed).toBe(true);
    });
  });

  describe('Rogue (DEX 13)', () => {
    it('passes with DEX 13+', () => {
      const result = meetsMulticlassPrerequisites(
        CLASS_REGISTRY.rogue,
        { ...lowStats, dexterity: 13 }
      );
      expect(result.allowed).toBe(true);
    });

    it('fails with DEX < 13', () => {
      const result = meetsMulticlassPrerequisites(
        CLASS_REGISTRY.rogue,
        lowStats
      );
      expect(result.allowed).toBe(false);
    });
  });
});

describe('canAddMulticlassLevel', () => {
  it('allows multiclass at level 19', () => {
    const result = canAddMulticlassLevel(
      CLASS_REGISTRY.wizard,
      highStats,
      19
    );
    expect(result.allowed).toBe(true);
  });

  it('blocks multiclass at level 20 (cap)', () => {
    const result = canAddMulticlassLevel(
      CLASS_REGISTRY.wizard,
      highStats,
      20
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('20');
  });

  it('blocks multiclass with insufficient stats', () => {
    const result = canAddMulticlassLevel(
      CLASS_REGISTRY.wizard,
      lowStats,
      5
    );
    expect(result.allowed).toBe(false);
    expect(result.missingRequirements?.some(r => r.ability === 'intelligence')).toBe(true);
  });

  it('allows multiclass with sufficient stats and level', () => {
    const result = canAddMulticlassLevel(
      CLASS_REGISTRY.cleric,
      { ...lowStats, wisdom: 14 },
      10
    );
    expect(result.allowed).toBe(true);
  });
});

describe('Multiclass Requirement Accuracy (5e PHB)', () => {
  // Verify actual 5e multiclass requirements are configured correctly
  const expectedRequirements: Record<string, Partial<Record<string, number>>> = {
    wizard: { intelligence: 13 },
    sorcerer: { charisma: 13 },
    warlock: { charisma: 13 },
    cleric: { wisdom: 13 },
    druid: { wisdom: 13 },
    bard: { charisma: 13 },
    rogue: { dexterity: 13 },
  };

  for (const [classId, requirements] of Object.entries(expectedRequirements)) {
    it(`${classId} has correct multiclass requirements`, () => {
      const config = CLASS_REGISTRY[classId as keyof typeof CLASS_REGISTRY];
      expect(config.multiclassRequirements).toEqual(requirements);
    });
  }
});
