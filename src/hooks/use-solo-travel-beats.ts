// Solo Empyrean: tells the DM about the turning points of a trip, so the story carries on by itself.

// A travel button starts a trip; this hook remembers it, watches the map, and sends one message

// to the DM when the rider sets out, stops for the night, arrives, or makes a short move. Each beat

// is sent once, only when the story is idle, and survives a reload (an arrival that happened with

// the app closed is told when the story is next open). The rules live in src/lib/travel-beats.ts.

import { useCallback, useEffect, useRef, useState } from 'react';

import type { CampaignMapState } from '@/lib/campaign-map';

import type { TravelTarget } from '@/lib/travel-offers';

import { getScopedItem, removeScopedItem, setScopedItem } from '@/lib/scoped-storage';

import {

  nextTripStep, queueBeat, readTravelBeatStore, travelBeatFormat, travelBeatLine, tripPhase,

  type TravelBeat, type TripRecord,

} from '@/lib/travel-beats';



/** How often the map is re-read while a trip is remembered (a trip ends by the clock, not by an event). */

export const TRIP_WATCH_MS = 5000;

/** The pause between choosing a beat and sending it, so the DM's facts are rebuilt for the new place first. */

export const BEAT_SETTLE_MS = 600;



export interface TravelCompanion { key: string; name: string }



export interface SoloTravelBeatsOptions {

  /** Where the trip and any waiting beat are kept for this campaign; null turns the hook off. */

  storageKey: string | null;

  /** The map as saved (a change re-reads the trip at once). */

  mapState: CampaignMapState | null;

  /** The map as it stands at this moment. */

  getState: () => CampaignMapState | null;

  now: () => number;

  /** The story is on screen and loaded. */

  ready: boolean;

  /** Nothing else is being written or decided (no DM reply, no NPC answer, no fight, no trip being started). */

  idle: boolean;

  riderName: string;

  /** Send the rider's line to the DM with the one-off writing instruction. True when the DM replied. */

  send: (line: string, format: string, beat: TravelBeat) => Promise<boolean>;

  /** A beat is about to be sent: rebuild what the DM is told about the map. */

  onPrepare?: () => void;

  /** The DM did not answer: hand the rider their line to send themselves. */

  onFailed?: (line: string, beat: TravelBeat) => void;

  onSent?: (beat: TravelBeat) => void;

  watchMs?: number;

  settleMs?: number;

}



const isJourney = (t: TravelTarget): t is Extract<TravelTarget, { kind: 'journey' | 'leave-journey' }> => t.kind === 'journey' || t.kind === 'leave-journey';



export function useSoloTravelBeats(options: SoloTravelBeatsOptions) {

  const opts = useRef(options);

  opts.current = options;

  const { storageKey, mapState, ready, idle } = options;

  const watchMs = options.watchMs ?? TRIP_WATCH_MS;

  const settleMs = options.settleMs ?? BEAT_SETTLE_MS;



  const recordRef = useRef<TripRecord | null>(null);

  const queueRef = useRef<TravelBeat[]>([]);

  const sendingRef = useRef(false);

  const keyRef = useRef<string | null>(null);

  // Bumped whenever the trip or the waiting list changes, so the effects below look again.

  const [rev, setRev] = useState(0);

  const [watching, setWatching] = useState(false);



  const save = useCallback(() => {

    const key = keyRef.current;

    if (key) {

      try {

        if (!recordRef.current && !queueRef.current.length) removeScopedItem(key);

        else setScopedItem(key, JSON.stringify({ record: recordRef.current, queue: queueRef.current }));

      } catch { /* best effort */ }

    }

    setWatching(!!recordRef.current);

    setRev(n => n + 1);

  }, []);



  // Load what was kept for this campaign (and forget the last campaign's trip in memory).

  useEffect(() => {

    keyRef.current = storageKey;

    let raw: string | null = null;

    try { raw = storageKey ? getScopedItem(storageKey) : null; } catch { raw = null; }

    const kept = readTravelBeatStore(raw);

    recordRef.current = kept.record;

    queueRef.current = kept.queue;

    setWatching(!!kept.record);

    setRev(n => n + 1);

  }, [storageKey]);



  /** Read the map against the remembered trip; queue a beat when the trip reached a turning point. */

  const check = useCallback(() => {

    const record = recordRef.current;

    if (!record) return;

    const o = opts.current;

    const at = o.now();

    const step = nextTripStep(record, tripPhase(o.getState(), at), at);

    if (step.record === record && !step.beat) return;

    recordRef.current = step.record;

    if (step.beat) queueRef.current = queueBeat(queueRef.current, step.beat);

    save();

  }, [save]);



  useEffect(() => { check(); }, [check, mapState, rev]);

  useEffect(() => {

    if (!watching) return;

    const timer = setInterval(check, watchMs);

    return () => clearInterval(timer);

  }, [watching, check, watchMs]);



  // Send the next waiting beat when the story is idle. It leaves the saved list before it is sent, so a

  // crash can never send it twice.

  useEffect(() => {

    if (!ready || !idle || sendingRef.current || !queueRef.current.length) return;

    opts.current.onPrepare?.();

    const timer = setTimeout(() => {

      const o = opts.current;

      if (!o.ready || !o.idle || sendingRef.current || keyRef.current !== storageKey) return;

      const beat = queueRef.current[0];

      if (!beat) return;

      sendingRef.current = true;

      queueRef.current = queueRef.current.slice(1);

      save();

      const line = travelBeatLine(beat);

      let sent: Promise<boolean>;

      try { sent = o.send(line, travelBeatFormat(beat, o.riderName), beat); } catch { sent = Promise.resolve(false); }

      void sent.catch(() => false).then((ok) => {

        sendingRef.current = false;

        if (ok) opts.current.onSent?.(beat);

        else opts.current.onFailed?.(line, beat);

        setRev(n => n + 1);

      });

    }, settleMs);

    return () => clearTimeout(timer);

  }, [ready, idle, rev, storageKey, settleMs, save]);



  /** Call just before a travel button's trip is started: a journey is remembered from this moment. */

  const begin = useCallback((target: TravelTarget, companion?: TravelCompanion | null) => {

    if (!keyRef.current || !isJourney(target)) return;

    recordRef.current = {

      destId: target.locationId, destName: target.name, seenTravel: false, createdAt: opts.current.now(),

      ...(companion ? { companion: companion.name, companionKey: companion.key } : {}),

    };

    queueRef.current = [];

    save();

  }, [save]);



  /** The trip could not start: forget it. */

  const abandon = useCallback(() => {

    if (!recordRef.current) return;

    recordRef.current = null;

    save();

  }, [save]);



  /** The trip started (or the short move is done): the DM hears about it. */

  const started = useCallback((target: TravelTarget, companion?: TravelCompanion | null) => {

    if (!keyRef.current) return;

    const who = companion ? { companion: companion.name, companionKey: companion.key } : {};

    const beat: TravelBeat = isJourney(target)

      ? { kind: 'depart', place: target.name, ...who }

      : { kind: 'move', place: target.name, verb: target.kind === 'enter' ? 'enter' : target.kind === 'leave' ? 'leave' : 'move', ...who };

    queueRef.current = queueBeat(queueRef.current, beat);

    save();

  }, [save]);



  return { begin, abandon, started };

}
