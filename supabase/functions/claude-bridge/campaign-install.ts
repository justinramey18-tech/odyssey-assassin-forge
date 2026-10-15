// Campaign area install tools for the bridge (preview + install). Pure logic: every outside
// call comes in through `InstallDeps`, so the same code runs in the edge function and in unit
// tests. The database write itself is public.bridge_install_campaign_area (service role only),
// whose contract is documented in drizzle/migrations/0027_bridge_campaign_area_installer.sql.
//
// Never log or return: tickets, signed URLs, keys, guide bodies, snapshots or full request bodies.

import type { Actor } from './image-upload.ts';

export const PREVIEW_TOKEN_TTL_SECONDS = 15 * 60;
export const MAX_ARGS_BYTES = 4 * 1024 * 1024;
export const MAX_GUIDE_CHARS = 30000;
export const MAX_TOTAL_GUIDE_CHARS = 200000;
export const ATLAS_MAX_MAPS = 512;
export const ATLAS_MAX_BYTES = 8 * 1024 * 1024;
const MAX_LOCATIONS = 500;
const MAX_ROUTES = 1000;
const MAX_GUIDES = 501;
const TOKEN_VERSION = 1;
const TOKEN_PURPOSE = 'odyssey-bridge/campaign-area-preview/v1';
const SEP = '\n\n---\n\n';
const AREA_HEADER = '## CURRENT AREA GUIDES (where the party is now)';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ID_RE = /^[A-Za-z0-9_.:-]{1,80}$/;
const KINDS = ['city', 'town', 'village', 'fort', 'dungeon', 'landmark', 'camp', 'region', 'other'];
const PACES = ['slow', 'normal', 'fast'];

// ---------- deps ----------

export interface TicketPeek { party_id: string; path: string; sha256: string; size_bytes: number; content_type: string }
export interface VerifiedImage { party_id: string; public_url: string; object_path: string; sha256: string; width: number; height: number }
export interface MapRow { stateData: unknown; updatedAt: string }
export interface CoreGuideRow { name: string; content: string; enabled: boolean; created_at: string }
export interface AreaGuideRow { id?: string; map_id: string; scope: 'map' | 'location'; location_id: string | null; name: string; content: string; enabled: boolean }
export type RpcError = { code: string; message: string };

export interface InstallDeps {
  /** Signature-checked ticket claims for this actor, ignoring expiry (null = invalid/foreign). */
  peekImageTicket(ticket: string, actor: Actor): Promise<TicketPeek | null>;
  /** Full upload verification (expiry, bytes, hash, type, public access). */
  verifyImage(ticket: string, actor: Actor): Promise<{ ok: true; v: VerifiedImage } | { ok: false; error: string }>;
  findParty(partyId: string): Promise<{ hostId: string; isActive: boolean } | null>;
  readMap(partyId: string, hostId: string): Promise<MapRow | null>;
  readCoreGuides(hostId: string): Promise<CoreGuideRow[]>;
  readAreaGuides(partyId: string, mapIds: string[]): Promise<AreaGuideRow[]>;
  installRpc(params: Record<string, unknown>): Promise<{ data: Record<string, unknown> } | { error: RpcError }>;
  getReceipt(partyId: string, actor: string, requestId: string): Promise<Record<string, unknown> | null>;
  publicUrl(path: string): string;
  tokenSecret(): string | null;
  now(): number;
  randomId(): string;
}

type Result = { ok: true; data: Record<string, unknown> } | { ok: false; error: string };
const fail = (error: string): Result => ({ ok: false, error });

// ---------- tool definitions ----------

