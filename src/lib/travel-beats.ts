// Solo Empyrean: the DM speaks at the turning points of a trip without being asked.

// A travel button starts a trip (src/lib/travel-offers.ts); this file decides when the DM is

// told "set out", "stopped for the night", "arrived" or "moved", what the rider's line in the

// story says, and what the DM is asked to write. Pure: the hook (src/hooks/use-solo-travel-beats.ts)

// watches the map and sends; nothing here moves the rider.

import { settleTravelState, type CampaignMapState } from '@/lib/campaign-map';



export type TravelBeatKind = 'depart' | 'camp' | 'arrive' | 'move';

export type MoveVerb = 'move' | 'enter' | 'leave';



export interface TravelBeat {

  kind: TravelBeatKind;

  /** depart, camp: where the rider is bound. arrive, move: where the rider now is. */

  place: string;

  /** Who travels with the rider (an NPC who proposed the trip). */

  companion?: string;

  companionKey?: string;

  /** move only: a spot nearby, into an area, or out of one. */

  verb?: MoveVerb;

}



/** A trip a travel button started, remembered until it ends (kept across a reload). */

export interface TripRecord {

  destId: string;

  destName: string;

  companion?: string;

  companionKey?: string;

  /** The map has shown the rider on the road at least once. */

  seenTravel: boolean;

  /** The night stop already narrated. */

  campKey?: string;

  createdAt: number;

}



export type TripPhase =

  | { phase: 'traveling' }

  | { phase: 'paused' }

  | { phase: 'camped'; key: string }

  | { phase: 'at'; locationId: string; name: string }

  | { phase: 'road' }

  | { phase: 'unknown' };



/** A trip that never showed on the map (the start failed quietly) is forgotten after this long. */

export const TRIP_START_GRACE_MS = 60_000;



/** Where the trip stands on the map at this moment (finished travel counted as finished). */

export function tripPhase(state: CampaignMapState | null, now: number): TripPhase {

  if (!state) return { phase: 'unknown' };

  const s = settleTravelState(state, now);

  const t = s.activeTravel;

  if (t) return { phase: t.startedAt !== null ? 'traveling' : 'paused' };

  const pos = s.currentRoutePosition;

  const plan = s.journeyPlan;

  if (plan) {

    if (!plan.dayComplete && !pos?.dayComplete) return { phase: 'paused' };

    const spot = pos ? `${pos.routeId}@${pos.progress.toFixed(3)}` : `at:${s.currentLocationId ?? ''}`;

    return { phase: 'camped', key: `${plan.currentLegIndex}:${spot}` };

  }

  if (s.currentLocationId) {

    const here = s.locations.find(l => l.id === s.currentLocationId);

    return { phase: 'at', locationId: s.currentLocationId, name: here?.name || '' };

  }

  return { phase: 'road' };

}



/** What a remembered trip does now: maybe one beat for the DM, and the record to keep (null = the trip is over). */

export function nextTripStep(record: TripRecord, phase: TripPhase, now: number): { record: TripRecord | null; beat: TravelBeat | null } {

  const who = { ...(record.companion ? { companion: record.companion } : {}), ...(record.companionKey ? { companionKey: record.companionKey } : {}) };

  const stale = !record.seenTravel && now - record.createdAt > TRIP_START_GRACE_MS;

  if (phase.phase === 'unknown') return { record, beat: null };

  if (phase.phase === 'traveling' || phase.phase === 'paused') {

    return { record: record.seenTravel ? record : { ...record, seenTravel: true }, beat: null };

  }

  if (phase.phase === 'camped') {

    if (record.campKey === phase.key) return { record: record.seenTravel ? record : { ...record, seenTravel: true }, beat: null };

    return { record: { ...record, seenTravel: true, campKey: phase.key }, beat: { kind: 'camp', place: record.destName, ...who } };

  }

  if (phase.phase === 'at') {

    if (phase.locationId === record.destId) return { record: null, beat: { kind: 'arrive', place: phase.name || record.destName, ...who } };

    // The trip ended somewhere else (finished early at a waypoint): the rider arrived there.

    if (record.seenTravel) return { record: null, beat: phase.name ? { kind: 'arrive', place: phase.name, ...who } : null };

    return { record: stale ? null : record, beat: null };

  }

  // On a road with no journey left: the rider stopped the trip. Nothing to narrate.

  if (record.seenTravel) return { record: null, beat: null };

  return { record: stale ? null : record, beat: null };

}



/** Add a beat to the waiting list. A later turning point replaces earlier ones that were never sent. */

export function queueBeat(queue: TravelBeat[], beat: TravelBeat): TravelBeat[] {

  if (beat.kind === 'arrive') return [...queue.filter(b => b.kind === 'move'), beat];

  if (beat.kind === 'camp') return [...queue.filter(b => b.kind !== 'depart' && b.kind !== 'camp'), beat];

  return [...queue, beat];

}



const withWhom = (b: TravelBeat) => (b.companion ? ` with ${b.companion}` : '');



/** The rider's own line in the story for this beat. */

