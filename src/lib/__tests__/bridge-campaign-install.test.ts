import { describe, it, expect } from 'vitest';
import {
  previewCampaignAreaInstall as preview, installCampaignArea as install, validatePayload,
  type InstallDeps, type MapRow,
} from '../../../supabase/functions/claude-bridge/campaign-install';

const PARTY = '22222222-2222-4222-8222-222222222222';
const HOST = '11111111-1111-4111-8111-111111111111';
const ROOT = '44444444-4444-4444-8444-444444444444';
const actor = { id: 'bridge-key' };

const atlas = (rev = 3) => ({
  format: 'odyssey-campaign-atlas', version: 2, revision: rev, sourcePartyId: PARTY, rootMapId: ROOT, activeMapId: ROOT,
  campaignMinute: 100, realMinutesPerGameHour: 5,
  maps: [{ id: ROOT, name: 'World', parentMapId: null, parentLocationId: null, entryLocationId: null, navigationMode: 'regional',
    state: { version: 1, locations: [{ id: 'arabel', name: 'Arabel' }], routes: [], currentLocationId: 'arabel' } }],
});

function makeDeps(over: Partial<InstallDeps> = {}) {
  let now = 1_000_000_000_000;
  const state = { row: { stateData: atlas(), updatedAt: '2026-10-15T10:00:00.123456+00:00' } as MapRow, receipts: new Map<string, Record<string, unknown>>(), rpcCalls: 0 };
  const deps: InstallDeps = {
    peekImageTicket: async (t) => (t === 'ticket-good-0000' ? { party_id: PARTY, path: `${HOST}/${PARTY}/campaign-map/x.png`, sha256: 'a'.repeat(64), size_bytes: 10, content_type: 'image/png' } : null),
    verifyImage: async () => ({ ok: true, v: { party_id: PARTY, public_url: 'https://cdn/x.png', object_path: 'x', sha256: 'a'.repeat(64), width: 800, height: 600 } }),
    findParty: async () => ({ hostId: HOST, isActive: true }),
    readMap: async () => state.row,
    readCoreGuides: async () => [],
    readAreaGuides: async () => [],
    installRpc: async (p) => {
      state.rpcCalls++;
      const r = { requestId: p._request_id, mapId: '55555555-5555-4555-8555-555555555555', payloadDigest: p._payload_digest, revision: 4 };
      state.receipts.set(String(p._request_id), r);
      const d = atlas(4) as any;
      d.maps.push({ id: r.mapId, name: 'Old Town', parentMapId: ROOT, parentLocationId: 'arabel', entryLocationId: 'gate', navigationMode: 'local', state: p._map_state });
      state.row = { stateData: d, updatedAt: '2026-10-15T10:05:00+00:00' };
      return { data: r };
    },
    getReceipt: async (_p, _a, id) => state.receipts.get(id) ?? null,
    publicUrl: (p) => `https://cdn/${p}`,
    tokenSecret: () => 'test-secret',
    now: () => now,
    randomId: () => '66666666-6666-4666-8666-666666666666',
    ...over,
  };
  return { deps, state, advance: (ms: number) => { now += ms; } };
}

const args = () => ({
  party_id: PARTY, image_ticket: 'ticket-good-0000', parent_map_id: ROOT, parent_location_id: 'arabel', area_name: 'Old Town',
  map: { locations: [{ id: 'gate', name: 'Gate', x: 0.1, y: 0.1 }, { id: 'inn', name: 'Inn', parentLocationId: 'gate' }], currentLocationId: 'gate' },
  guides: [{ scope: 'location', location_id: 'inn', name: 'Inn secrets', content: 'hidden' }],
});

