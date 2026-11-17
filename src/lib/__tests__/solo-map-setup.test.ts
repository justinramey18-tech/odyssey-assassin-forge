import { describe, expect, it } from 'vitest';
import { buildEmpyreanStarterAtlas } from '@/lib/empyreanCanon/continentMap';
import { missingSoloStarterGuides, soloTravelFlags } from '@/lib/solo-map-setup';
import { activeNode, isFlying, isTraveling } from '../../../supabase/functions/empyrean-rules/travel';

describe('solo map setup recovery', () => {
  it('repairs only missing guides with the saved map IDs', () => {
    let i = 0;
    const starter = buildEmpyreanStarterAtlas('camp', { makeId: () => `saved-${++i}` });
    const first = starter.guides[0];
    const missing = missingSoloStarterGuides('camp', starter.atlas, [{ map_id: first.mapId, scope: first.scope, location_id: first.locationId }]);
    expect(missing).toHaveLength(starter.guides.length - 1);
    expect(missing.every(g => ['saved-1', 'saved-2'].includes(g.mapId))).toBe(true);
    expect(missingSoloStarterGuides('camp', starter.atlas, starter.guides.map(g => ({ map_id: g.mapId, scope: g.scope, location_id: g.locationId })))).toEqual([]);
  });
  it('walking is traveling, not flying, on both phone and server', () => {
    const travel = { routeId: 'road', startedAt: 100, realDurationMs: 1000, gameMinutes: 5, startCampaignMinute: 0, pace: 'normal' };
    expect(soloTravelFlags({ activeTravel: travel })).toEqual({ traveling: true, flying: false });
    const node = activeNode({ activeMapId: 'm', maps: [{ id: 'm', state: { activeTravel: travel } }] });
    expect(isTraveling(node)).toBe(true);
    expect(isFlying(node)).toBe(false);
    expect(soloTravelFlags({ activeTravel: { ...travel, pace: 'flying' } })).toEqual({ traveling: true, flying: true });
    expect(soloTravelFlags({ activeTravel: { ...travel, startedAt: null } })).toEqual({ traveling: false, flying: false });
  });
});