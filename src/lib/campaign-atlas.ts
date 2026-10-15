// Campaign Atlas: a collection of nested campaign maps (a regional root, child area maps attached
// to its locations, and further nesting). Version 2 is an OUTER envelope; every node.state is the
// existing version-1 CampaignMapState. All distance/time/path math stays in campaign-map.ts.
//
// Rules:
// - One shared party position: atlas.activeMapId. Only the active map may have travel/journeys.
// - One clock: atlas.campaignMinute + atlas.realMinutesPerGameHour. Node clocks are ignored and
//   overwritten by projection; inactive maps never advance.
// - Private guide text, local browse state and image bytes never belong in the atlas.
// - Limits: at most ATLAS_MAX_MAPS maps and ATLAS_MAX_BYTES of serialized geography. Over-limit
//   input is REJECTED with an error, never trimmed.

import {
  sanitizeCampaignMapState,
  settleTravelState,
  validRealMinutesPerGameHour,
  DEFAULT_REAL_MINUTES_PER_GAME_HOUR,
  type CampaignMapState,
} from '@/lib/campaign-map';

export const ATLAS_FORMAT = 'odyssey-campaign-atlas';
export const ATLAS_VERSION = 2;
export const ATLAS_MAX_MAPS = 512;
/** Total serialized geography budget: 8 MiB. */
export const ATLAS_MAX_BYTES = 8 * 1024 * 1024;
const MAX_LOCATIONS = 500;
const MAX_ROUTES = 1000;

export type NavigationMode = 'regional' | 'local';

export interface AtlasMapNode {
  id: string;
  name: string;
  parentMapId: string | null;
  parentLocationId: string | null;
  entryLocationId: string | null;
  navigationMode: NavigationMode;
  state: CampaignMapState;
}

export interface CampaignAtlas {
  format: typeof ATLAS_FORMAT;
  version: typeof ATLAS_VERSION;
  revision: number;
  sourcePartyId: string;
  rootMapId: string;
  activeMapId: string;
  campaignMinute: number;
  realMinutesPerGameHour: number;
  maps: AtlasMapNode[];
}

export type AtlasResult<T = CampaignAtlas> = { ok: true; value: T } | { ok: false; error: string };
const bad = (error: string): { ok: false; error: string } => ({ ok: false, error });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v);
const fin = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const nullableStr = (v: unknown) => v === null || typeof v === 'string';

/** Is this stored value an atlas envelope (valid or not)? Legacy v1 maps return false. */
export function isAtlasEnvelope(raw: unknown): boolean {
  return !!raw && typeof raw === 'object' && !Array.isArray(raw) && (raw as Record<string, unknown>).format === ATLAS_FORMAT;
}

