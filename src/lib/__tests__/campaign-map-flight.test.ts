import { describe, expect, it } from 'vitest';
import {
  buildJourneyTranche, calibrationFromMapWidth, campaignMapPosition, finishJourneyState,
  foldTravelToPosition, freezeTravel, listReachableDestinations, maxLegalLeg, planJourneyRoute,
  sanitizeCampaignMapState, settleTravelState, summarizeJourney, trancheToTravel, travelGameMinutes,
  travelRoute, type CampaignMapState, type JourneyPlan,
} from '@/lib/campaign-map';

function world(widthMiles = 1000): CampaignMapState {
  return sanitizeCampaignMapState({
    imageNaturalWidth: 1000, imageNaturalHeight: 500,
    mapCalibration: calibrationFromMapWidth(1000, 500, widthMiles),
    campaignMinute: 120, currentLocationId: 'a', realMinutesPerGameHour: 1,
    locations: [
      { id: 'a', name: 'A', x: 0, y: 0, kind: 'town', discovered: true },
      { id: 'b', name: 'B', x: 1, y: 0, kind: 'town', discovered: true },
      { id: 'c', name: 'C', x: 0.5, y: 1, kind: 'town', discovered: true },
      { id: 'hidden', name: 'Hidden', x: 0.8, y: 1, kind: 'town', discovered: false },
      { id: 'unpinned', name: 'Unpinned', x: null, y: null, kind: 'town', discovered: true },
    ],
    routes: [{ id: 'ab', fromLocationId: 'a', toLocationId: 'b', distanceMiles: 100, distanceSource: 'manual', terrainFactor: 2,
      path: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 0 }] }],
  });
}
function requirePlan(state: CampaignMapState, dest = 'b', pace: 'horseback' | 'flying' = 'flying'): JourneyPlan {
  const plan = planJourneyRoute(state, dest, pace);
  if (!plan) throw new Error('Expected reachable test journey');
  return plan;
}
function staged(state: CampaignMapState, plan = requirePlan(state)): CampaignMapState {
  const tranche = buildJourneyTranche(state, plan);
  if (!tranche) throw new Error('Expected tranche');
  return sanitizeCampaignMapState({ ...state, currentLocationId: null, currentRoutePosition: undefined,
    temporaryFlight: plan.temporaryFlight, journeyPlan: plan, activeTravel: trancheToTravel(tranche, plan.pace, state.campaignMinute, 1) });
}

