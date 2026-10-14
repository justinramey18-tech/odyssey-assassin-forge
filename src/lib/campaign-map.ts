// Campaign Map: the generic world-geography model and its math (no React, no database).
// Campaign/world travel only. Tactical combat markers live in use-party-sync.ts (map_markers) and are separate.

export const CAMPAIGN_MAP_VERSION = 1;

export type TravelPace = 'slow' | 'normal' | 'fast';
/** Miles per in-world hour. */
export const TRAVEL_PACE_MPH: Record<TravelPace, number> = { slow: 2, normal: 3, fast: 4 };
/** A normal overland travel day: this many in-world hours of travel, then the party must stop. */
export const TRAVEL_DAY_HOURS = 8;
export const TRAVEL_DAY_MINUTES = TRAVEL_DAY_HOURS * 60;

/** Real minutes that pass for one in-world hour of travel. */
export const TIME_COMPRESSION_PRESETS = [
  { id: 'cinematic', label: 'Cinematic', realMinutesPerGameHour: 1 },
  { id: 'standard', label: 'Standard', realMinutesPerGameHour: 5 },
  { id: 'immersive', label: 'Immersive', realMinutesPerGameHour: 15 },
  { id: 'realtime', label: 'Real Time', realMinutesPerGameHour: 60 },
] as const;
export const DEFAULT_REAL_MINUTES_PER_GAME_HOUR = 5;
export const MIN_REAL_MINUTES_PER_GAME_HOUR = 0.25;
export const MAX_REAL_MINUTES_PER_GAME_HOUR = 240;

export const LOCATION_KINDS = ['city', 'town', 'village', 'fort', 'dungeon', 'landmark', 'camp', 'region', 'other'] as const;
export type LocationKind = typeof LOCATION_KINDS[number];

export interface MapPoint { x: number; y: number }

export interface CampaignMapLocation {
  id: string;
  name: string;
  description?: string;
  region?: string;
  parentLocationId?: string;
  /** Normalized 0..1 across the image; null when not pinned yet. */
  x: number | null;
  y: number | null;
  discovered: boolean;
  kind: LocationKind;
  /** Presentation only: 'full' = pin + label, 'pin' = pin only, 'background' = art already shows it. Missing/invalid = 'full'. */
  overlayMode?: LocationOverlayMode;
}

export type LocationOverlayMode = 'full' | 'pin' | 'background';
export type RouteOverlayMode = 'full' | 'background';
export const locationOverlayMode = (l: Pick<CampaignMapLocation, 'overlayMode'>): LocationOverlayMode =>
  l.overlayMode === 'pin' || l.overlayMode === 'background' ? l.overlayMode : 'full';
export const routeOverlayMode = (r: Pick<CampaignMapRoute, 'overlayMode'>): RouteOverlayMode =>
  r.overlayMode === 'background' ? 'background' : 'full';

export interface CampaignMapCalibration {
  /** The intrinsic pixel size of the exact image this calibration belongs to. */
  imageWidth: number;
  imageHeight: number;
  a: MapPoint;
  b: MapPoint;
  knownMiles: number;
  /** Derived: real miles per intrinsic image pixel. */
  milesPerPixel: number;
}

export interface CampaignMapRoute {
  id: string;
  fromLocationId: string;
  toLocationId: string;
  /** The distance logistics use. */
  distanceMiles: number;
  distanceSource: 'calibrated' | 'manual';
  calibratedDistanceMiles?: number;
  /** 1 = open road; higher = slower going (hills 1.5, forest 2…). */
  terrainFactor: number;
  description?: string;
  /** Normalized polyline from the start location to the end, with any waypoints between. */
  path: MapPoint[];
  /** Presentation only. 'background' = the atlas art already shows this road. Missing/invalid = 'full'. */
  overlayMode?: RouteOverlayMode;
}

/** Stopped somewhere along a route (0 = at its start, 1 = at its end). */
/** progress is measured from the route's fromLocation (0) to its toLocation (1). dayComplete = stopped by the 8-hour travel day. */
export interface RoutePosition { routeId: string; progress: number; reversed?: boolean; dayComplete?: boolean }

