import { describe, it, expect } from 'vitest';
import { CAL_END_DAY, CANON_BEATS, calendarFacts, canonDayOf, dateLabel, dayName } from '../../../supabase/functions/empyrean-rules/calendar';
import { buildRuleFacts, calendarView, freshState, normalizeState, setCalendar } from '../../../supabase/functions/empyrean-rules/rules';

describe('Empyrean canon calendar', () => {
  it('turns canon days into dates', () => {
    expect(dateLabel(1)).toBe('July 20, 633 AU');
    expect(canonDayOf(10, 1)).toBe(74);
    expect(dateLabel(74)).toBe('October 1, 633 AU');
    expect(dateLabel(canonDayOf(12, 31))).toBe('December 31, 633 AU');
    expect(dateLabel(canonDayOf(1, 1, 1))).toBe('January 1, 634 AU');
    expect(dateLabel(CAL_END_DAY)).toBe('July 2, 634 AU');
    expect(dayName(1)).toBe('Conscription Day');
    expect(dayName(5)).toBeNull();
  });
  it('keeps every beat inside the year, in order', () => {
    for (const b of CANON_BEATS) {
      expect(b.from).toBeGreaterThanOrEqual(1);
      expect(b.to).toBeGreaterThanOrEqual(b.from);
      expect(b.to).toBeLessThanOrEqual(CAL_END_DAY);
    }
  });
  it('tells the DM what is happening today and what is coming', () => {
    const first = calendarFacts(1);
    expect(first).toContain('today is July 20, 633 AU (Conscription Day)');
    expect(first).toContain('Happening now:');
    expect(first).toContain('Coming up (every cadet knows the schedule): Challenges begin in 14 days.');
    expect(calendarFacts(74)).toContain('The Threshing');
    expect(calendarFacts(600)).toContain("The app's canon calendar ends");
  });
  it('rides on the clock and the campaign offset', () => {
    const s = freshState();
    expect(calendarView(s, 480).day).toBe(1);
    expect(calendarView(s, 480 + 3 * 1440).day).toBe(4);
    const moved = setCalendar(s, 480 + 3 * 1440, 1);
    expect(moved.calOffset).toBe(-3);
    expect(calendarView(moved, 480 + 3 * 1440).label).toBe('July 20, 633 AU');
    expect(calendarView(moved, 480 + 4 * 1440).day).toBe(2);
    expect(normalizeState({}).calOffset).toBe(0);
    expect(normalizeState({ calOffset: 12 }).calOffset).toBe(12);
    expect(buildRuleFacts(s, { minute: 480, masteryXp: 0, bond: null, bonded: false, traveling: false })).toContain('Calendar: today is July 20, 633 AU');
  });
});
