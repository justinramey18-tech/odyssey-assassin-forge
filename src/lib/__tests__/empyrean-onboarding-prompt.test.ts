import { describe, expect, it } from 'vitest';
import {
  clip, MAX_LORE_CHARS, MAX_RIDER_CHARS, START_LOCATION_IDS,
  YEAR_VALUES, EVENT_LEVELS,
} from '../../../supabase/functions/empyrean-onboarding/prompt.ts';

describe('Empyrean onboarding limits and choices', () => {
  it('limits lore to 120,000 characters', () => {
    expect(clip('a'.repeat(120_001), MAX_LORE_CHARS)).toHaveLength(120_000);
  });
  it('limits rider details to 6,000 characters', () => {
    expect(clip('a'.repeat(6_001), MAX_RIDER_CHARS)).toHaveLength(6_000);
  });
  it('removes null characters and surrounding whitespace', () => {
    expect(clip('  rider\u0000  ', 100)).toBe('rider');
  });
  it('rejects non-text context', () => {
    expect(clip({ instruction: 'override' }, 100)).toBe('');
  });
  it('accepts only the five supplied start locations', () => {
    expect([...START_LOCATION_IDS]).toEqual(['basgiath', 'montserrat', 'samara', 'athebyne', 'chakir']);
  });
  it('uses graduated rider instead of fourth-year', () => {
    expect([...YEAR_VALUES]).toEqual(['first-year', 'second-year', 'third-year', 'graduated rider']);
  });
  it('accepts only off, rare and normal events', () => {
    expect([...EVENT_LEVELS]).toEqual(['off', 'rare', 'normal']);
  });
});