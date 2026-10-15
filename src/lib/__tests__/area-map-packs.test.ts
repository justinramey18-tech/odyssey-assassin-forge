import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { parseMapPack } from '@/lib/campaign-map-pack';
import { applyStagedOperations } from '@/lib/campaign-map-pack-ops';
import { installAreaPackOp, getNode, childAt, type CampaignAtlas } from '@/lib/campaign-atlas';
import { sanitizeCampaignMapState } from '@/lib/campaign-map';

const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1]);
const opts = { decodeImage: async () => ({ width: 1000, height: 500 }), makeObjectUrl: () => 'blob:t' };
const data = { locations: [{ id: 'a', name: 'Hall', x: 0.1, y: 0.1, discovered: true }, { id: 'b', name: 'Vault', x: 0.5, y: 0.5, discovered: false }], routes: [], currentLocationId: 'a' };
async function pack(guides: unknown[], files: Record<string, string> = {}) {
  const zip = new JSZip();
  zip.file('manifest.json', JSON.stringify({ format: 'odyssey-campaign-map-pack', version: 1, id: 'p', name: 'Keep', mapFile: 'map/m.png', dataFile: 'map/d.json', guides }));
  zip.file('map/m.png', PNG); zip.file('map/d.json', JSON.stringify(data));
  for (const [k, v] of Object.entries(files)) zip.file(k, v);
  const buf = await zip.generateAsync({ type: 'uint8array' });
  return parseMapPack({ name: 'p.zip', size: buf.byteLength, arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer }, opts);
}

describe('area pack guide scopes', () => {
  it('old guides without a scope are campaign guides', async () => {
    const p = await pack([{ name: 'Lore', file: 'guides/l.md' }], { 'guides/l.md': 'x' });
    expect(p.errors).toEqual([]);
    expect(p.guides[0].scope).toBe('campaign');
  });
  it('rejects a place guide for a place not in the pack', async () => {
    const p = await pack([{ name: 'X', file: 'guides/x.md', scope: 'location', locationId: 'zzz' }], { 'guides/x.md': 'x' });
    expect(p.installable).toBe(false);
  });
  it('rejects two map guides, unknown scopes and campaign guides with a place', async () => {
    expect((await pack([{ name: 'A', file: 'guides/a.md', scope: 'map' }, { name: 'B', file: 'guides/b.md', scope: 'map' }], { 'guides/a.md': 'a', 'guides/b.md': 'b' })).installable).toBe(false);
    expect((await pack([{ name: 'A', file: 'guides/a.md', scope: 'room' }], { 'guides/a.md': 'a' })).installable).toBe(false);
    expect((await pack([{ name: 'A', file: 'guides/a.md', scope: 'campaign', locationId: 'a' }], { 'guides/a.md': 'a' })).installable).toBe(false);
  });
  it('rejects duplicate place guides', async () => {
    const p = await pack([{ name: 'A', file: 'guides/a.md', scope: 'location', locationId: 'a' }, { name: 'B', file: 'guides/b.md', scope: 'location', locationId: 'a' }], { 'guides/a.md': 'a', 'guides/b.md': 'b' });
    expect(p.installable).toBe(false);
  });
  it('staging cannot remove a place a guide is for', async () => {
    const p = await pack([{ name: 'A', file: 'guides/a.md', scope: 'location', locationId: 'b' }], { 'guides/a.md': 'a' });
    const r = applyStagedOperations(p.state!, p.guides, [{ op: 'remove_location', locationId: 'b' }], 1000, 500);
    expect(r.rejected.length).toBe(1);
  });
});

const R = '00000000-0000-4000-8000-0000000000aa';
const C = '00000000-0000-4000-8000-0000000000bb';
const N = '00000000-0000-4000-8000-0000000000cc';
const atlas = (activeMapId = R): CampaignAtlas => ({
  format: 'odyssey-campaign-atlas', version: 2, revision: 1, sourcePartyId: 'p', rootMapId: R, activeMapId, campaignMinute: 100, realMinutesPerGameHour: 5,
  maps: [
    { id: R, name: 'World', parentMapId: null, parentLocationId: null, entryLocationId: null, navigationMode: 'regional', state: sanitizeCampaignMapState({ locations: [{ id: 'town', name: 'Town', x: 0.2, y: 0.2, discovered: true }], currentLocationId: 'town' }) },
    { id: C, name: 'Old Keep', parentMapId: R, parentLocationId: 'town', entryLocationId: null, navigationMode: 'local', state: sanitizeCampaignMapState({}) },
  ],
} as CampaignAtlas);
const packState = sanitizeCampaignMapState({ locations: [{ id: 'a', name: 'Hall', x: 0.1, y: 0.1, discovered: true }], currentLocationId: 'a' });

describe('installAreaPackOp', () => {
  it('never replaces an existing area without explicit replace', () => {
    expect(typeof installAreaPackOp(atlas(), R, 'town', { id: N, name: 'Keep', state: packState, replaceExisting: false })).toBe('string');
  });
  it('replaces the area, keeps the party, clock and active map, and sets the arrival point', () => {
    const out = installAreaPackOp(atlas(), R, 'town', { id: N, name: 'Keep', state: packState, replaceExisting: true }) as CampaignAtlas;
    expect(typeof out).toBe('object');
    expect(out.activeMapId).toBe(R);
    expect(out.campaignMinute).toBe(100);
    expect(getNode(out, C)).toBeUndefined();
    expect(childAt(out, R, 'town')?.id).toBe(N);
    expect(getNode(out, N)?.entryLocationId).toBe('a');
  });
  it('blocks replacing an area the party is inside', () => {
    expect(installAreaPackOp(atlas(C), R, 'town', { id: N, name: 'Keep', state: packState, replaceExisting: true })).toMatch(/Leave the area/);
  });
});
