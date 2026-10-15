import { describe, it, expect } from 'vitest';
import { sanitizeCampaignMapState, type CampaignMapState } from '@/lib/campaign-map';
import {
  ATLAS_MAX_MAPS, applyArrivalEntry, convertLegacyToAtlas, createChildMap, enterChild, exitToParent, moveLocal,
  parseAtlas, patchMap, projectActive, resolveAtlasAt, type CampaignAtlas,
} from '@/lib/campaign-atlas';

const PARTY = '00000000-0000-4000-8000-000000000001';
const ROOT = '00000000-0000-4000-8000-0000000000aa';
const CHILD = '00000000-0000-4000-8000-0000000000bb';

const world = (): CampaignMapState => sanitizeCampaignMapState({
  imageUrl: 'https://x/map.png', campaignMinute: 600, realMinutesPerGameHour: 5,
  locations: [
    { id: 'town', name: 'Town', x: 0.1, y: 0.1, discovered: true },
    { id: 'keep', name: 'Keep', x: 0.5, y: 0.1, discovered: true },
  ],
  routes: [{ id: 'r', fromLocationId: 'town', toLocationId: 'keep', distanceSource: 'manual', distanceMiles: 3, terrainFactor: 1, path: [] }],
  currentLocationId: 'town',
});
const keepPlan = (): CampaignMapState => sanitizeCampaignMapState({
  locations: [{ id: 'gate', name: 'Gate', x: 0.5, y: 0.9, discovered: true }, { id: 'town', name: 'Same id, other map', x: 0.2, y: 0.2, discovered: true }],
  campaignMinute: 99999,
});
const withChild = (): CampaignAtlas => {
  const a = convertLegacyToAtlas(world(), PARTY, 'World', ROOT);
  const r = createChildMap(a, ROOT, 'keep', { id: CHILD, name: 'Keep', state: keepPlan(), entryLocationId: 'gate' });
  if (typeof r === 'string') throw new Error(r);
  return r;
};

describe('campaign atlas', () => {
  it('conversion keeps the whole map and clock', () => {
    const a = convertLegacyToAtlas(world(), PARTY, 'World', ROOT);
    expect(a.maps).toHaveLength(1);
    expect(a.campaignMinute).toBe(600);
    expect(projectActive(a).locations).toHaveLength(2);
    expect(parseAtlas(JSON.parse(JSON.stringify(a))).ok).toBe(true);
  });

  it('allows the same place id on different maps', () => expect(parseAtlas(JSON.parse(JSON.stringify(withChild()))).ok).toBe(true));

  it('rejects unknown versions, duplicate ids and missing active map', () => {
    const a = JSON.parse(JSON.stringify(withChild()));
    expect(parseAtlas({ ...a, version: 3 }).ok).toBe(false);
    expect(parseAtlas({ ...a, maps: [a.maps[0], { ...a.maps[1], id: ROOT }] }).ok).toBe(false);
    expect(parseAtlas({ ...a, activeMapId: '00000000-0000-4000-8000-0000000000cc' }).ok).toBe(false);
  });

  it('rejects over 512 maps instead of trimming', () => {
    const a = JSON.parse(JSON.stringify(withChild()));
    a.maps = Array.from({ length: ATLAS_MAX_MAPS + 1 }, () => a.maps[0]);
    const r = parseAtlas(a);
    expect(r.ok).toBe(false);
  });

  it('only one area map per place', () =>
    expect(typeof createChildMap(withChild(), ROOT, 'keep', { name: 'Second' })).toBe('string'));

  it('entering records the entrance on the parent and uses the entry point; clock is kept', () => {
    const r = enterChild(withChild(), CHILD) as CampaignAtlas;
    expect(r.activeMapId).toBe(CHILD);
    expect(r.maps.find(m => m.id === ROOT)!.state.currentLocationId).toBe('keep');
    expect(projectActive(r).currentLocationId).toBe('gate');
    expect(projectActive(r).campaignMinute).toBe(600);
  });

  it('leaving returns to the exact entrance without re-entering', () => {
    const out = exitToParent(enterChild(withChild(), CHILD) as CampaignAtlas) as CampaignAtlas;
    expect(out.activeMapId).toBe(ROOT);
    expect(projectActive(out).currentLocationId).toBe('keep');
    expect(typeof exitToParent(out)).toBe('string'); // root has no exit
  });

  it('cannot delete a place that is an area entrance', () => {
    const a = withChild();
    const st = projectActive(a);
    expect(typeof patchMap(a, ROOT, { ...st, locations: st.locations.filter(l => l.id !== 'keep') })).toBe('string');
  });

  it('inactive maps cannot get travel', () => {
    const a = withChild();
    const travel = { routeId: 'r', reversed: false, pace: 'normal' as const, startProgress: 0, endProgress: 1, startedAt: 0, realDurationMs: 1, gameMinutes: 60, startCampaignMinute: 0 };
    expect(typeof patchMap(a, CHILD, { ...projectActive(a), activeTravel: travel })).toBe('string');
  });

  it('final arrival by road enters the area at that time; mid-journey stops do not', () => {
    const a = withChild();
    const st = projectActive(a);
    const travel = { routeId: 'r', reversed: false, pace: 'normal' as const, startProgress: 0, endProgress: 1, startedAt: 1000, realDurationMs: 1000, gameMinutes: 60, startCampaignMinute: 600 };
    const moving = patchMap(a, ROOT, { ...st, currentLocationId: null, activeTravel: travel }) as CampaignAtlas;
    expect(resolveAtlasAt(moving, 1500).activeMapId).toBe(ROOT);
    const arrived = resolveAtlasAt(moving, 5000);
    expect(arrived.activeMapId).toBe(CHILD);
    expect(arrived.campaignMinute).toBe(660);
    const plan = { destinationLocationId: 'elsewhere', pace: 'normal' as const, legs: [], currentLegIndex: 0 };
    const midJourney = { ...st, currentLocationId: 'keep', journeyPlan: plan };
    expect(applyArrivalEntry({ ...st, activeTravel: travel }, { ...a, maps: a.maps.map(m => m.id === ROOT ? { ...m, state: midJourney } : m) } as CampaignAtlas).activeMapId).toBe(ROOT);
  });

  it('local moves take no time and enter an attached area once', () => {
    const entered = enterChild(withChild(), CHILD) as CampaignAtlas;
    const moved = moveLocal(entered, 'town') as CampaignAtlas;
    expect(projectActive(moved).currentLocationId).toBe('town');
    expect(moved.campaignMinute).toBe(600);
    expect(typeof moveLocal(withChild(), 'keep')).toBe('string'); // root is regional
  });
});

