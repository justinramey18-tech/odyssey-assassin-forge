// Solo Empyrean: carries out a confirmed travel offer with the map's own functions.
// One case needs two steps: a place on the map above means leaving the area first, then
// starting the journey once the map has caught up with the move (its state updates on the
// next render). Nothing here decides where the rider may go: src/lib/travel-offers.ts does.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { TravelPace } from '@/lib/campaign-map';
import type { TravelTarget } from '@/lib/travel-offers';

export type TravelResult = { ok: true } | { ok: false; error: string };
type MapResult = { ok: boolean; error?: string };

/** The part of the campaign map this needs. */
export interface TravelMap {
  activeMapId: string | null;
  startJourney: (destinationLocationId: string, pace?: TravelPace) => Promise<MapResult>;
  enterChildMap: (childMapId: string) => Promise<MapResult>;
  exitToParentMap: () => Promise<MapResult>;
  moveWithinLocalMap: (locationId: string) => Promise<MapResult>;
}

/** How long to wait for the map to show the rider outside before giving up on the second step. */
export const LEAVE_WAIT_MS = 8000;
const toResult = (r: MapResult, fallback: string): TravelResult => (r.ok ? { ok: true } : { ok: false, error: r.error || fallback });

export function useSoloTravel(map: TravelMap, waitMs: number = LEAVE_WAIT_MS) {
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const mapRef = useRef(map);
  mapRef.current = map;
  const pendingRef = useRef<{ parentMapId: string; run: () => void } | null>(null);

  // The rider is now on the map above: start the journey that was waiting.
  useEffect(() => {
    const p = pendingRef.current;
    if (p && map.activeMapId === p.parentMapId) { pendingRef.current = null; p.run(); }
  }, [map.activeMapId]);

  const go = useCallback(async (target: TravelTarget, pace?: TravelPace): Promise<TravelResult> => {
    if (busyRef.current) return { ok: false, error: 'Already setting out.' };
    busyRef.current = true;
    setBusy(true);
    try {
      const m = mapRef.current;
      if (target.kind === 'move') return toResult(await m.moveWithinLocalMap(target.locationId), 'Could not move there.');
      if (target.kind === 'enter') return toResult(await m.enterChildMap(target.childMapId), 'Could not enter that area.');
      if (target.kind === 'leave') return toResult(await m.exitToParentMap(), 'Could not leave the area.');
      if (target.kind === 'journey') return toResult(await m.startJourney(target.locationId, pace), 'The journey could not start.');
      const left = await m.exitToParentMap();
      if (!left.ok) return toResult(left, 'Could not leave the area.');
      return await new Promise<TravelResult>((resolve) => {
        let done = false;
        const finish = (r: TravelResult) => { if (!done) { done = true; clearTimeout(timer); resolve(r); } };
        const timer = setTimeout(() => {
          pendingRef.current = null;
          finish({ ok: false, error: 'You left the area, but the journey did not start. Open the Map to set out.' });
        }, waitMs);
        const run = () => { void mapRef.current.startJourney(target.locationId, pace).then(r => finish(toResult(r, 'The journey could not start.'))); };
        // The map may already show the rider outside; otherwise wait for it.
        if (mapRef.current.activeMapId === target.parentMapId) run();
        else pendingRef.current = { parentMapId: target.parentMapId, run };
      });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [waitMs]);

  return { go, busy };
}