import { describe, expect, it } from 'vitest';

import {

  nextTripStep, queueBeat, readTravelBeatStore, travelBeatFormat, travelBeatLine, tripPhase, TRIP_START_GRACE_MS,

  type TravelBeat, type TripRecord,

} from '@/lib/travel-beats';

import { buildEmpyreanStarterAtlas } from '@/lib/empyreanCanon/continentMap';

import { exitToParent, projectActive } from '@/lib/campaign-atlas';

import { buildJourneyTranche, planJourneyRoute, settleTravelState, trancheToTravel, type CampaignMapState } from '@/lib/campaign-map';



const T0 = 1_700_000_000_000;



/** The starter Continent map with the rider standing at Basgiath. */

function continent(): CampaignMapState {

  const out = exitToParent(buildEmpyreanStarterAtlas('camp-1').atlas);

  if (typeof out === 'string') throw new Error(out);

  return projectActive(out);

}

const idOf = (s: CampaignMapState, name: string) => s.locations.find(l => l.name === name)!.id;



/** Start (or continue) the journey the way the map does, with the clock started at `at`. */

function launch(base: CampaignMapState, destId: string | null, at: number): CampaignMapState {

  const plan = destId ? planJourneyRoute(base, destId) : base.journeyPlan;

  if (!plan) throw new Error('no plan');

  const tranche = buildJourneyTranche(base, plan);

  if (!tranche) throw new Error('no tranche');

  const travel = trancheToTravel(tranche, plan.pace, base.campaignMinute, base.realMinutesPerGameHour);

  const clean = { ...plan };

  delete clean.dayComplete;

  const next: CampaignMapState = { ...base, journeyPlan: clean, activeTravel: { ...travel, startedAt: at }, currentLocationId: null };

  delete next.currentRoutePosition;

  return next;

}

const record = (s: CampaignMapState, name: string, over: Partial<TripRecord> = {}): TripRecord =>

  ({ destId: idOf(s, name), destName: name, seenTravel: false, createdAt: T0, ...over });



describe('travel beats: where the trip stands', () => {

  it('a one-day trip: on the road, then at the place', () => {

    const base = continent();

    expect(tripPhase(base, T0)).toMatchObject({ phase: 'at', name: 'Basgiath War College' });

    const going = launch(base, idOf(base, 'Chantara'), T0);

    expect(tripPhase(going, T0 + 60_000)).toEqual({ phase: 'traveling' });

    const real = going.activeTravel!.realDurationMs;

    // Time alone finishes it: the saved map need not have caught up.

    expect(tripPhase(going, T0 + real + 1000)).toMatchObject({ phase: 'at', locationId: idOf(base, 'Chantara'), name: 'Chantara' });

    expect(tripPhase(null, T0)).toEqual({ phase: 'unknown' });

  });



  it('a long trip stops for the night, continues, and each night has its own key', () => {

    const base = continent();

    const day1 = launch(base, idOf(base, 'Cordyn'), T0);

    const end1 = T0 + day1.activeTravel!.realDurationMs + 1000;

    const night1 = tripPhase(day1, end1);

    expect(night1.phase).toBe('camped');

    const day2 = launch(settleTravelState(day1, end1), null, end1);

    expect(tripPhase(day2, end1 + 1000)).toEqual({ phase: 'traveling' });

    const end2 = end1 + day2.activeTravel!.realDurationMs + 1000;

    const night2 = tripPhase(day2, end2);

    expect(night2.phase).toBe('camped');

    expect((night2 as { key: string }).key).not.toBe((night1 as { key: string }).key);

  });



  it('paused on the road (a road encounter) is neither camp nor arrival', () => {

    const base = continent();

    const going = launch(base, idOf(base, 'Chantara'), T0);

    const paused: CampaignMapState = { ...going, activeTravel: { ...going.activeTravel!, startedAt: null, pausedFraction: 0.4 } };

    expect(tripPhase(paused, T0 + 10 * 60_000_000)).toEqual({ phase: 'paused' });

  });

});



