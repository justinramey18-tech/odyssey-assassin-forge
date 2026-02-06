// Unit Tests for apply-wizard-state utility
// Tests HP calculation, XP mapping, validation, and state application

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  mapXPPreset,
  getXPMultiplier,
  calculateStartingXP,
  calculateStartingHP,
  mergeAbilities,
  validateWizardStateForApplication,
  getApplicationSummary,
  applyWizardState,
  applyQuickStart,
} from './apply-wizard-state';
import { WizardState, QUICK_START_DEFAULTS } from '../types';
import { CharacterAbility } from '@/lib/types';
import { createInitialEquipment } from '@/lib/inventory';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Helper to create a valid WizardState
function createTestWizardState(overrides: Partial<WizardState> = {}): WizardState {
  return {
    currentStep: 0,
    completedSteps: [],
    name: 'Test Assassin',
    level: 1,
    portraitIcon: 'Skull',
    abilityScores: {
      strength: 10,
      dexterity: 15,
      constitution: 14,
      intelligence: 12,
      wisdom: 10,
      charisma: 8,
    },
    scoreGenerationMethod: 'standard',
    gameMode: 'infinityPool',
    honestModeRules: {
      requireGearUnlocks: true,
      organicLevelUp: true,
      maxLevelInfinityStones: true,
      noRerolls: true,
      scribeItemVerification: true,
      prestigePointsRequireXP: true,
      prestigeRespecDisabled: true,
      enforceCooldowns: true,
    },
    xpPreset: 'standard',
    diceOddsMode: 'fair',
    selectedPath: null,
    starterAbilities: [],
    equipment: createInitialEquipment(),
    selectedPresetId: null,
    ...overrides,
  };
}

describe('mapXPPreset', () => {
  it('maps standard to standard', () => {
    expect(mapXPPreset('standard')).toBe('standard');
  });

  it('maps fastTrack to fast', () => {
    expect(mapXPPreset('fastTrack')).toBe('fast');
  });

  it('maps epicJourney to slow', () => {
    expect(mapXPPreset('epicJourney')).toBe('slow');
  });

  it('maps milestone to milestone', () => {
    expect(mapXPPreset('milestone')).toBe('milestone');
  });
});

describe('getXPMultiplier', () => {
  it('returns 1.0 for standard', () => {
    expect(getXPMultiplier('standard')).toBe(1.0);
  });

  it('returns 0.5 for fastTrack', () => {
    expect(getXPMultiplier('fastTrack')).toBe(0.5);
  });

  it('returns 2.0 for epicJourney', () => {
    expect(getXPMultiplier('epicJourney')).toBe(2.0);
  });

  it('returns 0 for milestone', () => {
    expect(getXPMultiplier('milestone')).toBe(0);
  });
});

describe('calculateStartingXP', () => {
  it('returns 0 for level 1 with standard preset', () => {
    expect(calculateStartingXP(1, 'standard')).toBe(0);
  });

  it('returns 0 for milestone preset at any level', () => {
    expect(calculateStartingXP(5, 'milestone')).toBe(0);
    expect(calculateStartingXP(10, 'milestone')).toBe(0);
    expect(calculateStartingXP(20, 'milestone')).toBe(0);
  });

  it('returns correct XP for level 5 standard', () => {
    // Level 5 in D&D 5e is 6,500 XP
    const xp = calculateStartingXP(5, 'standard');
    expect(xp).toBe(6500);
  });

  it('returns half XP for fastTrack preset', () => {
    // Level 5 with 0.5 multiplier = 3,250 XP
    const standardXP = calculateStartingXP(5, 'standard');
    const fastXP = calculateStartingXP(5, 'fastTrack');
    expect(fastXP).toBe(standardXP * 0.5);
  });

  it('returns double XP for epicJourney preset', () => {
    // Level 5 with 2.0 multiplier = 13,000 XP
    const standardXP = calculateStartingXP(5, 'standard');
    const epicXP = calculateStartingXP(5, 'epicJourney');
    expect(epicXP).toBe(standardXP * 2.0);
  });
});

