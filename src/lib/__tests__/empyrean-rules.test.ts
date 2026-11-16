import { describe, it, expect } from 'vitest';
import {
  DAWN, DAY, EVENT_TABLE, QUEST_REWARDS, buildRuleFacts, chargeNeeds, consumeEvent, dayOf, formatTime, freshState,
  masteryRank, nextDawn, normalizeState, passTime, questPayout, resolveCheck, rest, rollEvent, signetStrainCost,
  signetUse, snapDc, storyReward, tick, timeOfDay, unlockList, unmetNeeds, type CampaignState, type Rand,
} from '../../../supabase/functions/empyrean-rules/rules';
import { REWARD_RANGES } from '@/lib/empyrean-quest-hub';
import { campaignDay, formatCampaignTime } from '@/lib/campaign-map';

const seq = (...values: number[]): Rand => { let i = 0; return () => values[Math.min(i++, values.length - 1)]; };
const sheet = { level: 4, maxHp: 30 };
const at = (day: number, hour: number) => (day - 1) * DAY + hour * 60;

describe('clock', () => {
  it('matches the map clock the phone shows', () => {
    for (const m of [0, 359, 360, 1439, 1440, 5000, 123456]) {
      expect(dayOf(m)).toBe(campaignDay(m));
      expect(formatTime(m)).toBe(formatCampaignTime(m));
    }
    expect(timeOfDay(at(1, 3))).toBe('night');
    expect(timeOfDay(at(1, 6))).toBe('dawn');
    expect(timeOfDay(at(1, 14))).toBe('afternoon');
  });
  it('finds the next dawn at least six hours away', () => {
    expect(nextDawn(at(1, 22))).toBe(at(2, 6));
    expect(nextDawn(at(2, 2))).toBe(at(3, 6));
    expect(nextDawn(at(1, 0)) % DAY).toBe(DAWN);
  });
});