const pointSchema = { type: 'object', properties: { x: { type: 'number', minimum: 0, maximum: 1 }, y: { type: 'number', minimum: 0, maximum: 1 } }, required: ['x', 'y'], additionalProperties: false };
const mapSchema = {
  type: 'object',
  description: 'Version-1 geography for the NEW area. No image URL (it comes from the verified ticket), no travel, no calibration.',
  properties: {
    locations: {
      type: 'array', minItems: 1, maxItems: MAX_LOCATIONS,
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', pattern: ID_RE.source }, name: { type: 'string', minLength: 1, maxLength: 80 },
          x: { type: ['number', 'null'], minimum: 0, maximum: 1 }, y: { type: ['number', 'null'], minimum: 0, maximum: 1 },
          kind: { type: 'string', enum: KINDS }, description: { type: 'string', maxLength: 1000 }, region: { type: 'string', maxLength: 80 },
          parentLocationId: { type: 'string', pattern: ID_RE.source }, discovered: { type: 'boolean' },
          overlayMode: { type: 'string', enum: ['full', 'pin', 'background'] },
        },
        required: ['id', 'name'], additionalProperties: false,
      },
    },
    routes: {
      type: 'array', maxItems: MAX_ROUTES,
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', pattern: ID_RE.source }, fromLocationId: { type: 'string' }, toLocationId: { type: 'string' },
          distanceMiles: { type: 'number', exclusiveMinimum: 0, maximum: 100000 }, distanceSource: { type: 'string', enum: ['calibrated', 'manual'] },
          terrainFactor: { type: 'number', exclusiveMinimum: 0, maximum: 10 }, description: { type: 'string', maxLength: 1000 },
          path: { type: 'array', maxItems: 200, items: pointSchema }, overlayMode: { type: 'string', enum: ['full', 'background'] },
        },
        required: ['id', 'fromLocationId', 'toLocationId', 'distanceMiles'], additionalProperties: false,
      },
    },
    currentLocationId: { type: 'string', description: 'Arrival place inside the new area (becomes its entry point).' },
    defaultPace: { type: 'string', enum: PACES },
  },
  required: ['locations', 'currentLocationId'], additionalProperties: false,
};
const guidesSchema = {
  type: 'array', maxItems: MAX_GUIDES,
  description: 'Private DM guides for the new area: at most one map guide, at most one guide per place.',
  items: {
    type: 'object',
    properties: {
      scope: { type: 'string', enum: ['map', 'location'] }, location_id: { type: 'string', description: 'Required for location scope.' },
      name: { type: 'string', minLength: 1, maxLength: 120 }, content: { type: 'string', maxLength: MAX_GUIDE_CHARS }, enabled: { type: 'boolean' },
    },
    required: ['scope', 'name', 'content'], additionalProperties: false,
  },
};
const payloadProps = {
  party_id: { type: 'string', format: 'uuid' },
  image_ticket: { type: 'string', description: 'Ticket from prepare_campaign_image_upload (already uploaded and verifiable).' },
  parent_map_id: { type: ['string', 'null'], format: 'uuid', description: 'Existing map to attach to. null ONLY when the party still has a single legacy map (it becomes the world root).' },
  parent_location_id: { type: 'string', description: 'Existing place on that map with no area attached yet.' },
  area_name: { type: 'string', minLength: 1, maxLength: 120 },
  map: mapSchema,
  guides: guidesSchema,
};
const PAYLOAD_KEYS = Object.keys(payloadProps);

const AUTHORITY_NOTE =
  'Operates through this authenticated connector\'s dedicated install authority; it does NOT require the party host to be signed in. ' +
  'Adds ONE new local area map (plus its private guides) under an existing place; never moves the party, changes the clock, enters the area or replaces maps. ' +
  'Only use when the user explicitly asked for this installation.';

export const PREVIEW_INSTALL_TOOL = {
  name: 'preview_campaign_area_install',
  description: `Read-only preview of installing a new area map for a party. ${AUTHORITY_NOTE} ` +
    'Validates everything and returns counts, guide names/scopes, the current map version, a payload digest, a request_id and a short-lived preview_token. ' +
    'A preview is not approval: show the summary to the user and get their go-ahead before calling install_campaign_area with the SAME arguments plus preview_token.',
  inputSchema: { type: 'object', properties: payloadProps, required: ['party_id', 'image_ticket', 'parent_map_id', 'parent_location_id', 'area_name', 'map'], additionalProperties: false },
};

export const INSTALL_AREA_TOOL = {
  name: 'install_campaign_area',
  description: `Install a previously previewed area map. ${AUTHORITY_NOTE} ` +
    'Pass exactly the same arguments as the preview plus its preview_token. If the map changed since the preview it fails with a conflict: preview again, never force. ' +
    'Safe to retry with the same token: a completed install returns its original receipt without changing anything.',
  inputSchema: {
    type: 'object',
    properties: { ...payloadProps, preview_token: { type: 'string' } },
    required: ['party_id', 'image_ticket', 'parent_map_id', 'parent_location_id', 'area_name', 'map', 'preview_token'],
    additionalProperties: false,
  },
};

// ---------- validation / normalization ----------

