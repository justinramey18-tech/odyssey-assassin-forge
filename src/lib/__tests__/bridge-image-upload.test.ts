import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import {
  prepareCampaignImageUpload as prepare, verifyCampaignImageUpload as verify, signTicket, inspectImage,
  PREPARE_TOOL, VERIFY_TOOL, MAX_IMAGE_BYTES, type ImageDeps,
} from '../../../supabase/functions/claude-bridge/image-upload';

const HOST = '11111111-1111-4111-8111-111111111111';
const PARTY = '22222222-2222-4222-8222-222222222222';
const FILE = '33333333-3333-4333-8333-333333333333';
const owner = { id: 'bridge-key' };
const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');

function chunk(type: string, data: number[]) {
  const len = data.length;
  return [len >>> 24, (len >> 16) & 255, (len >> 8) & 255, len & 255, ...[...type].map((c) => c.charCodeAt(0)), ...data, 0, 0, 0, 0];
}
function png(w: number, h: number) {
  const ihdr = [0, 0, w >> 8, w & 255, 0, 0, h >> 8, h & 255, 8, 6, 0, 0, 0];
  return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...chunk('IHDR', ihdr), ...chunk('IDAT', [1, 2]), ...chunk('IEND', [])]);
}
function jpeg(w: number, h: number) {
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 11, 8, h >> 8, h & 255, w >> 8, w & 255, 1, 1, 0x11, 0, 0xff, 0xd9]);
}
function webp(w: number, h: number) {
  const body = [...'WEBP'].map((c) => c.charCodeAt(0)).concat([...'VP8X'].map((c) => c.charCodeAt(0)), 10, 0, 0, 0, 0, 0, 0, 0,
    (w - 1) & 255, ((w - 1) >> 8) & 255, 0, (h - 1) & 255, ((h - 1) >> 8) & 255, 0);
  const size = body.length;
  return new Uint8Array([...'RIFF'].map((c) => c.charCodeAt(0)).concat(size & 255, (size >> 8) & 255, 0, 0, body));
}

function mockDeps(over: Partial<ImageDeps> = {}) {
  const store = new Map<string, { bytes: Uint8Array; type: string }>();
  const calls = { signed: [] as string[], fetched: 0 };
  const deps: ImageDeps = {
    findParty: async (id) => (id === PARTY ? { hostId: HOST, isActive: true } : null),
    createSignedUpload: async (b, p) => { calls.signed.push(`${b}/${p}`); return { signedUrl: 'mock://signed', token: 'mock' }; },
    fetchObject: async (b, p, max) => {
      calls.fetched++;
      const o = store.get(`${b}/${p}`);
      if (!o) return { status: 'missing' };
      if (o.bytes.length > max) return { status: 'too_large' };
      return { status: 'ok', bytes: o.bytes, contentType: o.type };
    },
    publicUrl: (b, p) => `mock://public/${b}/${p}`,
    checkPublic: async () => true,
    ticketSecret: () => 'test-secret',
    now: () => 1_700_000_000_000,
    randomId: () => FILE,
    ...over,
  };
  return { deps, store, calls };
}

async function prepared(bytes: Uint8Array, type = 'image/png', m = mockDeps()) {
  const r = await prepare({ party_id: PARTY, content_type: type, size_bytes: bytes.length, sha256: sha(bytes) }, owner, m.deps);
  if (!r.ok) throw new Error((r as { error: string }).error);
  return { ...m, ticket: r.data.ticket as string, path: r.data.object_path as string };
}

describe('schemas', () => {
  it('are strict', () => {
    expect(PREPARE_TOOL.inputSchema.additionalProperties).toBe(false);
    expect(VERIFY_TOOL.inputSchema.required).toEqual(['ticket']);
  });
  it('reject zero, oversized, extra and invalid inputs', async () => {
    const { deps } = mockDeps();
    const base = { party_id: PARTY, content_type: 'image/png', size_bytes: 10, sha256: 'a'.repeat(64) };
    for (const bad of [
      { ...base, size_bytes: 0 }, { ...base, size_bytes: MAX_IMAGE_BYTES + 1 }, { ...base, size_bytes: 1.5 },
      { ...base, content_type: 'image/svg+xml' }, { ...base, sha256: 'xyz' }, { ...base, party_id: 'nope' },
      { ...base, bucket: 'other' }, { ...base, path: '../x' },
    ]) expect((await prepare(bad, owner, deps)).ok).toBe(false);
    expect((await verify({ ticket: 'abc.def', extra: 1 }, owner, deps)).ok).toBe(false);
  });
});

