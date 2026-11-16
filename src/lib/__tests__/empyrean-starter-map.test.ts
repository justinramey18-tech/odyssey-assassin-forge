import { describe, it, expect } from 'vitest';
import { BASGIATH_PLACES, CONTINENT_PLACES, CONTINENT_ROADS, buildEmpyreanStarterAtlas, STARTER_CAMPAIGN_MINUTE } from '@/lib/empyreanCanon/continentMap';
import { exitToParent, parseAtlas, projectActive, validateAtlasGraph } from '@/lib/campaign-atlas';
import { formatCampaignTime, planJourneyRoute, summarizeJourney, listReachableDestinations } from '@/lib/campaign-map';
import { resolveGuideScopes, composeLocationGuides } from '@/lib/location-guides';

const C = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
let n = 0;
const makeId = () => `0000000${(++n).toString(16)}`.slice(-8) + '-0000-4000-8000-000000000000';

describe('Empyrean starter map', () => {
  const built = buildEmpyreanStarterAtlas(C, { makeId });
  it('is a valid atlas that survives a save and load', () => {
    expect(validateAtlasGraph(built.atlas)).toBeNull();
    const parsed = parseAtlas(JSON.parse(JSON.stringify(built.atlas)));
    expect(parsed.ok).toBe(true);
    expect(built.atlas.sourcePartyId).toBe(C);
    expect(built.atlas.maps).toHaveLength(2);
    expect(formatCampaignTime(built.atlas.campaignMinute)).toBe('Day 1, 08:00');
    expect(built.atlas.campaignMinute).toBe(STARTER_CAMPAIGN_MINUTE);
  });
  it('starts the rider in the courtyard, on foot, with paths between every place', () => {
    const here = projectActive(built.atlas);
    expect(here.currentLocationId).toBe('courtyard');
    expect(here.travelScale).toBe('city');
    expect(listReachableDestinations(here, 'normal')).toHaveLength(BASGIATH_PLACES.length - 1);
  });
  it('lets a rider fly from Basgiath to any known place, and keeps secrets off the list', () => {
    const out = exitToParent(built.atlas);
    expect(typeof out).not.toBe('string');
    const world = projectActive(out as any);
    expect(world.currentLocationId).toBe('basgiath');
    const samara = planJourneyRoute(world, 'samara', 'flying');
    if (!samara) throw new Error('Expected a flight route to Samara');
    const hours = summarizeJourney(world, samara);
    expect(samara?.totalMiles).toBeGreaterThan(300);
    expect(samara?.totalMiles).toBeLessThan(600);
    expect(hours).toBeTruthy();
    expect(planJourneyRoute(world, 'aretia', 'flying')).toBeNull(); // undiscovered
    expect(planJourneyRoute(world, 'calldyr', 'normal')?.legs).toHaveLength(1); // by road
  });
  it('has unique ids, pins on the map, and a road list that only names real places', () => {
    for (const list of [CONTINENT_PLACES, BASGIATH_PLACES]) {
      expect(new Set(list.map(p => p.id)).size).toBe(list.length);
      for (const p of list) { expect(p.x).toBeGreaterThan(0); expect(p.x).toBeLessThan(1); expect(p.y).toBeGreaterThan(0); expect(p.y).toBeLessThan(1); expect(p.note.length).toBeGreaterThan(30); }
    }
    const ids = new Set(CONTINENT_PLACES.map(p => p.id));
    for (const [a, b] of CONTINENT_ROADS) { expect(ids.has(a)).toBe(true); expect(ids.has(b)).toBe(true); }
  });
  it('gives the DM the guides for where the rider stands', () => {
    const scopes = resolveGuideScopes(built.atlas);
    expect(scopes.ok).toBe(true);
    if (!scopes.ok) return;
    const rows = built.guides.map((g, i) => ({ id: String(i), map_id: g.mapId, scope: g.scope, location_id: g.locationId, name: g.name, content: g.content, enabled: true }));
    const text = composeLocationGuides(scopes.scopes, rows as any);
    expect(text).toContain('teardrop-shaped yard');
    expect(text).toContain('Riders Quadrant');
    expect(text).not.toContain('Cliffsbane');
    expect(built.guides.every(g => g.content.length <= 30000 && g.name.length <= 120)).toBe(true);
  });
});

describe('Basgiath painted art (CL-072)', () => {
  it('uses the painted grounds at their real size; the paths stay hidden until chosen; it survives a save', () => {
    const built = buildEmpyreanStarterAtlas('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', { makeId });
    const parsed = parseAtlas(JSON.parse(JSON.stringify(built.atlas)));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error('atlas did not parse');
    const grounds = projectActive(parsed.value);
    expect(grounds.imageUrl).toBe('/maps/basgiath-grounds-art.webp');
    expect([grounds.imageNaturalWidth, grounds.imageNaturalHeight]).toEqual([1448, 1086]);
    expect(grounds.mapCalibration?.imageWidth).toBe(1448);
    expect(grounds.routes.length).toBeGreaterThan(0);
    expect(grounds.routes.every(r => r.overlayMode === 'background')).toBe(true);
    for (const p of BASGIATH_PLACES) {
      expect(p.x).toBeGreaterThan(0.02); expect(p.x).toBeLessThan(0.98);
      expect(p.y).toBeGreaterThan(0.02); expect(p.y).toBeLessThan(0.98);
    }
  });
});