describe('calculateStartingHP', () => {
  it('calculates HP for level 1 with CON 10 (modifier 0)', () => {
    const result = calculateStartingHP(1, 10);
    // Level 1: 8 (base) + 0 (CON mod) = 8
    expect(result.max).toBe(8);
    expect(result.current).toBe(8);
    expect(result.temp).toBe(0);
  });

  it('calculates HP for level 1 with CON 14 (modifier +2)', () => {
    const result = calculateStartingHP(1, 14);
    // Level 1: 8 (base) + 2 (CON mod) = 10
    expect(result.max).toBe(10);
    expect(result.current).toBe(10);
  });

  it('calculates HP for level 1 with CON 8 (modifier -1)', () => {
    const result = calculateStartingHP(1, 8);
    // Level 1: 8 (base) - 1 (CON mod) = 7
    expect(result.max).toBe(7);
    expect(result.current).toBe(7);
  });

  it('calculates HP for level 5 with CON 14 (modifier +2)', () => {
    const result = calculateStartingHP(5, 14);
    // Level 1: 8 + 2 = 10
    // Levels 2-5: 4 levels × (5 + 2) = 28
    // Total: 10 + 28 = 38
    expect(result.max).toBe(38);
  });

  it('calculates HP for level 10 with CON 16 (modifier +3)', () => {
    const result = calculateStartingHP(10, 16);
    // Level 1: 8 + 3 = 11
    // Levels 2-10: 9 levels × (5 + 3) = 72
    // Total: 11 + 72 = 83
    expect(result.max).toBe(83);
  });

  it('calculates HP for level 20 with CON 20 (modifier +5)', () => {
    const result = calculateStartingHP(20, 20);
    // Level 1: 8 + 5 = 13
    // Levels 2-20: 19 levels × (5 + 5) = 190
    // Total: 13 + 190 = 203
    expect(result.max).toBe(203);
  });

  it('always sets temp HP to 0', () => {
    const result = calculateStartingHP(10, 16);
    expect(result.temp).toBe(0);
  });

  it('sets current HP equal to max HP', () => {
    const result = calculateStartingHP(10, 16);
    expect(result.current).toBe(result.max);
  });
});

describe('mergeAbilities', () => {
  const existingAbilities: CharacterAbility[] = [
    { abilityId: 'ability-1', currentTier: 1 },
    { abilityId: 'ability-2', currentTier: 0 },
    { abilityId: 'ability-3', currentTier: 2 },
  ];

  it('returns existing abilities if starter abilities is empty', () => {
    const result = mergeAbilities(existingAbilities, []);
    expect(result).toEqual(existingAbilities);
  });

  it('returns existing abilities if starter abilities is undefined-like', () => {
    const result = mergeAbilities(existingAbilities, undefined as any);
    expect(result).toEqual(existingAbilities);
  });

  it('upgrades ability tier if starter has higher tier', () => {
    const starterAbilities: CharacterAbility[] = [
      { abilityId: 'ability-2', currentTier: 2 },
    ];
    const result = mergeAbilities(existingAbilities, starterAbilities);
    
    const ability2 = result.find(a => a.abilityId === 'ability-2');
    expect(ability2?.currentTier).toBe(2);
  });

  it('does not downgrade ability tier if starter has lower tier', () => {
    const starterAbilities: CharacterAbility[] = [
      { abilityId: 'ability-3', currentTier: 1 },
    ];
    const result = mergeAbilities(existingAbilities, starterAbilities);
    
    const ability3 = result.find(a => a.abilityId === 'ability-3');
    expect(ability3?.currentTier).toBe(2); // Stays at 2, not downgraded to 1
  });

  it('handles multiple starter abilities', () => {
    const starterAbilities: CharacterAbility[] = [
      { abilityId: 'ability-1', currentTier: 3 },
      { abilityId: 'ability-2', currentTier: 1 },
    ];
    const result = mergeAbilities(existingAbilities, starterAbilities);
    
    expect(result.find(a => a.abilityId === 'ability-1')?.currentTier).toBe(3);
    expect(result.find(a => a.abilityId === 'ability-2')?.currentTier).toBe(1);
  });
});