import { classifySnapshot, parseLegacyMap, remapAtlasIds, pauseAtlasTravel } from '@/lib/campaign-atlas';

describe('atlas save and load', () => {
  it('recognizes null, legacy, atlas and unknown snapshots strictly', () => {
    expect(classifySnapshot(null)).toBe('null');
    expect(classifySnapshot(world())).toBe('legacy');
    expect(classifySnapshot(JSON.parse(JSON.stringify(withChild())))).toBe('atlas');
    expect(classifySnapshot({ format: 'something-else', maps: [] })).toBe('unknown');
    expect(classifySnapshot({ version: 7, locations: [] })).toBe('unknown');
    expect(classifySnapshot('nope')).toBe('unknown');
    expect(parseLegacyMap({ hello: 1 }).ok).toBe(false);
  });

  it('a foreign collection gets fresh map ids with every link remapped', () => {
    const a = enterChild(withChild(), CHILD) as CampaignAtlas;
    const other = '00000000-0000-4000-8000-000000000002';
    const r = remapAtlasIds(a, other);
    expect(r.sourcePartyId).toBe(other);
    expect(r.maps.map(m => m.id)).not.toContain(ROOT);
    expect(r.maps.map(m => m.id)).not.toContain(CHILD);
    const child = r.maps.find(m => m.parentMapId)!;
    expect(child.parentMapId).toBe(r.rootMapId);
    expect(r.activeMapId).toBe(child.id);
    expect(parseAtlas(JSON.parse(JSON.stringify(r))).ok).toBe(true);
  });

  it('restored travel comes back paused', () => {
    const a = withChild();
    const travel = { routeId: 'r', reversed: false, pace: 'normal' as const, startProgress: 0, endProgress: 1, startedAt: 1000, realDurationMs: 1000, gameMinutes: 60, startCampaignMinute: 600, pausedFraction: 0.4 };
    const moving = patchMap(a, ROOT, { ...projectActive(a), currentLocationId: null, activeTravel: travel }) as CampaignAtlas;
    const p = pauseAtlasTravel(moving);
    expect(projectActive(p).activeTravel?.startedAt).toBeNull();
    expect(p.activeMapId).toBe(ROOT);
  });
});
