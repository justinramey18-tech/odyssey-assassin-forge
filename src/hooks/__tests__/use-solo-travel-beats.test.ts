import { beforeEach, describe, expect, it, vi } from 'vitest';

import { act, renderHook, waitFor } from '@testing-library/react';

import { useSoloTravelBeats } from '@/hooks/use-solo-travel-beats';

import type { TravelBeat } from '@/lib/travel-beats';

import { buildEmpyreanStarterAtlas } from '@/lib/empyreanCanon/continentMap';

import { exitToParent, projectActive } from '@/lib/campaign-atlas';

import { buildJourneyTranche, planJourneyRoute, settleTravelState, trancheToTravel, type CampaignMapState } from '@/lib/campaign-map';



const T0 = 1_700_000_000_000;

const KEY = 'solo-travel-beats:camp-1';



function continent(): CampaignMapState {

  const out = exitToParent(buildEmpyreanStarterAtlas('camp-1').atlas);

  if (typeof out === 'string') throw new Error(out);

  return projectActive(out);

}

const idOf = (s: CampaignMapState, name: string) => s.locations.find(l => l.name === name)!.id;

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

const settle = (ms = 40) => new Promise(r => setTimeout(r, ms));



/** A story screen stand-in: a map, a clock, and a DM that answers (or not). */

function setup(over: { state?: CampaignMapState; idle?: boolean; ready?: boolean; replies?: boolean; storageKey?: string | null } = {}) {

  const world = { state: over.state ?? continent(), now: T0 };

  const sent: Array<{ line: string; format: string; beat: TravelBeat }> = [];

  const failed: string[] = [];

  const done: TravelBeat[] = [];

  const prepared = { count: 0 };

  const send = vi.fn(async (line: string, format: string, beat: TravelBeat) => { sent.push({ line, format, beat }); await settle(5); return over.replies ?? true; });

  const hook = renderHook((p: { idle: boolean; ready: boolean; tick: number }) => useSoloTravelBeats({

    storageKey: over.storageKey === undefined ? KEY : over.storageKey,

    mapState: world.state, getState: () => world.state, now: () => world.now,

    ready: p.ready, idle: p.idle, riderName: 'Xeyle', send,

    onPrepare: () => { prepared.count += 1; },

    onFailed: (line) => { failed.push(line); },

    onSent: (beat) => { done.push(beat); },

    watchMs: 10, settleMs: 5,

  }), { initialProps: { idle: over.idle ?? true, ready: over.ready ?? true, tick: 0 } });

  let tick = 0;

  const redraw = (p: { idle?: boolean; ready?: boolean } = {}) => { tick += 1; hook.rerender({ idle: p.idle ?? over.idle ?? true, ready: p.ready ?? over.ready ?? true, tick }); };

  return { ...hook, world, sent, failed, done, prepared, send, redraw };

}