export interface ActiveTravel {
  routeId: string;
  reversed: boolean;
  pace: TravelPace;
  /** Route progress when this leg began (0..1 in the travel direction). */
  startProgress: number;
  /** Route progress where this leg ends (may stop short at the travel-day cap). */
  endProgress: number;
  /** Server-anchored real-world start (ms since epoch); null when paused. */
  startedAt: number | null;
  /** Real milliseconds the whole leg takes. */
  realDurationMs: number;
  /** In-world minutes the whole leg takes. */
  gameMinutes: number;
  /** Campaign minute when the leg began. */
  startCampaignMinute: number;
  /** Fraction of this leg already done when paused (0..1). */
  pausedFraction?: number;
}

export interface CampaignMapState {
  version: number;
  imageUrl: string | null;
  imageNaturalWidth?: number;
  imageNaturalHeight?: number;
  mapCalibration?: CampaignMapCalibration;
  locations: CampaignMapLocation[];
  routes: CampaignMapRoute[];
  currentLocationId: string | null;
  currentRoutePosition?: RoutePosition;
  /** Absolute in-world minute counter (0 = Day 1, 00:00). */
  campaignMinute: number;
  realMinutesPerGameHour: number;
  defaultPace: TravelPace;
  activeTravel?: ActiveTravel;
}

// ── small guards ──

const fin = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const optStr = (v: unknown, max: number): string | undefined => str(v, max) || undefined;
const isPace = (v: unknown): v is TravelPace => v === 'slow' || v === 'normal' || v === 'fast';

function pointOf(raw: unknown): MapPoint | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  return fin(r.x) && fin(r.y) ? { x: clamp01(r.x), y: clamp01(r.y) } : null;
}

export function emptyCampaignMapState(): CampaignMapState {
  return {
    version: CAMPAIGN_MAP_VERSION, imageUrl: null, locations: [], routes: [], currentLocationId: null,
    campaignMinute: 0, realMinutesPerGameHour: DEFAULT_REAL_MINUTES_PER_GAME_HOUR, defaultPace: 'normal',
  };
}

/** A safe real-minutes-per-game-hour value, or null when invalid. */
export function validRealMinutesPerGameHour(v: unknown): number | null {
  const n = Number(v);
  if (v === null || v === '' || !Number.isFinite(n)) return null;
  if (n < MIN_REAL_MINUTES_PER_GAME_HOUR || n > MAX_REAL_MINUTES_PER_GAME_HOUR) return null;
  return n;
}

// ── calibration ──

/** Pixel distance between two normalized points on an image of this intrinsic size. */
export function pixelDistance(a: MapPoint, b: MapPoint, width: number, height: number): number {
  return Math.hypot((b.x - a.x) * width, (b.y - a.y) * height);
}

/** A calibration from two tapped points and the known miles between them, or null when unusable. */
export function createCalibration(a: MapPoint, b: MapPoint, imageWidth: number, imageHeight: number, knownMiles: number): CampaignMapCalibration | null {
  if (!fin(imageWidth) || !fin(imageHeight) || imageWidth <= 0 || imageHeight <= 0) return null;
  if (!fin(knownMiles) || knownMiles <= 0) return null;
  const pa = pointOf(a), pb = pointOf(b);
  if (!pa || !pb) return null;
  const px = pixelDistance(pa, pb, imageWidth, imageHeight);
  if (!(px >= 1)) return null;
  return { imageWidth, imageHeight, a: pa, b: pb, knownMiles, milesPerPixel: knownMiles / px };
}

/** True when the calibration is sound and belongs to this exact image size. */
export function isCalibrationValid(c: CampaignMapCalibration | undefined | null, imageWidth?: number, imageHeight?: number): c is CampaignMapCalibration {
  if (!c || !fin(c.milesPerPixel) || c.milesPerPixel <= 0) return false;
  if (!fin(imageWidth) || !fin(imageHeight)) return false;
  return c.imageWidth === imageWidth && c.imageHeight === imageHeight;
}