export function atlasByteSize(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

/** Strict parse. Unknown versions, broken graphs and oversize collections are errors, never repaired. */
export function parseAtlas(raw: unknown): AtlasResult {
  if (!isAtlasEnvelope(raw)) return bad('This is not a nested map collection.');
  const r = raw as Record<string, unknown>;
  if (r.version !== ATLAS_VERSION) return bad('This map collection was made by a newer or unknown version.');
  if (!fin(r.revision) || r.revision < 0 || !Number.isInteger(r.revision)) return bad('The map collection has an invalid revision.');
  if (!isUuid(r.sourcePartyId) || !isUuid(r.rootMapId) || !isUuid(r.activeMapId)) return bad('The map collection has invalid ids.');
  if (!fin(r.campaignMinute) || r.campaignMinute < 0) return bad('The map collection clock is invalid.');
  const rate = validRealMinutesPerGameHour(r.realMinutesPerGameHour);
  if (rate === null || typeof r.realMinutesPerGameHour !== 'number') return bad('The map collection time speed is invalid.');
  if (!Array.isArray(r.maps) || r.maps.length === 0) return bad('The map collection has no maps.');
  if (r.maps.length > ATLAS_MAX_MAPS) return bad(`Too many maps (${ATLAS_MAX_MAPS} at most).`);
  if (atlasByteSize(r.maps) > ATLAS_MAX_BYTES) return bad('The map collection is too large (8 MB of map data at most).');

  const maps: AtlasMapNode[] = [];
  const ids = new Set<string>();
  for (const m of r.maps as unknown[]) {
    if (!m || typeof m !== 'object' || Array.isArray(m)) return bad('A map in the collection is malformed.');
    const n = m as Record<string, unknown>;
    if (!isUuid(n.id)) return bad('A map has an invalid id.');
    if (ids.has(n.id)) return bad('Two maps share the same id.');
    ids.add(n.id);
    if (typeof n.name !== 'string') return bad('A map has no name.');
    if (!(n.parentMapId === null || isUuid(n.parentMapId))) return bad('A map has an invalid parent.');
    if (!nullableStr(n.parentLocationId) || !nullableStr(n.entryLocationId)) return bad('A map has invalid links.');
    if (n.navigationMode !== 'regional' && n.navigationMode !== 'local') return bad('A map has an invalid navigation mode.');
    const st = n.state as Record<string, unknown> | undefined;
    if (!st || typeof st !== 'object' || Array.isArray(st)) return bad('A map has no geography.');
    if (st.version !== undefined && st.version !== 1) return bad('A map uses an unknown geography version.');
    if (Array.isArray(st.locations) && st.locations.length > MAX_LOCATIONS) return bad(`A map has too many places (${MAX_LOCATIONS} at most).`);
    if (Array.isArray(st.routes) && st.routes.length > MAX_ROUTES) return bad(`A map has too many roads (${MAX_ROUTES} at most).`);
    maps.push({
      id: n.id, name: n.name.slice(0, 120), parentMapId: n.parentMapId as string | null,
      parentLocationId: n.parentLocationId as string | null, entryLocationId: n.entryLocationId as string | null,
      navigationMode: n.navigationMode, state: sanitizeCampaignMapState(st),
    });
  }
  const atlas: CampaignAtlas = {
    format: ATLAS_FORMAT, version: ATLAS_VERSION, revision: r.revision, sourcePartyId: r.sourcePartyId,
    rootMapId: r.rootMapId, activeMapId: r.activeMapId, campaignMinute: r.campaignMinute, realMinutesPerGameHour: rate, maps,
  };
  const err = validateAtlasGraph(atlas);
  return err ? bad(err) : { ok: true, value: atlas };
}

/** Graph rules. Returns an error message, or null when valid. */
export function validateAtlasGraph(a: CampaignAtlas): string | null {
  if (a.maps.length > ATLAS_MAX_MAPS) return `Too many maps (${ATLAS_MAX_MAPS} at most).`;
  const byId = new Map(a.maps.map(m => [m.id, m]));
  if (byId.size !== a.maps.length) return 'Two maps share the same id.';
  const root = byId.get(a.rootMapId);
  if (!root) return 'The top map is missing.';
  if (root.parentMapId !== null || root.parentLocationId !== null) return 'The top map cannot have a parent.';
  if (!byId.has(a.activeMapId)) return 'The party is on a map that does not exist.';
  const attached = new Set<string>();
  for (const m of a.maps) {
    const locIds = new Set(m.state.locations.map(l => l.id));
    if (m.entryLocationId !== null && !locIds.has(m.entryLocationId)) return `"${m.name}" has an entry point that does not exist.`;
    // local location-parent chains: every parent exists in this map and there are no loops
    const parentOf = new Map(m.state.locations.map(l => [l.id, l.parentLocationId]));
    for (const l of m.state.locations) {
      let cur = l.parentLocationId, steps = 0;
      while (cur) {
        if (!locIds.has(cur)) return `"${m.name}" has a place inside a missing place.`;
        if (cur === l.id || ++steps > locIds.size) return `"${m.name}" has places inside each other in a loop.`;
        cur = parentOf.get(cur);
      }
    }
    if (m.id !== a.activeMapId && (m.state.activeTravel || m.state.journeyPlan)) return `"${m.name}" has travel running but the party is not there.`;
    if (m.id === a.rootMapId) continue;
    if (m.parentMapId === null || m.parentLocationId === null) return `"${m.name}" is not attached to any map.`;
    const parent = byId.get(m.parentMapId);
    if (!parent) return `"${m.name}" is attached to a missing map.`;
    if (!parent.state.locations.some(l => l.id === m.parentLocationId)) return `"${m.name}" is attached to a missing place.`;
    const key = `${m.parentMapId}\u0000${m.parentLocationId}`;
    if (attached.has(key)) return 'Two area maps are attached to the same place.';
    attached.add(key);
    // reach the root without a loop
    let cur: AtlasMapNode | undefined = m, steps = 0;
    while (cur && cur.id !== a.rootMapId) {
      if (++steps > a.maps.length) return 'The maps are attached in a loop.';
      cur = cur.parentMapId ? byId.get(cur.parentMapId) : undefined;
    }
    if (!cur) return `"${m.name}" is not connected to the top map.`;
  }
  if (atlasByteSize(a.maps) > ATLAS_MAX_BYTES) return 'The map collection is too large (8 MB of map data at most).';
  return null;
}

// ── reads ──

export const getNode = (a: CampaignAtlas, id: string) => a.maps.find(m => m.id === id);
export const childAt = (a: CampaignAtlas, parentMapId: string, locationId: string | null | undefined) =>
  locationId ? a.maps.find(m => m.parentMapId === parentMapId && m.parentLocationId === locationId) : undefined;
export const childrenOf = (a: CampaignAtlas, mapId: string) => a.maps.filter(m => m.parentMapId === mapId);

/** A node's state with the atlas clock projected in (node clocks are never authoritative). */
export function projectMapState(a: CampaignAtlas, mapId: string): CampaignMapState | null {
  const n = getNode(a, mapId);
  return n ? { ...n.state, campaignMinute: a.campaignMinute, realMinutesPerGameHour: a.realMinutesPerGameHour } : null;
}
export const projectActive = (a: CampaignAtlas) => projectMapState(a, a.activeMapId)!;

export interface Breadcrumb { mapId: string; name: string; viaLocationId: string | null }
/** Root → … → mapId. */
export function breadcrumbs(a: CampaignAtlas, mapId: string): Breadcrumb[] {
  const out: Breadcrumb[] = [];
  let cur = getNode(a, mapId), steps = 0;
  while (cur && steps++ <= a.maps.length) {
    out.unshift({ mapId: cur.id, name: cur.name, viaLocationId: cur.parentLocationId });
    cur = cur.parentMapId ? getNode(a, cur.parentMapId) : undefined;
  }
  return out;
}

// ── immutable operations (each returns a new atlas or an error string) ──

const withNode = (a: CampaignAtlas, id: string, fn: (n: AtlasMapNode) => AtlasMapNode): CampaignAtlas =>
  ({ ...a, maps: a.maps.map(m => (m.id === id ? fn(m) : m)) });
const stripTravel = (s: CampaignMapState): CampaignMapState => {
  const n = { ...s }; delete n.activeTravel; delete n.journeyPlan; delete n.currentRoutePosition; return n;
};
const busy = (s: CampaignMapState) => !!(s.activeTravel || s.journeyPlan);

/** Wrap a complete legacy map as the root. Geography, image, discovery, travel and clock are kept. */
export function convertLegacyToAtlas(legacy: CampaignMapState, partyId: string, name = 'World', rootId: string = crypto.randomUUID()): CampaignAtlas {
  return {
    format: ATLAS_FORMAT, version: ATLAS_VERSION, revision: 0, sourcePartyId: partyId,
    rootMapId: rootId, activeMapId: rootId,
    campaignMinute: legacy.campaignMinute,
    realMinutesPerGameHour: validRealMinutesPerGameHour(legacy.realMinutesPerGameHour) ?? DEFAULT_REAL_MINUTES_PER_GAME_HOUR,
    maps: [{ id: rootId, name, parentMapId: null, parentLocationId: null, entryLocationId: null, navigationMode: 'regional', state: legacy }],
  };
}

/**
 * Patch ONE node, keeping every other node. When the target is the active map, its clock fields
 * become the atlas clock; otherwise they are ignored and travel is refused.
 */
export function patchMap(a: CampaignAtlas, mapId: string, next: CampaignMapState): CampaignAtlas | string {
  const node = getNode(a, mapId);
  if (!node) return 'That map no longer exists.';
  const isActive = mapId === a.activeMapId;
  if (!isActive && busy(next)) return 'Travel can only run on the map the party is on.';
  const out = withNode(a, mapId, n => ({ ...n, state: next }));
  if (isActive) {
    out.campaignMinute = next.campaignMinute;
    out.realMinutesPerGameHour = validRealMinutesPerGameHour(next.realMinutesPerGameHour) ?? a.realMinutesPerGameHour;
  }
  return validateAtlasGraph(out) ?? out;
}

export function setNodeMeta(a: CampaignAtlas, mapId: string, patch: Partial<Pick<AtlasMapNode, 'name' | 'entryLocationId' | 'navigationMode'>>): CampaignAtlas | string {
  if (!getNode(a, mapId)) return 'That map no longer exists.';
  const out = withNode(a, mapId, n => ({ ...n, ...patch, ...(patch.name !== undefined ? { name: patch.name.trim().slice(0, 120) || n.name } : {}) }));
  return validateAtlasGraph(out) ?? out;
}

export function createChildMap(a: CampaignAtlas, parentMapId: string, parentLocationId: string, opts: {
  id?: string; name: string; navigationMode?: NavigationMode; state?: CampaignMapState; entryLocationId?: string | null;
}): CampaignAtlas | string {
  if (!getNode(a, parentMapId)) return 'That map no longer exists.';
  if (childAt(a, parentMapId, parentLocationId)) return 'That place already has an area map.';
  if (a.maps.length >= ATLAS_MAX_MAPS) return `Too many maps (${ATLAS_MAX_MAPS} at most).`;
  const node: AtlasMapNode = {
    id: opts.id ?? crypto.randomUUID(), name: opts.name.trim().slice(0, 120) || 'Area',
    parentMapId, parentLocationId, entryLocationId: opts.entryLocationId ?? null,
    navigationMode: opts.navigationMode ?? 'local', state: stripTravel(opts.state ?? sanitizeCampaignMapState({})),
  };
  const out = { ...a, maps: [...a.maps, node] };
  return validateAtlasGraph(out) ?? out;
}

/** Party enters a child area. The parent records arrival at the entrance in the same commit. */
export function enterChild(a: CampaignAtlas, childMapId: string): CampaignAtlas | string {
  const child = getNode(a, childMapId);
  if (!child || child.parentMapId !== a.activeMapId || !child.parentLocationId) return 'That area is not reachable from here.';
  const parent = getNode(a, a.activeMapId)!;
  if (busy(parent.state)) return 'Finish or stop the travel first.';
  const out = withNode(withNode(a, parent.id, n => ({ ...n, state: { ...stripTravel(n.state), currentLocationId: child.parentLocationId } })),
    child.id, n => ({ ...n, state: { ...stripTravel(n.state), currentLocationId: n.entryLocationId } }));
  out.activeMapId = child.id;
  return validateAtlasGraph(out) ?? out;
}

/** Party leaves the active area to its parent, standing exactly at the linked entrance. No auto re-entry. */
export function exitToParent(a: CampaignAtlas): CampaignAtlas | string {
  const child = getNode(a, a.activeMapId)!;
  if (!child.parentMapId) return 'This is the top map; there is nowhere to leave to.';
  if (busy(child.state)) return 'Finish or stop the travel first.';
  const out = withNode(a, child.parentMapId, n => ({ ...n, state: { ...stripTravel(n.state), currentLocationId: child.parentLocationId } }));
  out.activeMapId = child.parentMapId;
  return validateAtlasGraph(out) ?? out;
}

/** Local floor plans: move to a place with no miles, rests or time. A place with an area map is entered. */
export function moveLocal(a: CampaignAtlas, locationId: string): CampaignAtlas | string {
  const node = getNode(a, a.activeMapId)!;
  if (node.navigationMode !== 'local') return 'Use travel on regional maps.';
  if (busy(node.state)) return 'Finish or stop the travel first.';
  if (!node.state.locations.some(l => l.id === locationId)) return 'That place no longer exists.';
  const moved = withNode(a, node.id, n => ({ ...n, state: { ...stripTravel(n.state), currentLocationId: locationId } }));
  const child = childAt(moved, node.id, locationId);
  return child ? enterChild(moved, child.id) : moved;
}

/**
 * If the active map just finished travel (stored had travel, next has none and no journey) at a place
 * with an area map, enter it. Mid-journey stops keep the journey and never enter.
 */
export function applyArrivalEntry(prev: CampaignMapState, a: CampaignAtlas): CampaignAtlas {
  const cur = getNode(a, a.activeMapId)!.state;
  if (!prev.activeTravel || cur.activeTravel || cur.journeyPlan || !cur.currentLocationId) return a;
  const child = childAt(a, a.activeMapId, cur.currentLocationId);
  if (!child) return a;
  const entered = enterChild(a, child.id);
  return typeof entered === 'string' ? a : entered;
}

/** The atlas as it really is at this moment: finished travel folded in, final arrival entered. Never persisted here. */
export function resolveAtlasAt(a: CampaignAtlas, nowMs: number): CampaignAtlas {
  const active = projectActive(a);
  if (!active.activeTravel) return a;
  const settled = settleTravelState(active, nowMs);
  if (settled === active) return a;
  const patched = patchMap(a, a.activeMapId, settled);
  return typeof patched === 'string' ? a : applyArrivalEntry(active, patched);
}

// ── save / load helpers ──

export type SnapshotKind = 'null' | 'legacy' | 'atlas' | 'unknown';
/** Strict recognition. Anything that is neither a single v1 map nor an atlas is 'unknown' (never turned into an empty map). */
export function classifySnapshot(raw: unknown): SnapshotKind {
  if (raw === null || raw === undefined) return 'null';
  if (isAtlasEnvelope(raw)) return 'atlas';
  if (typeof raw !== 'object' || Array.isArray(raw)) return 'unknown';
  const r = raw as Record<string, unknown>;
  if ('format' in r || 'maps' in r) return 'unknown';
  if (r.version !== undefined && r.version !== 1) return 'unknown';
  if (r.locations !== undefined && !Array.isArray(r.locations)) return 'unknown';
  if (r.routes !== undefined && !Array.isArray(r.routes)) return 'unknown';
  if (!('locations' in r) && !('imageUrl' in r) && !('routes' in r)) return 'unknown';
  return 'legacy';
}

/** A single legacy map: sanity-limited before the sanitizer can trim. */
export function parseLegacyMap(raw: unknown): AtlasResult<CampaignMapState> {
  if (classifySnapshot(raw) !== 'legacy') return bad('That file is not a campaign map.');
  const r = raw as Record<string, unknown>;
  if (Array.isArray(r.locations) && r.locations.length > MAX_LOCATIONS) return bad(`Too many places (${MAX_LOCATIONS} at most).`);
  if (Array.isArray(r.routes) && r.routes.length > MAX_ROUTES) return bad(`Too many roads (${MAX_ROUTES} at most).`);
  if (atlasByteSize(raw) > ATLAS_MAX_BYTES) return bad('That map is too large (8 MB of map data at most).');
  return { ok: true, value: sanitizeCampaignMapState(raw) };
}

/** Fresh node ids with every root/active/parent link remapped. Place ids inside maps are kept (they are per-map). */
export function remapAtlasIds(a: CampaignAtlas, partyId: string, makeId: () => string = () => crypto.randomUUID()): CampaignAtlas {
  const ids = new Map(a.maps.map(m => [m.id, makeId()]));
  return {
    ...a, sourcePartyId: partyId, rootMapId: ids.get(a.rootMapId)!, activeMapId: ids.get(a.activeMapId)!,
    maps: a.maps.map(m => ({ ...m, id: ids.get(m.id)!, parentMapId: m.parentMapId ? ids.get(m.parentMapId)! : null })),
  };
}

/** Travel on the active map comes back paused; no auto-resume, auto-complete or descent. */
export function pauseAtlasTravel(a: CampaignAtlas): CampaignAtlas {
  const st = projectActive(a);
  const t = st.activeTravel;
  if (!t || t.startedAt === null) return a;
  return { ...a, maps: a.maps.map(m => (m.id === a.activeMapId ? { ...m, state: { ...m.state, activeTravel: { ...t, startedAt: null, pausedFraction: t.pausedFraction ?? 0 } } } : m)) };
}
