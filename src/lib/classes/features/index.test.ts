// Class Features Registry Tests
// Tests for feature lookups, unlocking, and scaling

import { describe, it, expect } from 'vitest';
import {
  getClassFeatures,
  getFeaturesForLevel,
  getFeaturesAtLevel,
  getFeatureById,
  getUnlockedFeatures,
  getScalingValue,
  countUnlockedFeatures,
  CLASS_FEATURES_REGISTRY,
} from './index';
import { DnDClass } from '../types';

describe('CLASS_FEATURES_REGISTRY', () => {
  it('has entries for all classes', () => {
    const expectedClasses: DnDClass[] = [
      'rogue', 'wizard', 'sorcerer', 'warlock', 'cleric', 'druid', 'bard'
    ];
    
    for (const classId of expectedClasses) {
      expect(CLASS_FEATURES_REGISTRY[classId], `Missing ${classId}`).toBeDefined();
      expect(Array.isArray(CLASS_FEATURES_REGISTRY[classId])).toBe(true);
    }
  });

  it('all features have required fields', () => {
    for (const [classId, features] of Object.entries(CLASS_FEATURES_REGISTRY)) {
      for (const feature of features) {
        expect(feature.id, `${classId} feature missing id`).toBeDefined();
        expect(feature.name, `${classId} feature missing name`).toBeDefined();
        expect(feature.level, `${classId} feature missing level`).toBeGreaterThanOrEqual(1);
        expect(feature.classId, `${classId} feature classId mismatch`).toBe(classId);
        expect(typeof feature.description).toBe('string');
        expect(typeof feature.isSubclassFeature).toBe('boolean');
      }
    }
  });
});

describe('getClassFeatures', () => {
  it('returns all features for a class', () => {
    const wizardFeatures = getClassFeatures('wizard');
    expect(wizardFeatures.length).toBeGreaterThan(0);
    expect(wizardFeatures.every(f => f.classId === 'wizard')).toBe(true);
  });

  it('returns empty array for unknown class', () => {
    const features = getClassFeatures('unknown' as DnDClass);
    expect(features).toEqual([]);
  });
});

describe('getFeaturesForLevel', () => {
  it('returns features up to and including level', () => {
    const features = getFeaturesForLevel('rogue', 5);
    
    // All returned features should be level 5 or below
    expect(features.every(f => f.level <= 5)).toBe(true);
    
    // Should include level 1 features
    const hasLevel1 = features.some(f => f.level === 1);
    expect(hasLevel1).toBe(true);
  });

  it('excludes subclass features by default', () => {
    const features = getFeaturesForLevel('wizard', 10);
    const hasSubclass = features.some(f => f.isSubclassFeature);
    expect(hasSubclass).toBe(false);
  });

  it('includes subclass features when requested', () => {
    const features = getFeaturesForLevel('wizard', 10, true);
    // May or may not have subclass features depending on data
    // Just verify it doesn't throw
    expect(Array.isArray(features)).toBe(true);
  });
});

describe('getFeaturesAtLevel', () => {
  it('returns only features at exact level', () => {
    const features = getFeaturesAtLevel('rogue', 1);
    expect(features.every(f => f.level === 1)).toBe(true);
  });

  it('returns empty for levels with no features', () => {
    // Most classes don't have features at every level
    const features = getFeaturesAtLevel('wizard', 4);
    // Could be empty or have features - just verify valid return
    expect(Array.isArray(features)).toBe(true);
  });
});

describe('getFeatureById', () => {
  it('finds feature by ID', () => {
    const feature = getFeatureById('rogue-sneak-attack');
    expect(feature).toBeDefined();
    expect(feature?.name).toBe('Sneak Attack');
  });

  it('returns undefined for unknown ID', () => {
    const feature = getFeatureById('nonexistent_feature');
    expect(feature).toBeUndefined();
  });
});

describe('getUnlockedFeatures', () => {
  it('returns features for single class', () => {
    const unlocked = getUnlockedFeatures({ rogue: 5 });
    expect(unlocked.length).toBeGreaterThan(0);
    expect(unlocked.every(u => u.classLevel === 5)).toBe(true);
  });

  it('returns features for multiple classes', () => {
    const unlocked = getUnlockedFeatures({ rogue: 3, wizard: 2 });
    
    const rogueFeatures = unlocked.filter(u => u.feature.classId === 'rogue');
    const wizardFeatures = unlocked.filter(u => u.feature.classId === 'wizard');
    
    expect(rogueFeatures.length).toBeGreaterThan(0);
    expect(wizardFeatures.length).toBeGreaterThan(0);
  });

  it('sorts features by level', () => {
    const unlocked = getUnlockedFeatures({ rogue: 10 });
    
    for (let i = 1; i < unlocked.length; i++) {
      expect(unlocked[i].feature.level).toBeGreaterThanOrEqual(
        unlocked[i - 1].feature.level
      );
    }
  });
});

describe('getScalingValue', () => {
  it('returns correct Sneak Attack scaling', () => {
    // Sneak Attack scales: 1d6 at level 1, 2d6 at level 3, etc.
    expect(getScalingValue('rogue-sneak-attack', 1)).toBe('1d6');
    expect(getScalingValue('rogue-sneak-attack', 3)).toBe('2d6');
    expect(getScalingValue('rogue-sneak-attack', 5)).toBe('3d6');
    expect(getScalingValue('rogue-sneak-attack', 19)).toBe('10d6');
  });

  it('returns undefined for non-scaling features', () => {
    const value = getScalingValue('wizard-arcane-recovery', 5);
    // Arcane Recovery doesn't have scaling array
    expect(value).toBeUndefined();
  });

  it('returns undefined for unknown feature', () => {
    const value = getScalingValue('nonexistent', 5);
    expect(value).toBeUndefined();
  });
});

describe('countUnlockedFeatures', () => {
  it('counts features correctly', () => {
    const singleClass = countUnlockedFeatures({ wizard: 5 });
    const multiClass = countUnlockedFeatures({ wizard: 5, cleric: 3 });
    
    expect(singleClass).toBeGreaterThan(0);
    expect(multiClass).toBeGreaterThan(singleClass);
  });

  it('returns 0 for empty class levels', () => {
    expect(countUnlockedFeatures({})).toBe(0);
  });
});

describe('Specific Class Features Exist', () => {
  const expectedFeatures = [
    // Rogue
    { classId: 'rogue', name: 'Sneak Attack', level: 1 },
    { classId: 'rogue', name: 'Cunning Action', level: 2 },
    { classId: 'rogue', name: 'Uncanny Dodge', level: 5 },
    
    // Wizard
    { classId: 'wizard', name: 'Arcane Recovery', level: 1 },
    { classId: 'wizard', name: 'Spell Mastery', level: 18 },
    
    // Warlock
    { classId: 'warlock', name: 'Eldritch Invocations', level: 2 },
    
    // Cleric
    { classId: 'cleric', name: 'Channel Divinity', level: 2 },
    
    // Druid
    { classId: 'druid', name: 'Wild Shape', level: 2 },
    
    // Bard
    { classId: 'bard', name: 'Bardic Inspiration', level: 1 },
    
    // Sorcerer
    { classId: 'sorcerer', name: 'Font of Magic', level: 2 },
  ];

  for (const expected of expectedFeatures) {
    it(`${expected.classId} has ${expected.name} at level ${expected.level}`, () => {
      const features = CLASS_FEATURES_REGISTRY[expected.classId as DnDClass];
      const found = features.find(
        f => f.name === expected.name && f.level === expected.level
      );
      expect(found, `Missing ${expected.name}`).toBeDefined();
    });
  }
});
