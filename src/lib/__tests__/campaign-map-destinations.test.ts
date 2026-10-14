import { describe, it, expect } from 'vitest';
import { listReachableDestinations, remainingJourneyRouteIds, sanitizeCampaignMapState } from '@/lib/campaign-map';

const loc = (id: string, o: Record<string, unknown> = {}) => ({ id, name: id, x: 0.2, y: 0.2, discovered: true, kind: 'town', ...o });
const road = (id: string, a: string, b: string, m: number) => ({ id, fromLocationId: a, toLocationId: b, distanceSource: 'manual', distanceMiles: m, terrainFactor: 1, path: [] });
const atlas = () => sanitizeCampaignMapState({
  currentLocationId: 'arabel',
  locations: [loc('arabel'), loc('mid'), loc('myth'), loc('lost'), loc('secret', { discovered: false }), loc('wheel', { x: null, y: null, parentLocationId: 'myth' })],
  routes: [road('r1', 'arabel', 'mid', 30), road('r2', 'mid', 'myth', 40), road('r3', 'myth', 'secret', 5)],
});

describe('whole-map destinations', () => {
  const ids = () => listReachableDestinations(atlas()).map(d => d.location.id);
  it('a place two roads away is offered', () => expect(ids()).toContain('myth'));
  it('its preview covers every road on the way', () => {
    const d = listReachableDestinations(atlas()).find(x => x.location.id === 'myth')!;
    expect(d.plan.legs.map(l => l.routeId)).toEqual(['r1', 'r2']);
    expect(remainingJourneyRouteIds(d.plan)).toEqual(['r1', 'r2']);
  });
  it('a discovered place with no road is not offered', () => expect(ids()).not.toContain('lost'));
  it('an undiscovered place is not offered', () => expect(ids()).not.toContain('secret'));
  it('unpinned local places are not overland destinations', () => expect(ids()).not.toContain('wheel'));
  it('nothing is offered mid-trip', () => {
    const s = { ...atlas(), activeTravel: { routeId: 'r1', reversed: false, pace: 'normal' as const, startProgress: 0, endProgress: 1, startedAt: 0, realDurationMs: 1, gameMinutes: 1, startCampaignMinute: 0 } };
    expect(listReachableDestinations(s)).toEqual([]);
  });
});