describe('validateWizardStateForApplication', () => {
  it('returns valid for a correctly configured state', () => {
    const state = createTestWizardState();
    const result = validateWizardStateForApplication(state);
    
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns error for empty name', () => {
    const state = createTestWizardState({ name: '' });
    const result = validateWizardStateForApplication(state);
    
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Character name must be at least 2 characters');
  });

  it('returns error for single character name', () => {
    const state = createTestWizardState({ name: 'A' });
    const result = validateWizardStateForApplication(state);
    
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Character name must be at least 2 characters');
  });

  it('returns error for name over 30 characters', () => {
    const state = createTestWizardState({ name: 'A'.repeat(31) });
    const result = validateWizardStateForApplication(state);
    
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Character name must be 30 characters or less');
  });

  it('returns error for level below 1', () => {
    const state = createTestWizardState({ level: 0 });
    const result = validateWizardStateForApplication(state);
    
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Level must be between 1 and 20');
  });

  it('returns error for level above 20', () => {
    const state = createTestWizardState({ level: 21 });
    const result = validateWizardStateForApplication(state);
    
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Level must be between 1 and 20');
  });

  it('returns error for ability score below 3', () => {
    const state = createTestWizardState({
      abilityScores: {
        strength: 2,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
      },
    });
    const result = validateWizardStateForApplication(state);
    
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('All ability scores must be between 3 and 20');
  });

  it('returns error for ability score above 20', () => {
    const state = createTestWizardState({
      abilityScores: {
        strength: 10,
        dexterity: 25,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
      },
    });
    const result = validateWizardStateForApplication(state);
    
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('All ability scores must be between 3 and 20');
  });

  it('returns error for non-hexblade magic path at level 1', () => {
    const state = createTestWizardState({
      level: 1,
      selectedPath: 'arcane_trickster',
    });
    const result = validateWizardStateForApplication(state);
    
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('requires level 3'))).toBe(true);
  });

  it('allows hexblade at level 1', () => {
    const state = createTestWizardState({
      level: 1,
      selectedPath: 'hexblade',
    });
    const result = validateWizardStateForApplication(state);
    
    expect(result.isValid).toBe(true);
  });

  it('allows arcane_trickster at level 3+', () => {
    const state = createTestWizardState({
      level: 3,
      selectedPath: 'arcane_trickster',
    });
    const result = validateWizardStateForApplication(state);
    
    expect(result.isValid).toBe(true);
  });

  it('allows no magic path at any level', () => {
    const state = createTestWizardState({
      level: 1,
      selectedPath: null,
    });
    const result = validateWizardStateForApplication(state);
    
    expect(result.isValid).toBe(true);
  });
});

