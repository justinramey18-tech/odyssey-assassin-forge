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
  /**
   * Multi-road travel day: the roads this one timed tranche covers, in order. When present the
   * top-level routeId/reversed/startProgress/endProgress mirror the FIRST segment. Missing = single road.
   */
  segments?: TravelSegment[];
}

/** One road inside a timed travel-day tranche. Progress is in the travel direction (0..1). */
export interface TravelSegment {
  routeId: string;
  reversed: boolean;
  startProgress: number;
  endProgress: number;
  distanceMiles: number;
  gameMinutes: number;
  /** Which JourneyPlan leg this segment belongs to. */
  legIndex?: number;
}

export interface JourneyLeg { routeId: string; fromLocationId: string; toLocationId: string; reversed: boolean }

export interface JourneyPlan {
  destinationLocationId: string;
  pace: TravelPace;
  legs: JourneyLeg[];
  currentLegIndex: number;
  /** Miles of the whole journey when planned (for overall progress). */
  totalMiles?: number;
  /** The last tranche stopped because the 8-hour travel day ended. */
  dayComplete?: boolean;
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
  /** Multi-road journey in progress (optional; older saves have none). */
  journeyPlan?: JourneyPlan;
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
  totalMiles: number, progress: number, pace: TravelPace, terrainFactor: number, minutesTraveledToday = 0, dayMinutes: number = TRAVEL_DAY_MINUTES,
): { miles: number; gameMinutes: number; endProgress: number; reachesEnd: boolean } {
  const remaining = routeMilesRemaining(totalMiles, progress);
  const left = Math.max(0, dayMinutes - (fin(minutesTraveledToday) ? Math.max(0, minutesTraveledToday) : 0));
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
  if (travel.segments?.length) {
    const d = travelDetailAt(travel, f);
    return { fraction: f, progress: d.progress, campaignMinute: d.campaignMinute, done: d.done };
  }
  return {
    fraction: f,
    progress: travel.startProgress + (travel.endProgress - travel.startProgress) * f,
    campaignMinute: travel.startCampaignMinute + travel.gameMinutes * f,
    done: f >= 1,
  };
}

export interface TravelDetail {
  fraction: number;
  segmentIndex: number;
  routeId: string;
  reversed: boolean;
  /** Progress on the current road in the travel direction. */
  progress: number;
  /** Progress on the current road measured from its fromLocation. */
  forwardProgress: number;
  campaignMinute: number;
  milesCompleted: number;
  legIndex?: number;
  done: boolean;
}

/** Where a (segmented or single-road) tranche is at this whole-tranche fraction. */
export function travelDetailAt(travel: ActiveTravel, fraction: number): TravelDetail {
  const f = clamp01(fraction);
  const segs = travel.segments;
  if (!segs?.length) {
    const progress = travel.startProgress + (travel.endProgress - travel.startProgress) * f;
    return { fraction: f, segmentIndex: 0, routeId: travel.routeId, reversed: travel.reversed, progress,
      forwardProgress: travel.reversed ? 1 - progress : progress, campaignMinute: travel.startCampaignMinute + travel.gameMinutes * f,
      milesCompleted: 0, done: f >= 1 };
  }
  const total = segs.reduce((n, x) => n + x.gameMinutes, 0);
  let want = total * f, miles = 0, i = 0;
  for (; i < segs.length - 1; i++) {
    if (want < segs[i].gameMinutes) break;
    want -= segs[i].gameMinutes; miles += segs[i].distanceMiles;
  }
  const seg = segs[i];
  const k = seg.gameMinutes > 0 ? Math.min(1, want / seg.gameMinutes) : 1;
  const progress = seg.startProgress + (seg.endProgress - seg.startProgress) * k;
  miles += seg.distanceMiles * k;
  return { fraction: f, segmentIndex: i, routeId: seg.routeId, reversed: seg.reversed, progress,
    forwardProgress: seg.reversed ? 1 - progress : progress, campaignMinute: travel.startCampaignMinute + total * f,
    milesCompleted: miles, legIndex: seg.legIndex, done: f >= 1 };
}

