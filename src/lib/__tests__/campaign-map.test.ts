import { describe, it, expect } from 'vitest';
import {
  TRAVEL_PACE_MPH, TRAVEL_DAY_MINUTES, TIME_COMPRESSION_PRESETS, createCalibration, effectiveRouteMiles,
  gameToRealMs, maxLegalLeg, polylineMiles, replaceMapImage, sanitizeCampaignMapState, travelGameMinutes,
  formatCampaignTime, freezeTravel, travelNow, locationOverlayMode, routeOverlayMode, type CampaignMapRoute,
} from '@/lib/campaign-map';

const route = (over: Partial<CampaignMapRoute> = {}): CampaignMapRoute => ({
  id: 'r', fromLocationId: 'a', toLocationId: 'b', distanceMiles: 0, distanceSource: 'calibrated', terrainFactor: 1,
  path: [{ x: 0, y: 0 }, { x: 0.5, y: 0 }], ...over,
});

describe('campaign map rules', () => {
  it('paces are 2 / 3 / 4 mph', () => expect(TRAVEL_PACE_MPH).toEqual({ slow: 2, normal: 3, fast: 4 }));
  it('travel day is 8 hours', () => expect(TRAVEL_DAY_MINUTES).toBe(480));
  it('presets are 1, 5, 15, 60 real minutes per game hour', () =>
    expect(TIME_COMPRESSION_PRESETS.map(p => p.realMinutesPerGameHour)).toEqual([1, 5, 15, 60]));

  it('calibrated route miles come from the traced length', () => {
    const cal = createCalibration({ x: 0, y: 0 }, { x: 0.1, y: 0 }, 1000, 500, 10)!; // 100 px = 10 mi
    expect(polylineMiles(route().path, cal)).toBeCloseTo(50);
  });
  it('without calibration a calibrated route has no distance (never invented)', () =>
    expect(effectiveRouteMiles(route(), null)).toBeNull());
  it('manual distance wins over the calibrated estimate', () => {
    const cal = createCalibration({ x: 0, y: 0 }, { x: 0.1, y: 0 }, 1000, 500, 10)!;
    expect(effectiveRouteMiles(route({ distanceSource: 'manual', distanceMiles: 7 }), cal)).toBe(7);
  });
  it('replacing the image drops the calibration', () => {
    const s = sanitizeCampaignMapState({ imageUrl: 'x', imageNaturalWidth: 1000, imageNaturalHeight: 500,
      mapCalibration: { imageWidth: 1000, imageHeight: 500, a: { x: 0, y: 0 }, b: { x: 0.1, y: 0 }, knownMiles: 10 } });
    expect(s.mapCalibration).toBeDefined();
    expect(replaceMapImage(s, 'y', 1000, 500).mapCalibration).toBeUndefined();
  });
  it('12 miles at normal pace takes 4 game hours', () => expect(travelGameMinutes(12, 'normal')).toBe(240));
  it('a 30-mile leg at normal pace stops at the 8-hour day (24 miles)', () => {
    const leg = maxLegalLeg(30, 0, 'normal', 1);
    expect(leg.reachesEnd).toBe(false);
    expect(leg.miles).toBeCloseTo(24);
    expect(leg.gameMinutes).toBe(480);
  });
  it('Standard compression: 1 game hour = 5 real minutes', () => expect(gameToRealMs(60, 5)).toBe(300_000));
  it('formats Day N and time', () => expect(formatCampaignTime(1440 * 2 + 14 * 60 + 5)).toBe('Day 3, 14:05'));
  it('freezing travel keeps progress for saving', () => {
    const t = { routeId: 'r', reversed: false, pace: 'normal' as const, startProgress: 0, endProgress: 1, startedAt: 0, realDurationMs: 1000, gameMinutes: 60, startCampaignMinute: 0 };
    const frozen = freezeTravel(t, 500);
    expect(frozen.startedAt).toBeNull();
    expect(travelNow(frozen, 99_999).progress).toBeCloseTo(0.5);
  });
  it('garbage import becomes an empty map', () => expect(sanitizeCampaignMapState('nope').locations).toEqual([]));
});

describe('map overlay modes', () => {
  const base = (loc: object, rt: object) => sanitizeCampaignMapState({
    locations: [{ id: 'a', name: 'A', x: 0, y: 0, ...loc }, { id: 'b', name: 'B', x: 1, y: 1 }],
    routes: [{ id: 'r', fromLocationId: 'a', toLocationId: 'b', path: [], ...rt }],
  });
  it('valid modes survive sanitizing', () => {
    const s = base({ overlayMode: 'background' }, { overlayMode: 'background' });
    expect(s.locations[0].overlayMode).toBe('background');
    expect(s.routes[0].overlayMode).toBe('background');
    expect(base({ overlayMode: 'pin' }, {}).locations[0].overlayMode).toBe('pin');
  });
  it('invalid or missing modes act as full', () => {
    const s = base({ overlayMode: 'weird' }, { overlayMode: 'pin' });
    expect(locationOverlayMode(s.locations[0])).toBe('full');
    expect(routeOverlayMode(s.routes[0])).toBe('full');
    expect('overlayMode' in s.locations[1]).toBe(false);
  });
});