type Loc = Record<string, unknown> & { id: string; name: string; parentLocationId?: string };
type Route = Record<string, unknown> & { id: string; fromLocationId: string; toLocationId: string };
export interface NormGuide { scope: 'map' | 'location'; location_id: string | null; name: string; content: string; enabled: boolean }
export interface NormInput {
  party_id: string; image_ticket: string; parent_map_id: string | null; parent_location_id: string; area_name: string;
  map: { locations: Loc[]; routes: Route[]; currentLocationId: string; defaultPace: string }; guides: NormGuide[];
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const fin = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const extra = (o: Record<string, unknown>, allowed: string[]) => Object.keys(o).filter(k => !allowed.includes(k));
const str = (v: unknown, min: number, max: number) => typeof v === 'string' && v.trim().length >= min && v.length <= max;

function normPoint(p: unknown, where: string): { x: number; y: number } | string {
  if (!isObj(p) || extra(p, ['x', 'y']).length || !fin(p.x) || !fin(p.y) || p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1) return `${where}: points need x and y from 0 to 1.`;
  return { x: p.x, y: p.y };
}

export function validatePayload(args: unknown, extraAllowed: string[] = []): { ok: true; v: NormInput } | { ok: false; error: string } {
  const bad = (error: string) => ({ ok: false as const, error });
  if (!isObj(args)) return bad('Arguments must be an object.');
  let size = 0;
  try { size = new TextEncoder().encode(JSON.stringify(args)).byteLength; } catch { return bad('Arguments are not serializable.'); }
  if (size > MAX_ARGS_BYTES) return bad('Arguments are larger than 4 MiB.');
  const x = extra(args, [...PAYLOAD_KEYS, ...extraAllowed]);
  if (x.length) return bad(`Unexpected argument(s): ${x.join(', ')}. Raw image URLs, storage paths, SQL, travel and replacement targets are not accepted.`);
  const a = args;
  if (typeof a.party_id !== 'string' || !UUID_RE.test(a.party_id)) return bad('party_id must be a UUID.');
  if (typeof a.image_ticket !== 'string' || a.image_ticket.length < 10 || a.image_ticket.length > 4096) return bad('image_ticket is required.');
  if (!(a.parent_map_id === null || (typeof a.parent_map_id === 'string' && UUID_RE.test(a.parent_map_id)))) return bad('parent_map_id must be a UUID or null.');
  if (typeof a.parent_location_id !== 'string' || !ID_RE.test(a.parent_location_id)) return bad('parent_location_id must be an existing place id.');
  if (!str(a.area_name, 1, 120)) return bad('area_name must be 1 to 120 characters.');

  const m = a.map;
  if (!isObj(m)) return bad('map must be an object.');
  const mx = extra(m, ['locations', 'routes', 'currentLocationId', 'defaultPace']);
  if (mx.length) return bad(`map has unsupported field(s): ${mx.join(', ')}. The image comes from the verified ticket; travel, position on roads and calibration are not accepted.`);
  if (!Array.isArray(m.locations) || m.locations.length < 1 || m.locations.length > MAX_LOCATIONS) return bad(`map.locations needs 1 to ${MAX_LOCATIONS} places.`);
  const routesIn = m.routes === undefined ? [] : m.routes;
  if (!Array.isArray(routesIn) || routesIn.length > MAX_ROUTES) return bad(`map.routes allows at most ${MAX_ROUTES} roads.`);

  const locations: Loc[] = []; const ids = new Set<string>();
  for (const [i, l] of m.locations.entries()) {
    const w = `map.locations[${i}]`;
    if (!isObj(l)) return bad(`${w} must be an object.`);
    const lx = extra(l, ['id', 'name', 'x', 'y', 'kind', 'description', 'region', 'parentLocationId', 'discovered', 'overlayMode']);
    if (lx.length) return bad(`${w} has unsupported field(s): ${lx.join(', ')}.`);
    if (typeof l.id !== 'string' || !ID_RE.test(l.id)) return bad(`${w}.id must be 1-80 letters, digits, _ . : -`);
    if (ids.has(l.id)) return bad(`${w}.id "${l.id}" is used twice.`);
    ids.add(l.id);
    if (!str(l.name, 1, 80)) return bad(`${w}.name must be 1 to 80 characters.`);
    const xNull = l.x === undefined || l.x === null, yNull = l.y === undefined || l.y === null;
    if (xNull !== yNull) return bad(`${w} needs both x and y, or neither.`);
    if (!xNull && (!fin(l.x) || !fin(l.y) || (l.x as number) < 0 || (l.x as number) > 1 || (l.y as number) < 0 || (l.y as number) > 1)) return bad(`${w} x/y must be from 0 to 1.`);
    if (l.kind !== undefined && !KINDS.includes(l.kind as string)) return bad(`${w}.kind is not supported.`);
    if (l.description !== undefined && !str(l.description, 0, 1000)) return bad(`${w}.description is too long.`);
    if (l.region !== undefined && !str(l.region, 0, 80)) return bad(`${w}.region is too long.`);
    if (l.parentLocationId !== undefined && (typeof l.parentLocationId !== 'string' || !ID_RE.test(l.parentLocationId))) return bad(`${w}.parentLocationId is invalid.`);
    if (l.discovered !== undefined && typeof l.discovered !== 'boolean') return bad(`${w}.discovered must be true or false.`);
    if (l.overlayMode !== undefined && !['full', 'pin', 'background'].includes(l.overlayMode as string)) return bad(`${w}.overlayMode is invalid.`);
    const loc: Loc = { id: l.id, name: (l.name as string).trim(), x: xNull ? null : l.x, y: yNull ? null : l.y, discovered: l.discovered === true, kind: (l.kind as string) ?? 'other' };
    if (l.description) loc.description = (l.description as string).trim();
    if (l.region) loc.region = (l.region as string).trim();
    if (l.parentLocationId) loc.parentLocationId = l.parentLocationId as string;
    if (l.overlayMode) loc.overlayMode = l.overlayMode;
    locations.push(loc);
  }
  const parentOf = new Map(locations.map(l => [l.id, l.parentLocationId]));
  for (const l of locations) {
    let cur = l.parentLocationId, steps = 0;
    while (cur) {
      if (!ids.has(cur)) return bad(`Place "${l.id}" is inside missing place "${cur}".`);
      if (cur === l.id || ++steps > ids.size) return bad(`Place "${l.id}" is inside itself through a loop.`);
      cur = parentOf.get(cur);
    }
  }
  const routes: Route[] = []; const rids = new Set<string>();
  for (const [i, r] of routesIn.entries()) {
    const w = `map.routes[${i}]`;
    if (!isObj(r)) return bad(`${w} must be an object.`);
    const rx = extra(r, ['id', 'fromLocationId', 'toLocationId', 'distanceMiles', 'distanceSource', 'terrainFactor', 'description', 'path', 'overlayMode']);
    if (rx.length) return bad(`${w} has unsupported field(s): ${rx.join(', ')}.`);
    if (typeof r.id !== 'string' || !ID_RE.test(r.id)) return bad(`${w}.id is invalid.`);
    if (rids.has(r.id)) return bad(`${w}.id "${r.id}" is used twice.`);
    rids.add(r.id);
    if (typeof r.fromLocationId !== 'string' || typeof r.toLocationId !== 'string' || !ids.has(r.fromLocationId) || !ids.has(r.toLocationId) || r.fromLocationId === r.toLocationId)
      return bad(`${w} must join two different places on the new area.`);
    if (!fin(r.distanceMiles) || r.distanceMiles <= 0 || r.distanceMiles > 100000) return bad(`${w}.distanceMiles must be above 0.`);
    if (r.terrainFactor !== undefined && (!fin(r.terrainFactor) || r.terrainFactor <= 0 || r.terrainFactor > 10)) return bad(`${w}.terrainFactor must be above 0 and at most 10.`);
    if (r.distanceSource !== undefined && r.distanceSource !== 'manual' && r.distanceSource !== 'calibrated') return bad(`${w}.distanceSource is invalid.`);
    if (r.description !== undefined && !str(r.description, 0, 1000)) return bad(`${w}.description is too long.`);
    if (r.overlayMode !== undefined && r.overlayMode !== 'full' && r.overlayMode !== 'background') return bad(`${w}.overlayMode is invalid.`);
    const pathIn = r.path === undefined ? [] : r.path;
    if (!Array.isArray(pathIn) || pathIn.length > 200) return bad(`${w}.path allows at most 200 points.`);
    const path: { x: number; y: number }[] = [];
    for (const p of pathIn) { const n = normPoint(p, w); if (typeof n === 'string') return bad(n); path.push(n); }
    // New areas have no calibration, so distances are manual.
    const route: Route = { id: r.id, fromLocationId: r.fromLocationId, toLocationId: r.toLocationId, distanceMiles: r.distanceMiles, distanceSource: 'manual', terrainFactor: (r.terrainFactor as number) ?? 1, path };
    if (r.description) route.description = (r.description as string).trim();
    if (r.overlayMode) route.overlayMode = r.overlayMode;
    routes.push(route);
  }
  if (typeof m.currentLocationId !== 'string' || !ids.has(m.currentLocationId)) return bad('map.currentLocationId must be one of the new places (the arrival point).');
  if (m.defaultPace !== undefined && !PACES.includes(m.defaultPace as string)) return bad('map.defaultPace must be slow, normal or fast.');

  const guidesIn = a.guides === undefined ? [] : a.guides;
  if (!Array.isArray(guidesIn) || guidesIn.length > MAX_GUIDES) return bad(`guides allows at most ${MAX_GUIDES} entries.`);
  const guides: NormGuide[] = []; const keys = new Set<string>();
  for (const [i, g] of guidesIn.entries()) {
    const w = `guides[${i}]`;
    if (!isObj(g)) return bad(`${w} must be an object.`);
    const gx = extra(g, ['scope', 'location_id', 'name', 'content', 'enabled']);
    if (gx.length) return bad(`${w} has unsupported field(s): ${gx.join(', ')}.`);
    if (g.scope !== 'map' && g.scope !== 'location') return bad(`${w}.scope must be map or location.`);
    if (!str(g.name, 1, 120)) return bad(`${w}.name must be 1 to 120 characters.`);
    if (typeof g.content !== 'string' || g.content.length > MAX_GUIDE_CHARS) return bad(`${w}.content must be at most ${MAX_GUIDE_CHARS.toLocaleString()} characters.`);
    if (g.enabled !== undefined && typeof g.enabled !== 'boolean') return bad(`${w}.enabled must be true or false.`);
    let loc: string | null = null;
    if (g.scope === 'map') { if (g.location_id !== undefined) return bad(`${w}: a map guide has no location_id.`); }
    else {
      if (typeof g.location_id !== 'string' || !ids.has(g.location_id)) return bad(`${w}.location_id must be a place on the new area.`);
      loc = g.location_id;
    }
    const key = g.scope === 'map' ? 'map' : `location:${loc}`;
    if (keys.has(key)) return bad(`${w}: two guides target the same ${g.scope === 'map' ? 'map' : `place "${loc}"`}.`);
    keys.add(key);
    guides.push({ scope: g.scope, location_id: loc, name: (g.name as string).trim(), content: g.content, enabled: g.enabled !== false });
  }

  return {
    ok: true,
    v: {
      party_id: a.party_id.toLowerCase(), image_ticket: a.image_ticket,
      parent_map_id: a.parent_map_id === null ? null : (a.parent_map_id as string).toLowerCase(),
      parent_location_id: a.parent_location_id, area_name: (a.area_name as string).trim(),
      map: { locations, routes, currentLocationId: m.currentLocationId, defaultPace: (m.defaultPace as string) ?? 'normal' },
      guides,
    },
  };
}

// ---------- canonical digest + token ----------

function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (isObj(v)) return `{${Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
  return JSON.stringify(v);
}
const enc = new TextEncoder();
async function sha256Hex(s: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)));
  return [...d].map(b => b.toString(16).padStart(2, '0')).join('');
}
/** Digest of the complete normalized install payload, with the image identified by its ticket's file (not the ticket string). */
export async function payloadDigest(n: NormInput, img: TicketPeek): Promise<string> {
  const { image_ticket: _t, ...rest } = n;
  return sha256Hex(canonical({ purpose: 'campaign-area-install/v1', ...rest, image: { path: img.path, sha256: img.sha256, size_bytes: img.size_bytes, content_type: img.content_type } }));
}

function b64url(bytes: Uint8Array): string {
  let s = ''; for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(s: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) return null;
  try { const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)); return Uint8Array.from(bin, c => c.charCodeAt(0)); } catch { return null; }
}
async function tokenKey(secret: string): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const derived = new Uint8Array(await crypto.subtle.sign('HMAC', base, enc.encode(TOKEN_PURPOSE)));
  return crypto.subtle.importKey('raw', derived, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
export interface PreviewClaims {
  v: number; ctx: 'campaign-area-preview'; actor: string; party_id: string; host_id: string;
  expected_updated_at: string; expected_revision: number | null; expected_legacy: boolean;
  request_id: string; digest: string; exp: number;
}
export async function signPreviewToken(c: PreviewClaims, secret: string): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(c)));
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await tokenKey(secret), enc.encode(body)));
  return `${body}.${b64url(sig)}`;
}
export async function readPreviewToken(token: string, secret: string): Promise<PreviewClaims | null> {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const sig = fromB64url(parts[1]); if (!sig) return null;
  if (!(await crypto.subtle.verify('HMAC', await tokenKey(secret), sig as BufferSource, enc.encode(parts[0])))) return null;
  const raw = fromB64url(parts[0]); if (!raw) return null;
  try { return JSON.parse(new TextDecoder().decode(raw)) as PreviewClaims; } catch { return null; }
}

// ---------- current-target analysis ----------

interface AtlasNode { id: string; name: string; parentMapId: string | null; parentLocationId: string | null; state: Record<string, unknown> }
interface Target {
  legacy: boolean; revision: number | null; atlasMaps: AtlasNode[]; parent: AtlasNode; path: AtlasNode[];
  activeMapId: string | null; campaignMinute: unknown; realMinutesPerGameHour: unknown; position: unknown;
}

function locsOf(st: Record<string, unknown>): Array<Record<string, unknown>> {
  return Array.isArray(st.locations) ? (st.locations as Array<Record<string, unknown>>).filter(isObj) : [];
}

function analyzeTarget(n: NormInput, row: MapRow): { ok: true; t: Target } | { ok: false; error: string } {
  const d = row.stateData;
  const bad = (error: string) => ({ ok: false as const, error });
  if (!isObj(d)) return bad('The party\'s campaign map is in an unknown format.');
  const isAtlas = d.format === 'odyssey-campaign-atlas';
  let maps: AtlasNode[]; let revision: number | null = null; let parentId: string;
  if (!isAtlas) {
    if ('format' in d || (d.version !== undefined && d.version !== 1)) return bad('The party\'s campaign map is in an unknown format.');
    if (n.parent_map_id !== null) return bad('This party still has a single (legacy) map: pass parent_map_id null to attach to it; it will become the world root.');
    maps = [{ id: '(world root, created on install)', name: 'World', parentMapId: null, parentLocationId: null, state: d }];
    parentId = maps[0].id;
  } else {
    if (d.version !== 2 || !fin(d.revision) || !Array.isArray(d.maps)) return bad('The party\'s map collection is in an unknown version.');
    if (n.parent_map_id === null) return bad('parent_map_id is required: this party already has nested maps.');
    revision = d.revision;
    maps = (d.maps as unknown[]).filter(isObj).map(m => ({
      id: String(m.id), name: String(m.name ?? ''), parentMapId: (m.parentMapId as string | null) ?? null,
      parentLocationId: (m.parentLocationId as string | null) ?? null, state: isObj(m.state) ? m.state : {},
    }));
    parentId = n.parent_map_id;
    if (maps.length >= ATLAS_MAX_MAPS) return bad(`The map collection already has ${ATLAS_MAX_MAPS} maps.`);
  }
  const parent = maps.find(m => m.id === parentId);
  if (!parent) return bad('parent_map_id is not a map in this party\'s collection.');
  if (!locsOf(parent.state).some(l => l.id === n.parent_location_id)) return bad(`parent_location_id "${n.parent_location_id}" is not a place on "${parent.name}".`);
  if (maps.some(m => m.parentMapId === parentId && m.parentLocationId === n.parent_location_id))
    return bad('That place already has an area map. Replacing areas is not supported by this tool.');
  const byId = new Map(maps.map(m => [m.id, m]));
  const path: AtlasNode[] = []; let cur: AtlasNode | undefined = parent;
  while (cur) { if (path.length > maps.length) return bad('The map collection has a loop.'); path.unshift(cur); cur = cur.parentMapId ? byId.get(cur.parentMapId) : undefined; }
  const active = isAtlas ? maps.find(m => m.id === d.activeMapId) : maps[0];
  return {
    ok: true,
    t: {
      legacy: !isAtlas, revision, atlasMaps: maps, parent, path, activeMapId: isAtlas ? String(d.activeMapId) : null,
      campaignMinute: isAtlas ? d.campaignMinute : (d.campaignMinute ?? 0),
      realMinutesPerGameHour: isAtlas ? d.realMinutesPerGameHour : d.realMinutesPerGameHour,
      position: active ? { mapName: active.name, currentLocationId: active.state.currentLocationId ?? null, onRoad: !!(active.state.currentRoutePosition || active.state.activeTravel || active.state.journeyPlan) } : null,
    },
  };
}

function locationChain(state: Record<string, unknown>, locId: string): Array<{ id: string; name: string }> {
  const byId = new Map(locsOf(state).map(l => [String(l.id), l]));
  const out: Array<{ id: string; name: string }> = []; const seen = new Set<string>();
  let cur = byId.get(locId);
  while (cur && !seen.has(String(cur.id))) {
    seen.add(String(cur.id)); out.unshift({ id: String(cur.id), name: String(cur.name ?? '') });
    cur = cur.parentLocationId ? byId.get(String(cur.parentLocationId)) : undefined;
  }
  return out;
}

const blank = (s: string) => !s.trim();
/** Largest combined guide text (core + area path) over every place in the new area — same composition as the DM uses. */
export function maxCombinedGuideChars(n: NormInput, t: Target, core: CoreGuideRow[], area: AreaGuideRow[], newMapId = '00000000-0000-0000-0000-000000000000'): number {
  const coreText = [...core].filter(g => g.enabled && !blank(g.content)).sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map(g => `### ${g.name}\n${g.content}`).join(SEP).trim();
  const find = (mapId: string, scope: string, loc: string | null) => area.find(r => r.map_id === mapId && r.scope === scope && (r.location_id ?? null) === loc && r.enabled && !blank(r.content));
  const prefix: string[] = [];
  for (let i = 0; i < t.path.length; i++) {
    const node = t.path[i];
    if (t.legacy) { /* legacy: no area rows can exist yet */ }
    else {
      const mg = find(node.id, 'map', null);
      if (mg) prefix.push(`### ${mg.name} — ${node.name} [area map ${node.id}]\n${mg.content}`);
    }
    const via = i < t.path.length - 1 ? t.path[i + 1].parentLocationId! : n.parent_location_id;
    for (const c of locationChain(node.state, via)) {
      const lg = t.legacy ? undefined : find(node.id, 'location', c.id);
      if (lg) prefix.push(`### ${lg.name} — ${node.name} › ${c.name} [place ${c.id} on map ${node.id}]\n${lg.content}`);
    }
  }
  const mg = n.guides.find(g => g.scope === 'map' && g.enabled && !blank(g.content));
  if (mg) prefix.push(`### ${mg.name} — ${n.area_name} [area map ${newMapId}]\n${mg.content}`);
  const childState = { locations: n.map.locations } as Record<string, unknown>;
  let best = 0;
  for (const l of n.map.locations) {
    const parts = [...prefix];
    for (const c of locationChain(childState, l.id)) {
      const g = n.guides.find(x => x.scope === 'location' && x.location_id === c.id && x.enabled && !blank(x.content));
      if (g) parts.push(`### ${g.name} — ${n.area_name} › ${c.name} [place ${c.id} on map ${newMapId}]\n${g.content}`);
    }
    const areaText = parts.join(SEP).trim();
    const combined = !areaText ? coreText : coreText ? `${coreText}${SEP}${AREA_HEADER}\n\n${areaText}` : `${AREA_HEADER}\n\n${areaText}`;
    best = Math.max(best, combined.length);
  }
  return best;
}

