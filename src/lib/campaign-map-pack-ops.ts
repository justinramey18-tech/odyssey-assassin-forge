// Allowlisted edits the Map Setup Assistant may propose for a STAGED Map Pack.
// They change only an in-memory copy; every result is re-checked by the pack validator.
// Nothing here can set the image, timers, user ids or live travel.

import { LOCATION_KINDS, TIME_COMPRESSION_PRESETS, sanitizeCampaignMapState, locationOverlayMode, routeOverlayMode, validRealMinutesPerGameHour, type CampaignMapLocation, type CampaignMapState, type LocationKind, type TravelPace } from '@/lib/campaign-map';
import { validateMapData, type MapPackGuide } from '@/lib/campaign-map-pack';

export type StagedOp =
  | { op: 'set_default_pace'; pace: TravelPace }
  | { op: 'set_time_compression'; preset?: string; realMinutesPerGameHour?: number }
  | { op: 'set_campaign_minute'; minute: number }
  | { op: 'set_discovered'; locationId: string; discovered: boolean }
  | { op: 'edit_location'; locationId: string; name?: string; description?: string; region?: string; kind?: string; parentLocationId?: string | null; overlayMode?: 'full' | 'pin' | 'background' }
  | { op: 'add_location'; id: string; name: string; kind?: string; description?: string; region?: string; parentLocationId?: string | null; discovered?: boolean }
  | { op: 'remove_location'; locationId: string }
  | { op: 'edit_route'; routeId: string; description?: string; terrainFactor?: number; distanceSource?: 'manual' | 'calibrated'; distanceMiles?: number; overlayMode?: 'full' | 'background' }
  | { op: 'add_route'; id: string; fromLocationId: string; toLocationId: string; distanceMiles: number; terrainFactor?: number; description?: string }
  | { op: 'remove_route'; routeId: string }
  | { op: 'set_start_location'; locationId: string | null }
  | { op: 'set_guide_recommendation'; guideIndex: number; recommendedEnabled: boolean };

export const STAGED_OP_NAMES = ['set_default_pace', 'set_time_compression', 'set_campaign_minute', 'set_discovered', 'edit_location', 'add_location', 'remove_location', 'edit_route', 'add_route', 'remove_route', 'set_start_location', 'set_guide_recommendation'] as const;

export interface StagedResult {
  state: CampaignMapState;
  guides: MapPackGuide[];
  applied: string[];
  rejected: Array<{ label: string; reason: string }>;
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : undefined);
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

function describe(o: Record<string, unknown>): string {
  const op = String(o.op ?? '?');
  const target = o.locationId ?? o.routeId ?? o.id ?? o.pace ?? o.preset ?? o.realMinutesPerGameHour ?? o.minute ?? o.guideIndex;
  return target !== undefined ? `${op.replace(/_/g, ' ')} (${String(target)})` : op.replace(/_/g, ' ');
}