export const travelDetail = (travel: ActiveTravel, nowMs: number) => travelDetailAt(travel, travelFraction(travel, nowMs));

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
  const segments = segmentsOf(r.segments, routeIds);
  if (segments === null) return undefined; // a broken schedule is dropped, never half-kept
  return {
    routeId, reversed: r.reversed === true, pace: r.pace,
    startProgress: clamp01(r.startProgress), endProgress: clamp01(r.endProgress),
    startedAt: fin(r.startedAt) ? r.startedAt : null,
    realDurationMs: Math.max(0, r.realDurationMs), gameMinutes: Math.max(0, r.gameMinutes),
    startCampaignMinute: Math.max(0, r.startCampaignMinute),
    ...(fin(r.pausedFraction) ? { pausedFraction: clamp01(r.pausedFraction) } : {}),
    ...(segments ? { segments } : {}),
  };
}

function segmentsOf(raw: unknown, routeIds: Set<string>): TravelSegment[] | null | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 100) return null;
  const out: TravelSegment[] = [];
  for (const x of raw) {
    if (!x || typeof x !== 'object') return null;
    const r = x as Record<string, unknown>;
    const routeId = str(r.routeId, 80);
    if (!routeIds.has(routeId) || !fin(r.startProgress) || !fin(r.endProgress) || !fin(r.distanceMiles) || !fin(r.gameMinutes)) return null;
    const seg: TravelSegment = { routeId, reversed: r.reversed === true, startProgress: clamp01(r.startProgress), endProgress: clamp01(r.endProgress),
      distanceMiles: Math.max(0, r.distanceMiles), gameMinutes: Math.max(0, r.gameMinutes) };
    if (fin(r.legIndex) && Number.isInteger(r.legIndex) && r.legIndex >= 0) seg.legIndex = r.legIndex;
    out.push(seg);
  }
  return out;
}