describe('getApplicationSummary', () => {
  it('returns correct summary for standard level 1 character', () => {
    const state = createTestWizardState();
    const summary = getApplicationSummary(state);
    
    expect(summary.character.name).toBe('Test Assassin');
    expect(summary.character.level).toBe(1);
    expect(summary.abilityScores).toEqual(state.abilityScores);
    expect(summary.gameMode).toBe('infinityPool');
    expect(summary.magicPath).toBeNull();
    expect(summary.equipment).toBeNull();
  });

  it('calculates correct HP in summary', () => {
    const state = createTestWizardState({
      level: 5,
      abilityScores: {
        strength: 10,
        dexterity: 15,
        constitution: 16, // +3 modifier
        intelligence: 12,
        wisdom: 10,
        charisma: 8,
      },
    });
    const summary = getApplicationSummary(state);
    
    // Level 1: 8 + 3 = 11
    // Levels 2-5: 4 × (5 + 3) = 32
    // Total: 43
    expect(summary.hp).toBe(43);
  });

  it('calculates correct XP for different presets', () => {
    const standardState = createTestWizardState({ level: 5, xpPreset: 'standard' });
    const fastState = createTestWizardState({ level: 5, xpPreset: 'fastTrack' });
    const milestoneState = createTestWizardState({ level: 5, xpPreset: 'milestone' });
    
    const standardSummary = getApplicationSummary(standardState);
    const fastSummary = getApplicationSummary(fastState);
    const milestoneSummary = getApplicationSummary(milestoneState);
    
    expect(standardSummary.xp).toBe(6500);
    expect(fastSummary.xp).toBe(3250);
    expect(milestoneSummary.xp).toBe(0);
  });

  it('includes magic path when selected', () => {
    const state = createTestWizardState({
      level: 5,
      selectedPath: 'shadow_blade',
    });
    const summary = getApplicationSummary(state);
    
    expect(summary.magicPath).toBe('shadow_blade');
  });

  it('includes equipment preset when selected', () => {
    const state = createTestWizardState({
      selectedPresetId: 'shadow-initiate',
    });
    const summary = getApplicationSummary(state);
    
    expect(summary.equipment).toBe('shadow-initiate');
  });
});

describe('applyWizardState', () => {
  let mockSetters: any;

  beforeEach(() => {
    localStorageMock.clear();
    
    mockSetters = {
      setCharacter: vi.fn(),
      setCurrentXP: vi.fn(),
      setXPPreset: vi.fn(),
      setEquipment: vi.fn(),
      handleHPChange: vi.fn(),
      abilityScores: {
        applyScores: vi.fn(),
      },
      spellcasting: {
        selectPath: vi.fn(),
      },
      toast: vi.fn(),
    };
  });

  it('returns success result for valid state', () => {
    const state = createTestWizardState();
    const result = applyWizardState(state, mockSetters);
    
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.appliedChanges.length).toBeGreaterThan(0);
  });

  it('calls setCharacter with correct name and level', () => {
    const state = createTestWizardState({ name: 'Shadow', level: 7 });
    applyWizardState(state, mockSetters);
    
    expect(mockSetters.setCharacter).toHaveBeenCalled();
    
    // Get the updater function and test it
    const updater = mockSetters.setCharacter.mock.calls[0][0];
    const prevChar = { name: 'Old', level: 1, abilities: [] };
    const result = updater(prevChar);
    
    expect(result.name).toBe('Shadow');
    expect(result.level).toBe(7);
  });

  it('calls setCurrentXP with calculated XP', () => {
    const state = createTestWizardState({ level: 5, xpPreset: 'standard' });
    applyWizardState(state, mockSetters);
    
    expect(mockSetters.setCurrentXP).toHaveBeenCalledWith(6500);
  });

  it('calls setXPPreset with mapped preset', () => {
    const state = createTestWizardState({ xpPreset: 'fastTrack' });
    applyWizardState(state, mockSetters);
    
    expect(mockSetters.setXPPreset).toHaveBeenCalledWith('fast');
  });

  it('calls abilityScores.applyScores with correct scores', () => {
    const scores = {
      strength: 8,
      dexterity: 16,
      constitution: 14,
      intelligence: 12,
      wisdom: 10,
      charisma: 10,
    };
    const state = createTestWizardState({ abilityScores: scores });
    applyWizardState(state, mockSetters);
    
    expect(mockSetters.abilityScores.applyScores).toHaveBeenCalledWith(scores);
  });

  it('calls handleHPChange with correct HP values', () => {
    const state = createTestWizardState({
      level: 5,
      abilityScores: {
        strength: 10,
        dexterity: 15,
        constitution: 14, // +2 modifier
        intelligence: 12,
        wisdom: 10,
        charisma: 8,
      },
    });
    applyWizardState(state, mockSetters);
    
    // Level 1: 8 + 2 = 10
    // Levels 2-5: 4 × (5 + 2) = 28
    // Total: 38
    expect(mockSetters.handleHPChange).toHaveBeenCalledWith(38, 38, 0);
  });

  it('calls spellcasting.selectPath when path is selected', () => {
    const state = createTestWizardState({
      level: 5,
      selectedPath: 'arcane_trickster',
    });
    applyWizardState(state, mockSetters);
    
    expect(mockSetters.spellcasting.selectPath).toHaveBeenCalledWith('arcane_trickster');
  });

  it('does not call spellcasting.selectPath when path is null', () => {
    const state = createTestWizardState({ selectedPath: null });
    applyWizardState(state, mockSetters);
    
    expect(mockSetters.spellcasting.selectPath).not.toHaveBeenCalled();
  });

  it('calls toast with success message', () => {
    const state = createTestWizardState({ name: 'Nightblade' });
    applyWizardState(state, mockSetters);
    
    expect(mockSetters.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining('Nightblade'),
        description: expect.stringContaining('Level'),
      })
    );
  });

  it('saves game mode settings to localStorage', () => {
    const state = createTestWizardState({ gameMode: 'honest' });
    applyWizardState(state, mockSetters);
    
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'odyssey-game-mode',
      expect.any(String)
    );
  });

  it('clears wizard progress from localStorage', () => {
    const state = createTestWizardState();
    applyWizardState(state, mockSetters);
    
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('odyssey-wizard-progress');
  });

  it('handles errors gracefully', () => {
    mockSetters.setCharacter.mockImplementation(() => {
      throw new Error('Test error');
    });
    
    const state = createTestWizardState();
    const result = applyWizardState(state, mockSetters);
    
    expect(result.success).toBe(false);
    expect(result.errors).toContain('Test error');
    expect(mockSetters.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
      })
    );
  });
});

