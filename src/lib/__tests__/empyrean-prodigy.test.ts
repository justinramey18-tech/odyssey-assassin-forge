import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import * as P from '../empyreanClasses/prodigy';
import * as R from '../../../supabase/functions/empyrean-rules/rules';
import * as C from '../../../supabase/functions/empyrean-rules/combat';

const sheet = { level: 10, maxHp: 50, riderClass: 'prodigy' };
const start = (prodigy?: number) => C.startFight({
  id: 'test-fight', riderName: 'Rider', level: 10, maxHp: 50, hp: 50, ac: 14,
  foeKind: 'wyvern', count: 2, challenge: 'hard', lethal: true, arena: 'ground',
  dragon: { name: 'Dragon', hp: null, bond: 45 }, masteryXp: 0, prodigy,
}, 0, () => 0.5);

describe('solo Prodigy rules', () => {
  it('keeps server and phone rules byte-identical', () => {
    expect(readFileSync('supabase/functions/empyrean-rules/prodigy.ts', 'utf8'))
      .toBe(readFileSync('src/lib/empyreanClasses/prodigy.ts', 'utf8'));
  });
  it.each([[1, 1], [4, 1], [5, 2], [9, 2], [10, 3], [14, 3], [15, 4], [19, 4], [20, 5]])(
    'level %i reaches Ascension tier %i', (level, tier) => expect(P.ascensionTier(level)).toBe(tier),
  );
  it('accepts only the exact Prodigy class', () => {
    expect(R.normalizeSheet(sheet).riderClass).toBe('prodigy');
    expect(R.normalizeSheet({ ...sheet, riderClass: 'wizard' }).riderClass).toBeNull();
    expect(P.prodigyTier(undefined, 20)).toBe(0);
  });
  it('adds one strain capacity per tier and permits a cap of sixteen', () => {
    expect([1, 2, 3, 4, 5].map(t => P.prodigyStrainBonus(t as P.ProdigyTier))).toEqual([1, 2, 3, 4, 5]);
    expect(P.PRODIGY_STRAIN_CAP).toBe(16);
  });
  it('discounts intensity three at Awakened and intensity five twice at Paragon', () => {
    expect(R.signetStrainCost(3, 0, 1)).toBe(3);
    expect(R.signetStrainCost(3, 0, 2)).toBe(2);
    expect(R.signetStrainCost(5, 0, 4)).toBe(3);
    expect(R.signetStrainCost(3, 4, 5)).toBe(1);
  });
  it('doubles per-use mastery and caps daily mastery at sixteen', () => {
    let state = R.freshState();
    expect(R.signetUse(state, 0, 8, 1).xpDelta).toBe(6);
    for (let i = 0; i < 5; i++) state = R.signetUse(state, 0, 8, 1).state;
    expect(state.signet.xpToday).toBe(16);
    expect(R.signetUse(state, R.DAY, 8, 1).xpDelta).toBe(6);
    expect(R.masteryDailyXp(0)).toBe(8);
  });
  it('adds tier-based signet checks and extra assistance only with a dragon', () => {
    const input = { d20: 10, modifier: 0, dc: 15, risk: 'signet' as const, label: 'Channel', masteryXp: 0, bond: 45 };
    expect(R.resolveCheck(R.freshState(), 0, sheet, input, () => 0.5).total).toBe(14);
    expect(R.resolveCheck(R.freshState(), 0, sheet, { ...input, bond: null }, () => 0.5).total).toBe(12);
    expect([0, 1, 2, 3, 4, 5].map(t => P.prodigyCheckBonus(t as P.ProdigyTier))).toEqual([0, 1, 1, 2, 2, 3]);
  });
  it.each([[1, 1], [5, 1], [10, 2], [15, 2], [20, 3]])(
    'level %i has %i briefs per in-game day', (level, count) => {
      const rider = { ...sheet, level };
      let state = R.freshState();
      for (let i = 0; i < count; i++) {
        const result = R.battleBrief(state, 0, rider);
        expect(result.ok).toBe(true);
        if (result.ok) state = result.state;
      }
      expect(R.battleBrief(state, 0, rider).ok).toBe(false);
      expect(R.briefsLeft(state, R.DAY, rider)).toBe(count);
    },
  );
  it('denies briefs to ordinary riders and normalizes old counters', () => {
    const state = R.normalizeState({});
    expect(state.briefs).toEqual({ day: 1, n: 0 });
    expect(R.battleBrief(state, 0, { level: 20, maxHp: 50 }).ok).toBe(false);
  });
  it('raises dragon fight HP by ten percent per tier', () => {
    expect(start(3).dragon?.maxHp).toBe(234);
    expect(start().dragon?.maxHp).toBe(180);
  });
  it('shortens dragon and rider timing by half a second per tier', () => {
    expect(P.prodigyDragonIntervalMs(3, 10000)).toBe(8500);
    const fight = start(3);
    C.advance(fight, 6000, () => 0.5);
    expect(fight.dragon?.nextAt).toBe(14500);
    C.act(fight, 6000, { type: 'attack', targetId: 'e1' }, () => 0.5);
    expect(fight.rider.readyAt).toBe(12500);
  });
  it('changes fire cadence and shielding thresholds at the supplied tiers', () => {
    expect([0, 2, 3, 5].map(t => P.prodigyFireEvery(t as P.ProdigyTier))).toEqual([3, 3, 2, 2]);
    expect([0, 1, 2, 3, 4, 5].map(t => P.prodigyShieldBond(t as P.ProdigyTier))).toEqual([61, 61, 41, 41, 21, 21]);
  });
  it('adds tier dice to signet strikes and applies the strain discount', () => {
    const fight = start(3);
    const result = C.act(fight, 1500, { type: 'signet', targetId: 'e1', intensity: 3, strainRoom: 8 }, () => 0.5);
    expect(result).toMatchObject({ ok: true, strain: 2 });
    expect(fight.enemies[0].maxHp - fight.enemies[0].hp).toBe(24);
  });
  it('adds the tier to fleeing without changing ordinary riders', () => {
    const ordinary = start();
    const prodigy = start(3);
    C.act(ordinary, 1500, { type: 'flee' }, () => 0.1);
    C.act(prodigy, 1500, { type: 'flee' }, () => 0.1);
    expect(ordinary.status).toBe('active');
    expect(prodigy.outcome).toBe('fled');
  });
  it('plays fights without a saved tier like tier-zero fights', () => {
    const legacy = start();
    delete legacy.prodigy;
    const normal = start(0);
    C.advance(legacy, 16000, () => 0.5);
    C.advance(normal, 16000, () => 0.5);
    delete normal.prodigy;
    expect(legacy).toEqual(normal);
  });
});