function buildMapState(n: NormInput, img: VerifiedImage | null, publicUrl: string) {
  return {
    version: 1, imageUrl: img?.public_url ?? publicUrl,
    ...(img ? { imageNaturalWidth: img.width, imageNaturalHeight: img.height } : {}),
    locations: n.map.locations, routes: n.map.routes, currentLocationId: n.map.currentLocationId, defaultPace: n.map.defaultPace,
  };
}

function guideSummary(n: NormInput) {
  return n.guides.map(g => ({ scope: g.scope, location_id: g.location_id, name: g.name, characters: g.content.length, enabled: g.enabled }));
}

// ---------- shared: load + check current state ----------

async function loadAndCheck(n: NormInput, actor: Actor, deps: InstallDeps, verified: VerifiedImage) {
  if (verified.party_id.toLowerCase() !== n.party_id) return { error: 'The image ticket belongs to a different party.' } as const;
  const party = await deps.findParty(n.party_id);
  if (!party) return { error: 'Party not found.' } as const;
  if (!party.isActive) return { error: 'Party is not active.' } as const;
  const row = await deps.readMap(n.party_id, party.hostId);
  if (!row) return { error: 'This party has no campaign map yet. Create one in the app first.' } as const;
  const an = analyzeTarget(n, row);
  if (!an.ok) return { error: an.error } as const;
  const t = an.t;
  const mapIds = t.legacy ? [] : t.path.map(p => p.id);
  const [core, area] = await Promise.all([deps.readCoreGuides(party.hostId), deps.readAreaGuides(n.party_id, mapIds)]);
  const total = maxCombinedGuideChars(n, t, core, area);
  if (total > MAX_TOTAL_GUIDE_CHARS)
    return { error: `Guides for the new area would add up to ${total.toLocaleString()} characters at its busiest place, over the ${MAX_TOTAL_GUIDE_CHARS.toLocaleString()} limit. Shorten or disable a guide.` } as const;
  const childBytes = enc.encode(JSON.stringify(buildMapState(n, verified, verified.public_url))).byteLength;
  const atlasBytes = enc.encode(JSON.stringify(isObj(row.stateData) && Array.isArray(row.stateData.maps) ? row.stateData.maps : [row.stateData])).byteLength;
  if (childBytes + atlasBytes + 1024 > ATLAS_MAX_BYTES) return { error: 'The map collection would exceed 8 MiB of map data.' } as const;
  void actor;
  return { party, row, t, total } as const;
}

