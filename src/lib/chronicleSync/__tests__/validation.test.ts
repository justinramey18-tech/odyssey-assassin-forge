import { describe, it, expect } from 'vitest';
import {
  validateWithHonestMode,
  validateXPChange,
  validateItemChange,
  validateAchievementEvidence,
  hasActionableChanges,
  hasDisplayOnlyChanges,
  getConfidenceColor,
  getConfidenceIcon,
} from '../validation';
import { ChronicleParseResult } from '../types';

function emptyResult(): ChronicleParseResult {
  return {
    xpChanges: [],
    hpChanges: [],
    itemChanges: [],
    achievementTriggers: [],
    goldChanges: [],
    shopItems: [],
    conditions: [],
    combatEvents: [],
    enemies: [],
    levelUp: null,
    parseMode: 'offline',
    parsedAt: new Date().toISOString(),
    inputLength: 0,
  };
}

describe('validateWithHonestMode', () => {
  it('caps XP when total exceeds cap', () => {
    const result = emptyResult();
    result.xpChanges = [
      { amount: 800, context: '', confidence: 'high', sourceText: 'test' },
      { amount: 400, context: '', confidence: 'high', sourceText: 'test2' },
    ];
    const validated = validateWithHonestMode(result, {
      requireChronicleEvidence: false,
      chronicleItemValidation: false,
      chronicleXPCap: 1000,
    });
    const total = validated.filtered.xpChanges.reduce((s, x) => s + x.amount, 0);
    expect(total).toBeLessThanOrEqual(1000);
    expect(validated.warnings.length).toBeGreaterThan(0);
  });

  it('does not cap XP when under limit', () => {
    const result = emptyResult();
    result.xpChanges = [{ amount: 500, context: '', confidence: 'high', sourceText: 'test' }];
    const validated = validateWithHonestMode(result, {
      requireChronicleEvidence: false,
      chronicleItemValidation: false,
      chronicleXPCap: 1000,
    });
    expect(validated.filtered.xpChanges[0].amount).toBe(500);
    expect(validated.warnings).toHaveLength(0);
  });

  it('rejects items without consumableId when item validation enabled', () => {
    const result = emptyResult();
    result.itemChanges = [
      { name: 'mystery orb', quantity: 1, action: 'acquired', confidence: 'low', sourceText: 'test' },
    ];
    const validated = validateWithHonestMode(result, {
      requireChronicleEvidence: false,
      chronicleItemValidation: true,
      chronicleXPCap: 0,
    });
    expect(validated.filtered.itemChanges).toHaveLength(0);
    expect(validated.warnings.some(w => w.includes('mystery orb'))).toBe(true);
  });

  it('rejects low-confidence achievements when evidence required', () => {
    const result = emptyResult();
    result.achievementTriggers = [
      { achievementId: 'test', achievementName: 'Test', increment: 1, evidence: 'e', confidence: 'low', sourceText: 'short' },
    ];
    const validated = validateWithHonestMode(result, {
      requireChronicleEvidence: true,
      chronicleItemValidation: false,
      chronicleXPCap: 0,
    });
    expect(validated.filtered.achievementTriggers).toHaveLength(0);
  });

  it('keeps high-confidence achievements with sufficient source text', () => {
    const result = emptyResult();
    result.achievementTriggers = [
      { achievementId: 'test', achievementName: 'Test', increment: 1, evidence: 'evidence', confidence: 'high', sourceText: 'This is a long enough source text for validation' },
    ];
    const validated = validateWithHonestMode(result, {
      requireChronicleEvidence: true,
      chronicleItemValidation: false,
      chronicleXPCap: 0,
    });
    expect(validated.filtered.achievementTriggers).toHaveLength(1);
  });

  it('returns isValid true when no errors', () => {
    const result = emptyResult();
    const validated = validateWithHonestMode(result, {
      requireChronicleEvidence: false,
      chronicleItemValidation: false,
      chronicleXPCap: 0,
    });
    expect(validated.isValid).toBe(true);
  });
});

