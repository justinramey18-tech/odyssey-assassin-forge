import { describe, expect, it } from 'vitest';
import { eligibleJourney, journeyHash, targetPoint } from '../../../supabase/functions/_shared/travel-planning';
import { eventClock } from '../../../supabase/functions/_shared/travel-event-clock';
import { buildJourneyTranche, calibrationFromMapWidth, campaignMapPosition, freezeTravel, planJourneyRoute, sanitizeCampaignMapState, trancheToTravel, type TravelPace } from '../campaign-map';

function staged(pace: TravelPace = 'flying', width = 80) {
  const state = sanitizeCampaignMapState({ imageNaturalWidth: 1000, imageNaturalHeight: 500,
    mapCalibration: calibrationFromMapWidth(1000, 500, width), currentLocationId: 'a', campaignMinute: 100,
    locations: [{ id: 'a', name: 'A', x: 0, y: 0, discovered: true }, { id: 'b', name: 'B', x: 1, y: 0, discovered: true }],
    routes: [{ id: 'road', fromLocationId: 'a', toLocationId: 'b', distanceSource: 'manual', distanceMiles: 16, terrainFactor: 2 }] });
  const plan = planJourneyRoute(state, 'b', pace);
  if (!plan) throw new Error('Expected plan');
  const tranche = buildJourneyTranche(state, plan);
  if (!tranche) throw new Error('Expected tranche');
  return sanitizeCampaignMapState({ ...state, currentLocationId: null, journeyPlan: plan, temporaryFlight: plan.temporaryFlight,
    activeTravel: trancheToTravel(tranche, pace, 100, 1) });
}
function required(state = staged()) {
  const j = eligibleJourney(state, 1000);
  if (!j) throw new Error('Expected eligible journey');
  return j;
}
describe('mounted and air private travel', () => {
  it('accepts horseback using 8 mph and road terrain, without flight geometry', () => {
    const j = required(staged('horseback'));
    expect(j.remaining[0].route.id).toBe('road');
    expect(j.travel.gameMinutes).toBe(240);
    expect(j.state.temporaryFlight).toBeUndefined();
  });
  it('uses authoritative 80-mile direct flight rather than the 16-mile road', () => {
    const j = required();
    expect(j.remainingMiles).toBe(80);
    expect(j.travel.gameMinutes).toBe(120);
    expect(j.remaining[0].route).toEqual(j.state.temporaryFlight);
  });
  it('schedules and freezes at the exact halfway point of the straight path', () => {
    const state = staged(), j = required(state), target = targetPoint(j, 0.5);
    expect(target.target_route_progress).toBe(0.5);
    const moving = { ...state, activeTravel: { ...j.travel, startedAt: 1000 } };
    expect(eventClock(moving, { ...target, destination_location_id: 'b' }, 1000)).toMatchObject({
      kind: 'schedule', target_tranche_fraction: 0.5, target_campaign_minute: 160, scheduled_at: new Date(61000).toISOString() });
    expect(campaignMapPosition({ ...state, activeTravel: freezeTravel(moving.activeTravel, 61000) }, 61000)).toEqual({ x: 0.5, y: 0 });
  });
  it('keeps 15–85 percent targets and eight-hour 320-mile flight tranches', () => {
    const j = required(staged('flying', 1000));
    expect(j.travel.gameMinutes).toBe(480);
    expect(j.travel.segments[0].distanceMiles).toBe(320);
    expect(targetPoint(j, 0.15).target_route_progress).toBe(0.15);
    expect(targetPoint(j, 0.85).target_route_progress).toBe(0.85);
    expect(() => targetPoint(j, 0.14)).toThrow();
    expect(() => targetPoint(j, 0.86)).toThrow();
  });
  it('hash survives pause/resume and distinguishes all five methods', async () => {
    const j = required();
    const hashes = await Promise.all(['slow', 'normal', 'fast', 'horseback', 'flying'].map(pace => journeyHash({ ...j, plan: { ...j.plan, pace } })));
    expect(new Set(hashes).size).toBe(5);
    expect(await journeyHash({ ...j, travel: { ...j.travel, startedAt: 9000, pausedFraction: 0.25 } })).toBe(hashes[4]);
  });
  it.each(['slow', 'normal', 'fast', 'horseback', 'flying'] as TravelPace[])('excludes city %s', pace => {
    expect(eligibleJourney({ ...staged(pace), travelScale: 'city' }, 1000)).toBeNull();
  });
  it.each([
    ['absent geometry', (s: any) => { delete s.temporaryFlight; }],
    ['wrong active id', (s: any) => { s.activeTravel.routeId = 'road'; }],
    ['wrong segment id', (s: any) => { s.activeTravel.segments[0].routeId = 'road'; }],
    ['reverse flight', (s: any) => { s.activeTravel.segments[0].reversed = true; }],
    ['wrong endpoint', (s: any) => { s.temporaryFlight.path[1].x = 0.8; }],
    ['terrain penalty', (s: any) => { s.temporaryFlight.terrainFactor = 2; }],
    ['wrong duration', (s: any) => { s.activeTravel.gameMinutes = 240; }],
    ['wrong miles', (s: any) => { s.activeTravel.segments[0].distanceMiles = 16; }],
    ['NaN distance', (s: any) => { s.temporaryFlight.distanceMiles = NaN; }],
    ['extra flight leg', (s: any) => { s.journeyPlan.legs.push(s.journeyPlan.legs[0]); }],
    ['ground graph pollution', (s: any) => { s.routes.push(s.temporaryFlight); }],
  ])('rejects %s without inventing a route', (_label, change) => {
    const state = structuredClone(staged()); change(state);
    expect(eligibleJourney(state, 1000)).toBeNull();
  });
});