describe('travel beats: what the DM is told, once', () => {

  it('nothing while the trip has not shown on the map; arrival exactly once when it ends', () => {

    const base = continent();

    const rec = record(base, 'Chantara', { companion: 'Xaden Riorson', companionKey: 'xaden-riorson' });

    // The map still shows the start (the trip is being saved).

    expect(nextTripStep(rec, tripPhase(base, T0 + 500), T0 + 500)).toEqual({ record: rec, beat: null });

    const going = launch(base, rec.destId, T0);

    const onRoad = nextTripStep(rec, tripPhase(going, T0 + 60_000), T0 + 60_000);

    expect(onRoad.beat).toBeNull();

    expect(onRoad.record?.seenTravel).toBe(true);

    const end = T0 + going.activeTravel!.realDurationMs + 1000;

    const arrived = nextTripStep(onRoad.record!, tripPhase(going, end), end);

    expect(arrived.record).toBeNull();

    expect(arrived.beat).toEqual({ kind: 'arrive', place: 'Chantara', companion: 'Xaden Riorson', companionKey: 'xaden-riorson' });

  });



  it('arrival is told even when the app was closed for the whole trip', () => {

    const base = continent();

    const rec = record(base, 'Chantara');

    const going = launch(base, rec.destId, T0);

    const muchLater = T0 + 6 * 3_600_000;

    expect(nextTripStep(rec, tripPhase(going, muchLater), muchLater).beat).toMatchObject({ kind: 'arrive', place: 'Chantara' });

  });



  it('a night stop is told once per night and the trip is still remembered', () => {

    const base = continent();

    const rec = record(base, 'Cordyn');

    const day1 = launch(base, rec.destId, T0);

    const end1 = T0 + day1.activeTravel!.realDurationMs + 1000;

    const first = nextTripStep(rec, tripPhase(day1, end1), end1);

    expect(first.beat).toEqual({ kind: 'camp', place: 'Cordyn' });

    const again = nextTripStep(first.record!, tripPhase(day1, end1 + 60_000), end1 + 60_000);

    expect(again.beat).toBeNull();

    expect(again.record).toEqual(first.record);

    const day2 = launch(settleTravelState(day1, end1), null, end1);

    const end2 = end1 + day2.activeTravel!.realDurationMs + 1000;

    expect(nextTripStep(first.record!, tripPhase(day2, end2), end2).beat?.kind).toBe('camp');

  });



  it('a trip stopped on the road ends without a scene; a trip that never started is forgotten', () => {

    const base = continent();

    const seen = record(base, 'Chantara', { seenTravel: true });

    const stopped: CampaignMapState = { ...base, currentLocationId: null, currentRoutePosition: { routeId: base.routes[0].id, progress: 0.3 } };

    expect(nextTripStep(seen, tripPhase(stopped, T0), T0)).toEqual({ record: null, beat: null });

    const never = record(base, 'Chantara');

    expect(nextTripStep(never, tripPhase(base, T0 + 1000), T0 + 1000).record).toEqual(never);

    expect(nextTripStep(never, tripPhase(base, T0 + TRIP_START_GRACE_MS + 1), T0 + TRIP_START_GRACE_MS + 1)).toEqual({ record: null, beat: null });

  });



  it('a later turning point replaces earlier ones that were never sent', () => {

    const depart: TravelBeat = { kind: 'depart', place: 'Samara' };

    const camp: TravelBeat = { kind: 'camp', place: 'Samara' };

    const arrive: TravelBeat = { kind: 'arrive', place: 'Samara' };

    expect(queueBeat([depart], camp)).toEqual([camp]);

    expect(queueBeat([depart, camp], arrive)).toEqual([arrive]);

    expect(queueBeat([], depart)).toEqual([depart]);

  });

});



describe('travel beats: the words', () => {

  it("the rider's line names the place and who came along", () => {

    expect(travelBeatLine({ kind: 'depart', place: 'Samara', companion: 'Xaden Riorson' })).toBe('I set out for Samara with Xaden Riorson.');

    expect(travelBeatLine({ kind: 'camp', place: 'Samara' })).toBe('I stop for the night on the road to Samara.');

    expect(travelBeatLine({ kind: 'arrive', place: 'Samara' })).toBe('I arrive at Samara.');

    expect(travelBeatLine({ kind: 'move', place: 'Flight Field', verb: 'move' })).toBe('I head to Flight Field.');

    expect(travelBeatLine({ kind: 'move', place: 'Basgiath War College', verb: 'enter' })).toBe('I go into Basgiath War College.');

    expect(travelBeatLine({ kind: 'move', place: 'The Continent', verb: 'leave' })).toBe('I leave for The Continent.');

  });



  it('the DM is told what happened, how long to write, and what to leave alone', () => {

    const depart = travelBeatFormat({ kind: 'depart', place: 'Samara', companion: 'Xaden Riorson' }, 'Xeyle');

    expect(depart).toContain('80 to 150 words');

    expect(depart).toContain('Do NOT narrate the middle of the journey');

    expect(depart).toContain('Xaden Riorson travels with Xeyle');

    const camp = travelBeatFormat({ kind: 'camp', place: 'Samara' }, 'Xeyle');

    expect(camp).toContain('They have NOT arrived');

    expect(camp).toContain('100 to 180 words');

    const arrive = travelBeatFormat({ kind: 'arrive', place: 'Samara' }, 'Xeyle');

    expect(arrive).toContain('they are now at Samara');

    expect(arrive).toContain('300 to 500 words');

    expect(arrive).toContain('write no TIME tag');

    const move = travelBeatFormat({ kind: 'move', place: 'Flight Field', verb: 'move' }, '');

    expect(move).toContain('The rider');

    expect(move).toContain('120 to 250 words');

    expect(move).not.toContain('TIME tag');

    for (const text of [depart, camp, arrive, move]) expect(text).toContain('Do not offer a travel button');

  });

});



describe('travel beats: what is kept across a reload', () => {

  it('keeps the trip and a waiting arrival or night stop; drops beats of the moment and junk', () => {

    const rec: TripRecord = { destId: 'loc-1', destName: 'Samara', seenTravel: true, createdAt: T0, campKey: '0:r@0.500' };

    const saved = JSON.stringify({ record: rec, queue: [{ kind: 'depart', place: 'Samara' }, { kind: 'arrive', place: 'Samara', companion: 'Xaden Riorson' }, { kind: 'move' }] });

    expect(readTravelBeatStore(saved)).toEqual({ record: rec, queue: [{ kind: 'arrive', place: 'Samara', companion: 'Xaden Riorson' }] });

    expect(readTravelBeatStore(null)).toEqual({ record: null, queue: [] });

    expect(readTravelBeatStore('not json')).toEqual({ record: null, queue: [] });

    expect(readTravelBeatStore(JSON.stringify({ record: { destName: 'Samara' } }))).toEqual({ record: null, queue: [] });

  });

});