// ---------- preview ----------

export async function previewCampaignAreaInstall(args: unknown, actor: Actor, deps: InstallDeps): Promise<Result> {
  const p = validatePayload(args);
  if (!p.ok) return fail((p as { error: string }).error);
  const n = p.v;
  const secret = deps.tokenSecret();
  if (!secret) return fail('Area installs are not configured on the server.');
  const peek = await deps.peekImageTicket(n.image_ticket, actor);
  if (!peek) return fail('image_ticket is invalid or was issued to a different caller.');
  const ver = await deps.verifyImage(n.image_ticket, actor);
  if (!ver.ok) return fail(`Image check failed: ${(ver as { error: string }).error}`);
  const c = await loadAndCheck(n, actor, deps, ver.v);
  if ('error' in c) return fail(c.error as string);

  const digest = await payloadDigest(n, peek);
  const request_id = deps.randomId();
  const exp = Math.floor(deps.now() / 1000) + PREVIEW_TOKEN_TTL_SECONDS;
  const preview_token = await signPreviewToken({
    v: TOKEN_VERSION, ctx: 'campaign-area-preview', actor: actor.id, party_id: n.party_id, host_id: c.party.hostId,
    expected_updated_at: c.row.updatedAt, expected_revision: c.t.revision, expected_legacy: c.t.legacy,
    request_id, digest, exp,
  }, secret);

  return {
    ok: true,
    data: {
      preview: true, read_only: true,
      target: { party_id: n.party_id, parent_map: c.t.legacy ? 'world root (your existing single map, wrapped unchanged on install)' : c.t.parent.name, parent_map_id: n.parent_map_id, parent_location_id: n.parent_location_id },
      adds: {
        maps: 1, area_name: n.area_name, navigation: 'local', arrival_location_id: n.map.currentLocationId,
        locations: n.map.locations.length, routes: n.map.routes.length, guides: n.guides.length, guide_list: guideSummary(n),
        image: { width: ver.v.width, height: ver.v.height, sha256: ver.v.sha256 },
      },
      existing_version: c.t.legacy ? { format: 'legacy single map', updated_at: c.row.updatedAt } : { revision: c.t.revision, maps: c.t.atlasMaps.length, updated_at: c.row.updatedAt },
      unchanged: { party_position: c.t.position, campaign_minute: c.t.campaignMinute, real_minutes_per_game_hour: c.t.realMinutesPerGameHour, note: 'The party does not move and the clock does not change.' },
      busiest_place_guide_characters: c.total,
      payload_digest: digest, request_id, preview_token, expires_at: new Date(exp * 1000).toISOString(),
      next_step: 'Show this summary to the user. Only after they approve, call install_campaign_area with the same arguments plus preview_token.',
    },
  };
}

