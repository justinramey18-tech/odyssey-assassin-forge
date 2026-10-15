import { describe, it, expect } from 'vitest';
import {
  buildDmLogisticsContext, buildJourneyTranche, calibrationFromMapWidth, formatTravelDistance, planJourneyRoute,
  sanitizeCampaignMapState, suggestStreets, travelGameMinutes, yardsToMiles, type CampaignMapState,
} from '@/lib/campaign-map';

const loc = (id: string, x: number, y: number) => ({ id, name: id.toUpperCase(), x, y, discovered: true, kind: 'landmark' });
const street = (id: string, a: string, b: string, miles: number) =>
  ({ id, fromLocationId: a, toLocationId: b, distanceSource: 'manual', distanceMiles: miles, terrainFactor: 1, path: [] });

const town = (extra: Record<string, unknown> = {}): CampaignMapState => sanitizeCampaignMapState({
  currentLocationId: 'a', imageNaturalWidth: 1000, imageNaturalHeight: 1000,
  locations: [loc('a', 0.1, 0.1), loc('b', 0.2, 0.1), loc('c', 0.9, 0.9)],
  routes: [street('ab', 'a', 'b', 20), street('bc', 'b', 'c', 20)], ...extra,
});

describe('city travel', () => {
  it('a 0.25-mile street at walking pace takes 5 minutes', () => expect(travelGameMinutes(0.25, 'normal')).toBe(5));

  it('a city trip goes all the way with no 8-hour stop', () => {
    const s = town({ travelScale: 'city' });
    const tr = buildJourneyTranche(s, planJourneyRoute(s, 'c')!)!;
    expect(tr.reachesDestination).toBe(true);
    expect(tr.gameMinutes).toBeCloseTo(800);
  });

  it('wilderness maps still stop at the 8-hour travel day', () => {
    const s = town();
    const tr = buildJourneyTranche(s, planJourneyRoute(s, 'c')!)!;
    expect(tr.reachesDestination).toBe(false);
    expect(tr.gameMinutes).toBe(480);
  });

  it('a tiny city trip still takes at least one in-world minute', () => {
    const s = town({ travelScale: 'city', routes: [street('ab', 'a', 'b', 0.001)] });
    expect(buildJourneyTranche(s, planJourneyRoute(s, 'b')!)!.gameMinutes).toBe(1);
  });

  it('only "city" survives as a travel style; anything else is wilderness', () => {
    expect(town({ travelScale: 'city' }).travelScale).toBe('city');
    expect(town({ travelScale: 'weird' }).travelScale).toBeUndefined();
    expect(sanitizeCampaignMapState(JSON.parse(JSON.stringify(town({ travelScale: 'city' })))).travelScale).toBe('city');
  });

  it('city distances read in yards', () => {
    expect(formatTravelDistance(yardsToMiles(340), true)).toBe('340 yd');
    expect(formatTravelDistance(12, false)).toBe('12 mi');
  });

  it('map width sets a scale: full width of 2000 yards', () => {
    const c = calibrationFromMapWidth(1000, 1000, yardsToMiles(2000))!;
    expect(c.milesPerPixel * 1000).toBeCloseTo(yardsToMiles(2000));
  });

  it('suggested streets connect every place once, with no repeats of existing streets', () => {
    const s = sanitizeCampaignMapState({
      imageNaturalWidth: 1000, imageNaturalHeight: 1000,
      locations: [loc('a', 0.1, 0.1), loc('b', 0.15, 0.1), loc('c', 0.12, 0.15), loc('x', 0.9, 0.9), loc('y', 0.95, 0.9), loc('z', 0.9, 0.95)],
      routes: [street('ab', 'a', 'b', 1)],
    });
    let n = 0;
    const list = suggestStreets(s, () => `s${n++}`);
    const keys = list.map(r => [r.fromLocationId, r.toLocationId].sort().join('|'));
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).not.toContain('a|b');
    const all = [...s.routes, ...list];
    const seen = new Set(['a']);
    for (let changed = true; changed;) {
      changed = false;
      for (const r of all) for (const [p, q] of [[r.fromLocationId, r.toLocationId], [r.toLocationId, r.fromLocationId]])
        if (seen.has(p) && !seen.has(q)) { seen.add(q); changed = true; }
    }
    expect(seen.size).toBe(6);
  });

  it('the DM hears city wording and no travel-day talk', () => {
    const s = town({ travelScale: 'city' });
    const c = buildDmLogisticsContext(s, 0);
    expect(c).toMatch(/CITY/);
    expect(c).not.toMatch(/8-hour/);
  });
});
