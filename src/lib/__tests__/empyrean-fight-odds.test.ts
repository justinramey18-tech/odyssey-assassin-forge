import { describe, it, expect } from 'vitest';

import * as C from '../../../supabase/functions/empyrean-rules/combat';

import { DICE_ODDS_CONFIGS, type DiceOddsMode } from '@/lib/diceOdds';



const fixed = (...values: number[]) => { let i = 0; return () => values[Math.min(i++, values.length - 1)]; };



describe('dice odds in solo fights', () => {

  it('keeps the server brackets equal to the phone setting', () => {

    for (const mode of Object.keys(DICE_ODDS_CONFIGS) as DiceOddsMode[]) {

      const phone = DICE_ODDS_CONFIGS[mode].brackets.map(b => ({ chance: b.chance, min: b.min, max: b.max }));

      expect(C.ODDS_BRACKETS[mode]).toEqual(phone);

    }

    expect(Object.keys(C.ODDS_BRACKETS).sort()).toEqual(Object.keys(DICE_ODDS_CONFIGS).sort());

  });

  it('rolls fair dice when no odds are set', () => {

    expect(C.oddsD20(fixed(0), undefined)).toBe(1);

    expect(C.oddsD20(fixed(0.999), 'fair')).toBe(20);

  });

  it('follows the brackets for a weighted mode', () => {

    expect(C.oddsD20(fixed(0.5), 'godmode')).toBe(20);

    expect(C.oddsD20(fixed(0.5), 'doomed')).toBe(1);

    // Heroic: the first 15% is a natural 20; the next 65% is 15 to 19.

    expect(C.oddsD20(fixed(0.1, 0), 'heroic')).toBe(20);

    expect(C.oddsD20(fixed(0.2, 0), 'heroic')).toBe(15);

    expect(C.oddsD20(fixed(0.2, 0.999), 'heroic')).toBe(19);

    for (let i = 0; i < 200; i++) {

      const roll = C.oddsD20(Math.random, 'chaotic');

      expect(roll).toBeGreaterThanOrEqual(1);

      expect(roll).toBeLessThanOrEqual(20);

    }

  });

  it('treats an unknown mode as fair', () => {

    expect(C.cleanOdds('heroic')).toBe('heroic');

    expect(C.cleanOdds('nonsense')).toBe('fair');

    expect(C.cleanOdds(null)).toBe('fair');

  });

  it('uses the odds in an attack roll only when they are given', () => {

    expect(C.attackRoll(fixed(0), 5, 10).d20).toBe(1);

    const weighted = C.attackRoll(fixed(0.5), 0, 30, 'godmode');

    expect(weighted.d20).toBe(20);

    expect(weighted.crit).toBe(true);

    expect(weighted.hit).toBe(true);

  });

});