/** One op → new state, or a reason it can't apply. Never touches image, timers or travel. */
function applyOne(s: CampaignMapState, guides: MapPackGuide[], o: Record<string, unknown>): { state: CampaignMapState; guides: MapPackGuide[] } | string {
  const loc = (id: unknown) => s.locations.find(l => l.id === id);
  const route = (id: unknown) => s.routes.find(r => r.id === id);
  switch (o.op) {
    case 'set_default_pace':
      if (o.pace !== 'slow' && o.pace !== 'normal' && o.pace !== 'fast') return 'Pace must be slow, normal or fast.';
      return { state: { ...s, defaultPace: o.pace }, guides };
    case 'set_time_compression': {
      const preset = TIME_COMPRESSION_PRESETS.find(p => p.id === o.preset || p.label.toLowerCase() === String(o.preset ?? '').toLowerCase());
      const v = preset ? preset.realMinutesPerGameHour : validRealMinutesPerGameHour(o.realMinutesPerGameHour);
      if (v === null || v === undefined) return 'Time speed must be a known preset or 0.25–240 real minutes per hour.';
      return { state: { ...s, realMinutesPerGameHour: v }, guides };
    }
    case 'set_campaign_minute':
      if (typeof o.minute !== 'number' || !Number.isFinite(o.minute) || o.minute < 0) return 'Start time must be zero or more.';
      return { state: { ...s, campaignMinute: Math.floor(o.minute) }, guides };
    case 'set_discovered':
      if (!loc(o.locationId) || typeof o.discovered !== 'boolean') return 'Unknown place.';
      return { state: { ...s, locations: s.locations.map(l => (l.id === o.locationId ? { ...l, discovered: o.discovered as boolean } : l)) }, guides };
    case 'edit_location': {
      const l = loc(o.locationId);
      if (!l) return 'Unknown place.';
      const next: CampaignMapLocation = { ...l };
      const name = str(o.name, 80); if (o.name !== undefined) { if (!name) return 'A place needs a name.'; next.name = name; }
      if (o.description !== undefined) next.description = str(o.description, 600) || undefined;
      if (o.region !== undefined) next.region = str(o.region, 80) || undefined;
      if (o.kind !== undefined) { if (!(LOCATION_KINDS as readonly string[]).includes(o.kind as string)) return 'Unknown place type.'; next.kind = o.kind as LocationKind; }
      if (o.overlayMode !== undefined) { if (o.overlayMode !== 'full' && o.overlayMode !== 'pin' && o.overlayMode !== 'background') return 'Place display must be full, pin or background.'; next.overlayMode = o.overlayMode; }
      if (o.parentLocationId !== undefined) {
        if (o.parentLocationId === null) delete next.parentLocationId;
        else if (!loc(o.parentLocationId) || o.parentLocationId === l.id) return 'That parent place does not exist.';
        else next.parentLocationId = o.parentLocationId as string;
      }
      return { state: { ...s, locations: s.locations.map(x => (x.id === l.id ? next : x)) }, guides };
    }
    case 'add_location': {
      const id = str(o.id, 60), name = str(o.name, 80);
      if (!id || !name) return 'A new place needs an id and a name.';
      if (loc(id)) return 'That place id already exists.';
      if (o.parentLocationId && !loc(o.parentLocationId)) return 'That parent place does not exist.';
      const kind = (LOCATION_KINDS as readonly string[]).includes(o.kind as string) ? (o.kind as LocationKind) : 'other';
      // Never invent coordinates: new places start unpinned.
      const l: CampaignMapLocation = { id, name, x: null, y: null, discovered: o.discovered === true, kind,
        ...(str(o.description, 600) ? { description: str(o.description, 600) } : {}), ...(str(o.region, 80) ? { region: str(o.region, 80) } : {}),
        ...(typeof o.parentLocationId === 'string' ? { parentLocationId: o.parentLocationId } : {}) };
      return { state: { ...s, locations: [...s.locations, l] }, guides };
    }
    case 'remove_location': {
      if (!loc(o.locationId)) return 'Unknown place.';
      if (guides.some(g => g.scope === 'location' && g.locationId === o.locationId)) return 'A place guide in this pack is for this place. Keep the place.';
      if (s.activeTravel && s.routes.some(r => r.id === s.activeTravel!.routeId && (r.fromLocationId === o.locationId || r.toLocationId === o.locationId))) return 'A paused trip uses this place.';
      return { state: { ...s,
        locations: s.locations.filter(l => l.id !== o.locationId).map(l => (l.parentLocationId === o.locationId ? (({ parentLocationId: _p, ...rest }) => rest)(l) as CampaignMapLocation : l)),
        routes: s.routes.filter(r => r.fromLocationId !== o.locationId && r.toLocationId !== o.locationId),
        currentLocationId: s.currentLocationId === o.locationId ? null : s.currentLocationId }, guides };
    }
    case 'edit_route': {
      const r = route(o.routeId);
      if (!r) return 'Unknown road.';
      const next = { ...r };
      if (o.description !== undefined) next.description = str(o.description, 400) || undefined;
      if (o.terrainFactor !== undefined) { if (typeof o.terrainFactor !== 'number' || !(o.terrainFactor > 0 && o.terrainFactor <= 10)) return 'Terrain must be above 0 and at most 10.'; next.terrainFactor = o.terrainFactor; }
      if (o.overlayMode !== undefined) { if (o.overlayMode !== 'full' && o.overlayMode !== 'background') return 'Road display must be full or background.'; next.overlayMode = o.overlayMode; }
      if (o.distanceMiles !== undefined) { if (typeof o.distanceMiles !== 'number' || !(o.distanceMiles > 0)) return 'Miles must be above 0.'; next.distanceMiles = o.distanceMiles; }
      if (o.distanceSource !== undefined) { if (o.distanceSource !== 'manual' && o.distanceSource !== 'calibrated') return 'Distance must be manual or calibrated.'; next.distanceSource = o.distanceSource; }
      return { state: { ...s, routes: s.routes.map(x => (x.id === r.id ? next : x)) }, guides };
    }
    case 'add_route': {
      const id = str(o.id, 60);
      if (!id || route(id)) return 'A new road needs a fresh id.';
      const a = loc(o.fromLocationId), b = loc(o.toLocationId);
      if (!a || !b || a.id === b.id) return 'A road needs two different existing places.';
      if (typeof o.distanceMiles !== 'number' || !(o.distanceMiles > 0)) return 'A new road needs its miles.';
      const tf = typeof o.terrainFactor === 'number' && o.terrainFactor > 0 && o.terrainFactor <= 10 ? o.terrainFactor : 1;
      const path = a.x !== null && a.y !== null && b.x !== null && b.y !== null ? [{ x: a.x, y: a.y }, { x: b.x, y: b.y }] : [];
      return { state: { ...s, routes: [...s.routes, { id, fromLocationId: a.id, toLocationId: b.id, distanceSource: 'manual', distanceMiles: o.distanceMiles, terrainFactor: tf, path, ...(str(o.description, 400) ? { description: str(o.description, 400) } : {}) }] }, guides };
    }
    case 'remove_route':
      if (!route(o.routeId)) return 'Unknown road.';
      if (s.activeTravel?.routeId === o.routeId || s.currentRoutePosition?.routeId === o.routeId) return 'The party is on this road.';
      return { state: { ...s, routes: s.routes.filter(r => r.id !== o.routeId) }, guides };
    case 'set_start_location': {
      if (o.locationId !== null && !loc(o.locationId)) return 'Unknown place.';
      if (s.activeTravel) return 'A paused trip is included; the start place cannot change.';
      const next: CampaignMapState = { ...s, currentLocationId: (o.locationId as string | null) };
      delete next.currentRoutePosition;
      return { state: next, guides };
    }
    case 'set_guide_recommendation': {
      const i = o.guideIndex;
      if (typeof i !== 'number' || !guides[i] || typeof o.recommendedEnabled !== 'boolean') return 'Unknown guide.';
      // Metadata only — this never installs or ticks the guide.
      return { state: s, guides: guides.map((g, j) => (j === i ? { ...g, recommendedEnabled: o.recommendedEnabled as boolean } : g)) };
    }
    default:
      return 'That kind of change is not allowed.';
  }
}

