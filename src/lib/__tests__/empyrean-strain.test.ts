import { describe, it, expect } from 'vitest';
import {
  DAY, STRAIN_HARD_CAP, changeStrain, channelSignet, freshState, lowerStrain, normalizeState, raiseStrain, rest,
  signetStrainCost, strainLimitOf, strainRoom, type CampaignState,
} from '../../../supabase/functions/empyrean-rules/rules';

const at = (day: number, hour: number) => (day - 1) * DAY + hour * 60;
const withStrain = (strain: number, over: Partial<CampaignState> = {}): CampaignState => ({ ...freshState(), strain, ...over });

describe('Signet Strain kept on the server', () => {
  it('starts at 0, survives a save and load, and normalizes junk', () => {
    expect(freshState().strain).toBe(0);
    expect(freshState().strainCooled).toBeNull();
    const s = withStrain(6, { strainCooled: 'msg-1' });
    expect(normalizeState(JSON.parse(JSON.stringify(s)))).toEqual(s);
    expect(normalizeState({ strain: -3 }).strain).toBe(0);
    expect(normalizeState({ strain: 999 }).strain).toBe(STRAIN_HARD_CAP);
    expect(normalizeState({ strain: 'x', strainCooled: 5 })).toMatchObject({ strain: 0, strainCooled: null });
  });

  it('reads the limit the phone sends; no limit means none is known', () => {
    expect(strainLimitOf(10)).toBe(10);
    expect(strainLimitOf(10.9)).toBe(10);
    expect(strainLimitOf(-1)).toBe(0);
    expect(strainLimitOf(99)).toBe(STRAIN_HARD_CAP);
    expect(strainLimitOf(undefined)).toBeNull();
    expect(strainLimitOf(null)).toBeNull();
    expect(strainRoom(withStrain(3), 8)).toBe(5);
    expect(strainRoom(withStrain(9), 8)).toBe(0);
    expect(strainRoom(withStrain(3), null)).toBeNull();
  });

  it('raises up to the limit, never past it, and a rise that reaches the limit costs bond once', () => {
    const a = raiseStrain(withStrain(5), 2, 8, 'x');
    expect(a.state.strain).toBe(7);
    expect(a.events).toEqual([]);
    const b = raiseStrain(withStrain(7), 4, 8, 'Channeled to the limit');
    expect(b.state.strain).toBe(8);
    expect(b.events).toHaveLength(1);
    expect(b.events[0]).toMatchObject({ kind: 'strain_limit', payload: { strain: 8, limit: 8 } });
    expect(b.events[0].idem_key).toBe(`strain-limit:${b.state.seq}`);
    // Already at the limit: nothing changes and no second penalty.
    const c = raiseStrain(b.state, 3, 8, 'x');
    expect(c.state).toBe(b.state);
    expect(c.events).toEqual([]);
    // An unbonded rider (limit 0) never gains strain.
    expect(raiseStrain(withStrain(0), 3, 0, 'x').state.strain).toBe(0);
    expect(raiseStrain(withStrain(0), 3, 0, 'x').events).toEqual([]);
  });

  it('lowers to 0 at most', () => {
    expect(lowerStrain(withStrain(3), 2).strain).toBe(1);
    expect(lowerStrain(withStrain(1), 2).strain).toBe(0);
  });

  it('a channel charges the same cost the phone shows, earns mastery, and is capped at the limit', () => {
    const r = channelSignet(withStrain(1), at(1, 10), 4, 2, 0, 8);
    expect(r.cost).toBe(signetStrainCost(4, 2, 0));
    expect(r.state.strain).toBe(1 + r.cost);
    expect(r.xpDelta).toBeGreaterThan(0);
    const capped = channelSignet(withStrain(6), at(1, 10), 8, 0, 0, 8);
    expect(capped.state.strain).toBe(8);
    expect(capped.events.map(e => e.kind)).toEqual(['strain_limit']);
  });

  it('cools by 1 after a DM reply, counts each reply once, and not after a channel', () => {
    const a = changeStrain(withStrain(4), 'cool', 8, { messageId: 'm1' });
    expect(a.state).toMatchObject({ strain: 3, strainCooled: 'm1' });
    // The same reply again (the app reopened): no second cool-down.
    const again = changeStrain(a.state, 'cool', 8, { messageId: 'm1' });
    expect(again.state.strain).toBe(3);
    // A round where the rider channeled: the reply is counted, strain stays.
    const ch = changeStrain(a.state, 'cool', 8, { messageId: 'm2', channeled: true });
    expect(ch.state).toMatchObject({ strain: 3, strainCooled: 'm2' });
    expect(changeStrain(ch.state, 'cool', 8, { messageId: 'm2' }).state.strain).toBe(3);
    // No reply id: nothing.
    expect(changeStrain(withStrain(4), 'cool', 8, {}).state.strain).toBe(4);
  });

  it('grounding, quest relief, the + button, a revive and a fall', () => {
    expect(changeStrain(withStrain(5), 'ground', 8).state.strain).toBe(3);
    expect(changeStrain(withStrain(8), 'ground_roll', 8).state.strain).toBe(7);
    expect(changeStrain(withStrain(5), 'quest', 8, { amount: 2 }).state.strain).toBe(3);
    expect(changeStrain(withStrain(9), 'quest', 12, { amount: 99 }).state.strain).toBe(5);
    expect(changeStrain(withStrain(9), 'quest', 12, {}).state.strain).toBe(7);
    const up = changeStrain(withStrain(7), 'raise', 8);
    expect(up.state.strain).toBe(8);
    expect(up.events.map(e => e.kind)).toEqual(['strain_limit']);
    expect(changeStrain(withStrain(8), 'revive', 10).state.strain).toBe(9);
    expect(changeStrain(withStrain(8), 'revive', null).state.strain).toBe(7);
    expect(changeStrain(withStrain(8), 'fallen', 10).state.strain).toBe(0);
  });

  it('a short rest eases strain by 2 and a long rest clears it', () => {
    const short = rest(withStrain(5), at(1, 10), 'short');
    expect(short.ok && short.state.strain).toBe(3);
    const long = rest(withStrain(9, { lastLongRestEnd: -100000 }), at(1, 20), 'long');
    expect(long.ok && long.state.strain).toBe(0);
  });
});