// ---------- install ----------

function rpcMessage(e: RpcError): string {
  switch (e.code) {
    case '40001': return `Conflict: ${e.message}. The map changed since the preview — run preview_campaign_area_install again.`;
    case '23505': return `Rejected: ${e.message}.`;
    case '54000': return `Rejected: ${e.message}.`;
    case '55000': return 'Rejected: the party is not active.';
    case 'P0002': return `Rejected: ${e.message}.`;
    case '22023': return `Invalid installation: ${e.message}.`;
    default: return 'The installation failed on the server.';
  }
}

async function readback(n: NormInput, receipt: Record<string, unknown>, deps: InstallDeps, before: Target | null) {
  try {
    const party = await deps.findParty(n.party_id);
    if (!party) throw new Error('party');
    const row = await deps.readMap(n.party_id, party.hostId);
    if (!row || !isObj(row.stateData) || !Array.isArray(row.stateData.maps)) throw new Error('map');
    const d = row.stateData;
    const mapId = String(receipt.mapId);
    const node = (d.maps as unknown[]).filter(isObj).find(m => m.id === mapId);
    if (!node) throw new Error('missing');
    const guides = await deps.readAreaGuides(n.party_id, [mapId]);
    const st = isObj(node.state) ? node.state : {};
    return {
      readback_ok: true,
      installed_map: { id: mapId, name: node.name, parent_map_id: node.parentMapId, parent_location_id: node.parentLocationId, entry_location_id: node.entryLocationId, navigation: node.navigationMode, locations: locsOf(st).length, routes: Array.isArray(st.routes) ? st.routes.length : 0 },
      installed_guides: guides.map(g => ({ id: g.id, scope: g.scope, location_id: g.location_id, name: g.name, enabled: g.enabled })),
      world_now: { revision: d.revision, maps: (d.maps as unknown[]).length, campaign_minute: d.campaignMinute, real_minutes_per_game_hour: d.realMinutesPerGameHour, active_map_is_new_area: d.activeMapId === mapId },
      ...(before && !before.legacy ? { preserved: { clock: before.campaignMinute === d.campaignMinute && before.realMinutesPerGameHour === d.realMinutesPerGameHour, active_map: before.activeMapId === d.activeMapId } } : {}),
    };
  } catch {
    return { readback_ok: false, readback_note: 'The install IS committed (see receipt), but reading it back failed. Do not retry the install; check again later with a fresh read.' };
  }
}

