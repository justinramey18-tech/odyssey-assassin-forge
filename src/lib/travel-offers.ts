// Solo Empyrean: travel offers. The AI DM (and a live NPC) can offer a trip; the rider gets a
// button, a short confirm, and the map's own travel does the rest. Pure rules, no React, no network.
//
// - The DM ends a post with a hidden tag: <!--TRAVEL:Place name|verb-->  (at most two).
// - The app matches the place against the rider's atlas. Only real, discovered, reachable places
//   become buttons; anything else is dropped without a word.
// - A place can be: a spot on the local map (a move, no time passes), a place on a regional map
//   (a journey), the area map of the place the rider stands at (enter), the map above (leave), or
//   a place on the map above (leave, then a journey).
// Nothing here moves the rider: the screen calls the map's existing functions after the confirm.
import { getNode, projectMapState, type AtlasMapNode, type CampaignAtlas } from '@/lib/campaign-atlas';
import { planJourneyRoute, summarizeJourney, type CampaignMapState, type JourneyPlan, type JourneySummary, type TravelPace } from '@/lib/campaign-map';

export interface TravelOffer { place: string; verb: string }

const TRAVEL_TAG_RE = /<!--TRAVEL:([^>]*?)-->/g;
const tidy = (s: string, max: number) => s.replace(/\s+/g, ' ').trim().slice(0, max);

/** The travel offers in a DM post (at most two). */
export function parseTravelOffers(content: string | null | undefined): TravelOffer[] {
  const out: TravelOffer[] = [];
  for (const m of String(content ?? '').matchAll(TRAVEL_TAG_RE)) {
    const [place = '', verb = ''] = m[1].split('|');
    const p = tidy(place, 80);
    if (!p || out.some(o => o.place.toLowerCase() === p.toLowerCase())) continue;
    out.push({ place: p, verb: tidy(verb, 48).replace(/[.!?]+$/, '') });
    if (out.length >= 2) break;
  }
  return out;
}

export function stripTravelTags(text: string): string {
  return (text || '').replace(TRAVEL_TAG_RE, '');
}

export type TravelTarget =
  /** A spot on the local map the rider is in: no time passes. */
  | { kind: 'move'; locationId: string; name: string }
  /** A place on the regional map the rider is on. */
  | { kind: 'journey'; locationId: string; name: string }
  /** The area map of the place the rider stands at. */
  | { kind: 'enter'; childMapId: string; name: string }
  /** Out to the map above. */
  | { kind: 'leave'; parentMapId: string; name: string }
  /** Out to the map above, then a journey on it. */
  | { kind: 'leave-journey'; parentMapId: string; locationId: string; name: string };

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim().replace(/^the /, '');
const busy = (s: CampaignMapState) => !!s.activeTravel || !!s.journeyPlan || !!s.currentRoutePosition;

/** One name out of a list: an exact match first, then the only one that contains the words. */
function pick<T extends { name: string }>(items: T[], wanted: string): T | null {
  const w = norm(wanted);
  if (!w) return null;
  const exact = items.filter(i => norm(i.name) === w);
  if (exact.length) return exact[0];
  const loose = items.filter(i => { const n = norm(i.name); return n.includes(w) || (w.length >= 5 && w.includes(n) && n.length >= 5); });
  return loose.length === 1 ? loose[0] : null;
}

interface Where { active: AtlasMapNode; state: CampaignMapState; parent: AtlasMapNode | null; parentState: CampaignMapState | null }

function whereIs(atlas: CampaignAtlas): Where | null {
  const active = getNode(atlas, atlas.activeMapId);
  const state = projectMapState(atlas, atlas.activeMapId);
  if (!active || !state) return null;
  const parent = active.parentMapId ? getNode(atlas, active.parentMapId) ?? null : null;
  const projected = parent ? projectMapState(atlas, parent.id) : null;
  // Leaving puts the rider at the entrance on the map above.
  const parentState = parent && projected ? { ...projected, currentLocationId: active.parentLocationId } : null;
  return { active, state, parent, parentState };
}

/** Places on a regional map the rider could set out for (discovered, not where they stand, and a route exists at some pace). */
function journeyPlaces(state: CampaignMapState): Array<{ id: string; name: string }> {
  if (busy(state)) return [];
  return state.locations
    .filter(l => l.discovered && l.id !== state.currentLocationId)
    .filter(l => !!planJourneyRoute(state, l.id, 'normal') || !!planJourneyRoute(state, l.id, 'flying'))
    .map(l => ({ id: l.id, name: l.name }));
}

export interface TravelChoices {
  /** Spots on the local map (a move) or places on the regional map (a journey). */
  here: string[];
  /** The area map at the place the rider stands at. */
  area: string | null;
  /** The map above. */
  leave: string | null;
  /** Places on the map above. */
  beyond: string[];
}

/** Everywhere a travel button may point right now. Empty while a journey is under way. */
export function travelChoices(atlas: CampaignAtlas): TravelChoices {
  const none: TravelChoices = { here: [], area: null, leave: null, beyond: [] };
  const w = whereIs(atlas);
  if (!w || busy(w.state)) return none;
  const local = w.active.navigationMode === 'local';
  const here = local
    ? w.state.locations.filter(l => l.discovered && l.id !== w.state.currentLocationId).map(l => l.name)
    : journeyPlaces(w.state).map(l => l.name);
  const child = w.state.currentLocationId
    ? atlas.maps.find(m => m.parentMapId === w.active.id && m.parentLocationId === w.state.currentLocationId) : undefined;
  const beyond = w.parent && w.parentState && w.parent.navigationMode !== 'local' ? journeyPlaces(w.parentState).map(l => l.name) : [];
  return { here, area: child ? child.name : null, leave: w.parent ? w.parent.name : null, beyond };
}

