// Server-only, pure travel projection. Distance/direction rules mirror campaign-map.ts.
type Obj = Record<string, any>;
export const object = (v: unknown): Obj => v && typeof v === 'object' && !Array.isArray(v) ? v as Obj : {};
export const text = (v: unknown, cap = 400): string => typeof v === 'string' ? v.trim().slice(0, cap) : '';
export const isOriginalHost = (host: unknown, caller: unknown): boolean => typeof host === 'string' && !!host && host === caller;
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const clamp = (v: number) => Math.max(0, Math.min(1, v));

export function activeMap(raw: unknown) {
  const envelope = object(raw);
  if (envelope.format === 'odyssey-campaign-atlas') {
    if (envelope.version !== 2 || !Array.isArray(envelope.maps)) return null;
    const node = envelope.maps.find((n: Obj) => n.id === envelope.activeMapId);
    if (!node || node.navigationMode !== 'regional') return null;
    return { mapId: String(node.id), name: text(node.name), state: object(node.state), envelope };
  }
  if (envelope.format || !Array.isArray(envelope.routes)) return null;
  return { mapId: null, name: 'World', state: envelope, envelope };
}

function routeMiles(route: Obj, state: Obj): number | null {
  if (route.distanceSource === 'manual') return finite(route.distanceMiles) && route.distanceMiles > 0 ? route.distanceMiles : null;
  const c = object(state.mapCalibration);
  if (!finite(c.milesPerPixel) || c.milesPerPixel <= 0 || !finite(state.imageNaturalWidth) || !finite(state.imageNaturalHeight)
    || state.imageNaturalWidth !== c.imageWidth || state.imageNaturalHeight !== c.imageHeight
    || !Array.isArray(route.path) || route.path.length < 2) return null;
  let pixels = 0;
  for (let i = 1; i < route.path.length; i++) {
    const a = object(route.path[i-1]), b = object(route.path[i]);
    if (![a.x,a.y,b.x,b.y].every(finite)) return null;
    pixels += Math.hypot((a.x-b.x)*c.imageWidth,(a.y-b.y)*c.imageHeight);
  }
  const miles = pixels * c.milesPerPixel;
  return finite(miles) && miles > 0 ? miles : null;
}

/** Resolve only the saved flight; never fabricate geometry or add it to the ground graph. */
export function savedTravelRoute(state: Obj, routeId: string): Obj | undefined {
  if (state.temporaryFlight?.id === routeId) return state.temporaryFlight;
  return Array.isArray(state.routes) ? state.routes.find((r: Obj) => r.id === routeId) : undefined;
}

function validFlight(state: Obj, plan: Obj, travel: Obj): boolean {
  const r = object(state.temporaryFlight);
  const destination = state.locations?.find((l: Obj) => l.id === plan.destinationLocationId);
  if (r.kind !== 'direct-flight' || typeof r.id !== 'string' || r.id.length > 80 || !r.id.startsWith('__flight__')
    || state.routes?.some((road: Obj) => road.id === r.id)
    || !destination?.discovered || !finite(destination.x) || !finite(destination.y)
    || r.toLocationId !== destination.id || r.fromLocationId === r.toLocationId
    || (r.fromLocationId !== '__flight_origin__' && !state.locations?.some((l: Obj) => l.id === r.fromLocationId))
    || r.distanceSource !== 'manual' || r.terrainFactor !== 1
    || !finite(r.distanceMiles) || r.distanceMiles <= 0 || r.distanceMiles > 1_000_000_000
    || !Array.isArray(r.path) || r.path.length !== 2
    || r.path.some((p: Obj) => !p || !finite(p.x) || !finite(p.y) || p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1)
    || (r.path[0].x === r.path[1].x && r.path[0].y === r.path[1].y)
    || r.path[1].x !== destination.x || r.path[1].y !== destination.y
    || plan.legs.length !== 1 || plan.currentLegIndex !== 0
    || plan.legs[0]?.routeId !== r.id || plan.legs[0]?.reversed !== false
    || travel.routeId !== r.id || travel.reversed !== false
    || !Array.isArray(travel.segments) || travel.segments.length !== 1) return false;
  const seg = object(travel.segments[0]);
  const miles = r.distanceMiles * (seg.endProgress - seg.startProgress);
  const minutes = miles / 40 * 60;
  const close = (a: unknown, b: number) => finite(a) && Math.abs(a - b) <= Math.max(1e-6, Math.abs(b) * 1e-9);
  return seg.routeId === r.id && seg.reversed === false && seg.legIndex === 0
    && close(travel.startProgress, seg.startProgress) && close(travel.endProgress, seg.endProgress)
    && close(seg.distanceMiles, miles) && close(seg.gameMinutes, minutes)
    && close(travel.gameMinutes, minutes) && minutes > 0 && minutes <= 480 + 1e-6
    && close(plan.totalMiles, r.distanceMiles);
}