/** The stored calibration only if it is valid for the state's current image. */
export function activeCalibration(state: CampaignMapState): CampaignMapCalibration | null {
  return isCalibrationValid(state.mapCalibration, state.imageNaturalWidth, state.imageNaturalHeight) ? state.mapCalibration! : null;
}

/** Swap the map image: the old calibration no longer applies, and calibrated routes need manual distances or a new calibration. */
export function replaceMapImage(state: CampaignMapState, imageUrl: string, width?: number, height?: number): CampaignMapState {
  const next: CampaignMapState = { ...state, imageUrl, imageNaturalWidth: fin(width) && width > 0 ? width : undefined, imageNaturalHeight: fin(height) && height > 0 ? height : undefined };
  delete next.mapCalibration;
  return next;
}

// ── route geometry and distance ──

/** Pixel length of a normalized polyline on an image of this intrinsic size. */
export function polylinePixelLength(path: MapPoint[], width: number, height: number): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += pixelDistance(path[i - 1], path[i], width, height);
  return total;
}

/** Estimated real miles for a traced path, or null without a valid calibration. Never invents a distance. */
export function polylineMiles(path: MapPoint[], calibration: CampaignMapCalibration | null): number | null {
  if (!calibration || path.length < 2) return null;
  const miles = polylinePixelLength(path, calibration.imageWidth, calibration.imageHeight) * calibration.milesPerPixel;
  return fin(miles) && miles > 0 ? miles : null;
}

/** The distance logistics use: a manual override wins; otherwise the calibrated estimate. Null = unknown. */
export function effectiveRouteMiles(route: CampaignMapRoute, calibration: CampaignMapCalibration | null): number | null {
  if (route.distanceSource === 'manual') return fin(route.distanceMiles) && route.distanceMiles > 0 ? route.distanceMiles : null;
  const est = polylineMiles(route.path, calibration);
  return est ?? null;
}

/** After a waypoint edit: calibrated routes recalc their distance; manual routes keep the host's number. */
export function withRoutePath(route: CampaignMapRoute, path: MapPoint[], calibration: CampaignMapCalibration | null): CampaignMapRoute {
  const next = { ...route, path };
  if (route.distanceSource === 'calibrated') {
    const est = polylineMiles(path, calibration);
    if (est !== null) { next.calibratedDistanceMiles = est; next.distanceMiles = est; }
  }
  return next;
}

/** Miles still to go from route progress (0..1 in the travel direction). */
export function routeMilesRemaining(totalMiles: number, progress: number): number {
  if (!fin(totalMiles) || totalMiles <= 0) return 0;
  return totalMiles * (1 - clamp01(fin(progress) ? progress : 0));
}

/** In-world minutes to cover these miles at this pace over this terrain. */
export function travelGameMinutes(miles: number, pace: TravelPace, terrainFactor = 1): number {
  if (!fin(miles) || miles <= 0) return 0;
  const tf = fin(terrainFactor) && terrainFactor > 0 ? terrainFactor : 1;
  return (miles / TRAVEL_PACE_MPH[pace]) * 60 * tf;
}

/**
 * The longest legal leg from here: never past the end of the route and never past the 8-hour travel day.
 * `minutesTraveledToday` = travel already done today.
 */
export function maxLegalLeg(
  totalMiles: number, progress: number, pace: TravelPace, terrainFactor: number, minutesTraveledToday = 0,
): { miles: number; gameMinutes: number; endProgress: number; reachesEnd: boolean } {
  const remaining = routeMilesRemaining(totalMiles, progress);
  const left = Math.max(0, TRAVEL_DAY_MINUTES - (fin(minutesTraveledToday) ? Math.max(0, minutesTraveledToday) : 0));
  const full = travelGameMinutes(remaining, pace, terrainFactor);
  if (remaining <= 0 || left <= 0) return { miles: 0, gameMinutes: 0, endProgress: clamp01(progress), reachesEnd: remaining <= 0 };
  if (full <= left) return { miles: remaining, gameMinutes: full, endProgress: 1, reachesEnd: true };
  const miles = remaining * (left / full);
  return { miles, gameMinutes: left, endProgress: clamp01(progress + miles / totalMiles), reachesEnd: false };
}

