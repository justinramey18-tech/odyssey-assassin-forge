// Spell Customization Utilities

import { HomebrewSpell, SpellCustomizationState, DEFAULT_SPELL_CUSTOMIZATION_STATE } from './types';
import { SpellDefinition, SpellSchool } from '@/lib/magic/types';

const STORAGE_KEY = 'odyssey-spell-customization';

/**
 * Generate a unique ID for homebrew spells
 */
export function generateHomebrewSpellId(): string {
  return `homebrew_spell_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Load spell customization state from localStorage
 */
export function loadSpellCustomization(): SpellCustomizationState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_SPELL_CUSTOMIZATION_STATE;
    const parsed = JSON.parse(stored);
    return {
      ...DEFAULT_SPELL_CUSTOMIZATION_STATE,
      ...parsed,
    };
  } catch {
    return DEFAULT_SPELL_CUSTOMIZATION_STATE;
  }
}

/**
 * Save spell customization state to localStorage
 */
export function saveSpellCustomization(state: SpellCustomizationState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save spell customization:', e);
  }
}

/**
 * Validate a homebrew spell has required fields
 */
export function validateHomebrewSpell(spell: Partial<HomebrewSpell>): string[] {
  const errors: string[] = [];
  if (!spell.name?.trim()) errors.push('Name is required');
  if (spell.level === undefined || spell.level < 0 || spell.level > 9) errors.push('Valid spell level is required');
  if (!spell.school) errors.push('School is required');
  if (!spell.description?.trim()) errors.push('Description is required');
  return errors;
}

/**
 * Create a default homebrew spell template
 */
export function createDefaultHomebrewSpell(): Partial<HomebrewSpell> {
  return {
    id: generateHomebrewSpellId(),
    name: '',
    level: 1 as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9,
    school: 'evocation' as SpellSchool,
    castingTime: 'action',
    range: '60 feet',
    components: { verbal: true, somatic: true },
    duration: 'Instantaneous',
    concentration: false,
    ritual: false,
    description: '',
    iconName: 'Sparkles',
    isHomebrew: true as const,
    personalityQuips: {
      thunderhead: '',
      jarvis: '',
      deadpool: '',
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