describe('state', () => {
  it('normalizes junk into a fresh state and keeps a valid one', () => {
    expect(normalizeState(null)).toEqual(freshState());
    expect(normalizeState({ shortRests: 99, events: { level: 'loud' }, injuries: [{ name: 'Cut', severity: 9 }, 5] }))
      .toMatchObject({ shortRests: 9, events: { level: 'normal' }, injuries: [{ name: 'Cut', severity: 3 }] });
    const s: CampaignState = { ...freshState(), seq: 4, shortRests: 1 };
    expect(normalizeState(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });
  it('rolls daily counters over and ends timed conditions', () => {
    const s = { ...freshState(), shortRests: 2, conditions: [{ id: 'a', name: 'Winded', penalty: 1, untilMinute: at(1, 10) }] };
    expect(tick(s, at(1, 9)).conditions).toHaveLength(1);
    const next = tick(s, at(2, 7));
    expect(next.shortRests).toBe(0);
    expect(next.conditions).toHaveLength(0);
  });
});

describe('Signet Mastery', () => {
  it('ranks up at the thresholds and lowers strain cost, never below 1', () => {
    expect([0, 14, 15, 40, 80, 140, 999].map(masteryRank)).toEqual([0, 0, 1, 2, 3, 4, 4]);
    expect(signetStrainCost(1, 4)).toBe(1);
    expect(signetStrainCost(3, 1)).toBe(3);
    expect(signetStrainCost(3, 2)).toBe(2);
    expect(signetStrainCost(8, 4)).toBe(6);
  });
  it('caps mastery XP per in-game day', () => {
    let s = freshState(); let total = 0;
    for (let i = 0; i < 6; i++) { const u = signetUse(s, at(1, 9), 8); s = u.state; total += u.xpDelta; }
    expect(total).toBe(8);
    expect(signetUse(s, at(2, 9), 2).xpDelta).toBe(1);
  });
});

describe('checks', () => {
  const base = { modifier: 3, risk: 'physical' as const, label: 'Climb the Gauntlet', masteryXp: 0, bond: null };
  it('snaps the DC to the ladder', () => {
    expect([8, 12, 13, 17, 18, 22, 23, 40, NaN].map(snapDc)).toEqual([10, 10, 15, 15, 20, 20, 25, 25, 15]);
  });
  it('decides success and failure from the total', () => {
    expect(resolveCheck(freshState(), 0, sheet, { ...base, d20: 12, dc: 15 }, seq(0.9)).outcome).toBe('success');
    expect(resolveCheck(freshState(), 0, sheet, { ...base, d20: 11, dc: 15 }, seq(0.9)).outcome).toBe('failure');
    expect(resolveCheck(freshState(), 0, sheet, { ...base, d20: 20, dc: 25 }, seq(0.9)).outcome).toBe('success');
    expect(resolveCheck(freshState(), 0, sheet, { ...base, d20: 1, modifier: 30, dc: 10 }, seq(0.9)).outcome).toBe('critical_failure');
  });
  it('adds Signet Mastery and the dragon, subtracts wounds', () => {
    const hurt = { ...freshState(), injuries: [{ id: 'i', name: 'Cracked rib', severity: 2 }] };
    const r = resolveCheck(hurt, 0, sheet, { d20: 10, modifier: 2, dc: 15, risk: 'signet', label: 'Shape the shadow', masteryXp: 40, bond: 65 }, seq(0.9));
    expect(r.total).toBe(10 + 2 + 2 + 2 - 2);
    expect(r.parts).toHaveLength(3);
    expect(r.outcome).toBe('failure');
    expect(r.strain).toBe(1);
  });
  it('rolls real consequences on a physical critical failure, capped at half HP', () => {
    const r = resolveCheck(freshState(), at(1, 9), { ...sheet, maxHp: 10 }, { ...base, d20: 1, dc: 25 }, seq(0.99, 0.99, 0.99, 0.99, 0.1, 0.5));
    expect(r.hp).toBe(-5);
    expect(r.injury?.severity).toBe(1);
    expect(r.state.injuries).toHaveLength(1);
    expect(r.line).toContain('CRITICAL FAILURE');
    expect(r.events[0]).toMatchObject({ kind: 'check', hp: -5, idem_key: 'check:1' });
  });
  it('never damages on a mental check', () => {
    const r = resolveCheck(freshState(), 0, sheet, { ...base, risk: 'mental', d20: 1, dc: 20 }, seq(0.1));
    expect(r.hp).toBe(0);
    expect(r.condition?.name).toBe('Rattled');
  });
});

describe('rest and time', () => {
  it('allows two short rests a day', () => {
    let s = freshState();
    const a = rest(s, at(1, 10), 'short');
    expect(a.ok && a.advance).toBe(60);
    expect(a.ok && a.events[0]).toMatchObject({ kind: 'rest', payload: { rest: 'short', strainDelta: -2 } });
    if (a.ok) s = a.state;
    const b = rest(s, at(1, 11), 'short');
    if (b.ok) s = b.state;
    expect(rest(s, at(1, 12), 'short').ok).toBe(false);
    expect(rest(s, at(2, 8), 'short').ok).toBe(true);
  });
  it('a long rest runs to dawn, heals injuries a step, and cannot be chained', () => {
    const s = { ...freshState(), injuries: [{ id: 'a', name: 'Cut', severity: 1 }, { id: 'b', name: 'Break', severity: 3 }] };
    const r = rest(s, at(1, 21), 'long');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.setMinute).toBe(at(2, 6));
    expect(r.strainReset).toBe(true);
    expect(r.state.injuries).toEqual([{ id: 'b', name: 'Break', severity: 2 }]);
    expect(rest(r.state, at(2, 7), 'long').ok).toBe(false);
    expect(rest(r.state, at(2, 18), 'long').ok).toBe(true);
  });
  it('passing time can feed or fly the dragon, or train', () => {
    expect(passTime(freshState(), 0, 2, 'hunt', true).ok).toBe(false);
    expect(passTime(freshState(), 0, 4, 'hunt', false).ok).toBe(false);
    const hunt = passTime(freshState(), at(5, 8), 4, 'hunt', true);
    expect(hunt.ok && hunt.state.needs.huntMetDay).toBe(5);
    const train = passTime(freshState(), 0, 2, 'train', true);
    expect(train.ok && train.xpDelta).toBe(1);
  });
});

describe("the dragon's needs", () => {
  it('go overdue and charge trust once a day', () => {
    const s = freshState();
    expect(unmetNeeds(s, at(3, 9))).toEqual([]);
    expect(unmetNeeds(s, at(4, 9))).toEqual(['fly']);
    expect(unmetNeeds(s, at(5, 9))).toEqual(['hunt', 'fly']);
    const c = chargeNeeds(s, at(5, 9), true);
    expect(c.events[0]).toMatchObject({ kind: 'dragon_need', idem_key: 'need:5', payload: { trust: -1 } });
    expect(chargeNeeds(c.state, at(5, 20), true).events).toHaveLength(0);
    expect(chargeNeeds(s, at(5, 9), false).events).toHaveLength(0);
  });
});

describe('rewards', () => {
  it('uses the same quest ranges as the Quest Hub', () => {
    expect(QUEST_REWARDS).toEqual(REWARD_RANGES);
  });
  it('pays a quest inside its range, keyed so it can only pay once', () => {
    for (const r of [0, 0.5, 0.999]) {
      const e = questPayout('hard', 'find-the-map', 'Find the map', seq(r));
      expect(e.xp).toBeGreaterThanOrEqual(250); expect(e.xp).toBeLessThanOrEqual(600);
      expect(e.gold).toBeGreaterThanOrEqual(40); expect(e.gold).toBeLessThanOrEqual(150);
      expect(e.idem_key).toBe('quest:find-the-map');
    }
    expect(questPayout('nonsense', 'k', 't', seq(0)).xp).toBe(100);
  });
  it('snaps and caps story rewards per day, and lets spending through', () => {
    let s = freshState();
    const a = storyReward(s, 0, 'xp', 5000, 4, 'DM'); s = a.state;
    expect(a.granted).toBe(150);
    const b = storyReward(s, 0, 'xp', 5000, 4, 'DM'); s = b.state;
    const c = storyReward(s, 0, 'xp', 5000, 4, 'DM'); s = c.state;
    expect(storyReward(s, 0, 'xp', 5000, 4, 'DM').granted).toBe(0);
    expect(storyReward(s, at(2, 1), 'xp', 30, 4, 'DM').granted).toBe(25);
    expect(storyReward(s, 0, 'gold', -40, 4, 'Bought a blade').events[0]).toMatchObject({ gold: -40 });
    expect(storyReward(s, 0, 'xp', -10, 4, 'DM').granted).toBe(0);
  });
});

describe('random events', () => {
  it('respects off, one a day, and journeys', () => {
    const off = { ...freshState(), events: { level: 'off' as const, lastEventDay: 0, pending: null } };
    expect(rollEvent(off, 0, 'fort', false, seq(0)).events.pending).toBeNull();
    expect(rollEvent(freshState(), 0, 'fort', true, seq(0)).events.pending).toBeNull();
    const got = rollEvent(freshState(), at(1, 10), 'fort', false, seq(0, 0));
    expect(got.events.pending?.id).toBe('c-challenge');
    const cleared = consumeEvent(got);
    expect(rollEvent(cleared, at(1, 20), 'fort', false, seq(0, 0)).events.pending).toBeNull();
    expect(rollEvent(cleared, at(2, 10), 'fort', false, seq(0, 0)).events.pending).not.toBeNull();
  });
  it('keeps night events for the night', () => {
    const night = rollEvent(freshState(), at(1, 23), 'fort', false, seq(0, 0.99));
    expect(EVENT_TABLE.college.find(e => e.id === night.events.pending?.id)?.when).not.toBe('day');
  });
});

describe('facts and unlocks', () => {
  it('tells the DM the time, rests, wounds, and the pending event', () => {
    const s = rollEvent({ ...freshState(), injuries: [{ id: 'i', name: 'Cracked rib', severity: 2 }] }, at(2, 10), 'fort', false, seq(0, 0));
    const facts = buildRuleFacts(s, { minute: at(2, 10), masteryXp: 40, bond: 30, bonded: true, traveling: false });
    expect(facts).toContain('Day 2, 10:00');
    expect(facts).toContain('Cracked rib (serious)');
    expect(facts).toContain('Tempered');
    expect(facts).toContain('EVENT TO WORK INTO YOUR NEXT REPLY');
    expect(buildRuleFacts(s, { minute: at(2, 10), masteryXp: 0, bond: null, bonded: false, traveling: true })).not.toContain('EVENT TO WORK');
  });
  it('lists unlocks from mastery and bond', () => {
    const u = unlockList(40, 45);
    expect(u.filter(x => x.unlocked).map(x => x.id)).toEqual(['m1', 'm2', 'b1', 'b2']);
    expect(unlockList(0, null).some(x => x.unlocked)).toBe(false);
  });
});

// The server's copy of the journey math must agree with the map library the phone uses.
import * as T from '../../../supabase/functions/empyrean-rules/travel';
import { freezeTravel, travelFraction, travelNow, type ActiveTravel } from '@/lib/campaign-map';

describe('journey math (server copy)', () => {
  const leg: ActiveTravel = { routeId: 'r1', reversed: false, pace: 'flying', startProgress: 0, endProgress: 1, startedAt: 1_000_000, realDurationMs: 600_000, gameMinutes: 120, startCampaignMinute: 600, pausedFraction: 0.25 };
  const atlas = (t: ActiveTravel | undefined, minute = 600) => ({ activeMapId: 'm', campaignMinute: minute, revision: 4, maps: [{ id: 'm', name: 'W', state: t ? { activeTravel: t } : {} }] });
  it('agrees with the phone on progress and the clock', () => {
    for (const now of [1_000_000, 1_150_000, 1_450_000, 9_999_999]) {
      expect(T.travelFraction(leg as any, now)).toBeCloseTo(travelFraction(leg, now), 10);
      expect(T.currentMinute(atlas(leg), now)).toBeCloseTo(travelNow(leg, now).campaignMinute, 6);
    }
    const frozen = freezeTravel(leg, 1_300_000);
    expect(T.travelFraction(frozen as any, 5_000_000)).toBeCloseTo(travelFraction(frozen, 5_000_000), 10);
    expect(T.currentMinute(atlas(undefined, 777), 0)).toBe(777);
  });
  it('times, anchors and pauses a leg', () => {
    const staged = { ...leg, startedAt: null } as any;
    expect(T.remainingRealMs(staged)).toBe(450_000);
    const at = T.fireAtMs(staged, 2_000_000, 0.625);
    expect(T.travelFraction({ ...staged, startedAt: 2_000_000 }, at)).toBeCloseTo(0.625, 10);
    const paused = T.pauseTravelAt(T.anchorTravel(staged, 2_000_000), 0.625);
    expect(paused).toMatchObject({ startedAt: null, pausedFraction: 0.625 });
    const next = T.withTravel(atlas(leg) as any, 0, paused);
    expect(next.revision).toBe(5);
    expect(T.isFlying(T.activeNode(next))).toBe(false);
    expect(T.isFlying(T.activeNode(atlas(leg)))).toBe(true);
    expect(T.trancheKey(leg as any)).toBe('r1|600|120');
  });
  it('reads the planner strictly', () => {
    expect(T.parseDecision('{"event":true,"eventType":"omen","premise":"Wings in the cloud.","targetFraction":0.99}')).toMatchObject({ event: true, targetFraction: 0.85 });
    expect(T.parseDecision('{"event":true,"premise":"","targetFraction":0.5}').event).toBe(false);
    expect(T.parseDecision('not json').event).toBe(false);
  });
});