/** Apply proposed ops one by one to a copy; any op that would break the pack is rejected. */
export function applyStagedOperations(base: CampaignMapState, guides: MapPackGuide[], ops: unknown, imageWidth: number, imageHeight: number): StagedResult {
  let state: CampaignMapState = structuredClone(base);
  let gs = guides.map(g => ({ ...g }));
  const applied: string[] = []; const rejected: StagedResult['rejected'] = [];
  for (const raw of (Array.isArray(ops) ? ops : []).slice(0, 40)) {
    if (!isObj(raw)) { rejected.push({ label: 'unknown change', reason: 'Not a valid change.' }); continue; }
    const label = describe(raw);
    const r = applyOne(state, gs, raw);
    if (typeof r === 'string') { rejected.push({ label, reason: r }); continue; }
    const check = validateMapData(r.state, imageWidth, imageHeight);
    if (check.errors.length) { rejected.push({ label, reason: check.errors[0] }); continue; }
    const ids = new Set(r.state.locations.map(l => l.id));
    const dangling = r.guides.find(g => g.scope === 'location' && !ids.has(g.locationId!));
    if (dangling) { rejected.push({ label, reason: `Guide "${dangling.name}" would lose its place.` }); continue; }
    // Keep the live-safety shape: sanitized, no image, no running timer.
    const clean = sanitizeCampaignMapState({ ...r.state, imageUrl: null });
    clean.imageUrl = null;
    if (clean.activeTravel) clean.activeTravel = { ...clean.activeTravel, startedAt: null };
    state = clean; gs = r.guides; applied.push(label);
  }
  return { state, guides: gs, applied, rejected };
}

/** Compact, image-free copy of the staged pack for the assistant. */
export function stagedPackForAssistant(state: CampaignMapState, guides: MapPackGuide[], meta: { name?: string; description?: string; imageWidth: number | null; imageHeight: number | null }) {
  return {
    pack: { name: meta.name ?? '', description: meta.description ?? '', imageWidth: meta.imageWidth, imageHeight: meta.imageHeight },
    calibrated: !!state.mapCalibration,
    calibration: state.mapCalibration ? { knownMiles: state.mapCalibration.knownMiles, milesPerPixel: state.mapCalibration.milesPerPixel } : null,
    defaultPace: state.defaultPace,
    realMinutesPerGameHour: state.realMinutesPerGameHour,
    campaignMinute: state.campaignMinute,
    startLocationId: state.currentLocationId,
    hasPausedTrip: !!state.activeTravel,
    locations: state.locations.slice(0, 200).map(l => ({ id: l.id, name: l.name, kind: l.kind, discovered: l.discovered, pinned: l.x !== null && l.y !== null, ...(l.region ? { region: l.region } : {}), ...(l.parentLocationId ? { parentLocationId: l.parentLocationId } : {}), ...(l.description ? { description: l.description.slice(0, 300) } : {}), overlayMode: locationOverlayMode(l) })),
    routes: state.routes.slice(0, 300).map(r => ({ id: r.id, from: r.fromLocationId, to: r.toLocationId, distanceSource: r.distanceSource, distanceMiles: Math.round(r.distanceMiles * 10) / 10, terrainFactor: r.terrainFactor, traced: r.path.length >= 2, ...(r.description ? { description: r.description.slice(0, 200) } : {}), overlayMode: routeOverlayMode(r) })),
    guides: guides.map((g, i) => ({ index: i, name: g.name, scope: g.scope, ...(g.scope === 'location' ? { locationId: g.locationId, locationName: state.locations.find(l => l.id === g.locationId)?.name ?? null } : {}), chars: g.content.length, recommendedEnabled: !!g.recommendedEnabled, preview: g.content.slice(0, 400) })),
  };
}