export function travelBeatLine(b: TravelBeat): string {

  if (b.kind === 'depart') return `I set out for ${b.place}${withWhom(b)}.`;

  if (b.kind === 'camp') return `I stop for the night on the road to ${b.place}.`;

  if (b.kind === 'arrive') return `I arrive at ${b.place}${withWhom(b)}.`;

  return `I ${b.verb === 'enter' ? 'go into' : b.verb === 'leave' ? 'leave for' : 'head to'} ${b.place}${withWhom(b)}.`;

}



export const TRAVEL_BEAT_WORDS: Record<TravelBeatKind, { min: number; max: number }> = {

  depart: { min: 80, max: 150 },

  camp: { min: 100, max: 180 },

  arrive: { min: 300, max: 500 },

  move: { min: 120, max: 250 },

};



/** What the DM is asked to write for this beat. It replaces the length setting for that one reply. */

export function travelBeatFormat(b: TravelBeat, riderName: string): string {

  const rider = riderName.trim() || 'The rider';

  const w = TRAVEL_BEAT_WORDS[b.kind];

  const length = `${w.min} to ${w.max} words. This length outranks any other length setting.`;

  const company = b.companion

    ? `${b.companion} travels with ${rider}: keep them in the scene and list them in your STAGE direction.`

    : '';

  const noButton = 'Do not offer a travel button in this post.';

  const clock = 'The app has already counted the travel time: write no TIME tag in this post.';

  if (b.kind === 'depart') {

    return [

      '\n\n## RESPONSE FORMAT (TRAVEL: SETTING OUT)',

      `The app has just started ${rider}'s journey to ${b.place}: the map shows them on the way now, and the trip plays out in real time. Write a short send-off: ${length}`,

      'Show the leaving, the first stretch of road or sky, and the mood. Stop there. Do NOT narrate the middle of the journey, an encounter, a night stop or the arrival: the app tells you when each of those happens, and you write it then.',

      company, noButton, clock,

    ].filter(Boolean).join('\n');

  }

  if (b.kind === 'camp') {

    return [

      '\n\n## RESPONSE FORMAT (TRAVEL: NIGHT STOP)',

      `The app has just stopped ${rider} for the night: the travel day is over and they are still on the road to ${b.place}. They have NOT arrived. Write a short camp scene: ${length}`,

      `Show where they stop, the making of camp, and the night settling in. Keep it quiet: start no trouble that would need resolving (the app runs road encounters itself). Do not pass the night for them, do not resume the journey, and do not narrate the arrival. ${rider} continues from the Map when ready.`,

      company, noButton, clock,

    ].filter(Boolean).join('\n');

  }

  if (b.kind === 'arrive') {

    return [

      '\n\n## RESPONSE FORMAT (TRAVEL: ARRIVAL)',

      `The app has just finished ${rider}'s journey: they are now at ${b.place}. Trust this over any older line that says they are still travelling. Write the arrival scene: ${length}`,

      'Give the road behind them one line at most. Then the approach and the first sight, sound and smell of the place at this hour, who and what is here, and how the place receives them. Close on an opening that invites a reply at the Live Table. Do not move them anywhere else.',

      company, noButton, clock,

    ].filter(Boolean).join('\n');

  }

  const how = b.verb === 'enter' ? `gone into ${b.place}` : b.verb === 'leave' ? `left the area: they are now at ${b.place}` : `walked to ${b.place}`;

  return [

    '\n\n## RESPONSE FORMAT (TRAVEL: A SHORT MOVE)',

    `The app has just moved ${rider} on the map: they have ${how}. Trust this over any older line about where they stand. Write the scene of getting there: ${length}`,

    'A line for the way over, then what this spot is like right now and who is here. Close on an opening that invites a reply at the Live Table. Do not move them anywhere else.',

    company, noButton,

  ].filter(Boolean).join('\n');

}



/** Read what was saved for a campaign. Beats that only make sense in the moment (set out, a short move) are not kept across a reload. */

export function readTravelBeatStore(raw: string | null): { record: TripRecord | null; queue: TravelBeat[] } {

  const empty = { record: null, queue: [] as TravelBeat[] };

  if (!raw) return empty;

  try {

    const data = JSON.parse(raw) as { record?: unknown; queue?: unknown };

    const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 120) : undefined);

    const r = data.record as Partial<TripRecord> | null | undefined;

    const record: TripRecord | null = r && str(r.destId) && str(r.destName)

      ? {

        destId: str(r.destId)!, destName: str(r.destName)!, seenTravel: r.seenTravel === true,

        createdAt: typeof r.createdAt === 'number' && Number.isFinite(r.createdAt) ? r.createdAt : 0,

        ...(str(r.companion) ? { companion: str(r.companion) } : {}),

        ...(str(r.companionKey) ? { companionKey: str(r.companionKey) } : {}),

        ...(str(r.campKey) ? { campKey: str(r.campKey) } : {}),

      }

      : null;

    const queue: TravelBeat[] = [];

    for (const item of Array.isArray(data.queue) ? data.queue : []) {

      const b = item as Partial<TravelBeat>;

      if ((b.kind !== 'camp' && b.kind !== 'arrive') || !str(b.place)) continue;

      queue.push({ kind: b.kind, place: str(b.place)!, ...(str(b.companion) ? { companion: str(b.companion) } : {}), ...(str(b.companionKey) ? { companionKey: str(b.companionKey) } : {}) });

    }

    return { record, queue: queue.slice(-2) };

  } catch {

    return empty;

  }

}
