import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { createHash } from 'crypto';
import { parseMapPack, isSafePackPath, buildInstallState } from '@/lib/campaign-map-pack';

const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);
const decode = async () => ({ width: 1000, height: 500 });
const opts = { decodeImage: decode, makeObjectUrl: () => 'blob:test' };

const data = () => ({
  imageNaturalWidth: 1000, imageNaturalHeight: 500,
  locations: [
    { id: 'a', name: 'Town A', x: 0.1, y: 0.1, discovered: true, kind: 'town' },
    { id: 'b', name: 'Town B', x: 0.5, y: 0.5, discovered: false, kind: 'town' },
  ],
  routes: [{ id: 'r', fromLocationId: 'a', toLocationId: 'b', distanceSource: 'manual', distanceMiles: 12, terrainFactor: 1, path: [{ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.5 }] }],
  currentLocationId: 'a', defaultPace: 'normal', realMinutesPerGameHour: 5,
});
const manifest = (extra: Record<string, unknown> = {}) => ({ format: 'odyssey-campaign-map-pack', version: 1, id: 'p', name: 'Pack', mapFile: 'map/map.png', dataFile: 'map/data.json', ...extra });

async function pack(files: Record<string, string | Uint8Array>, name = 'pack.zip') {
  const zip = new JSZip();
  for (const [k, v] of Object.entries(files)) zip.file(k, v);
  const buf = await zip.generateAsync({ type: 'uint8array' });
  return { name, size: buf.byteLength, arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer };
}
const valid = (m = manifest(), d: unknown = data(), extra: Record<string, string | Uint8Array> = {}) =>
  pack({ 'manifest.json': JSON.stringify(m), 'map/map.png': PNG, 'map/data.json': JSON.stringify(d), ...extra });

describe('Map Pack parser', () => {
  it('accepts a valid minimal pack', async () => {
    const p = await parseMapPack(await valid(), opts);
    expect(p.errors).toEqual([]);
    expect(p.installable).toBe(true);
    expect(p.summary.locations).toBe(2);
    expect(p.summary.routes).toBe(1);
    expect(p.state?.imageUrl).toBeNull();
    expect(p.summary.startingLocation).toBe('Town A');
  });

  it('rejects non-zip files', async () => {
    const p = await parseMapPack({ name: 'pack.rar', size: 10, arrayBuffer: async () => new ArrayBuffer(10) }, opts);
    expect(p.installable).toBe(false);
  });

  it('rejects path traversal and absolute paths', () => {
    expect(isSafePackPath('../evil.txt')).toBe(false);
    expect(isSafePackPath('/etc/passwd')).toBe(false);
    expect(isSafePackPath('guides/../x.md')).toBe(false);
    expect(isSafePackPath('C:/x.md')).toBe(false);
    expect(isSafePackPath('guides/ok.md')).toBe(true);
  });

  it('rejects script and html files', async () => {
    const p = await parseMapPack(await valid(manifest(), data(), { 'evil.js': 'alert(1)' }), opts);
    expect(p.installable).toBe(false);
    const h = await parseMapPack(await valid(manifest(), data(), { 'map/x.html': '<p>' }), opts);
    expect(h.installable).toBe(false);
  });

  it('rejects nested zips', async () => {
    const p = await parseMapPack(await valid(manifest(), data(), { 'inner.zip': 'x' }), opts);
    expect(p.installable).toBe(false);
  });

  it('rejects missing referenced files', async () => {
    const p = await parseMapPack(await pack({ 'manifest.json': JSON.stringify(manifest()), 'map/data.json': JSON.stringify(data()) }), opts);
    expect(p.installable).toBe(false);
    expect(p.errors.join(' ')).toMatch(/Missing file: map\/map.png/);
  });

  it('rejects a road to a place that does not exist', async () => {
    const d = data(); d.routes[0].toLocationId = 'nowhere';
    const p = await parseMapPack(await valid(manifest(), d), opts);
    expect(p.installable).toBe(false);
  });

  it('rejects a missing parent place', async () => {
    const d = data() as ReturnType<typeof data> & { locations: Array<Record<string, unknown>> };
    d.locations[1].parentLocationId = 'ghost';
    const p = await parseMapPack(await valid(manifest(), d), opts);
    expect(p.installable).toBe(false);
  });

  it('rejects coordinates outside the map', async () => {
    const d = data(); d.locations[0].x = 1.5;
    expect((await parseMapPack(await valid(manifest(), d), opts)).installable).toBe(false);
  });

  it('rejects calibration made for a different image size', async () => {
    const d = { ...data(), mapCalibration: { imageWidth: 800, imageHeight: 500, a: { x: 0, y: 0 }, b: { x: 1, y: 0 }, knownMiles: 100 } };
    expect((await parseMapPack(await valid(manifest(), d), opts)).installable).toBe(false);
  });

  it('rejects typed-miles roads with no distance', async () => {
    const d = data(); d.routes[0].distanceMiles = 0;
    expect((await parseMapPack(await valid(manifest(), d), opts)).installable).toBe(false);
  });

  it('verifies matching checksums and rejects mismatched ones', async () => {
    const good = createHash('sha256').update(PNG).digest('hex');
    expect((await parseMapPack(await valid(manifest({ sha256: { 'map/map.png': good } })), opts)).installable).toBe(true);
    const bad = 'a'.repeat(64);
    const p = await parseMapPack(await valid(manifest({ sha256: { 'map/map.png': bad } })), opts);
    expect(p.installable).toBe(false);
    expect(p.errors.join(' ')).toMatch(/Checksum does not match/);
  });

  it('imports any travel paused', () => {
    const s = buildInstallState({ ...data(), activeTravel: { routeId: 'r', reversed: false, pace: 'normal', startProgress: 0, endProgress: 1, startedAt: 123, realDurationMs: 1000, gameMinutes: 60, startCampaignMinute: 0 } }, 1000, 500);
    expect(s.activeTravel?.startedAt ?? null).toBeNull();
  });

  it('reads guides but marks none as installed', async () => {
    const p = await parseMapPack(await valid(manifest({ guides: [{ name: 'Lore', file: 'guides/lore.md' }] }), data(), { 'guides/lore.md': '# Lore' }), opts);
    expect(p.installable).toBe(true);
    expect(p.guides[0].content).toBe('# Lore');
  });
});