export function eligibleJourney(raw: unknown, now: number) {
  const map = activeMap(raw);
  if (!map || map.state.travelScale === 'city') return null;
  const state = map.state, plan = object(state.journeyPlan), travel = object(state.activeTravel);
  if (!text(plan.destinationLocationId) || state.currentLocationId === plan.destinationLocationId
    || !Array.isArray(plan.legs) || !plan.legs.length || plan.legs.length > 1000
    || !Number.isInteger(plan.currentLegIndex) || plan.currentLegIndex < 0 || plan.currentLegIndex >= plan.legs.length
    || !['slow','normal','fast','horseback','flying'].includes(plan.pace) || travel.pace !== plan.pace
    || (travel.startedAt !== null && !finite(travel.startedAt)) || !finite(travel.realDurationMs) || travel.realDurationMs <= 0
    || !finite(travel.gameMinutes) || travel.gameMinutes <= 0 || !finite(travel.startCampaignMinute)
    || (travel.pausedFraction !== undefined && (!finite(travel.pausedFraction) || travel.pausedFraction < 0 || travel.pausedFraction >= 1))) return null;
  const base = travel.pausedFraction ?? 0;
  const fraction = travel.startedAt === null ? base : clamp(base + Math.max(0, now-travel.startedAt)/travel.realDurationMs*(1-base));
  if (fraction >= 1 || !Array.isArray(state.routes) || !Array.isArray(state.locations)) return null;
  if (plan.pace === 'flying' && !validFlight(state, plan, travel)) return null;
  const segments = Array.isArray(travel.segments) && travel.segments.length ? travel.segments : [travel];
  if (segments.some((s: Obj) => !finite(s.gameMinutes) || s.gameMinutes <= 0 || !finite(s.startProgress)
    || !finite(s.endProgress) || s.startProgress < 0 || s.endProgress > 1 || s.endProgress <= s.startProgress)) return null;
  if (segments.some((s: Obj, index: number) => {
    const i = s.legIndex ?? plan.currentLegIndex;
    const leg = plan.legs[i];
    return !Number.isInteger(i) || i < plan.currentLegIndex || !leg || s.routeId !== leg.routeId
      || s.reversed !== leg.reversed || (index > 0 && i !== (segments[index - 1].legIndex ?? plan.currentLegIndex) + 1);
  })) return null;
  let want = segments.reduce((n: number,s: Obj) => n+s.gameMinutes,0)*fraction, segmentIndex = 0;
  while (segmentIndex < segments.length-1 && want >= segments[segmentIndex].gameMinutes) {
    want -= segments[segmentIndex].gameMinutes; segmentIndex++;
  }
  const seg = segments[segmentIndex];
  const legIndex = seg.legIndex ?? plan.currentLegIndex;
  if (!Number.isInteger(legIndex) || legIndex < 0 || legIndex >= plan.legs.length) return null;
  const directionProgress = seg.startProgress+(seg.endProgress-seg.startProgress)*clamp(want/seg.gameMinutes);
  const remaining: { legIndex: number; route: Obj; leg: Obj; fullMiles: number; start: number; miles: number }[] = [];
  for (let i = legIndex; i < plan.legs.length; i++) {
    const leg = plan.legs[i], route = plan.pace === 'flying' ? savedTravelRoute(state, leg.routeId)
      : state.routes.find((r: Obj) => r.id === leg.routeId && r.kind !== 'direct-flight' && !String(r.id).startsWith('__flight__'));
    if (!route || typeof leg.reversed !== 'boolean'
      || leg.fromLocationId !== (leg.reversed ? route.toLocationId : route.fromLocationId)
      || leg.toLocationId !== (leg.reversed ? route.fromLocationId : route.toLocationId)) return null;
    if (i === legIndex && (seg.routeId !== leg.routeId || seg.reversed !== leg.reversed)) return null;
    const fullMiles = routeMiles(route,state);
    if (fullMiles === null) return null;
    const start = i === legIndex ? directionProgress : 0;
    remaining.push({ legIndex:i, route, leg, fullMiles, start, miles:fullMiles*(1-start) });
  }
  const remainingMiles = remaining.reduce((n,r) => n+r.miles,0);
  if (!finite(remainingMiles) || remainingMiles <= 0) return null;
  return { ...map, plan, travel, remaining, remainingMiles, now,
    campaignMinute: travel.startCampaignMinute+segments.reduce((n: number,s: Obj) => n+s.gameMinutes,0)*fraction };
}
export type Journey = NonNullable<ReturnType<typeof eligibleJourney>>;