describe('horseback and direct flight core', () => {
  it('horseback follows the same roads and retains terrain penalties', () => {
    const state = world();
    const plan = requirePlan(state, 'b', 'horseback');
    expect(plan.legs.map(l => l.routeId)).toEqual(['ab']);
    expect(summarizeJourney(state, plan)?.remainingMiles).toBe(100);
    expect(summarizeJourney(state, plan)?.remainingMinutes).toBe(1500);
    expect(travelGameMinutes(8, 'horseback', 2)).toBe(120);
    expect(planJourneyRoute(state, 'c', 'horseback')).toBeNull();
  });
  it('horseback caps at 64 open-road miles and 32 miles with terrain ×2', () => {
    expect(maxLegalLeg(1000, 0, 'horseback', 1).miles).toBe(64);
    expect(maxLegalLeg(1000, 0, 'horseback', 2).miles).toBe(32);
  });
  it('flight uses calibrated straight-line miles, not road mileage or terrain', () => {
    const state = world(); const plan = requirePlan(state);
    expect(plan.legs).toHaveLength(1);
    expect(plan.temporaryFlight?.path).toEqual([{ x: 0, y: 0 }, { x: 1, y: 0 }]);
    expect(summarizeJourney(state, plan)?.remainingMiles).toBe(1000);
    expect(summarizeJourney(state, plan)?.remainingMinutes).toBe(1500);
    expect(travelGameMinutes(40, 'flying', 10)).toBe(60);
    expect(state.routes[0].distanceMiles).toBe(100);
    expect(state.routes[0].terrainFactor).toBe(2);
  });
  it('flight needs no road and previews all discovered pinned destinations', () => {
    const state = world(); state.routes = [];
    expect(listReachableDestinations(state, 'flying').map(d => d.location.id).sort()).toEqual(['b', 'c']);
    expect(planJourneyRoute(state, 'hidden', 'flying')).toBeNull();
    expect(planJourneyRoute(state, 'unpinned', 'flying')).toBeNull();
    expect(planJourneyRoute(state, 'b', 'normal')).toBeNull();
  });
  it('flight requires valid calibration and never guesses distance', () => {
    const state = world(); delete state.mapCalibration;
    expect(planJourneyRoute(state, 'b', 'flying')).toBeNull();
  });
  it('mid-road takeoff starts at the exact interpolated painted road position', () => {
    const state = world(); state.currentLocationId = null;
    state.currentRoutePosition = { routeId: 'ab', progress: 0.5 };
    expect(campaignMapPosition(state)).toEqual({ x: 0.5, y: 1 });
    const plan = requirePlan(state);
    expect(plan.temporaryFlight?.path[0]).toEqual({ x: 0.5, y: 1 });
    expect(plan.totalMiles).toBeCloseTo(Math.hypot(500, 500));
  });
  it('flight day stops after 320 miles, preserves geometry through reload, and continues from there', () => {
    const state = staged(world()); const travel = state.activeTravel;
    if (!travel) throw new Error('Expected flight');
    expect(travel.gameMinutes).toBe(480);
    expect(travel.segments?.[0].distanceMiles).toBe(320);
    const stopped = settleTravelState({ ...state, activeTravel: { ...travel, pausedFraction: 1 } }, 0);
    const reloaded = sanitizeCampaignMapState(JSON.parse(JSON.stringify(stopped)));
    expect(reloaded.currentLocationId).toBeNull();
    expect(reloaded.currentRoutePosition?.progress).toBeCloseTo(0.32);
    expect(reloaded.currentRoutePosition?.dayComplete).toBe(true);
    expect(campaignMapPosition(reloaded)?.x).toBeCloseTo(0.32);
    expect(reloaded.campaignMinute).toBe(600);
    const plan = reloaded.journeyPlan;
    if (!plan) throw new Error('Expected continued flight');
    expect(buildJourneyTranche(reloaded, plan)?.segments[0].startProgress).toBeCloseTo(0.32);
    expect(buildJourneyTranche(reloaded, plan)?.miles).toBe(320);
  });
  it('pause retains precise position across a server re-anchor', () => {
    const state = staged(world(100)); const travel = state.activeTravel;
    if (!travel) throw new Error('Expected flight');
    const paused = freezeTravel({ ...travel, startedAt: 1000 }, 1000 + travel.realDurationMs / 4);
    const saved = sanitizeCampaignMapState({ ...state, activeTravel: paused });
    expect(campaignMapPosition(saved, 1e9)?.x).toBeCloseTo(0.25);
    const resumed = { ...saved, activeTravel: { ...paused, startedAt: 5000 } };
    expect(campaignMapPosition(resumed, 5000)?.x).toBeCloseTo(0.25);
    expect(campaignMapPosition(resumed, 5000 + paused.realDurationMs / 2)?.x).toBeCloseTo(0.625);
  });
  it('manual cancellation keeps midair geometry but does not permit ground routing', () => {
    const state = staged(world(100)); const travel = state.activeTravel;
    if (!travel) throw new Error('Expected flight');
    const cancelled = foldTravelToPosition({ ...state, activeTravel: { ...travel, pausedFraction: 0.4 } }, 0);
    delete cancelled.journeyPlan;
    const saved = sanitizeCampaignMapState(cancelled);
    expect(campaignMapPosition(saved)?.x).toBeCloseTo(0.4);
    expect(saved.currentLocationId).toBeNull();
    expect(saved.routes).toEqual(world(100).routes);
    expect(planJourneyRoute(saved, 'b', 'normal')).toBeNull();
    expect(planJourneyRoute(saved, 'a', 'horseback')).toBeNull();
    const next = requirePlan(saved, 'c');
    expect(next.temporaryFlight?.path[0].x).toBeCloseTo(0.4);
    expect(staged(saved, next).temporaryFlight?.id).toBe(next.temporaryFlight?.id);
    expect(staged(saved, next).routes).toEqual(saved.routes);
  });
  it.each(['arrival', 'finish'] as const)('%s cleans up only temporary flight geometry', (mode) => {
    const base = world(100); const state = staged(base); const travel = state.activeTravel;
    if (!travel) throw new Error('Expected flight');
    const done = mode === 'arrival' ? settleTravelState({ ...state, activeTravel: { ...travel, pausedFraction: 1 } }, 0) : finishJourneyState(state, 0);
    if (typeof done === 'string') throw new Error(done);
    expect(done.currentLocationId).toBe('b');
    expect(done.temporaryFlight).toBeUndefined();
    expect(done.journeyPlan).toBeUndefined();
    expect(done.routes).toEqual(base.routes);
    expect(done.locations).toEqual(base.locations);
    expect(done.campaignMinute).toBe(270);
  });
  it.each([NaN, Infinity, -1, 1e20])('drops malformed flight distance %s safely', (distanceMiles) => {
    const state = staged(world());
    const loaded = sanitizeCampaignMapState({ ...state, temporaryFlight: { ...state.temporaryFlight, distanceMiles } });
    expect(loaded.temporaryFlight).toBeUndefined();
    expect(loaded.activeTravel).toBeUndefined();
    expect(loaded.journeyPlan).toBeUndefined();
    expect(loaded.routes).toEqual(state.routes);
  });
  it('drops oversized or out-of-bounds geometry and rejects flight on real roads', () => {
    const state = staged(world());
    for (const path of [[{ x: -1, y: 0 }, { x: 1, y: 0 }], Array(201).fill({ x: 0, y: 0 })]) {
      expect(sanitizeCampaignMapState({ ...state, temporaryFlight: { ...state.temporaryFlight, path } }).temporaryFlight).toBeUndefined();
    }
    const loaded = sanitizeCampaignMapState({ ...state, activeTravel: { ...state.activeTravel, routeId: 'ab' } });
    expect(loaded.activeTravel).toBeUndefined();
    expect(travelRoute(state, state.activeTravel?.routeId ?? '')?.path).toEqual([{ x: 0, y: 0 }, { x: 1, y: 0 }]);
  });
  it('city walking is unchanged and new overland methods cannot bypass city rules', () => {
    const state = world(); state.travelScale = 'city';
    expect(planJourneyRoute(state, 'b', 'flying')).toBeNull();
    expect(planJourneyRoute(state, 'b', 'horseback')).toBeNull();
    const plan = planJourneyRoute(state, 'b', 'normal');
    if (!plan) throw new Error('Expected city walk');
    expect(buildJourneyTranche(state, plan)?.gameMinutes).toBeCloseTo(4000);
  });
});