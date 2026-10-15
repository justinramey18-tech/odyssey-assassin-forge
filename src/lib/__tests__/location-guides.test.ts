import { describe, it, expect } from 'vitest';
import { combineGuides, composeLocationGuides, resolveGuideScopes, checkGuideBudget, type LocationGuideRow } from '@/lib/location-guides';
import type { CampaignAtlas } from '@/lib/campaign-atlas';

const R = '00000000-0000-4000-8000-000000000001';
const C = '00000000-0000-4000-8000-000000000002';
const loc = (id: string, name: string, parentLocationId?: string) => ({ id, name, x: 0.5, y: 0.5, discovered: true, ...(parentLocationId ? { parentLocationId } : {}) });
const st = (locations: any[], currentLocationId: string | null, extra: any = {}) => ({ version: 1, imageUrl: 'x', locations, routes: [], currentLocationId, ...extra });

function atlas(childState: any): CampaignAtlas {
  return {
    format: 'odyssey-campaign-atlas', version: 2, revision: 3, sourcePartyId: 'p', rootMapId: R, activeMapId: C,
    campaignMinute: 0, realMinutesPerGameHour: 60,
    maps: [
      { id: R, name: 'World', parentMapId: null, parentLocationId: null, entryLocationId: null, navigationMode: 'regional',
        state: st([loc('cormyr', 'Cormyr'), loc('arabel', 'Arabel', 'cormyr'), loc('suzail', 'Suzail', 'cormyr')], 'arabel') as any },
      { id: C, name: 'Arabel', parentMapId: R, parentLocationId: 'arabel', entryLocationId: 'gate', navigationMode: 'local', state: childState },
    ],
  } as CampaignAtlas;
}

const row = (id: string, map_id: string, scope: 'map' | 'location', location_id: string | null, enabled = true): LocationGuideRow =>
  ({ id, map_id, scope, location_id, name: id, content: `text ${id}`, enabled });

describe('location guide scopes', () => {
  it('orders outer to inner and skips siblings', () => {
    const a = atlas(st([loc('gate', 'Gate'), loc('inn', 'Inn')], 'inn'));
    const r = resolveGuideScopes(a as any);
    if (!r.ok) throw new Error((r as { error: string }).error);
    const text = composeLocationGuides(r.scopes, [
      row('world', R, 'map', null), row('cormyr', R, 'location', 'cormyr'), row('arabel', R, 'location', 'arabel'),
      row('suzail', R, 'location', 'suzail'), row('city', C, 'map', null), row('inn', C, 'location', 'inn'), row('gate', C, 'location', 'gate'),
    ]);
    const order = ['world', 'cormyr', 'arabel', 'city', 'inn'].map(n => text.indexOf(`text ${n}`));
    expect(order.every((v, i) => v >= 0 && (i === 0 || v > order[i - 1]))).toBe(true);
    expect(text).not.toContain('text suzail');
    expect(text).not.toContain('text gate');
  });

  it('on a road inside a map, keeps the area guides but no local place guide', () => {
    const a = atlas(st([loc('gate', 'Gate'), loc('inn', 'Inn')], 'inn', { currentRoutePosition: { routeId: 'r', fromLocationId: 'inn', toLocationId: 'gate', progress: 0.5 } }));
    const r = resolveGuideScopes(a as any);
    if (!r.ok) throw new Error((r as { error: string }).error);
    const text = composeLocationGuides(r.scopes, [row('city', C, 'map', null), row('inn', C, 'location', 'inn'), row('arabel', R, 'location', 'arabel')]);
    expect(text).toContain('text city');
    expect(text).toContain('text arabel');
    expect(text).not.toContain('text inn');
  });

  it('a disabled guide does not hide its enabled ancestors', () => {
    const a = atlas(st([loc('gate', 'Gate')], 'gate'));
    const r = resolveGuideScopes(a as any);
    if (!r.ok) throw new Error((r as { error: string }).error);
    const text = composeLocationGuides(r.scopes, [row('cormyr', R, 'location', 'cormyr'), row('arabel', R, 'location', 'arabel', false)]);
    expect(text).toContain('text cormyr');
    expect(text).not.toContain('text arabel');
  });

  it('rejects combined guides over 200000 characters', () => {
    expect(checkGuideBudget(combineGuides('a'.repeat(199_990), 'b'.repeat(50)))).not.toBeNull();
    expect(checkGuideBudget(combineGuides('a'.repeat(1000), 'b'.repeat(50)))).toBeNull();
  });
});