/** Real milliseconds for this many in-world minutes. */
export function gameToRealMs(gameMinutes: number, realMinutesPerGameHour: number): number {
  const rate = validRealMinutesPerGameHour(realMinutesPerGameHour) ?? DEFAULT_REAL_MINUTES_PER_GAME_HOUR;
  if (!fin(gameMinutes) || gameMinutes <= 0) return 0;
  return (gameMinutes / 60) * rate * 60_000;
}

/** How far through the leg (0..1) at this server time. */
export function travelFraction(travel: ActiveTravel, nowMs: number): number {
  if (travel.startedAt === null) return clamp01(travel.pausedFraction ?? 0);
  if (!(travel.realDurationMs > 0)) return 1;
  const base = clamp01(travel.pausedFraction ?? 0);
  const elapsed = Math.max(0, nowMs - travel.startedAt);
  return clamp01(base + (elapsed / travel.realDurationMs) * (1 - base));
}

/** Route progress and campaign minute right now. */
export function travelNow(travel: ActiveTravel, nowMs: number): { fraction: number; progress: number; campaignMinute: number; done: boolean } {
  const f = travelFraction(travel, nowMs);
  return {
    fraction: f,
    progress: travel.startProgress + (travel.endProgress - travel.startProgress) * f,
    campaignMinute: travel.startCampaignMinute + travel.gameMinutes * f,
    done: f >= 1,
  };
}

/** A save-safe snapshot: no running clock, just how far the leg got. */
export function freezeTravel(travel: ActiveTravel, nowMs: number): ActiveTravel {
  return { ...travel, startedAt: null, pausedFraction: travelFraction(travel, nowMs) };
}

/** A point along a normalized polyline at fraction t (0..1 of its length). */
export function pointAlong(path: MapPoint[], t: number): MapPoint | null {
  if (path.length === 0) return null;
  if (path.length === 1) return { ...path[0] };
  const lens: number[] = [];
  let total = 0;
  for (let i = 1; i < path.length; i++) { const l = Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y); lens.push(l); total += l; }
  if (total === 0) return { ...path[0] };
  let want = clamp01(fin(t) ? t : 0) * total;
  for (let i = 0; i < lens.length; i++) {
    if (want <= lens[i] || i === lens.length - 1) {
      const k = lens[i] === 0 ? 0 : Math.min(1, want / lens[i]);
      return { x: path[i].x + (path[i + 1].x - path[i].x) * k, y: path[i].y + (path[i + 1].y - path[i].y) * k };
    }
    want -= lens[i];
  }
  return { ...path[path.length - 1] };
}

// ── campaign time ──

export function campaignDay(minute: number): number {
  return Math.floor(Math.max(0, fin(minute) ? minute : 0) / 1440) + 1;
}

/** "Day 3, 14:05". */
export function formatCampaignTime(minute: number): string {
  const m = Math.max(0, Math.floor(fin(minute) ? minute : 0));
  const inDay = m % 1440;
  const hh = String(Math.floor(inDay / 60)).padStart(2, '0');
  const mm = String(inDay % 60).padStart(2, '0');
  return `Day ${campaignDay(m)}, ${hh}:${mm}`;
}

// ── import/sanitize ──

function locationOf(raw: unknown): CampaignMapLocation | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = str(r.id, 80), name = str(r.name, 80);
  if (!id || !name) return null;
  const pinned = fin(r.x) && fin(r.y);
  const loc: CampaignMapLocation = {
    id, name,
    description: optStr(r.description, 1000),
    region: optStr(r.region, 80),
    parentLocationId: optStr(r.parentLocationId, 80),
    x: pinned ? clamp01(r.x as number) : null,
    y: pinned ? clamp01(r.y as number) : null,
    discovered: r.discovered === true,
    kind: (LOCATION_KINDS as readonly string[]).includes(r.kind as string) ? (r.kind as LocationKind) : 'other',
  };
  if (r.overlayMode === 'full' || r.overlayMode === 'pin' || r.overlayMode === 'background') loc.overlayMode = r.overlayMode;
  return loc;
}

