import { describe, it, expect } from 'vitest';
import {
  buildDmLogisticsContext, buildJourneyTranche, finishJourneyState, foldTravelToPosition, freezeTravel, planJourneyRoute,
  sanitizeCampaignMapState, settleTravelState, summarizeJourney, trancheToTravel, travelDetail, travelNow, type CampaignMapState,
} from '@/lib/campaign-map';

const loc = (id: string, discovered = true) => ({ id, name: id.toUpperCase(), x: 0.1, y: 0.1, discovered, kind: 'town' });
const road = (id: string, a: string, b: string, miles: number, terrainFactor = 1) =>
  ({ id, fromLocationId: a, toLocationId: b, distanceSource: 'manual', distanceMiles: miles, terrainFactor, path: [] });
const map = (extra: Record<string, unknown>): CampaignMapState => sanitizeCampaignMapState({ currentLocationId: 'a', ...extra });

const start = (s: CampaignMapState, dest: string) => {
  const plan = planJourneyRoute(s, dest)!;
  const tr = buildJourneyTranche(s, plan)!;
  const travel = { ...trancheToTravel(tr, plan.pace, s.campaignMinute, 1), startedAt: 0 }; // 1 real min per game hour
  return { ...s, journeyPlan: plan, activeTravel: travel, currentLocationId: null } as CampaignMapState;
};

describe('journey planning', () => {
  it('picks the shortest travel time across several roads', () => {
    const s = map({ locations: ['a', 'b', 'c', 'd'].map(x => loc(x)), routes: [road('ab', 'a', 'b', 6), road('bc', 'b', 'c', 6), road('ad', 'a', 'd', 20), road('dc', 'd', 'c', 1)] });
    expect(planJourneyRoute(s, 'c')!.legs.map(l => l.routeId)).toEqual(['ab', 'bc']);
  });
  it('terrain changes the choice', () => {
    const s = map({ locations: ['a', 'b', 'c'].map(x => loc(x)), routes: [road('ac', 'a', 'c', 10, 3), road('ab', 'a', 'b', 6), road('bc', 'b', 'c', 6)] });
    expect(planJourneyRoute(s, 'c')!.legs.map(l => l.routeId)).toEqual(['ab', 'bc']);
  });
  it('equal plans always resolve the same way', () => {
    const s = map({ locations: ['a', 'b', 'c', 'd'].map(x => loc(x)), routes: [road('r2', 'a', 'c', 6), road('r3', 'c', 'd', 6), road('r1', 'a', 'b', 6), road('r4', 'b', 'd', 6)] });
    const p1 = planJourneyRoute(s, 'd')!.legs.map(l => l.routeId);
    expect(p1).toEqual(['r1', 'r4']);
    expect(planJourneyRoute(s, 'd')!.legs.map(l => l.routeId)).toEqual(p1);
  });
  it('undiscovered places are neither destinations nor passed through', () => {
    const s = map({ locations: [loc('a'), loc('b', false), loc('c')], routes: [road('ab', 'a', 'b', 5), road('bc', 'b', 'c', 5)] });
    expect(planJourneyRoute(s, 'b')).toBeNull();
    expect(planJourneyRoute(s, 'c')).toBeNull();
  });
  it('disconnected destination is unreachable', () => {
    const s = map({ locations: ['a', 'b', 'c'].map(x => loc(x)), routes: [road('ab', 'a', 'b', 5)] });
    expect(planJourneyRoute(s, 'c')).toBeNull();
  });
  it('starting mid-road uses only the partial distance', () => {
    const s = map({ currentLocationId: null, currentRoutePosition: { routeId: 'ab', progress: 0.25 }, locations: ['a', 'b', 'c'].map(x => loc(x)), routes: [road('ab', 'a', 'b', 12), road('bc', 'b', 'c', 3)] });
    const plan = planJourneyRoute(s, 'c')!;
    expect(plan.legs.map(l => l.routeId)).toEqual(['ab', 'bc']);
    expect(summarizeJourney(s, plan)!.remainingMiles).toBeCloseTo(12); // 9 + 3
    const back = planJourneyRoute(s, 'a')!;
    expect(summarizeJourney(s, back)!.remainingMiles).toBeCloseTo(3);
  });
});

