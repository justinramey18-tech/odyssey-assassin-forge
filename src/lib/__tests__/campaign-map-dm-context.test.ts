import { describe, it, expect } from 'vitest';
import { buildDmLogisticsContext, sanitizeCampaignMapState } from '@/lib/campaign-map';

const base = (extra: Record<string, unknown> = {}) => sanitizeCampaignMapState({
  locations: [{ id: 'a', name: 'Ashford', x: 0.1, y: 0.1, discovered: true, kind: 'town' }, { id: 'g', name: 'Greywatch', x: 0.5, y: 0.5, discovered: true, kind: 'fort' }],
  routes: [{ id: 'r', fromLocationId: 'a', toLocationId: 'g', distanceSource: 'manual', distanceMiles: 40, terrainFactor: 1, path: [] }],
  currentLocationId: 'a', ...extra,
});
const travel = (o: Record<string, unknown>) => ({ routeId: 'r', reversed: false, pace: 'normal', startProgress: 0, endProgress: 0.6, startedAt: 0, realDurationMs: 1000, gameMinutes: 480, startCampaignMinute: 0, ...o });

describe('DM map facts', () => {
  it('forbids arrival mid-journey and reports progress', () => {
    const c = buildDmLogisticsContext(base({ currentLocationId: null, activeTravel: travel({}) }), 500);
    expect(c).toMatch(/NOT allowed yet/);
    expect(c).toMatch(/30% of the road/);
    expect(c).toMatch(/8-hour travel day/);
  });
  it('says paused when paused', () => {
    const c = buildDmLogisticsContext(base({ currentLocationId: null, activeTravel: travel({ startedAt: null, pausedFraction: 0.5 }) }), 0);
    expect(c).toMatch(/PAUSED/);
  });
  it('reports a day-complete stop', () => {
    const c = buildDmLogisticsContext(base({ currentLocationId: null, currentRoutePosition: { routeId: 'r', progress: 0.6, dayComplete: true } }), 0);
    expect(c).toMatch(/travel day has ended/);
  });
});
