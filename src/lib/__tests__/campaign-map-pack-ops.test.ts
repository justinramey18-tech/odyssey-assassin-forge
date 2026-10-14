import { describe, it, expect } from 'vitest';
import { applyStagedOperations } from '@/lib/campaign-map-pack-ops';
import { buildInstallState } from '@/lib/campaign-map-pack';

const base = () => buildInstallState({
  locations: [
    { id: 'a', name: 'Ashford', x: 0.1, y: 0.1, discovered: true, kind: 'town' },
    { id: 'g', name: 'Greywatch', x: 0.5, y: 0.5, discovered: false, kind: 'fort' },
  ],
  routes: [{ id: 'r', fromLocationId: 'a', toLocationId: 'g', distanceSource: 'manual', distanceMiles: 12, terrainFactor: 1, path: [{ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.5 }] }],
  currentLocationId: 'a',
}, 1000, 500);

describe('staged Map Pack edits', () => {
  it('applies allowed edits to a copy only', () => {
    const s = base();
    const r = applyStagedOperations(s, [], [{ op: 'set_discovered', locationId: 'g', discovered: true }, { op: 'set_time_compression', preset: 'standard' }], 1000, 500);
    expect(r.state.locations.find(l => l.id === 'g')?.discovered).toBe(true);
    expect(r.state.realMinutesPerGameHour).toBe(5);
    expect(s.locations.find(l => l.id === 'g')?.discovered).toBe(false);
  });

  it('rejects edits that would break the pack', () => {
    const r = applyStagedOperations(base(), [], [{ op: 'edit_route', routeId: 'r', distanceSource: 'calibrated' }], 1000, 500);
    expect(r.applied).toEqual([]);
    expect(r.rejected).toHaveLength(1);
  });

  it('rejects disallowed operations such as setting the image or timers', () => {
    const r = applyStagedOperations(base(), [], [{ op: 'set_image', imageUrl: 'x' }, { op: 'start_travel' }], 1000, 500);
    expect(r.applied).toEqual([]);
    expect(r.state.imageUrl).toBeNull();
  });

  it('adds new places without inventing coordinates', () => {
    const r = applyStagedOperations(base(), [], [{ op: 'add_location', id: 'n', name: 'New', x: 0.3, y: 0.3 }], 1000, 500);
    const n = r.state.locations.find(l => l.id === 'n');
    expect(n?.x).toBeNull();
    expect(n?.y).toBeNull();
  });

  it('only changes guide recommendation metadata', () => {
    const g = [{ name: 'Lore', file: 'guides/l.md', content: 'x', tooLarge: false }];
    const r = applyStagedOperations(base(), g, [{ op: 'set_guide_recommendation', guideIndex: 0, recommendedEnabled: true }], 1000, 500);
    expect(r.guides[0].recommendedEnabled).toBe(true);
    expect(r.guides[0].content).toBe('x');
  });
});