describe('validateXPChange', () => {
  it('rejects zero or negative XP', () => {
    expect(validateXPChange({ amount: 0, context: '', confidence: 'high', sourceText: '' }, 1000).valid).toBe(false);
    expect(validateXPChange({ amount: -5, context: '', confidence: 'high', sourceText: '' }, 1000).valid).toBe(false);
  });

  it('rejects XP over cap', () => {
    expect(validateXPChange({ amount: 1500, context: '', confidence: 'high', sourceText: '' }, 1000).valid).toBe(false);
  });

  it('accepts valid XP', () => {
    expect(validateXPChange({ amount: 500, context: '', confidence: 'high', sourceText: '' }, 1000).valid).toBe(true);
  });
});

describe('validateItemChange', () => {
  it('rejects items without consumableId', () => {
    expect(validateItemChange({ name: 'orb', quantity: 1, action: 'acquired', confidence: 'low', sourceText: '' }).valid).toBe(false);
  });

  it('rejects items with zero quantity', () => {
    expect(validateItemChange({ name: 'orb', quantity: 0, action: 'acquired', consumableId: 'fake', confidence: 'low', sourceText: '' }).valid).toBe(false);
  });
});

describe('validateAchievementEvidence', () => {
  it('passes when evidence not required', () => {
    const trigger = { achievementId: 'x', achievementName: 'X', increment: 1, evidence: '', confidence: 'low' as const, sourceText: '' };
    expect(validateAchievementEvidence(trigger, false).valid).toBe(true);
  });

  it('fails for low confidence when evidence required', () => {
    const trigger = { achievementId: 'x', achievementName: 'X', increment: 1, evidence: '', confidence: 'low' as const, sourceText: 'some text here' };
    expect(validateAchievementEvidence(trigger, true).valid).toBe(false);
  });

  it('fails for short source text when evidence required', () => {
    const trigger = { achievementId: 'x', achievementName: 'X', increment: 1, evidence: '', confidence: 'high' as const, sourceText: 'short' };
    expect(validateAchievementEvidence(trigger, true).valid).toBe(false);
  });
});

describe('hasActionableChanges', () => {
  it('returns false for empty result', () => {
    expect(hasActionableChanges(emptyResult())).toBe(false);
  });

  it('returns true for XP changes', () => {
    const r = emptyResult();
    r.xpChanges = [{ amount: 100, context: '', confidence: 'high', sourceText: '' }];
    expect(hasActionableChanges(r)).toBe(true);
  });

  it('returns true for gold changes', () => {
    const r = emptyResult();
    r.goldChanges = [{ amount: 50, action: 'gained', sourceText: '' }];
    expect(hasActionableChanges(r)).toBe(true);
  });

  it('returns true for shop items', () => {
    const r = emptyResult();
    r.shopItems = [{ name: 'Sword', itemType: 'equipment', costGold: 15, sourceText: '', confidence: 'high' }];
    expect(hasActionableChanges(r)).toBe(true);
  });

  it('returns true for level up', () => {
    const r = emptyResult();
    r.levelUp = { newLevel: 5, sourceText: '' };
    expect(hasActionableChanges(r)).toBe(true);
  });
});

describe('hasDisplayOnlyChanges', () => {
  it('returns false for empty result', () => {
    expect(hasDisplayOnlyChanges(emptyResult())).toBe(false);
  });

  it('returns true for HP changes', () => {
    const r = emptyResult();
    r.hpChanges = [{ amount: -5, type: 'damage', source: '', sourceText: '' }];
    expect(hasDisplayOnlyChanges(r)).toBe(true);
  });

  it('returns true for conditions', () => {
    const r = emptyResult();
    r.conditions = [{ name: 'poisoned', action: 'applied', sourceText: '' }];
    expect(hasDisplayOnlyChanges(r)).toBe(true);
  });
});

describe('getConfidenceColor / getConfidenceIcon', () => {
  it('returns correct colors', () => {
    expect(getConfidenceColor('high')).toContain('emerald');
    expect(getConfidenceColor('medium')).toContain('amber');
    expect(getConfidenceColor('low')).toContain('red');
  });

  it('returns correct icons', () => {
    expect(getConfidenceIcon('high')).toBe('CheckCircle');
    expect(getConfidenceIcon('medium')).toBe('AlertTriangle');
    expect(getConfidenceIcon('low')).toBe('HelpCircle');
  });
});