function routeOf(raw: unknown, ids: Set<string>): CampaignMapRoute | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = str(r.id, 80), from = str(r.fromLocationId, 80), to = str(r.toLocationId, 80);
  if (!id || !ids.has(from) || !ids.has(to) || from === to) return null;
  const path = (Array.isArray(r.path) ? r.path : []).map(pointOf).filter((p): p is MapPoint => !!p).slice(0, 200);
  const source = r.distanceSource === 'manual' ? 'manual' : 'calibrated';
  const dist = fin(r.distanceMiles) && r.distanceMiles > 0 ? r.distanceMiles : 0;
  const tf = fin(r.terrainFactor) && r.terrainFactor > 0 && r.terrainFactor <= 10 ? r.terrainFactor : 1;
  const route: CampaignMapRoute = { id, fromLocationId: from, toLocationId: to, distanceMiles: dist, distanceSource: source, terrainFactor: tf, path };
  if (fin(r.calibratedDistanceMiles) && r.calibratedDistanceMiles > 0) route.calibratedDistanceMiles = r.calibratedDistanceMiles;
  const d = optStr(r.description, 1000);
  if (d) route.description = d;
  if (r.overlayMode === 'full' || r.overlayMode === 'background') route.overlayMode = r.overlayMode;
  return route;
}

function travelOf(raw: unknown, routeIds: Set<string>): ActiveTravel | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const routeId = str(r.routeId, 80);
  if (!routeIds.has(routeId) || !isPace(r.pace)) return undefined;
  if (!fin(r.startProgress) || !fin(r.endProgress) || !fin(r.realDurationMs) || !fin(r.gameMinutes) || !fin(r.startCampaignMinute)) return undefined;
  return {
    routeId, reversed: r.reversed === true, pace: r.pace,
    startProgress: clamp01(r.startProgress), endProgress: clamp01(r.endProgress),
    startedAt: fin(r.startedAt) ? r.startedAt : null,
    realDurationMs: Math.max(0, r.realDurationMs), gameMinutes: Math.max(0, r.gameMinutes),
    startCampaignMinute: Math.max(0, r.startCampaignMinute),
    ...(fin(r.pausedFraction) ? { pausedFraction: clamp01(r.pausedFraction) } : {}),
  };
}