describe('applyQuickStart', () => {
  let mockSetters: any;

  beforeEach(() => {
    localStorageMock.clear();
    
    mockSetters = {
      setCharacter: vi.fn(),
      setCurrentXP: vi.fn(),
      setXPPreset: vi.fn(),
      abilityScores: {
        applyScores: vi.fn(),
      },
      handleHPChange: vi.fn(),
      toast: vi.fn(),
    };
  });

  it('returns success result for valid state', () => {
    const state = createTestWizardState();
    const result = applyQuickStart(state, mockSetters);
    
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('sets XP to 0 for quick start', () => {
    const state = createTestWizardState({ level: 5 });
    applyQuickStart(state, mockSetters);
    
    expect(mockSetters.setCurrentXP).toHaveBeenCalledWith(0);
  });

  it('sets XP preset to standard', () => {
    const state = createTestWizardState({ xpPreset: 'fastTrack' });
    applyQuickStart(state, mockSetters);
    
    expect(mockSetters.setXPPreset).toHaveBeenCalledWith('standard');
  });

  it('applies quick start defaults ability scores', () => {
    const state = createTestWizardState({
      abilityScores: QUICK_START_DEFAULTS.abilityScores!,
    });
    applyQuickStart(state, mockSetters);
    
    expect(mockSetters.abilityScores.applyScores).toHaveBeenCalledWith(
      QUICK_START_DEFAULTS.abilityScores
    );
  });

  it('shows success toast with Quick Start message', () => {
    const state = createTestWizardState({ name: 'QuickAssassin' });
    applyQuickStart(state, mockSetters);
    
    expect(mockSetters.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining('QuickAssassin'),
        description: expect.stringContaining('Quick Start'),
      })
    );
  });

  it('clears wizard progress', () => {
    const state = createTestWizardState();
    applyQuickStart(state, mockSetters);
    
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('odyssey-wizard-progress');
  });
});
