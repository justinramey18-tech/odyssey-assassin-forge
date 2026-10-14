// Campaign Map: the party's one shared world map (party_shared_state, state_type 'campaign_map').
// Only the ORIGINAL host (parties.created_by) writes it; everyone else reads the host's row.
// Travel runs on server timestamps: writes happen only on events (start, pause, resume, arrive),
// and every phone works out the moving dot locally from those anchors. No per-second writes.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  activeCalibration,
  buildDmLogisticsContext,
  effectiveRouteMiles,
  emptyCampaignMapState,
  freezeTravel,
  gameToRealMs,
  maxLegalLeg,
  pointAlong,
  replaceMapImage,
  sanitizeCampaignMapState,
  travelNow,
  validRealMinutesPerGameHour,
  withRoutePath,
  type ActiveTravel,
  type CampaignMapCalibration,
  type CampaignMapLocation,
  type CampaignMapRoute,
  type CampaignMapState,
  type MapPoint,
  type TravelPace,
} from '@/lib/campaign-map';

export const CAMPAIGN_MAP_STATE_TYPE = 'campaign_map';
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

export interface CampaignMapView {
  state: CampaignMapState;
  /** Where the party marker is right now (normalized), or null when unknown. */
  position: MapPoint | null;
  /** Live campaign minute (includes travel in progress). */
  campaignMinute: number;
  traveling: boolean;
  paused: boolean;
  /** 0..1 through the current leg. */
  legFraction: number;
  /** True when the leg has finished but the host has not saved it yet. */
  legDone: boolean;
}

type Result = { ok: true } | { ok: false; error: string };
const fail = (error: string): Result => ({ ok: false, error });
const OK: Result = { ok: true };

/** Route progress (forward terms) → progress in the travel direction, and back. */
const dirProgress = (forward: number, reversed: boolean) => (reversed ? 1 - forward : forward);