/** Any stored or imported value → a safe CampaignMapState (null/garbage → empty map). */
export function sanitizeCampaignMapState(raw: unknown): CampaignMapState {
  const base = emptyCampaignMapState();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;
  const r = raw as Record<string, unknown>;
  const seen = new Set<string>();
  const locations = (Array.isArray(r.locations) ? r.locations : []).map(locationOf)
    .filter((l): l is CampaignMapLocation => !!l && !seen.has(l.id) && (seen.add(l.id), true)).slice(0, 500);
  const ids = new Set(locations.map(l => l.id));
  for (const l of locations) if (l.parentLocationId && (!ids.has(l.parentLocationId) || l.parentLocationId === l.id)) delete l.parentLocationId;
  const seenR = new Set<string>();
  const routes = (Array.isArray(r.routes) ? r.routes : []).map(x => routeOf(x, ids))
    .filter((x): x is CampaignMapRoute => !!x && !seenR.has(x.id) && (seenR.add(x.id), true)).slice(0, 1000);
  const routeIds = new Set(routes.map(x => x.id));

  const state: CampaignMapState = {
    ...base,
    imageUrl: str(r.imageUrl, 2000) || null,
    locations, routes,
    currentLocationId: ids.has(r.currentLocationId as string) ? (r.currentLocationId as string) : null,
    campaignMinute: fin(r.campaignMinute) && r.campaignMinute >= 0 ? r.campaignMinute : 0,
    realMinutesPerGameHour: validRealMinutesPerGameHour(r.realMinutesPerGameHour) ?? DEFAULT_REAL_MINUTES_PER_GAME_HOUR,
    defaultPace: isPace(r.defaultPace) ? r.defaultPace : 'normal',
  };
  if (fin(r.imageNaturalWidth) && r.imageNaturalWidth > 0) state.imageNaturalWidth = r.imageNaturalWidth;
  if (fin(r.imageNaturalHeight) && r.imageNaturalHeight > 0) state.imageNaturalHeight = r.imageNaturalHeight;

  const c = r.mapCalibration as Record<string, unknown> | undefined;
  if (c && typeof c === 'object') {
    const a = pointOf(c.a), b = pointOf(c.b);
    const cal = a && b ? createCalibration(a, b, Number(c.imageWidth), Number(c.imageHeight), Number(c.knownMiles)) : null;
    if (cal && isCalibrationValid(cal, state.imageNaturalWidth, state.imageNaturalHeight)) state.mapCalibration = cal;
  }

  const pos = r.currentRoutePosition as Record<string, unknown> | undefined;
  if (pos && typeof pos === 'object' && routeIds.has(pos.routeId as string) && fin(pos.progress)) {
    state.currentRoutePosition = { routeId: pos.routeId as string, progress: clamp01(pos.progress), ...(pos.reversed === true ? { reversed: true } : {}), ...(pos.dayComplete === true ? { dayComplete: true } : {}) };
  }
  const travel = travelOf(r.activeTravel, routeIds);
  if (travel) state.activeTravel = travel;
  return state;
}

// ── DM context ──

/** A short, app-owned description of where the party is and where it can go, for the Party DM. */
export function buildGeographicContext(state: CampaignMapState, nowMs: number = Date.now()): string {
  const byId = new Map(state.locations.map(l => [l.id, l]));
  const cal = activeCalibration(state);
  const lines: string[] = [];
  let minute = state.campaignMinute;
  const t = state.activeTravel;
  if (t) {
    const route = state.routes.find(r => r.id === t.routeId);
    const now = travelNow(t, nowMs);
    minute = now.campaignMinute;
    if (route) {
      const from = byId.get(t.reversed ? route.toLocationId : route.fromLocationId)?.name ?? 'somewhere';
      const to = byId.get(t.reversed ? route.fromLocationId : route.toLocationId)?.name ?? 'somewhere';
      const miles = effectiveRouteMiles(route, cal);
      const left = miles !== null ? ` (about ${Math.round(routeMilesRemaining(miles, now.progress))} miles to go)` : '';
      lines.push(`The party is traveling from ${from} to ${to} at a ${t.pace} pace${left}${t.startedAt === null ? ', paused' : ''}.`);
    }
  } else if (state.currentRoutePosition) {
    const route = state.routes.find(r => r.id === state.currentRoutePosition!.routeId);
    if (route) {
      const a = byId.get(route.fromLocationId)?.name ?? 'somewhere', b = byId.get(route.toLocationId)?.name ?? 'somewhere';
      lines.push(`The party is stopped on the road between ${a} and ${b}.`);
    }
  } else if (state.currentLocationId && byId.get(state.currentLocationId)) {
    const here = byId.get(state.currentLocationId)!;
    lines.push(`The party is at ${here.name}${here.region ? `, in ${here.region}` : ''}.`);
  }
  lines.unshift(`Campaign time: ${formatCampaignTime(minute)}.`);

  if (state.currentLocationId && !t && !state.currentRoutePosition) {
    const out = state.routes.filter(r => r.fromLocationId === state.currentLocationId || r.toLocationId === state.currentLocationId).slice(0, 8);
    const known = out.map(r => {
      const other = byId.get(r.fromLocationId === state.currentLocationId ? r.toLocationId : r.fromLocationId);
      if (!other || !other.discovered) return null;
      const miles = effectiveRouteMiles(r, cal);
      return miles !== null ? `${other.name} (~${Math.round(miles)} mi)` : other.name;
    }).filter(Boolean);
    if (known.length) lines.push(`Known roads lead to: ${known.join(', ')}.`);
  }
  return lines.join(' ');
}