describe('campaign area install', () => {
  it('rejects raw image urls and travel', () => {
    expect(validatePayload({ ...args(), image_url: 'https://x' }).ok).toBe(false);
    const a = args() as any; a.map.activeTravel = {};
    expect(validatePayload(a).ok).toBe(false);
  });

  it('preview is read-only and hides guide text', async () => {
    const { deps, state } = makeDeps();
    const r = await preview(args(), actor, deps);
    expect(r.ok).toBe(true);
    expect(state.rpcCalls).toBe(0);
    expect(JSON.stringify(r)).not.toContain('hidden');
  });

  it('installs once, then replays the receipt even after expiry', async () => {
    const { deps, state, advance } = makeDeps();
    const p = await preview(args(), actor, deps) as any;
    const r1 = await install({ ...args(), preview_token: p.data.preview_token }, actor, deps) as any;
    expect(r1.ok).toBe(true);
    expect(r1.data.committed).toBe(true);
    advance(60 * 60 * 1000);
    const r2 = await install({ ...args(), preview_token: p.data.preview_token }, actor, deps) as any;
    expect(r2.data.replayed).toBe(true);
    expect(state.rpcCalls).toBe(1);
  });

  it('rejects changed arguments, other callers, stale maps and expired unused previews', async () => {
    const { deps, state, advance } = makeDeps();
    const p = await preview(args(), actor, deps) as any;
    const tok = p.data.preview_token;
    expect((await install({ ...args(), area_name: 'Other', preview_token: tok }, actor, deps)).ok).toBe(false);
    expect((await install({ ...args(), preview_token: tok }, { id: 'someone-else' }, deps)).ok).toBe(false);
    state.row = { ...state.row, updatedAt: '2026-10-15T11:00:00+00:00' };
    const stale = await install({ ...args(), preview_token: tok }, actor, deps) as any;
    expect(stale.error).toMatch(/Conflict/);
    const fresh = makeDeps();
    const p2 = await preview(args(), actor, fresh.deps) as any;
    fresh.advance(16 * 60 * 1000);
    expect(((await install({ ...args(), preview_token: p2.data.preview_token }, actor, fresh.deps)) as any).error).toMatch(/expired/);
    expect(state.rpcCalls + fresh.state.rpcCalls).toBe(0);
    void advance;
  });

  it('rejects an occupied place', async () => {
    const { deps, state } = makeDeps();
    const d = atlas() as any;
    d.maps.push({ id: '77777777-7777-4777-8777-777777777777', name: 'Taken', parentMapId: ROOT, parentLocationId: 'arabel', entryLocationId: null, navigationMode: 'local', state: { locations: [], routes: [] } });
    state.row = { ...state.row, stateData: d };
    expect(((await preview(args(), actor, deps)) as any).error).toMatch(/already has an area/);
  });
});

import { resolveGuideScopes } from '@/lib/location-guides';
import type { CampaignAtlas } from '@/lib/campaign-atlas';

describe('campaign area install — tokens and identity', () => {
  it('rejects a tampered preview token', async () => {
    const { deps, state } = makeDeps();
    const p = await preview(args(), actor, deps) as any;
    const [body, sig] = p.data.preview_token.split('.');
    const forged = `${body.slice(0, -2)}AA.${sig}`;
    expect((await install({ ...args(), preview_token: forged }, actor, deps)).ok).toBe(false);
    expect(state.rpcCalls).toBe(0);
  });

  it('rejects a ticket for another party, a foreign ticket, a different party in the token, and an inactive party', async () => {
    const other = makeDeps({ verifyImage: async () => ({ ok: true, v: { party_id: '88888888-8888-4888-8888-888888888888', public_url: 'https://cdn/x.png', object_path: 'x', sha256: 'a'.repeat(64), width: 1, height: 1 } }) });
    expect(((await preview(args(), actor, other.deps)) as any).error).toMatch(/different party/);
    const { deps } = makeDeps();
    expect((await preview({ ...args(), image_ticket: 'ticket-someone-else' }, actor, deps)).ok).toBe(false);
    const p = await preview(args(), actor, deps) as any;
    expect((await install({ ...args(), party_id: '88888888-8888-4888-8888-888888888888', preview_token: p.data.preview_token }, actor, deps)).ok).toBe(false);
    const inactive = makeDeps({ findParty: async () => ({ hostId: HOST, isActive: false }) });
    expect(((await preview(args(), actor, inactive.deps)) as any).error).toMatch(/not active/);
  });

  it('rejects a host change between preview and install', async () => {
    let host = HOST;
    const { deps, state } = makeDeps({ findParty: async () => ({ hostId: host, isActive: true }) });
    const p = await preview(args(), actor, deps) as any;
    host = '99999999-9999-4999-8999-999999999999';
    expect(((await install({ ...args(), preview_token: p.data.preview_token }, actor, deps)) as any).error).toMatch(/host changed/);
    expect(state.rpcCalls).toBe(0);
  });

  it('a lost server response is resolved from the receipt, not by writing again', async () => {
    const m = makeDeps();
    const real = m.deps.installRpc;
    m.deps.installRpc = async (p) => { await real(p); throw new Error('network'); };
    const p = await preview(args(), actor, m.deps) as any;
    const r = await install({ ...args(), preview_token: p.data.preview_token }, actor, m.deps) as any;
    expect(r.data.committed).toBe(true);
    expect(m.state.rpcCalls).toBe(1);
  });

  it('rejects over-budget guides in preview', async () => {
    const a = args() as any;
    a.map.locations = Array.from({ length: 7 }, (_, i) => ({ id: `p${i}`, name: `P${i}`, ...(i ? { parentLocationId: `p${i - 1}` } : {}) }));
    a.map.currentLocationId = 'p0';
    a.guides = a.map.locations.map((l: any) => ({ scope: 'location', location_id: l.id, name: l.name, content: 'x'.repeat(29990) }));
    const { deps } = makeDeps();
    expect(((await preview(a, actor, deps)) as any).error).toMatch(/200,000/);
  });
});