describe('journey travel days', () => {
  const three = () => map({ locations: ['a', 'b', 'c', 'd'].map(x => loc(x)), routes: [road('ab', 'a', 'b', 6), road('bc', 'b', 'c', 6), road('cd', 'c', 'd', 30)] });

  it('one travel day crosses two roads without a stop, then halts mid-road at 8 hours', () => {
    const s = start(three(), 'd');
    const t = s.activeTravel!;
    expect(t.segments!.map(x => x.routeId)).toEqual(['ab', 'bc', 'cd']);
    expect(t.gameMinutes).toBe(480);
    expect(travelDetail(t, 3 * 60_000).routeId).toBe('bc'); // hour 3 of 8, on the second road
    const settled = settleTravelState(s, 9 * 60_000);
    expect(settled.activeTravel).toBeUndefined();
    expect(settled.currentRoutePosition).toMatchObject({ routeId: 'cd', dayComplete: true });
    expect(settled.currentRoutePosition!.progress).toBeCloseTo(12 / 30);
    expect(settled.journeyPlan!.currentLegIndex).toBe(2);
    expect(settled.campaignMinute).toBe(480);
  });
  it('reaching the destination clears the journey', () => {
    const s = start(three(), 'c');
    const done = settleTravelState(s, 10 * 60_000);
    expect(done.currentLocationId).toBe('c');
    expect(done.journeyPlan).toBeUndefined();
    expect(done.currentRoutePosition).toBeUndefined();
  });
  it('pause freezes the whole schedule; resume continues it', () => {
    const s = start(three(), 'd');
    const frozen = freezeTravel(s.activeTravel!, 90_000);
    expect(frozen.segments).toHaveLength(3);
    expect(travelDetail(frozen, 999 * 60_000).routeId).toBe('ab');
    const resumed = { ...frozen, startedAt: 1_000_000 };
    expect(travelNow(resumed, 1_000_000).campaignMinute).toBeCloseTo(90);
    expect(travelDetail(resumed, 1_000_000 + 60_000).routeId).toBe('bc');
  });
  it('a save keeps the journey and the schedule', () => {
    const s = start(three(), 'd');
    const saved = sanitizeCampaignMapState(JSON.parse(JSON.stringify({ ...s, activeTravel: freezeTravel(s.activeTravel!, 4 * 60_000) })));
    expect(saved.journeyPlan!.destinationLocationId).toBe('d');
    expect(saved.activeTravel!.segments).toHaveLength(3);
    expect(saved.activeTravel!.startedAt).toBeNull();
    expect(saved.activeTravel!.pausedFraction).toBeCloseTo(0.5);
  });
  it('a plan pointing at a missing road is dropped on load', () => {
    const s = start(three(), 'd');
    const raw = JSON.parse(JSON.stringify(s));
    raw.journeyPlan.legs[0].routeId = 'gone';
    expect(sanitizeCampaignMapState(raw).journeyPlan).toBeUndefined();
  });
  it('old single-road travel still works', () => {
    const s = map({ locations: ['a', 'b'].map(x => loc(x)), routes: [road('ab', 'a', 'b', 6)], currentLocationId: null,
      activeTravel: { routeId: 'ab', reversed: false, pace: 'normal', startProgress: 0, endProgress: 1, startedAt: 0, realDurationMs: 1000, gameMinutes: 120, startCampaignMinute: 0 } });
    expect(travelNow(s.activeTravel!, 500).progress).toBeCloseTo(0.5);
    expect(settleTravelState(s, 2000).currentLocationId).toBe('b');
  });
  it('cancel stays at the exact point', () => {
    const s = start(three(), 'd');
    const stopped = foldTravelToPosition(s, 3 * 60_000);
    expect(stopped.currentRoutePosition!.routeId).toBe('bc');
    expect(stopped.currentRoutePosition!.progress).toBeCloseTo(0.5);
  });
  it('host finish completes the whole remaining journey and its time', () => {
    const done = finishJourneyState(start(three(), 'd'), 0) as CampaignMapState;
    expect(done.currentLocationId).toBe('d');
    expect(done.campaignMinute).toBeCloseTo(840); // 42 miles at 3 mph
  });
  it('DM is told the destination but arrival is forbidden', () => {
    const c = buildDmLogisticsContext(start(three(), 'd'), 60_000);
    expect(c).toMatch(/bound for D/);
    expect(c).toMatch(/Arrival at D is NOT allowed/);
  });
});