describe('useSoloTravelBeats', () => {

  beforeEach(() => { localStorage.clear(); });



  it('a journey: the DM hears the setting out, nothing on the road, then the arrival once', async () => {

    const h = setup();

    const base = h.world.state;

    const target = { kind: 'journey' as const, locationId: idOf(base, 'Chantara'), name: 'Chantara' };

    const xaden = { key: 'xaden-riorson', name: 'Xaden Riorson' };

    act(() => h.result.current.begin(target, xaden));

    h.world.state = launch(base, target.locationId, T0);

    act(() => { h.redraw(); h.result.current.started(target, xaden); });

    await waitFor(() => expect(h.sent.length).toBe(1));

    expect(h.sent[0].line).toBe('I set out for Chantara with Xaden Riorson.');

    expect(h.sent[0].format).toContain('TRAVEL: SETTING OUT');

    expect(h.prepared.count).toBeGreaterThan(0);

    await waitFor(() => expect(h.done.length).toBe(1));



    h.world.now = T0 + 60_000;

    await act(async () => { await settle(); });

    expect(h.sent.length).toBe(1);



    // The clock passes the end of the trip; the saved map has not changed.

    h.world.now = T0 + h.world.state.activeTravel!.realDurationMs + 1000;

    await waitFor(() => expect(h.sent.length).toBe(2));

    expect(h.sent[1].line).toBe('I arrive at Chantara with Xaden Riorson.');

    expect(h.sent[1].format).toContain('they are now at Chantara');

    await act(async () => { await settle(60); });

    expect(h.sent.length).toBe(2);

    expect(localStorage.getItem(KEY)).toBeNull();

  });



  it('waits while the story is busy, then sends', async () => {

    const h = setup({ idle: false });

    const target = { kind: 'move' as const, locationId: 'mat', name: 'The Sparring Mat' };

    act(() => h.result.current.started(target));

    await act(async () => { await settle(); });

    expect(h.sent.length).toBe(0);

    act(() => h.redraw({ idle: true }));

    await waitFor(() => expect(h.sent.length).toBe(1));

    expect(h.sent[0].line).toBe('I head to The Sparring Mat.');

    expect(h.sent[0].beat).toEqual({ kind: 'move', place: 'The Sparring Mat', verb: 'move' });

  });



  it('entering and leaving an area are short moves too, and remember no trip', async () => {

    const h = setup();

    act(() => { h.result.current.begin({ kind: 'enter', childMapId: 'c', name: 'Basgiath War College' }); h.result.current.started({ kind: 'enter', childMapId: 'c', name: 'Basgiath War College' }); });

    await waitFor(() => expect(h.sent.length).toBe(1));

    expect(h.sent[0].line).toBe('I go into Basgiath War College.');

    act(() => h.result.current.started({ kind: 'leave', parentMapId: 'root', name: 'The Continent' }));

    await waitFor(() => expect(h.sent.length).toBe(2));

    expect(h.sent[1].line).toBe('I leave for The Continent.');

    expect(localStorage.getItem(KEY)).toBeNull();

  });



  it('when the DM does not answer, the rider gets the line back and it is not sent again', async () => {

    const h = setup({ replies: false });

    act(() => h.result.current.started({ kind: 'move', locationId: 'mat', name: 'The Sparring Mat' }));

    await waitFor(() => expect(h.failed).toEqual(['I head to The Sparring Mat.']));

    await act(async () => { await settle(60); });

    expect(h.sent.length).toBe(1);

    expect(h.done.length).toBe(0);

  });



  it('a trip that could not start is forgotten', async () => {

    const h = setup();

    const base = h.world.state;

    act(() => h.result.current.begin({ kind: 'journey', locationId: idOf(base, 'Chantara'), name: 'Chantara' }));

    expect(localStorage.getItem(KEY)).toContain('Chantara');

    act(() => h.result.current.abandon());

    expect(localStorage.getItem(KEY)).toBeNull();

    await act(async () => { await settle(); });

    expect(h.sent.length).toBe(0);

  });



  it('the app was closed for the trip: the arrival is told when the story is open again, once', async () => {

    const first = setup({ ready: false });

    const base = first.world.state;

    const target = { kind: 'leave-journey' as const, parentMapId: 'root', locationId: idOf(base, 'Chantara'), name: 'Chantara' };

    act(() => first.result.current.begin(target));

    const going = launch(base, target.locationId, T0);

    first.world.state = going;

    act(() => first.redraw({ ready: false }));

    await act(async () => { await settle(); });

    first.unmount();

    expect(first.sent.length).toBe(0);



    const later = setup({ state: going, ready: false });

    later.world.now = T0 + 6 * 3_600_000;

    await act(async () => { await settle(); });

    expect(later.sent.length).toBe(0); // the story is not on screen yet

    act(() => later.redraw({ ready: true }));

    await waitFor(() => expect(later.sent.length).toBe(1));

    expect(later.sent[0].line).toBe('I arrive at Chantara.');

    later.unmount();



    const again = setup({ state: settleTravelState(going, later.world.now) });

    await act(async () => { await settle(60); });

    expect(again.sent.length).toBe(0);

  });



  it('a long trip: a camp scene each night, the arrival at the end', async () => {

    const h = setup();

    const base = h.world.state;

    const target = { kind: 'journey' as const, locationId: idOf(base, 'Samara'), name: 'Samara' };

    act(() => h.result.current.begin(target));

    h.world.state = launch(base, target.locationId, T0);

    act(() => { h.redraw(); h.result.current.started(target); });

    await waitFor(() => expect(h.sent.length).toBe(1));

    const end1 = T0 + h.world.state.activeTravel!.realDurationMs + 1000;

    h.world.now = end1;

    await waitFor(() => expect(h.sent.length).toBe(2));

    expect(h.sent[1].line).toBe('I stop for the night on the road to Samara.');

    await act(async () => { await settle(60); });

    expect(h.sent.length).toBe(2);

    // The rider continues from the Map.

    h.world.state = launch(settleTravelState(h.world.state, end1), null, end1);

    act(() => h.redraw());

    h.world.now = end1 + h.world.state.activeTravel!.realDurationMs + 1000;

    await waitFor(() => expect(h.sent.length).toBe(3));

    expect(h.sent[2].line).toBe('I arrive at Samara.');

  });



  it('the rider stops the trip on the Map: no scene', async () => {

    const h = setup({ idle: false });

    const base = h.world.state;

    const target = { kind: 'journey' as const, locationId: idOf(base, 'Chantara'), name: 'Chantara' };

    act(() => h.result.current.begin(target));

    h.world.state = launch(base, target.locationId, T0);

    act(() => h.redraw({ idle: false }));

    await act(async () => { await settle(); });

    const stopped: CampaignMapState = { ...base, currentLocationId: null, currentRoutePosition: { routeId: base.routes[0].id, progress: 0.3 } };

    h.world.state = stopped;

    act(() => h.redraw({ idle: true }));

    await act(async () => { await settle(60); });

    expect(h.sent.length).toBe(0);

    expect(localStorage.getItem(KEY)).toBeNull();

  });



  it('does nothing without a campaign', async () => {

    const h = setup({ storageKey: null });

    act(() => h.result.current.started({ kind: 'move', locationId: 'mat', name: 'The Sparring Mat' }));

    await act(async () => { await settle(); });

    expect(h.sent.length).toBe(0);

  });

});