describe('installed area guides follow the party position only', () => {
  const AREA = '55555555-5555-4555-8555-555555555555';
  const at = (activeMapId: string, rootLoc: string, areaLoc: string | null): CampaignAtlas => ({
    format: 'odyssey-campaign-atlas', version: 2, revision: 1, sourcePartyId: PARTY, rootMapId: ROOT, activeMapId,
    campaignMinute: 0, realMinutesPerGameHour: 5,
    maps: [
      { id: ROOT, name: 'World', parentMapId: null, parentLocationId: null, entryLocationId: null, navigationMode: 'regional',
        state: { version: 1, imageUrl: null, locations: [{ id: 'arabel', name: 'Arabel', x: 0.5, y: 0.5, discovered: true, kind: 'city' }, { id: 'tilverton', name: 'Tilverton', x: 0.1, y: 0.1, discovered: true, kind: 'town' }], routes: [], currentLocationId: rootLoc, campaignMinute: 0, realMinutesPerGameHour: 5, defaultPace: 'normal' } },
      { id: AREA, name: 'Arabel', parentMapId: ROOT, parentLocationId: 'arabel', entryLocationId: 'gate', navigationMode: 'local',
        state: { version: 1, imageUrl: 'https://cdn/a.png', locations: [{ id: 'gate', name: 'Gate', x: 0.1, y: 0.1, discovered: true, kind: 'other' }, { id: 'inn', name: 'Inn', x: 0.2, y: 0.2, discovered: true, kind: 'other', parentLocationId: 'gate' }], routes: [], currentLocationId: areaLoc, campaignMinute: 0, realMinutesPerGameHour: 5, defaultPace: 'normal' } },
    ],
  });
  const keys = (a: CampaignAtlas) => { const r = resolveGuideScopes(a); if (!r.ok) throw new Error('bad'); return r.scopes.map(s => `${s.mapId === AREA ? 'area' : 'root'}:${s.scope}:${s.locationId ?? ''}`); };

  it('party elsewhere on the world map: no city or inn guidance (even if someone browses the area)', () => {
    const k = keys(at(ROOT, 'tilverton', 'inn'));
    expect(k.some(x => x.startsWith('area:'))).toBe(false);
  });
  it('party inside the city at the gate: city guide but not the inn', () => {
    const k = keys(at(AREA, 'tilverton', 'gate'));
    expect(k).toContain('area:map:');
    expect(k).not.toContain('area:location:inn');
  });
  it('party at the inn: city and inn guidance', () => {
    const k = keys(at(AREA, 'tilverton', 'inn'));
    expect(k).toContain('area:map:');
    expect(k).toContain('area:location:inn');
  });
});