/** Match a place name to something the rider can really do. Null when it is unknown, undiscovered, or a journey is under way. */
export function resolveTravelTarget(atlas: CampaignAtlas, place: string): TravelTarget | null {
  const w = whereIs(atlas);
  if (!w || busy(w.state)) return null;
  const local = w.active.navigationMode === 'local';
  if (local) {
    const spot = pick(w.state.locations.filter(l => l.discovered && l.id !== w.state.currentLocationId), place);
    if (spot) return { kind: 'move', locationId: spot.id, name: spot.name };
  } else {
    const dest = pick(journeyPlaces(w.state), place);
    if (dest) return { kind: 'journey', locationId: dest.id, name: dest.name };
  }
  const child = w.state.currentLocationId
    ? atlas.maps.find(m => m.parentMapId === w.active.id && m.parentLocationId === w.state.currentLocationId) : undefined;
  if (child && pick([child], place)) return { kind: 'enter', childMapId: child.id, name: child.name };
  if (w.parent && w.parentState) {
    if (w.parent.navigationMode !== 'local') {
      const far = pick(journeyPlaces(w.parentState), place);
      if (far) return { kind: 'leave-journey', parentMapId: w.parent.id, locationId: far.id, name: far.name };
    }
    if (pick([w.parent], place)) return { kind: 'leave', parentMapId: w.parent.id, name: w.parent.name };
  }
  return null;
}

export interface JourneyPreview { plan: JourneyPlan; summary: JourneySummary; pace: TravelPace }

/** What a journey would take at this pace: route, distance and time. Null when that pace cannot make the trip. */
export function previewJourney(atlas: CampaignAtlas, target: TravelTarget, pace: TravelPace): JourneyPreview | null {
  if (target.kind !== 'journey' && target.kind !== 'leave-journey') return null;
  const w = whereIs(atlas);
  const state = target.kind === 'journey' ? w?.state : w?.parentState;
  if (!w || !state || busy(state)) return null;
  const plan = planJourneyRoute(state, target.locationId, pace);
  const summary = plan && summarizeJourney(state, plan);
  return plan && summary ? { plan, summary, pace } : null;
}

/** The paces to offer for a journey, the map's own default first. Flying only for a bonded rider. */
export function journeyPaces(atlas: CampaignAtlas, target: TravelTarget, canFly: boolean): TravelPace[] {
  const w = whereIs(atlas);
  const state = target.kind === 'journey' ? w?.state : target.kind === 'leave-journey' ? w?.parentState : null;
  if (!state) return [];
  const all: TravelPace[] = ['normal', 'horseback', 'flying'];
  const ok = all.filter(p => (p !== 'flying' || canFly) && !!previewJourney(atlas, target, p));
  const first = ok.includes(state.defaultPace) ? state.defaultPace : ok[0];
  return first ? [first, ...ok.filter(p => p !== first)] : [];
}

/** The words on the button: the DM's verb when it gave one, else a plain default. */
export function travelButtonLabel(offer: TravelOffer, target: TravelTarget): string {
  const verb = offer.verb.trim();
  if (verb) return verb.charAt(0).toUpperCase() + verb.slice(1);
  if (target.kind === 'enter') return `Enter ${target.name}`;
  if (target.kind === 'leave') return `Leave for ${target.name}`;
  if (target.kind === 'move') return `Go to ${target.name}`;
  return `Travel to ${target.name}`;
}

/** Time in plain words: minutes, hours, or travel days of eight hours. */
export function travelTimeText(minutes: number): string {
  const m = Math.max(1, Math.round(minutes));
  if (m < 90) return `about ${m} minute${m === 1 ? '' : 's'}`;
  const hours = Math.round(m / 6) / 10;
  if (hours <= 8) return `about ${hours} hour${hours === 1 ? '' : 's'}`;
  const days = Math.ceil(hours / 8);
  return `about ${hours} hours on the move (${days} travel days)`;
}

/** What the DM is told: where a travel button may point, and how to offer one. Replaces "tell the player to use the Map". */
export function travelFactsForDm(atlas: CampaignAtlas): string {
  const c = travelChoices(atlas);
  const lines: string[] = [];
  if (c.here.length) lines.push(`- From here: ${c.here.slice(0, 16).join('; ')}`);
  if (c.area) lines.push(`- Into the area at this place: ${c.area}`);
  if (c.leave) lines.push(`- Out to the wider map: ${c.leave}`);
  if (c.beyond.length) lines.push(`- Beyond that: ${c.beyond.slice(0, 16).join('; ')}`);
  const rule = 'Only the app moves the rider on the map. Never narrate an arrival the facts above do not show.';
  if (!lines.length) return `${rule} No travel can be offered right now.`;
  return [
    rule,
    'TRAVEL BUTTONS: when the story has reached the moment of leaving for somewhere (an order to report, a plan agreed, nothing left to do here), end your post with a hidden tag on its own line and the player gets a button that starts the trip:',
    '<!--TRAVEL:Place name|short verb phrase-->  for example <!--TRAVEL:Montserrat|ride for Montserrat-->',
    'The verb is 2 to 6 words, lower case, no punctuation, and fits the moment. Use a place name exactly as listed below; any other name does nothing. At most two tags in a post, and none when nobody is going anywhere. Do not describe the journey or the arrival in the same post: stop at the point of setting out.',
    'Places a button may point to right now:',
    ...lines,
  ].join('\n');
}

/** The names an NPC may propose going to with the rider. */
export function travelPlaceNames(atlas: CampaignAtlas): string[] {
  const c = travelChoices(atlas);
  return Array.from(new Set([...c.here, ...(c.area ? [c.area] : []), ...c.beyond])).slice(0, 24);
}