function journeyPlanOf(raw: unknown, routes: CampaignMapRoute[], ids: Set<string>): JourneyPlan | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const dest = str(r.destinationLocationId, 80);
  if (!ids.has(dest) || !isPace(r.pace) || !Array.isArray(r.legs) || r.legs.length === 0 || r.legs.length > 200) return undefined;
  const byId = new Map(routes.map(x => [x.id, x]));
  const legs: JourneyLeg[] = [];
  for (const x of r.legs) {
    if (!x || typeof x !== 'object') return undefined;
    const l = x as Record<string, unknown>;
    const route = byId.get(str(l.routeId, 80));
    if (!route) return undefined;
    const reversed = l.reversed === true;
    const from = reversed ? route.toLocationId : route.fromLocationId, to = reversed ? route.fromLocationId : route.toLocationId;
    if (l.fromLocationId !== from || l.toLocationId !== to) return undefined;
    if (legs.length && legs[legs.length - 1].toLocationId !== from) return undefined;
    legs.push({ routeId: route.id, fromLocationId: from, toLocationId: to, reversed });
  }
  if (legs[legs.length - 1].toLocationId !== dest) return undefined;
  const idx = fin(r.currentLegIndex) && Number.isInteger(r.currentLegIndex) ? r.currentLegIndex : 0;
  if (idx < 0 || idx >= legs.length) return undefined;
  const plan: JourneyPlan = { destinationLocationId: dest, pace: r.pace, legs, currentLegIndex: idx };
  if (fin(r.totalMiles) && r.totalMiles > 0) plan.totalMiles = r.totalMiles;
  if (r.dayComplete === true) plan.dayComplete = true;
  return plan;
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
  const plan = journeyPlanOf(r.journeyPlan, routes, ids);
  if (plan) {
    state.journeyPlan = plan;
    if (travel?.segments?.some(x => x.legIndex !== undefined && (x.legIndex >= plan.legs.length || plan.legs[x.legIndex].routeId !== x.routeId))) delete state.journeyPlan;
  }
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
  const plan = state.journeyPlan;
  if (plan) {
    const sum = summarizeJourney(t ? foldTravelToPosition(state, nowMs) : state);
    const dest = name(plan.destinationLocationId);
    lines.push(`Journey: the party is bound for ${dest} (final destination) at a ${plan.pace} pace, via ${sum?.locationNames.join(' → ') ?? dest}.`);
    if (sum) lines.push(`Journey progress: ${Math.round(sum.completedFraction * 100)}% overall; about ${Math.round(sum.remainingMiles)} mi and ${Math.round(sum.remainingMinutes / 60 * 10) / 10} in-world travel hours remain.`);
    lines.push(`Arrival at ${dest} is NOT allowed until the app reports the party has reached it. Intermediate towns are passed through, not stopped at, unless the host stops the journey.`);
  }
  if (t) {
    const now = travelDetail(t, nowMs);
    const route = state.routes.find(r => r.id === now.routeId);
    minute = now.campaignMinute;
    const from = route ? name(now.reversed ? route.toLocationId : route.fromLocationId) : 'somewhere';
    const to = route ? name(now.reversed ? route.fromLocationId : route.toLocationId) : 'somewhere';
    const miles = route ? effectiveRouteMiles(route, cal) : null;
    const status = t.startedAt === null ? 'PAUSED on the road' : now.done ? 'leg just finished (awaiting host update)' : 'MOVING';
    lines.push(`Status: en route from ${from} to ${to}${t.segments && t.segments.length > 1 ? ` (road ${now.segmentIndex + 1} of ${t.segments.length} today)` : ''} — ${status}.`);
    lines.push(`Progress: ${Math.round(now.progress * 100)}% of the road${miles !== null ? ` (${Math.round(miles * now.progress)} mi traveled, ${Math.round(routeMilesRemaining(miles, now.progress))} mi remaining)` : ''}.`);
    lines.push(`Pace: ${t.pace}; terrain ×${route?.terrainFactor ?? 1}${route?.description ? `; road: ${route.description.slice(0, 160)}` : ''}.`);
    const last = t.segments?.length ? t.segments[t.segments.length - 1] : t;
    const lastRoute = state.routes.find(r => r.id === (t.segments?.length ? t.segments[t.segments.length - 1].routeId : t.routeId));
    const dayEnd = lastRoute ? name(last.reversed ? lastRoute.fromLocationId : lastRoute.toLocationId) : to;
    const reachesFinal = !plan || (last.endProgress >= 1 && dayEnd === name(plan.destinationLocationId));
    if (last.endProgress < 1) lines.push(`This travel day stops partway when the 8-hour travel day ends; the party will NOT reach ${plan ? name(plan.destinationLocationId) : dayEnd} today.`);
    const arrived = now.done && last.endProgress >= 1 && reachesFinal;
    const target = plan ? name(plan.destinationLocationId) : to;
    lines.push(arrived ? `Arrival at ${target} is allowed.` : `Arrival at ${target} is NOT allowed yet — narrate the road only.`);
  } else if (state.currentRoutePosition) {
    const p = state.currentRoutePosition;
    const route = state.routes.find(r => r.id === p.routeId);
    const miles = route ? effectiveRouteMiles(route, cal) : null;
    lines.push(`Status: stopped on the road between ${route ? name(route.fromLocationId) : '?'} and ${route ? name(route.toLocationId) : '?'}${p.dayComplete ? ' — the 8-hour travel day has ended' : ''}.`);
    if (miles !== null) lines.push(`Position: ${Math.round(miles * p.progress)} mi from ${route ? name(route.fromLocationId) : '?'}, ${Math.round(miles * (1 - p.progress))} mi from ${route ? name(route.toLocationId) : '?'}.`);
    lines.push('Arrival at either end is NOT allowed until the host continues travel.');
    if (plan) lines.push(`The party is still en route to ${name(plan.destinationLocationId)}; the journey continues when the host continues it.`);
  } else if (state.currentLocationId && byId.get(state.currentLocationId)) {
    const here = byId.get(state.currentLocationId)!;
    lines.push(plan ? `Status: stopped at ${here.name}${plan.dayComplete ? ' — the 8-hour travel day has ended' : ''}; still en route to ${name(plan.destinationLocationId)}.`
      : `Status: at ${here.name}${here.region ? ` (${here.region})` : ''}. Not traveling.`);
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


// ── multi-road journeys ──

const EPS = 1e-6;
const HERE = '__here__';

/** Location ids where the party may start/continue: from a town, or from a point on a road. */
function journeyStartProgress(state: CampaignMapState, leg: JourneyLeg): number {
  const p = state.currentRoutePosition;
  if (p && p.routeId === leg.routeId) return clamp01(leg.reversed ? 1 - p.progress : p.progress);
  return 0;
}

interface PathLabel { minutes: number; miles: number; key: string; prev: string | null; via: JourneyLeg | null }
const better = (a: { minutes: number; miles: number; key: string }, b: { minutes: number; miles: number; key: string }) =>
  a.minutes < b.minutes - EPS || (Math.abs(a.minutes - b.minutes) <= EPS && (a.miles < b.miles - EPS || (Math.abs(a.miles - b.miles) <= EPS && a.key < b.key)));

/**
 * Fastest discovered-road plan from the party's exact position to a discovered destination.
 * Cost = in-world travel minutes at this pace (terrain included); ties → fewer miles → stable ids. Null = unreachable.
 */
export function planJourneyRoute(state: CampaignMapState, destinationLocationId: string, pace: TravelPace = state.defaultPace): JourneyPlan | null {
  if (state.activeTravel) return null;
  const byId = new Map(state.locations.map(l => [l.id, l]));
  const dest = byId.get(destinationLocationId);
  if (!dest || !dest.discovered) return null;
  const pos = state.currentRoutePosition;
  const startNode = pos ? HERE : state.currentLocationId;
  if (!startNode || (!pos && !byId.has(startNode))) return null;
  if (!pos && destinationLocationId === state.currentLocationId) return null;
  const cal = activeCalibration(state);
  const usable = (id: string) => (byId.get(id)?.discovered ?? false) || id === state.currentLocationId;

  // Undirected graph of roads with a known distance between usable endpoints.
  type Edge = { to: string; minutes: number; miles: number; leg: JourneyLeg };
  const adj = new Map<string, Edge[]>();
  const add = (from: string, e: Edge) => { const l = adj.get(from) ?? []; l.push(e); adj.set(from, l); };
  for (const r of [...state.routes].sort((a, b) => a.id.localeCompare(b.id))) {
    const miles = effectiveRouteMiles(r, cal);
    if (miles === null) continue;
    const minutes = travelGameMinutes(miles, pace, r.terrainFactor);
    if (pos && r.id === pos.routeId) {
      // Virtual start on this road: partial distance to either end, never a jump to an endpoint.
      const toB = 1 - pos.progress, toA = pos.progress;
      if (usable(r.toLocationId) && toB > EPS) add(HERE, { to: r.toLocationId, minutes: minutes * toB, miles: miles * toB, leg: { routeId: r.id, fromLocationId: r.fromLocationId, toLocationId: r.toLocationId, reversed: false } });
      if (usable(r.fromLocationId) && toA > EPS) add(HERE, { to: r.fromLocationId, minutes: minutes * toA, miles: miles * toA, leg: { routeId: r.id, fromLocationId: r.toLocationId, toLocationId: r.fromLocationId, reversed: true } });
      continue;
    }
    if (!usable(r.fromLocationId) || !usable(r.toLocationId)) continue;
    add(r.fromLocationId, { to: r.toLocationId, minutes, miles, leg: { routeId: r.id, fromLocationId: r.fromLocationId, toLocationId: r.toLocationId, reversed: false } });
    add(r.toLocationId, { to: r.fromLocationId, minutes, miles, leg: { routeId: r.id, fromLocationId: r.toLocationId, toLocationId: r.fromLocationId, reversed: true } });
  }

  const labels = new Map<string, PathLabel>([[startNode, { minutes: 0, miles: 0, key: '', prev: null, via: null }]]);
  const done = new Set<string>();
  for (;;) {
    let cur: string | null = null;
    for (const [id, l] of labels) if (!done.has(id) && (cur === null || better(l, labels.get(cur)!))) cur = id;
    if (cur === null) break;
    if (cur === destinationLocationId) break;
    done.add(cur);
    const here = labels.get(cur)!;
    for (const e of adj.get(cur) ?? []) {
      if (done.has(e.to) || e.to === startNode) continue;
      const cand = { minutes: here.minutes + e.minutes, miles: here.miles + e.miles, key: `${here.key}|${e.leg.routeId}>${e.to}`, prev: cur, via: e.leg };
      const old = labels.get(e.to);
      if (!old || better(cand, old)) labels.set(e.to, cand);
    }
  }
  const end = labels.get(destinationLocationId);
  if (!end || !end.via) return null;
  const legs: JourneyLeg[] = [];
  for (let n: string | null = destinationLocationId; n && labels.get(n)?.via; n = labels.get(n)!.prev) legs.unshift(labels.get(n)!.via!);
  return { destinationLocationId, pace, legs, currentLegIndex: 0, totalMiles: end.miles };
}

export interface JourneySummary {
  remainingMiles: number;
  remainingMinutes: number;
  locationNames: string[];
  roadIds: string[];
  completedFraction: number;
}

/** Remaining distance/time from the state's stopped position (fold running travel first). Null if a road lost its distance. */
export function summarizeJourney(state: CampaignMapState, plan: JourneyPlan | undefined = state.journeyPlan): JourneySummary | null {
  if (!plan) return null;
  const byId = new Map(state.locations.map(l => [l.id, l]));
  const routes = new Map(state.routes.map(r => [r.id, r]));
  const cal = activeCalibration(state);
  let miles = 0, minutes = 0;
  for (let i = plan.currentLegIndex; i < plan.legs.length; i++) {
    const leg = plan.legs[i], route = routes.get(leg.routeId);
    const m = route ? effectiveRouteMiles(route, cal) : null;
    if (!route || m === null) return null;
    const left = routeMilesRemaining(m, i === plan.currentLegIndex ? journeyStartProgress(state, leg) : 0);
    miles += left; minutes += travelGameMinutes(left, plan.pace, route.terrainFactor);
  }
  const names = [plan.legs[0].fromLocationId, ...plan.legs.map(l => l.toLocationId)].map(id => byId.get(id)?.name ?? '?');
  const total = plan.totalMiles && plan.totalMiles > 0 ? plan.totalMiles : miles;
  return { remainingMiles: miles, remainingMinutes: minutes, locationNames: names, roadIds: plan.legs.map(l => l.routeId),
    completedFraction: total > 0 ? clamp01(1 - miles / total) : 1 };
}

export interface JourneyTranche { segments: TravelSegment[]; gameMinutes: number; miles: number; reachesDestination: boolean }

/** The next legal travel day: consecutive roads until the destination or the 8-hour cap. Null if a road has no distance. */
export function buildJourneyTranche(state: CampaignMapState, plan: JourneyPlan): JourneyTranche | null {
  const routes = new Map(state.routes.map(r => [r.id, r]));
  const cal = activeCalibration(state);
  const segments: TravelSegment[] = [];
  let used = 0, miles = 0, reaches = false;
  for (let i = plan.currentLegIndex; i < plan.legs.length; i++) {
    const leg = plan.legs[i], route = routes.get(leg.routeId);
    const total = route ? effectiveRouteMiles(route, cal) : null;
    if (!route || total === null) return null;
    const start = i === plan.currentLegIndex ? journeyStartProgress(state, leg) : 0;
    const l = maxLegalLeg(total, start, plan.pace, route.terrainFactor, used);
    if (l.gameMinutes > 0) {
      segments.push({ routeId: leg.routeId, reversed: leg.reversed, startProgress: start, endProgress: l.endProgress, distanceMiles: l.miles, gameMinutes: l.gameMinutes, legIndex: i });
      used += l.gameMinutes; miles += l.miles;
    }
    if (!l.reachesEnd) break;
    if (i === plan.legs.length - 1) reaches = true;
  }
  return { segments, gameMinutes: used, miles, reachesDestination: reaches };
}

/** An unanchored ActiveTravel for a tranche (startedAt null until the server stamps it). */
export function trancheToTravel(tr: JourneyTranche, pace: TravelPace, campaignMinute: number, realMinutesPerGameHour: number): ActiveTravel {
  const first = tr.segments[0];
  return {
    routeId: first.routeId, reversed: first.reversed, pace, startProgress: first.startProgress, endProgress: first.endProgress,
    startedAt: null, pausedFraction: 0, realDurationMs: gameToRealMs(tr.gameMinutes, realMinutesPerGameHour),
    gameMinutes: tr.gameMinutes, startCampaignMinute: campaignMinute, segments: tr.segments,
  };
}

/** Put the party exactly where a travel detail says (town at a road end, otherwise on the road). */
function placeAt(next: CampaignMapState, route: CampaignMapRoute | undefined, d: { forwardProgress: number; progress: number; reversed: boolean }, dayComplete: boolean) {
  delete next.currentRoutePosition;
  if (!route) return;
  if (d.progress >= 1 - EPS) { next.currentLocationId = d.reversed ? route.fromLocationId : route.toLocationId; return; }
  next.currentLocationId = null;
  next.currentRoutePosition = { routeId: route.id, progress: clamp01(d.forwardProgress), ...(dayComplete ? { dayComplete: true } : {}) };
}

/** Running/paused travel folded into a stopped position at this time (journey plan kept and advanced). */
export function foldTravelToPosition(state: CampaignMapState, nowMs: number, dayComplete = false): CampaignMapState {
  const t = state.activeTravel;
  if (!t) return state;
  const d = travelDetail(t, nowMs);
  const next: CampaignMapState = { ...state, campaignMinute: d.campaignMinute };
  delete next.activeTravel;
  placeAt(next, state.routes.find(r => r.id === d.routeId), d, dayComplete);
  const plan = state.journeyPlan;
  if (plan) {
    let idx = d.legIndex ?? plan.currentLegIndex;
    if (d.progress >= 1 - EPS) idx += 1;
    if (idx >= plan.legs.length || next.currentLocationId === plan.destinationLocationId) {
      delete next.journeyPlan;
      next.currentLocationId = plan.destinationLocationId;
      delete next.currentRoutePosition;
    } else {
      next.journeyPlan = { ...plan, currentLegIndex: idx, ...(dayComplete ? { dayComplete: true } : {}) };
    }
  }
  return next;
}

/** A finished tranche (by server time) saved into the state. Old single-road travel behaves as before. */
export function settleTravelState(s: CampaignMapState, now: number): CampaignMapState {
  const t = s.activeTravel;
  if (!t) return s;
  const live = travelNow(t, now);
  if (!live.done) return s;
  if (t.segments?.length) {
    const finished: CampaignMapState = { ...s, activeTravel: { ...t, startedAt: null, pausedFraction: 1 } };
    const last = t.segments[t.segments.length - 1];
    return foldTravelToPosition(finished, now, last.endProgress < 1 - EPS || !!s.journeyPlan);
  }
  const route = s.routes.find(r => r.id === t.routeId);
  const next: CampaignMapState = { ...s, campaignMinute: t.startCampaignMinute + t.gameMinutes };
  delete next.activeTravel;
  if (!route) return next;
  if (t.endProgress >= 1) {
    next.currentLocationId = t.reversed ? route.fromLocationId : route.toLocationId;
    delete next.currentRoutePosition;
  } else {
    next.currentLocationId = null;
    next.currentRoutePosition = { routeId: route.id, progress: t.reversed ? 1 - t.endProgress : t.endProgress, dayComplete: true };
  }
  return next;
}

/** Host override: the whole remaining journey completes; the clock advances by all remaining travel time. No rests or resources. */
export function finishJourneyState(s: CampaignMapState, now: number): CampaignMapState | string {
  const stopped = foldTravelToPosition(s, now);
  const plan = stopped.journeyPlan;
  if (!plan) return stopped;
  const sum = summarizeJourney(stopped, plan);
  if (!sum) return 'A road on this journey has no distance. Set its miles first.';
  const next: CampaignMapState = { ...stopped, campaignMinute: stopped.campaignMinute + sum.remainingMinutes, currentLocationId: plan.destinationLocationId };
  delete next.currentRoutePosition; delete next.journeyPlan; delete next.activeTravel;
  return next;
}

/** Roads and places a journey (or the active trip) depends on, for edit guards. */
export function journeyLocks(s: CampaignMapState): { routeIds: Set<string>; locationIds: Set<string> } {
  const routeIds = new Set<string>(), locationIds = new Set<string>();
  for (const l of s.journeyPlan?.legs ?? []) { routeIds.add(l.routeId); locationIds.add(l.fromLocationId); locationIds.add(l.toLocationId); }
  if (s.activeTravel) { routeIds.add(s.activeTravel.routeId); s.activeTravel.segments?.forEach(x => routeIds.add(x.routeId)); }
  return { routeIds, locationIds };
}

export interface ReachableDestination { location: CampaignMapLocation; plan: JourneyPlan; summary: JourneySummary }

/** Every discovered, pinned world place the party can reach by known roads from its exact position, fastest first. */
export function listReachableDestinations(state: CampaignMapState, pace: TravelPace = state.defaultPace): ReachableDestination[] {
  if (state.activeTravel) return [];
  return state.locations.filter(l => l.discovered && l.x !== null && l.y !== null && l.id !== state.currentLocationId).flatMap(l => {
    const plan = planJourneyRoute(state, l.id, pace);
    const summary = plan && summarizeJourney(state, plan);
    return plan && summary ? [{ location: l, plan, summary }] : [];
  }).sort((a, b) => a.summary.remainingMinutes - b.summary.remainingMinutes || a.location.id.localeCompare(b.location.id));
}

/** Roads still ahead on a journey, in order (current road first). */
export function remainingJourneyRouteIds(plan: JourneyPlan, fromLegIndex = plan.currentLegIndex): string[] {
  return plan.legs.slice(Math.max(0, fromLegIndex)).map(l => l.routeId);
}