describe('prepare', () => {
  it('confines the path to the host/party campaign-map folder', async () => {
    const { path, calls } = await prepared(png(4, 4));
    expect(path).toBe(`${HOST}/${PARTY}/campaign-map/${FILE}.png`);
    expect(calls.signed).toEqual([`party-chat-images/${path}`]);
  });
  it('rejects missing or inactive parties', async () => {
    const m = mockDeps({ findParty: async () => ({ hostId: HOST, isActive: false }) });
    expect((await prepare({ party_id: PARTY, content_type: 'image/png', size_bytes: 5, sha256: 'a'.repeat(64) }, owner, m.deps)).ok).toBe(false);
    const n = mockDeps({ findParty: async () => null });
    expect((await prepare({ party_id: PARTY, content_type: 'image/png', size_bytes: 5, sha256: 'a'.repeat(64) }, owner, n.deps)).ok).toBe(false);
  });
});

describe('verify', () => {
  it('reports a missing object without a URL', async () => {
    const { deps, ticket } = await prepared(png(4, 4));
    const r = await verify({ ticket }, owner, deps);
    expect(r.ok).toBe(false);
  });
  it('accepts valid PNG, JPEG, WebP and returns dimensions; retry gives same result', async () => {
    for (const [bytes, type, w, h] of [[png(640, 480), 'image/png', 640, 480], [jpeg(300, 200), 'image/jpeg', 300, 200], [webp(1000, 700), 'image/webp', 1000, 700]] as const) {
      const p = await prepared(bytes, type);
      p.store.set(`party-chat-images/${p.path}`, { bytes, type });
      const a = await verify({ ticket: p.ticket }, owner, p.deps);
      const b = await verify({ ticket: p.ticket }, owner, p.deps);
      expect(a.ok && a.data.width).toBe(w);
      expect(a.ok && a.data.height).toBe(h);
      expect(a).toEqual(b);
    }
  });
  it('refuses forged, expired and wrong-caller tickets before fetching', async () => {
    const p = await prepared(png(4, 4));
    const [body, sig] = p.ticket.split('.');
    expect((await verify({ ticket: `${body}x.${sig}` }, owner, p.deps)).ok).toBe(false);
    expect((await verify({ ticket: await signTicket(JSON.parse(atob(body.replace(/-/g, '+').replace(/_/g, '/'))), 'wrong') }, owner, p.deps)).ok).toBe(false);
    expect((await verify({ ticket: p.ticket }, { id: 'someone-else' }, p.deps)).ok).toBe(false);
    const late = { ...p.deps, now: () => 1_700_000_000_000 + 25 * 3600_000 };
    expect((await verify({ ticket: p.ticket }, owner, late)).ok).toBe(false);
    const wrongCtx = await signTicket({ ...JSON.parse(atob(body.replace(/-/g, '+').replace(/_/g, '/'))), ctx: 'other' }, 'test-secret');
    expect((await verify({ ticket: wrongCtx }, owner, p.deps)).ok).toBe(false);
    expect(p.calls.fetched).toBe(0);
  });
  it('catches hash, size, MIME and invalid-image mismatches', async () => {
    const good = png(8, 8);
    const p = await prepared(good);
    const key = `party-chat-images/${p.path}`;
    const tampered = good.slice(); tampered[tampered.length - 5] ^= 1;
    p.store.set(key, { bytes: tampered, type: 'image/png' });
    expect((await verify({ ticket: p.ticket }, owner, p.deps)).ok).toBe(false);
    p.store.set(key, { bytes: png(9, 9).slice(0, good.length - 1), type: 'image/png' });
    expect((await verify({ ticket: p.ticket }, owner, p.deps)).ok).toBe(false);
    p.store.set(key, { bytes: good, type: 'text/html' });
    expect((await verify({ ticket: p.ticket }, owner, p.deps)).ok).toBe(false);
    const junk = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>');
    const q = await prepared(junk);
    q.store.set(`party-chat-images/${q.path}`, { bytes: junk, type: 'image/png' });
    expect((await verify({ ticket: q.ticket }, owner, q.deps)).ok).toBe(false);
    const j = jpeg(4, 4);
    const r = await prepared(j, 'image/png');
    r.store.set(`party-chat-images/${r.path}`, { bytes: j, type: 'image/png' });
    expect((await verify({ ticket: r.ticket }, owner, r.deps)).ok).toBe(false);
  });
  it('rejects absurd dimensions', () => {
    expect(inspectImage(png(20000, 10))).toBeNull();
  });
});
