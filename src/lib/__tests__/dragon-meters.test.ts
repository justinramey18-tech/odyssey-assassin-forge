import { describe, it, expect } from 'vitest';
import {
  applyMeterChange,
  bondStrainBonus,
  bondTier,
  metersFromLegacy,
  neglectChargedThrough,
  neglectWeeks,
  strainCeiling,
  trustGainMultiplier,
  trustTier,
  unlockState,
  UNLOCKS,
} from '@/lib/dragon-meters';

describe('bond (two-way, floor 15)', () => {
  it('rises and falls, but a loss stops at the floor', () => {
    expect(applyMeterChange({ bond: 40, trust: 10, wounds: 0 }, { bond: 3 }).meters.bond).toBe(43);
    expect(applyMeterChange({ bond: 40, trust: 10, wounds: 0 }, { bond: -2 }).meters.bond).toBe(38);
    const r = applyMeterChange({ bond: 16, trust: 10, wounds: 0 }, { bond: -2 });
    expect(r.meters.bond).toBe(15);
    expect(r.applied.bond).toBe(-1);
  });

  it('never pushes a pair that starts under the floor any lower, and caps at 100', () => {
    expect(applyMeterChange({ bond: 0, trust: 0, wounds: 0 }, { bond: -2 }).meters.bond).toBe(0);
    expect(applyMeterChange({ bond: 99, trust: 0, wounds: 0 }, { bond: 6 }).meters.bond).toBe(100);
  });
});

describe('trust wounds (repairable)', () => {
  it('a loss of 5 or more opens a wound; a smaller loss does not', () => {
    const big = applyMeterChange({ bond: 30, trust: 40, wounds: 0 }, { trust: -5 });
    expect(big.meters).toEqual({ bond: 30, trust: 35, wounds: 1 });
    expect(big.woundOpened).toBe(true);
    const small = applyMeterChange({ bond: 30, trust: 40, wounds: 0 }, { trust: -3 });
    expect(small.meters.wounds).toBe(0);
  });

  it('wounds cap at 3 and each cuts trust gains by 20% (never below +1)', () => {
    expect(applyMeterChange({ bond: 30, trust: 40, wounds: 3 }, { trust: -8 }).meters.wounds).toBe(3);
    expect(trustGainMultiplier(0)).toBe(1);
    expect(trustGainMultiplier(2)).toBeCloseTo(0.6);
    expect(trustGainMultiplier(9)).toBeCloseTo(0.4);
    expect(applyMeterChange({ bond: 30, trust: 40, wounds: 2 }, { trust: 5 }).meters.trust).toBe(43);
    expect(applyMeterChange({ bond: 30, trust: 40, wounds: 3 }, { trust: 1 }).meters.trust).toBe(41);
  });

  it('amends close one wound', () => {
    const r = applyMeterChange({ bond: 30, trust: 40, wounds: 2 }, { amends: true, bond: 4, trust: 3 });
    expect(r.meters.wounds).toBe(1);
    expect(r.woundClosed).toBe(true);
    expect(applyMeterChange({ bond: 30, trust: 40, wounds: 0 }, { amends: true }).woundClosed).toBe(false);
  });

  it('old ruptures become wounds, at most 3', () => {
    expect(metersFromLegacy({ bond: 22, trust: 31, ruptures: 1 } as any)).toEqual({ bond: 22, trust: 31, wounds: 1 });
    expect(metersFromLegacy({ bond: 22, trust: 31, ruptures: 7 } as any).wounds).toBe(3);
    expect(metersFromLegacy({ bond: 22, trust: 31, ruptures: 7, wounds: 0 } as any).wounds).toBe(0);
    expect(metersFromLegacy({} as any)).toEqual({ bond: 15, trust: 10, wounds: 0 });
  });
});

describe('neglect (charged once per full week)', () => {
  const day = 24 * 60 * 60 * 1000;
  const contact = '2026-11-01T00:00:00.000Z';
  const t0 = Date.parse(contact);

  it('counts full weeks since contact, then only new weeks after a charge', () => {
    expect(neglectWeeks(contact, null, t0 + 6 * day)).toBe(0);
    expect(neglectWeeks(contact, null, t0 + 15 * day)).toBe(2);
    const through = neglectChargedThrough(contact, null, 2);
    expect(through).toBe('2026-11-15T00:00:00.000Z');
    expect(neglectWeeks(contact, through, t0 + 20 * day)).toBe(0);
    expect(neglectWeeks(contact, through, t0 + 22 * day)).toBe(1);
  });

  it('new contact restarts the clock; no contact on record means no charge', () => {
    expect(neglectWeeks('2026-11-20T00:00:00.000Z', '2026-11-15T00:00:00.000Z', t0 + 22 * day)).toBe(0);
    expect(neglectWeeks(null, null, t0 + 100 * day)).toBe(0);
  });
});

describe('tiers, strain limit and unlocks', () => {
  it('names the tiers', () => {
    expect(bondTier(20).name).toBe('New');
    expect(bondTier(21).name).toBe('Growing');
    expect(bondTier(81).name).toBe('Legendary');
    expect(trustTier(0).name).toBe('Wary');
    expect(trustTier(61).name).toBe('Deep');
  });

  it('bond adds Signet Strain: Strong +1, Deep +2, Legendary +3, cap 12 with the Quest Hub', () => {
    expect(bondStrainBonus(40)).toBe(0);
    expect(bondStrainBonus(41)).toBe(1);
    expect(bondStrainBonus(90)).toBe(3);
    expect(strainCeiling(30)).toBe(8);
    expect(strainCeiling(65, 9)).toBe(11);
    expect(strainCeiling(90, 10)).toBe(12);
  });

  it('marks unlocks open, coming (built later) or locked', () => {
    const strain1 = UNLOCKS.find(u => u.title === 'Signet Strain +1');
    const mind = UNLOCKS.find(u => u.title === 'Mind-speak');
    if (!strain1 || !mind) throw new Error('Required unlocks are missing');
    expect(unlockState(strain1, { bond: 41, trust: 0, wounds: 0 })).toBe('open');
    expect(unlockState(strain1, { bond: 40, trust: 0, wounds: 0 })).toBe('locked');
    expect(unlockState(mind, { bond: 21, trust: 0, wounds: 0 })).toBe('coming');
  });
});