export function usePartyCampaignMap(partyId: string | null | undefined, currentUserId: string | null | undefined) {
  const [rawState, setRawState] = useState<CampaignMapState | null>(null);
  const [loading, setLoading] = useState(true);
  const [hostUserId, setHostUserId] = useState<string | null>(null);
  /** serverNow ≈ Date.now() + skew; learned from server timestamps. */
  const skewRef = useRef(0);
  const stateRef = useRef<CampaignMapState | null>(null);
  stateRef.current = rawState;
  const canWrite = !!currentUserId && !!hostUserId && currentUserId === hostUserId;
  const serverNow = useCallback(() => Date.now() + skewRef.current, []);

  // ── who is the original host ──
  useEffect(() => {
    setHostUserId(null);
    if (!partyId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from('parties').select('created_by').eq('id', partyId).maybeSingle();
      if (!cancelled) setHostUserId((data as { created_by?: string } | null)?.created_by ?? null);
    })();
    return () => { cancelled = true; };
  }, [partyId]);

  // ── read the host's row (errors keep the last known map) ──
  const fetchState = useCallback(async () => {
    if (!partyId || !hostUserId) return;
    const { data, error } = await (supabase.from('party_shared_state') as any)
      .select('state_data, updated_at')
      .eq('party_id', partyId).eq('user_id', hostUserId).eq('state_type', CAMPAIGN_MAP_STATE_TYPE)
      .maybeSingle();
    if (error) { console.warn('[campaign-map] read failed, keeping last map:', error.message); setLoading(false); return; }
    setRawState(data ? sanitizeCampaignMapState(data.state_data) : null);
    setLoading(false);
  }, [partyId, hostUserId]);

  useEffect(() => {
    setRawState(null);
    setLoading(true);
    if (!partyId || !hostUserId) return;
    void fetchState();
    const channel = supabase
      .channel(`campaign-map:${partyId}:${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'party_shared_state', filter: `party_id=eq.${partyId}` }, (payload: any) => {
        const row = (payload.eventType === 'DELETE' ? payload.old : payload.new) as { user_id?: string; state_type?: string; state_data?: unknown };
        if (row?.state_type !== CAMPAIGN_MAP_STATE_TYPE || row.user_id !== hostUserId) return; // only the host's row counts
        const commit = Date.parse(payload.commit_timestamp || '');
        if (Number.isFinite(commit)) skewRef.current = commit - Date.now();
        if (payload.eventType === 'DELETE') setRawState(null);
        else setRawState(sanitizeCampaignMapState(row.state_data));
      })
      .subscribe((status) => { if (status === 'SUBSCRIBED') void fetchState(); });
    const onVisible = () => { if (document.visibilityState === 'visible') void fetchState(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      supabase.removeChannel(channel);
    };
  }, [partyId, hostUserId, fetchState]);

  // ── host writes: one upsert, returns the server's updated_at ──
  const write = useCallback(async (next: CampaignMapState): Promise<{ ok: boolean; updatedAt: number; error: string }> => {
    if (!partyId || !currentUserId || !canWrite) return { ok: false, updatedAt: 0, error: "Only the party host can change the campaign map." };
    const { data, error } = await (supabase.from('party_shared_state') as any)
      .upsert({ party_id: partyId, user_id: currentUserId, state_type: CAMPAIGN_MAP_STATE_TYPE, state_data: next }, { onConflict: 'party_id,user_id,state_type' })
      .select('updated_at').single();
    if (error) return { ok: false, updatedAt: 0, error: error.message || "The map could not be saved." };
    const updatedAt = Date.parse((data as { updated_at?: string })?.updated_at || '');
    if (Number.isFinite(updatedAt)) skewRef.current = updatedAt - Date.now();
    setRawState(next);
    return { ok: true, updatedAt: Number.isFinite(updatedAt) ? updatedAt : serverNow(), error: "" };
  }, [partyId, currentUserId, canWrite, serverNow]);

  /** A leg that is finished (by server time) folded into the saved state. */
  const settleTravel = useCallback((s: CampaignMapState, now: number): CampaignMapState => {
    const t = s.activeTravel;
    if (!t) return s;
    const live = travelNow(t, now);
    if (!live.done) return s;
    const route = s.routes.find(r => r.id === t.routeId);
    const next: CampaignMapState = { ...s, campaignMinute: t.startCampaignMinute + t.gameMinutes };
    delete next.activeTravel;
    if (!route) return next;
    if (t.endProgress >= 1) {
      next.currentLocationId = t.reversed ? route.fromLocationId : route.toLocationId;
      delete next.currentRoutePosition;
    } else {
      next.currentLocationId = null;
      next.currentRoutePosition = { routeId: route.id, progress: dirProgress(t.endProgress, t.reversed), dayComplete: true };
    }
    return next;
  }, []);

  /** Every host change runs on a settled state, so a finished leg is never lost. */
  const mutate = useCallback(async (fn: (s: CampaignMapState) => CampaignMapState | string): Promise<Result> => {
    const base = settleTravel(stateRef.current ?? emptyCampaignMapState(), serverNow());
    const next = fn(base);
    if (typeof next === 'string') return fail(next);
    const res = await write(sanitizeCampaignMapState(next));
    return res.ok ? OK : fail(res.error);
  }, [settleTravel, serverNow, write]);

  const reconcileTravelIfComplete = useCallback(async (): Promise<boolean> => {
    const s = stateRef.current;
    if (!canWrite || !s?.activeTravel) return false;
    const settled = settleTravel(s, serverNow());
    if (settled === s) return false;
    return (await write(settled)).ok;
  }, [canWrite, settleTravel, serverNow, write]);

  // The host saves a finished leg on load / reconnect.
  useEffect(() => { if (canWrite && rawState?.activeTravel) void reconcileTravelIfComplete(); }, [canWrite, rawState, reconcileTravelIfComplete]);

  // ── view (derived locally, never written) ──
  const getViewState = useCallback((now: number = serverNow()): CampaignMapView | null => {
    const s = rawState;
    if (!s) return null;
    const byId = new Map(s.locations.map(l => [l.id, l]));
    const pinned = (id: string | null | undefined): MapPoint | null => {
      const l = id ? byId.get(id) : undefined;
      return l && l.x !== null && l.y !== null ? { x: l.x, y: l.y } : null;
    };
    const routePoint = (route: CampaignMapRoute | undefined, forward: number): MapPoint | null => {
      if (!route) return null;
      const a = pinned(route.fromLocationId), b = pinned(route.toLocationId);
      const path = route.path.length >= 2 ? route.path : a && b ? [a, b] : [];
      return pointAlong(path, forward);
    };
    const t = s.activeTravel;
    if (t) {
      const live = travelNow(t, now);
      const route = s.routes.find(r => r.id === t.routeId);
      return {
        state: s, position: routePoint(route, dirProgress(live.progress, t.reversed)), campaignMinute: live.campaignMinute,
        traveling: !live.done && t.startedAt !== null, paused: t.startedAt === null, legFraction: live.fraction, legDone: live.done,
      };
    }
    const pos = s.currentRoutePosition;
    const position = pos ? routePoint(s.routes.find(r => r.id === pos.routeId), pos.progress) : pinned(s.currentLocationId);
    return { state: s, position, campaignMinute: s.campaignMinute, traveling: false, paused: false, legFraction: 0, legDone: false };
  }, [rawState, serverNow]);

  // ── setup ──
  const initialize = useCallback(() => mutate(() => emptyCampaignMapState()), [mutate]);
  const reset = initialize;

  /** Upload an image only (no map change). Used by Map Pack install before replacing state. */
  const uploadImageFile = useCallback(async (file: Blob, type: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> => {
    if (!canWrite || !partyId || !currentUserId) return { ok: false, error: 'Only the party host can change the map.' };
    if (!IMAGE_TYPES.includes(type)) return { ok: false, error: 'Use a PNG, JPG, WebP or GIF image.' };
    if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: 'That image is too big (15 MB at most).' };
    const ext = (type.split('/')[1] || 'png').replace('jpeg', 'jpg');
    const path = `${currentUserId}/${partyId}/campaign-map/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('party-chat-images').upload(path, file, { contentType: type });
    if (error) return { ok: false, error: error.message || 'Upload failed.' };
    return { ok: true, url: supabase.storage.from('party-chat-images').getPublicUrl(path).data.publicUrl };
  }, [canWrite, partyId, currentUserId]);

  const uploadMapImage = useCallback(async (file: File): Promise<Result> => {
    if (!canWrite || !partyId || !currentUserId) return fail('Only the party host can change the map.');
    if (!IMAGE_TYPES.includes(file.type)) return fail('Use a PNG, JPG, WebP or GIF image.');
    if (file.size > MAX_IMAGE_BYTES) return fail('That image is too big (15 MB at most).');
    const size = await new Promise<{ w: number; h: number } | null>((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { resolve({ w: img.naturalWidth, h: img.naturalHeight }); URL.revokeObjectURL(url); };
      img.onerror = () => { resolve(null); URL.revokeObjectURL(url); };
      img.src = url;
    });
    if (!size) return fail('That file could not be read as an image.');
    const ext = (file.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
    const path = `${currentUserId}/${partyId}/campaign-map/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('party-chat-images').upload(path, file, { contentType: file.type });
    if (error) return fail(error.message || 'Upload failed.');
    const publicUrl = supabase.storage.from('party-chat-images').getPublicUrl(path).data.publicUrl;
    return mutate(s => replaceMapImage(s, publicUrl, size.w, size.h));
  }, [canWrite, partyId, currentUserId, mutate]);

  const replaceLocationsAndRoutes = useCallback((locations: CampaignMapLocation[], routes: CampaignMapRoute[]) =>
    mutate(s => ({ ...s, locations, routes })), [mutate]);

  const addLocation = useCallback((loc: CampaignMapLocation) =>
    mutate(s => (s.locations.some(l => l.id === loc.id) ? 'A place with that id already exists.' : { ...s, locations: [...s.locations, loc] })), [mutate]);
  const editLocation = useCallback((id: string, patch: Partial<Omit<CampaignMapLocation, 'id'>>) =>
    mutate(s => (s.locations.some(l => l.id === id) ? { ...s, locations: s.locations.map(l => (l.id === id ? { ...l, ...patch } : l)) } : 'That place no longer exists.')), [mutate]);
  const removeLocation = useCallback((id: string) => mutate(s => {
    if (s.activeTravel && s.routes.some(r => r.id === s.activeTravel!.routeId && (r.fromLocationId === id || r.toLocationId === id))) return 'The party is traveling on a road to that place. Stop the travel first.';
    return { ...s, locations: s.locations.filter(l => l.id !== id), routes: s.routes.filter(r => r.fromLocationId !== id && r.toLocationId !== id), currentLocationId: s.currentLocationId === id ? null : s.currentLocationId };
  }), [mutate]);

  const addRoute = useCallback((route: CampaignMapRoute) =>
    mutate(s => (s.routes.some(r => r.id === route.id) ? 'A road with that id already exists.' : { ...s, routes: [...s.routes, route] })), [mutate]);
  const editRoute = useCallback((id: string, patch: Partial<Omit<CampaignMapRoute, 'id'>>) =>
    mutate(s => {
      if (s.activeTravel?.routeId === id) return 'The party is on this road. Stop the travel before changing it.';
      return s.routes.some(r => r.id === id) ? { ...s, routes: s.routes.map(r => (r.id === id ? { ...r, ...patch } : r)) } : 'That road no longer exists.';
    }), [mutate]);
  const removeRoute = useCallback((id: string) => mutate(s => {
    if (s.activeTravel?.routeId === id || s.currentRoutePosition?.routeId === id) return 'The party is on this road. Move them off it first.';
    return { ...s, routes: s.routes.filter(r => r.id !== id) };
  }), [mutate]);

  const setDiscovered = useCallback((id: string, discovered: boolean) =>
    mutate(s => ({ ...s, locations: s.locations.map(l => (l.id === id ? { ...l, discovered } : l)) })), [mutate]);
  const setCampaignClock = useCallback((minute: number) =>
    mutate(s => (Number.isFinite(minute) && minute >= 0 ? (s.activeTravel ? 'Stop the travel before changing the clock.' : { ...s, campaignMinute: Math.floor(minute) }) : 'That time is not valid.')), [mutate]);
  const setTimeCompression = useCallback((realMinutesPerGameHour: number) =>
    mutate(s => {
      const v = validRealMinutesPerGameHour(realMinutesPerGameHour);
      if (v === null) return 'Pick between 0.25 and 240 real minutes per in-world hour.';
      if (s.activeTravel?.startedAt != null) return 'Pause the travel before changing how fast time runs.';
      return { ...s, realMinutesPerGameHour: v };
    }), [mutate]);
  const setCalibration = useCallback((calibration: CampaignMapCalibration | null) => mutate(s => {
    const next: CampaignMapState = { ...s };
    if (calibration) next.mapCalibration = calibration; else delete next.mapCalibration;
    // Map-estimated roads pick up the new scale; manual roads keep the host's number.
    next.routes = s.routes.map(r => withRoutePath(r, r.path, calibration));
    return next;
  }), [mutate]);
  /** Place the party at a location (setup only, not while traveling). */
  const setCurrentLocation = useCallback((id: string | null) => mutate(s => {
    if (s.activeTravel) return 'Stop the travel before moving the party.';
    if (id && !s.locations.some(l => l.id === id)) return 'That place no longer exists.';
    const next: CampaignMapState = { ...s, currentLocationId: id };
    delete next.currentRoutePosition;
    return next;
  }), [mutate]);
  const setDefaultPace = useCallback((pace: TravelPace) => mutate(s => ({ ...s, defaultPace: pace })), [mutate]);

  // ── travel ──
  const startTravel = useCallback(async (routeId: string, toLocationId: string, pace?: TravelPace): Promise<Result> => {
    if (!canWrite) return fail('Only the party host can start travel.');
    const base = settleTravel(stateRef.current ?? emptyCampaignMapState(), serverNow());
    if (base.activeTravel) return fail('The party is already traveling.');
    const route = base.routes.find(r => r.id === routeId);
    if (!route) return fail('That road no longer exists.');
    if (route.fromLocationId !== toLocationId && route.toLocationId !== toLocationId) return fail("That road doesn't lead there.");
    const reversed = route.fromLocationId === toLocationId;
    let startForward: number;
    if (base.currentRoutePosition) {
      if (base.currentRoutePosition.routeId !== routeId) return fail("The party is on a different road and can't jump to this one.");
      startForward = base.currentRoutePosition.progress;
    } else {
      const from = reversed ? route.toLocationId : route.fromLocationId;
      if (base.currentLocationId !== from) return fail("The party isn't at the start of that road.");
      startForward = reversed ? 1 : 0;
    }
    const miles = effectiveRouteMiles(route, activeCalibration(base));
    if (miles === null) return fail('This road has no distance yet. Set its miles (or calibrate the map) first.');
    const usePace = pace ?? base.defaultPace;
    const startProgress = dirProgress(startForward, reversed);
    const leg = maxLegalLeg(miles, startProgress, usePace, route.terrainFactor, 0);
    if (leg.gameMinutes <= 0) return fail('The party is already there.');
    const travel: ActiveTravel = {
      routeId, reversed, pace: usePace, startProgress, endProgress: leg.endProgress,
      startedAt: null, pausedFraction: 0,
      realDurationMs: gameToRealMs(leg.gameMinutes, base.realMinutesPerGameHour),
      gameMinutes: leg.gameMinutes, startCampaignMinute: base.campaignMinute,
    };
    const staged: CampaignMapState = { ...base, activeTravel: travel, currentLocationId: null };
    delete staged.currentRoutePosition;
    // 1) write to get the server's clock, 2) anchor the leg to it.
    const first = await write(staged);
    if (!first.ok) return fail(first.error);
    const anchored = await write({ ...staged, activeTravel: { ...travel, startedAt: first.updatedAt } });
    return anchored.ok ? OK : fail(anchored.error);
  }, [canWrite, settleTravel, serverNow, write]);

  const pauseTravel = useCallback(async (): Promise<Result> => {
    const s = stateRef.current;
    if (!canWrite) return fail('Only the party host can pause travel.');
    if (!s?.activeTravel || s.activeTravel.startedAt === null) return fail('The party is not traveling.');
    const touch = await write(s); // server time for the exact elapsed
    if (!touch.ok) return fail(touch.error);
    const settled = settleTravel(s, touch.updatedAt);
    if (!settled.activeTravel) return (await write(settled)).ok ? OK : fail('The map could not be saved.');
    const frozen = freezeTravel(s.activeTravel, touch.updatedAt);
    const live = travelNow(frozen, touch.updatedAt);
    const next: CampaignMapState = { ...s, activeTravel: frozen, currentRoutePosition: { routeId: frozen.routeId, progress: dirProgress(live.progress, frozen.reversed) } };
    const res = await write(next);
    return res.ok ? OK : fail(res.error);
  }, [canWrite, settleTravel, write]);

  const resumeTravel = useCallback(async (): Promise<Result> => {
    const s = stateRef.current;
    if (!canWrite) return fail('Only the party host can resume travel.');
    if (!s?.activeTravel || s.activeTravel.startedAt !== null) return fail('Travel is not paused.');
    const staged: CampaignMapState = { ...s };
    delete staged.currentRoutePosition;
    const first = await write(staged);
    if (!first.ok) return fail(first.error);
    const res = await write({ ...staged, activeTravel: { ...s.activeTravel, startedAt: first.updatedAt } });
    return res.ok ? OK : fail(res.error);
  }, [canWrite, write]);

  /** Stop here: the party stays at its current point on the road, and the clock keeps the time spent. */
  const cancelTravel = useCallback(async (): Promise<Result> => {
    const s = stateRef.current;
    if (!canWrite) return fail('Only the party host can stop travel.');
    if (!s?.activeTravel) return fail('The party is not traveling.');
    const touch = await write(s);
    if (!touch.ok) return fail(touch.error);
    const settled = settleTravel(s, touch.updatedAt);
    if (!settled.activeTravel) return (await write(settled)).ok ? OK : fail('The map could not be saved.');
    const t = s.activeTravel;
    const live = travelNow(t, touch.updatedAt);
    const next: CampaignMapState = { ...s, campaignMinute: live.campaignMinute, currentRoutePosition: { routeId: t.routeId, progress: dirProgress(live.progress, t.reversed) } };
    delete next.activeTravel;
    const res = await write(next);
    return res.ok ? OK : fail(res.error);
  }, [canWrite, settleTravel, write]);

  /** Host override: the leg ends now and the full remaining in-world time passes. */
  const finishTravelNow = useCallback(async (): Promise<Result> => {
    const s = stateRef.current;
    if (!canWrite) return fail('Only the party host can finish travel.');
    if (!s?.activeTravel) return fail('The party is not traveling.');
    const done = settleTravel({ ...s, activeTravel: { ...s.activeTravel, startedAt: null, pausedFraction: 1 } }, serverNow());
    const res = await write(done);
    return res.ok ? OK : fail(res.error);
  }, [canWrite, settleTravel, serverNow, write]);

  // ── campaign saves ──
  /** A save-safe copy: travel in progress is frozen at this moment. */
  const exportSaveSnapshot = useCallback((): CampaignMapState | null => {
    const s = rawState;
    if (!s) return null;
    const settled = settleTravel(s, serverNow());
    return settled.activeTravel && settled.activeTravel.startedAt !== null
      ? { ...settled, activeTravel: freezeTravel(settled.activeTravel, serverNow()) }
      : settled;
  }, [rawState, settleTravel, serverNow]);

  /** Load a saved map. Travel comes back paused; the host resumes it. */
  const restoreSaveSnapshot = useCallback((snapshot: unknown) => {
    const s = sanitizeCampaignMapState(snapshot);
    if (s.activeTravel && s.activeTravel.startedAt !== null) s.activeTravel = { ...s.activeTravel, startedAt: null, pausedFraction: s.activeTravel.pausedFraction ?? 0 };
    return write(s).then(r => (r.ok ? OK : fail(r.error)));
  }, [write]);

  const clearCampaignMap = useCallback(async (): Promise<Result> => {
    if (!partyId || !currentUserId || !canWrite) return fail('Only the party host can clear the map.');
    const { error } = await (supabase.from('party_shared_state') as any)
      .delete().eq('party_id', partyId).eq('user_id', currentUserId).eq('state_type', CAMPAIGN_MAP_STATE_TYPE);
    if (error) return fail(error.message || 'The map could not be cleared.');
    setRawState(null);
    return OK;
  }, [partyId, currentUserId, canWrite]);

  /** Reads the latest map at call time, so a moving dot is current even without a re-render. */
  const getPromptContext = useCallback((): string => { const st = stateRef.current; return st && (st.imageUrl || st.locations.length) ? buildDmLogisticsContext(st, serverNow()) : ''; }, [serverNow]);

  return useMemo(() => ({
    rawState, loading, hostUserId, canWrite, getViewState, uploadImageFile,
    initialize, reset, uploadMapImage, replaceMapImage: uploadMapImage, replaceLocationsAndRoutes,
    addLocation, editLocation, removeLocation, addRoute, editRoute, removeRoute,
    setDiscovered, setCampaignClock, setTimeCompression, setDefaultPace, setCalibration, setCurrentLocation,
    startTravel, pauseTravel, resumeTravel, cancelTravel, finishTravelNow, reconcileTravelIfComplete,
    exportSaveSnapshot, restoreSaveSnapshot, clearCampaignMap, getPromptContext,
  }), [rawState, loading, hostUserId, canWrite, getViewState, uploadImageFile, initialize, reset, uploadMapImage, replaceLocationsAndRoutes,
    addLocation, editLocation, removeLocation, addRoute, editRoute, removeRoute, setDiscovered, setCampaignClock,
    setTimeCompression, setDefaultPace, setCalibration, setCurrentLocation, startTravel, pauseTravel, resumeTravel, cancelTravel, finishTravelNow,
    reconcileTravelIfComplete, exportSaveSnapshot, restoreSaveSnapshot, clearCampaignMap, getPromptContext]);
}

export type PartyCampaignMapApi = ReturnType<typeof usePartyCampaignMap>;