export function targetPoint(journey: Journey, fraction: number) {
  if (!finite(fraction) || fraction < 0.15 || fraction > 0.85) throw new Error('Invalid target');
  let miles = journey.remainingMiles*fraction;
  let selected = journey.remaining[journey.remaining.length-1];
  for (const r of journey.remaining) {
    selected = r;
    if (miles < r.miles) break;
    miles -= r.miles;
  }
  if (!selected) throw new Error('Missing travel route');
  const progress = clamp(selected.start+miles/selected.fullMiles);
  return { target_leg_index:selected.legIndex, target_route_id:selected.route.id,
    target_route_progress:selected.leg.reversed ? 1-progress : progress,
    target_reversed:selected.leg.reversed, target_overall_fraction:fraction };
}

// PostgreSQL jsonb orders keys by UTF-8 byte length then byte order, and uses these spaces.
// Keep the Prompt 1 RPC hash contract; map_id is checked separately, totalMiles is freshness-checked.
function jsonb(v: any): string {
  if (Array.isArray(v)) return `[${v.map(jsonb).join(', ')}]`;
  if (v && typeof v === 'object') {
    const enc = new TextEncoder();
    const keys = Object.keys(v).sort((a,b) => {
      const x=enc.encode(a),y=enc.encode(b);
      if (x.length !== y.length) return x.length-y.length;
      for (let i=0;i<x.length;i++) if (x[i]!==y[i]) return x[i]-y[i];
      return 0;
    });
    return `{${keys.map(k => `${JSON.stringify(k)}: ${jsonb(v[k])}`).join(', ')}}`;
  }
  return JSON.stringify(v);
}
export async function journeyHash(j: Journey): Promise<string> {
  const canonical = jsonb({ destinationLocationId:j.plan.destinationLocationId, pace:j.plan.pace,
    legs:j.plan.legs.map((l: Obj) => ({ routeId:l.routeId,fromLocationId:l.fromLocationId,toLocationId:l.toLocationId,reversed:l.reversed })) });
  const bytes = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(bytes),v => v.toString(16).padStart(2,'0')).join('');
}

export function parseDecision(raw: string) {
  const v = object(JSON.parse(raw));
  if (v.event === false && Object.keys(v).length === 1) return { event:false } as const;
  if (v.event !== true || Object.keys(v).sort().join(',') !== 'event,eventType,premise,targetFraction'
    || typeof v.eventType !== 'string' || typeof v.premise !== 'string'
    || !v.eventType.trim() || !v.premise.trim() || v.eventType.length > 200 || v.premise.length > 8000
    || !finite(v.targetFraction) || v.targetFraction < 0.15 || v.targetFraction > 0.85) throw new Error('Invalid decision');
  return { event:true, eventType:text(v.eventType,80), premise:text(v.premise,2000), targetFraction:v.targetFraction } as const;
}

export function roadGuideScopes(raw: unknown) {
  const env = object(raw);
  if (env.format !== 'odyssey-campaign-atlas' || !Array.isArray(env.maps)) return [];
  const path: Obj[] = [], seen = new Set<string>();
  let node = env.maps.find((n: Obj) => n.id === env.activeMapId);
  while (node) {
    if (seen.has(node.id) || path.length >= 512) return [];
    seen.add(node.id); path.unshift(node);
    node = node.parentMapId ? env.maps.find((n: Obj) => n.id === node.parentMapId) : undefined;
  }
  if (!path.length || path[0].id !== env.rootMapId) return [];
  const scopes: { mapId:string; scope:string; locationId:string|null }[] = [];
  path.forEach((n,i) => {
    scopes.push({ mapId:n.id,scope:'map',locationId:null });
    // Only enclosing entrances. Never the active map's destination/current pin while travelling.
    const entrance = path[i+1]?.parentLocationId;
    if (!entrance) return;
    const locs = object(n.state).locations || [], visited = new Set<string>();
    let loc = locs.find((l: Obj) => l.id === entrance);
    while (loc && !visited.has(loc.id)) {
      visited.add(loc.id); scopes.push({ mapId:n.id,scope:'location',locationId:loc.id });
      loc = loc.parentLocationId ? locs.find((l: Obj) => l.id === loc.parentLocationId) : undefined;
    }
  });
  return scopes;
}