/** App-owned, factual travel facts for the Party DM. Concise; no registry, no coordinates. */
export function buildDmLogisticsContext(state: CampaignMapState, nowMs: number = Date.now()): string {
  const byId = new Map(state.locations.map(l => [l.id, l]));
  const cal = activeCalibration(state);
  const name = (id: string | null | undefined) => (id && byId.get(id)?.name) || 'an unnamed place';
  const lines: string[] = ['[CAMPAIGN MAP — AUTHORITATIVE FACTS, set by the app. Do not contradict, move the party, or start/finish journeys yourself; the host controls travel.]'];
  const t = state.activeTravel;
  let minute = state.campaignMinute;
  if (t) {
    const route = state.routes.find(r => r.id === t.routeId);
    const now = travelNow(t, nowMs);
    minute = now.campaignMinute;
    const from = route ? name(t.reversed ? route.toLocationId : route.fromLocationId) : 'somewhere';
    const to = route ? name(t.reversed ? route.fromLocationId : route.toLocationId) : 'somewhere';
    const miles = route ? effectiveRouteMiles(route, cal) : null;
    const status = t.startedAt === null ? 'PAUSED on the road' : now.done ? 'leg just finished (awaiting host update)' : 'MOVING';
    lines.push(`Status: en route from ${from} to ${to} — ${status}.`);
    lines.push(`Progress: ${Math.round(now.progress * 100)}% of the road${miles !== null ? ` (${Math.round(miles * now.progress)} mi traveled, ${Math.round(routeMilesRemaining(miles, now.progress))} mi remaining)` : ''}.`);
    lines.push(`Pace: ${t.pace}; terrain ×${route?.terrainFactor ?? 1}${route?.description ? `; road: ${route.description.slice(0, 160)}` : ''}.`);
    if (t.endProgress < 1) lines.push(`This leg stops partway when the 8-hour travel day ends; the party will NOT reach ${to} today.`);
    const arrived = now.done && t.endProgress >= 1;
    lines.push(arrived ? `Arrival at ${to} is allowed.` : `Arrival at ${to} is NOT allowed yet — narrate the roadside position only.`);
  } else if (state.currentRoutePosition) {
    const p = state.currentRoutePosition;
    const route = state.routes.find(r => r.id === p.routeId);
    const miles = route ? effectiveRouteMiles(route, cal) : null;
    lines.push(`Status: stopped on the road between ${route ? name(route.fromLocationId) : '?'} and ${route ? name(route.toLocationId) : '?'}${p.dayComplete ? ' — the 8-hour travel day has ended' : ''}.`);
    if (miles !== null) lines.push(`Position: ${Math.round(miles * p.progress)} mi from ${route ? name(route.fromLocationId) : '?'}, ${Math.round(miles * (1 - p.progress))} mi from ${route ? name(route.toLocationId) : '?'}.`);
    lines.push('Arrival at either end is NOT allowed until the host continues travel.');
  } else if (state.currentLocationId && byId.get(state.currentLocationId)) {
    const here = byId.get(state.currentLocationId)!;
    lines.push(`Status: at ${here.name}${here.region ? ` (${here.region})` : ''}. Not traveling.`);
    const known = state.routes.filter(r => r.fromLocationId === here.id || r.toLocationId === here.id).slice(0, 8).map(r => {
      const other = byId.get(r.fromLocationId === here.id ? r.toLocationId : r.fromLocationId);
      if (!other?.discovered) return null;
      const m = effectiveRouteMiles(r, cal);
      return m !== null ? `${other.name} (~${Math.round(m)} mi)` : other.name;
    }).filter(Boolean);
    if (known.length) lines.push(`Known roads lead to: ${known.join(', ')}. Reaching them requires the host to start travel.`);
  } else {
    lines.push('Status: party location not set on the map.');
  }
  lines.splice(1, 0, `Campaign time: ${formatCampaignTime(minute)}.`);
  return lines.join('\n');
}