export async function installCampaignArea(args: unknown, actor: Actor, deps: InstallDeps): Promise<Result> {
  const p = validatePayload(args, ['preview_token']);
  if (!p.ok) return fail((p as { error: string }).error);
  const n = p.v;
  const token = (args as Record<string, unknown>).preview_token;
  if (typeof token !== 'string' || token.length < 10 || token.length > 4096) return fail('preview_token is required.');
  const secret = deps.tokenSecret();
  if (!secret) return fail('Area installs are not configured on the server.');
  const c = await readPreviewToken(token, secret);
  if (!c || c.v !== TOKEN_VERSION || c.ctx !== 'campaign-area-preview') return fail('preview_token is invalid or has been altered.');
  if (c.actor !== actor.id) return fail('preview_token was issued to a different caller.');
  if (c.party_id !== n.party_id || !UUID_RE.test(c.request_id)) return fail('preview_token is for a different party.');

  const peek = await deps.peekImageTicket(n.image_ticket, actor);
  if (!peek) return fail('image_ticket is invalid or was issued to a different caller.');
  const digest = await payloadDigest(n, peek);
  if (digest !== c.digest) return fail('These arguments differ from the preview. Pass exactly the previewed arguments, or preview again.');

  // Completed earlier? Return its receipt unchanged (even if the preview or upload ticket has since expired).
  const prior = await deps.getReceipt(n.party_id, actor.id, c.request_id);
  if (prior) {
    if (prior.payloadDigest !== digest) return fail('This request id was already used for a different install.');
    return { ok: true, data: { committed: true, replayed: true, receipt: prior, ...(await readback(n, prior, deps, null)) } };
  }
  if (c.exp * 1000 < deps.now()) return fail('The preview has expired and was never installed. Run preview_campaign_area_install again.');

  const ver = await deps.verifyImage(n.image_ticket, actor);
  if (!ver.ok) return fail(`Image check failed: ${(ver as { error: string }).error}`);
  const chk = await loadAndCheck(n, actor, deps, ver.v);
  if ('error' in chk) return fail(chk.error as string);
  if (chk.party.hostId !== c.host_id) return fail('Conflict: the party host changed since the preview. Preview again.');
  if (chk.row.updatedAt !== c.expected_updated_at || chk.t.legacy !== c.expected_legacy || chk.t.revision !== c.expected_revision)
    return fail('Conflict: the campaign map changed since the preview. Run preview_campaign_area_install again; nothing was overwritten.');

  const params = {
    _party_id: n.party_id, _actor: actor.id, _request_id: c.request_id, _expected_host_id: c.host_id,
    _expected_updated_at: c.expected_updated_at, _expected_revision: c.expected_revision, _expected_legacy: c.expected_legacy,
    _parent_map_id: n.parent_map_id, _parent_location_id: n.parent_location_id, _area_name: n.area_name,
    _map_state: buildMapState(n, ver.v, ver.v.public_url),
    _guides: n.guides.map(g => ({ scope: g.scope, ...(g.location_id ? { locationId: g.location_id } : {}), name: g.name, content: g.content, enabled: g.enabled })),
    _payload_digest: digest,
  };
  let res: { data: Record<string, unknown> } | { error: RpcError };
  try { res = await deps.installRpc(params); }
  catch {
    // Outcome unknown (e.g. network). The receipt decides.
    const r = await deps.getReceipt(n.party_id, actor.id, c.request_id).catch(() => null);
    if (r) return { ok: true, data: { committed: true, receipt: r, ...(await readback(n, r, deps, chk.t)) } };
    return fail('The installation could not be confirmed. It is safe to retry install_campaign_area with the same arguments and preview_token.');
  }
  if ('error' in res) return fail(rpcMessage(res.error));
  return { ok: true, data: { committed: true, receipt: res.data, ...(await readback(n, res.data, deps, chk.t)) } };
}
