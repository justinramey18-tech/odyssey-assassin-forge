// Campaign Map: the party's one shared world map (party_shared_state, state_type 'campaign_map').
// Only the ORIGINAL host (parties.created_by) writes it; everyone else reads the host's row.
// Travel runs on server timestamps: writes happen only on events (start, pause, resume, arrive),
// and every phone works out the moving dot locally from those anchors. No per-second writes.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  activeCalibration,
  buildDmLogisticsContext,
  buildJourneyTranche,
  listReachableDestinations,
  finishJourneyState,
  foldTravelToPosition,
  journeyLocks,
  planJourneyRoute,
  settleTravelState,
  summarizeJourney,
  trancheToTravel,
  travelDetail,
  type JourneyPlan,
  type JourneySummary,
  effectiveRouteMiles,
  emptyCampaignMapState,
  freezeTravel,
  gameToRealMs,
  maxLegalLeg,
  pointAlong,
  replaceMapImage,
  sanitizeCampaignMapState,
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
import {
  applyArrivalEntry, installAreaPackOp, breadcrumbs, convertLegacyToAtlas, createChildMap as createChildMapOp, enterChild as enterChildOp,
  exitToParent as exitToParentOp, getNode, isAtlasEnvelope, moveLocal as moveLocalOp, parseAtlas, patchMap, projectActive,
  projectMapState, resolveAtlasAt, setNodeMeta, validateAtlasGraph, classifySnapshot, parseLegacyMap, remapAtlasIds, pauseAtlasTravel,
  type AtlasMapNode, type CampaignAtlas, type NavigationMode,
} from '@/lib/campaign-atlas';

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
  /** Road the party is on right now (segment-aware), when traveling. */
  currentRouteId?: string;
  journey?: { plan: JourneyPlan; summary: JourneySummary | null };
}

type Result = { ok: true } | { ok: false; error: string };
const fail = (error: string): Result => ({ ok: false, error });
const OK: Result = { ok: true };

/** Route progress (forward terms) → progress in the travel direction, and back. */
const dirProgress = (forward: number, reversed: boolean) => (reversed ? 1 - forward : forward);

type Stored =
  | { kind: 'legacy'; state: CampaignMapState; updatedAt: string | null }
  | { kind: 'atlas'; atlas: CampaignAtlas; updatedAt: string }
  | { kind: 'invalid'; error: string; updatedAt: string | null };

export type RestoreMode = 'campaign' | 'undo' | 'portable';

const CONFLICT_MSG = 'The map changed on another screen. It has been refreshed — please try again.';

export function usePartyCampaignMap(partyId: string | null | undefined, currentUserId: string | null | undefined) {
  const [stored, setStored] = useState<Stored | null>(null);
  const [loading, setLoading] = useState(true);
  const [hostUserId, setHostUserId] = useState<string | null>(null);
  /** serverNow ≈ Date.now() + skew; learned from server timestamps. */
  const skewRef = useRef(0);
  const storedRef = useRef<Stored | null>(null);
  storedRef.current = stored;
  // Active-map facade for existing consumers (legacy map, or the atlas's active node with the atlas clock).
  const rawState: CampaignMapState | null = useMemo(() =>
    stored?.kind === 'legacy' ? stored.state : stored?.kind === 'atlas' ? projectActive(stored.atlas) : null, [stored]);
  const stateRef = useRef<CampaignMapState | null>(null);
  stateRef.current = rawState;
  const activeMapIdRef = useRef<string | null>(null);
  activeMapIdRef.current = stored?.kind === 'atlas' ? stored.atlas.activeMapId : null;
  /** Bumps on party/account change so late async results are dropped. */
  const scopeRef = useRef(0);
  const canWrite = !!currentUserId && !!hostUserId && currentUserId === hostUserId;
  const serverNow = useCallback(() => Date.now() + skewRef.current, []);

  const applyStored = useCallback((next: Stored | null) => { storedRef.current = next; setStored(next); }, []);
  const toStored = (data: unknown, updatedAt: string | null): Stored => {
    if (isAtlasEnvelope(data)) {
      const p = parseAtlas(data);
      return p.ok ? { kind: 'atlas', atlas: p.value, updatedAt: updatedAt ?? '' } : { kind: 'invalid', error: (p as { error: string }).error, updatedAt };
    }
    return { kind: 'legacy', state: sanitizeCampaignMapState(data), updatedAt };
  };

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
    const scope = scopeRef.current;
    const { data, error } = await (supabase.from('party_shared_state') as any)
      .select('state_data, updated_at')
      .eq('party_id', partyId).eq('user_id', hostUserId).eq('state_type', CAMPAIGN_MAP_STATE_TYPE)
      .maybeSingle();
    if (scope !== scopeRef.current) return;
    if (error) { console.warn('[campaign-map] read failed, keeping last map:', error.message); setLoading(false); return; }
    const next = data ? toStored(data.state_data, data.updated_at ?? null) : null;
    if (next?.kind === 'invalid') console.warn('[campaign-map] saved nested maps are invalid:', next.error);
    applyStored(next);
    setLoading(false);
  }, [partyId, hostUserId, applyStored]);

  useEffect(() => {
    scopeRef.current += 1;
    applyStored(null);
    setLoading(true);
    if (!partyId || !hostUserId) return;
    void fetchState();
    const channel = supabase
      .channel(`campaign-map:${partyId}:${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'party_shared_state', filter: `party_id=eq.${partyId}` }, (payload: any) => {
        const row = (payload.eventType === 'DELETE' ? payload.old : payload.new) as { user_id?: string; state_type?: string; state_data?: unknown; updated_at?: string };
        if (row?.state_type !== CAMPAIGN_MAP_STATE_TYPE || row.user_id !== hostUserId) return; // only the host's row counts
        const commit = Date.parse(payload.commit_timestamp || '');
        if (Number.isFinite(commit)) skewRef.current = commit - Date.now();
        if (payload.eventType === 'DELETE') applyStored(null);
        else applyStored(toStored(row.state_data, row.updated_at ?? null));
      })
      .subscribe((status) => { if (status === 'SUBSCRIBED') void fetchState(); });
    const onVisible = () => { if (document.visibilityState === 'visible') void fetchState(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      supabase.removeChannel(channel);
    };
  }, [partyId, hostUserId, currentUserId, fetchState, applyStored]);

  /** Compare-and-set save of a whole collection. `clientRevision` must be the persisted revision (0 when none). */
  const commitAtlas = useCallback(async (next: CampaignAtlas, clientRevision: number): Promise<Result & { updatedAt?: number }> => {
    if (!partyId || !currentUserId || !canWrite) return fail('Only the party host can change the campaign map.');
    const err = validateAtlasGraph(next);
    if (err) return fail(err);
    const scope = scopeRef.current;
    const cur = storedRef.current;
    const expected = cur ? cur.updatedAt || null : null;
    const envelope: CampaignAtlas = { ...next, sourcePartyId: partyId, revision: clientRevision };
    const { data, error } = await (supabase.rpc as any)('write_campaign_atlas', { _party_id: partyId, _envelope: envelope, _expected_updated_at: expected });
    if (scope !== scopeRef.current) return fail('The party changed while saving.');
    if (error) {
      if (error.code === '40001') { void fetchState(); return fail(CONFLICT_MSG); }
      return fail(error.message || 'The map could not be saved.');
    }
    const row = (Array.isArray(data) ? data[0] : data) as { state_data: unknown; updated_at: string; server_time: string } | undefined;
    if (!row) { void fetchState(); return fail('The map could not be saved.'); }
    const st = Date.parse(row.server_time);
    if (Number.isFinite(st)) skewRef.current = st - Date.now();
    const saved = toStored(row.state_data, row.updated_at);
    applyStored(saved);
    const updatedAt = Date.parse(row.updated_at);
    return { ok: true, updatedAt: Number.isFinite(updatedAt) ? updatedAt : serverNow() };
  }, [partyId, currentUserId, canWrite, fetchState, applyStored, serverNow]);

  // ── host writes: returns the server's updated_at ──
  // `mid` is the active map id captured when the edit began; in nested mode a delayed edit never lands on another map.
  const write = useCallback(async (mid: string | null, next: CampaignMapState): Promise<{ ok: boolean; updatedAt: number; error: string }> => {
    if (!partyId || !currentUserId || !canWrite) return { ok: false, updatedAt: 0, error: "Only the party host can change the campaign map." };
    const cur = storedRef.current;
    if (cur?.kind === 'invalid') return { ok: false, updatedAt: 0, error: `The saved nested maps can't be read (${cur.error}). Nothing was changed.` };
    if (cur?.kind === 'atlas') {
      if (!mid || cur.atlas.activeMapId !== mid) return { ok: false, updatedAt: 0, error: 'The party moved to another map. Please try again.' };
      const prevActive = projectActive(cur.atlas);
      const patched = patchMap(cur.atlas, mid, next);
      if (typeof patched === 'string') return { ok: false, updatedAt: 0, error: patched };
      const res = await commitAtlas(applyArrivalEntry(prevActive, patched), cur.atlas.revision);
      return res.ok ? { ok: true, updatedAt: res.updatedAt ?? serverNow(), error: '' } : { ok: false, updatedAt: 0, error: (res as { error: string }).error };
    }
    const scope = scopeRef.current;
    const { data, error } = await (supabase.from('party_shared_state') as any)
      .upsert({ party_id: partyId, user_id: currentUserId, state_type: CAMPAIGN_MAP_STATE_TYPE, state_data: next }, { onConflict: 'party_id,user_id,state_type' })
      .select('updated_at').single();
    if (error) { void fetchState(); return { ok: false, updatedAt: 0, error: error.message || "The map could not be saved." }; }
    const updatedAtStr = (data as { updated_at?: string })?.updated_at ?? null;
    const updatedAt = Date.parse(updatedAtStr || '');
    if (Number.isFinite(updatedAt)) skewRef.current = updatedAt - Date.now();
    if (scope === scopeRef.current) applyStored({ kind: 'legacy', state: next, updatedAt: updatedAtStr });
    return { ok: true, updatedAt: Number.isFinite(updatedAt) ? updatedAt : serverNow(), error: "" };
  }, [partyId, currentUserId, canWrite, serverNow, commitAtlas, fetchState, applyStored]);

  /** A tranche that is finished (by server time) folded into the saved state. */
  const settleTravel = useCallback((st: CampaignMapState, now: number): CampaignMapState => settleTravelState(st, now), []);

  /** Every host change runs on a settled state, so a finished leg is never lost. */
  const mutate = useCallback(async (fn: (s: CampaignMapState) => CampaignMapState | string): Promise<Result> => {
    const mid = activeMapIdRef.current;
    const base = settleTravel(stateRef.current ?? emptyCampaignMapState(), serverNow());
    const next = fn(base);
    if (typeof next === 'string') return fail(next);
    const res = await write(mid, sanitizeCampaignMapState(next));
    return res.ok ? OK : fail(res.error);
  }, [settleTravel, serverNow, write]);

  const reconcileTravelIfComplete = useCallback(async (): Promise<boolean> => {
    const s = stateRef.current; const mid = activeMapIdRef.current;
    if (!canWrite || !s?.activeTravel) return false;
    const settled = settleTravel(s, serverNow());
    if (settled === s) return false;
    return (await write(mid, settled)).ok;
  }, [canWrite, settleTravel, serverNow, write]);

  // The host saves a finished leg on load / reconnect.
  useEffect(() => { if (canWrite && rawState?.activeTravel) void reconcileTravelIfComplete(); }, [canWrite, rawState, reconcileTravelIfComplete]);

  // ── view (derived locally, never written) ──
  const getViewState = useCallback((now: number = serverNow()): CampaignMapView | null => {
    const cur = storedRef.current;
    const s = cur?.kind === 'atlas' ? projectActive(resolveAtlasAt(cur.atlas, now)) : rawState;
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
    const journey = s.journeyPlan ? { plan: s.journeyPlan, summary: summarizeJourney(t ? foldTravelToPosition(s, now) : s) } : undefined;
    if (t) {
      const live = travelDetail(t, now);
      const route = s.routes.find(r => r.id === live.routeId);
      return {
        state: s, position: routePoint(route, live.forwardProgress), campaignMinute: live.campaignMinute,
        traveling: !live.done && t.startedAt !== null, paused: t.startedAt === null, legFraction: live.fraction, legDone: live.done,
        currentRouteId: live.routeId, ...(journey ? { journey } : {}),
      };
    }
    const pos = s.currentRoutePosition;
    const position = pos ? routePoint(s.routes.find(r => r.id === pos.routeId), pos.progress) : pinned(s.currentLocationId);
    return { state: s, position, campaignMinute: s.campaignMinute, traveling: false, paused: false, legFraction: 0, legDone: false, ...(journey ? { journey } : {}) };
  }, [rawState, serverNow]);

  // ── setup ──
  const initialize = useCallback(async (): Promise<Result> => {
    if (storedRef.current?.kind === 'atlas') return fail('This party uses nested maps. Clearing one map this way is not allowed.');
    return mutate(() => emptyCampaignMapState());
  }, [mutate]);
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
    mutate(s => (s.journeyPlan && journeyLocks(s).locationIds.has(id) && patch.discovered === false ? 'The current journey goes through that place. Cancel the journey first.' : s.locations.some(l => l.id === id) ? { ...s, locations: s.locations.map(l => (l.id === id ? { ...l, ...patch } : l)) } : 'That place no longer exists.')), [mutate]);
  const removeLocation = useCallback((id: string) => mutate(s => {
    if (journeyLocks(s).locationIds.has(id)) return 'The current journey goes through that place. Cancel the journey first.';
    if (s.activeTravel && s.routes.some(r => r.id === s.activeTravel!.routeId && (r.fromLocationId === id || r.toLocationId === id))) return 'The party is traveling on a road to that place. Stop the travel first.';
    return { ...s, locations: s.locations.filter(l => l.id !== id), routes: s.routes.filter(r => r.fromLocationId !== id && r.toLocationId !== id), currentLocationId: s.currentLocationId === id ? null : s.currentLocationId };
  }), [mutate]);

  const addRoute = useCallback((route: CampaignMapRoute) =>
    mutate(s => (s.routes.some(r => r.id === route.id) ? 'A road with that id already exists.' : { ...s, routes: [...s.routes, route] })), [mutate]);
  const editRoute = useCallback((id: string, patch: Partial<Omit<CampaignMapRoute, 'id'>>) =>
    mutate(s => {
      if (s.activeTravel?.routeId === id) return 'The party is on this road. Stop the travel before changing it.';
      if (journeyLocks(s).routeIds.has(id)) return 'The current journey uses this road. Cancel the journey first.';
      return s.routes.some(r => r.id === id) ? { ...s, routes: s.routes.map(r => (r.id === id ? { ...r, ...patch } : r)) } : 'That road no longer exists.';
    }), [mutate]);
  const removeRoute = useCallback((id: string) => mutate(s => {
    if (s.activeTravel?.routeId === id || s.currentRoutePosition?.routeId === id) return 'The party is on this road. Move them off it first.';
    if (journeyLocks(s).routeIds.has(id)) return 'The current journey uses this road. Cancel the journey first.';
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
    if (s.journeyPlan) return 'Cancel the journey before moving the party.';
    if (id && !s.locations.some(l => l.id === id)) return 'That place no longer exists.';
    const next: CampaignMapState = { ...s, currentLocationId: id };
    delete next.currentRoutePosition;
    return next;
  }), [mutate]);
  const setDefaultPace = useCallback((pace: TravelPace) => mutate(s => ({ ...s, defaultPace: pace })), [mutate]);

  // ── travel ──
  const startTravel = useCallback(async (routeId: string, toLocationId: string, pace?: TravelPace): Promise<Result> => {
    if (!canWrite) return fail('Only the party host can start travel.');
    const mid = activeMapIdRef.current;
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
    delete staged.journeyPlan; // a manual one-road trip replaces any planned journey
    // 1) write to get the server's clock, 2) anchor the leg to it.
    const first = await write(mid, staged);
    if (!first.ok) return fail(first.error);
    const anchored = await write(mid, { ...staged, activeTravel: { ...travel, startedAt: first.updatedAt } });
    return anchored.ok ? OK : fail(anchored.error);
  }, [canWrite, settleTravel, serverNow, write]);

  const pauseTravel = useCallback(async (): Promise<Result> => {
    const s = stateRef.current; const mid = activeMapIdRef.current;
    if (!canWrite) return fail('Only the party host can pause travel.');
    if (!s?.activeTravel || s.activeTravel.startedAt === null) return fail('The party is not traveling.');
    const touch = await write(mid, s); // server time for the exact elapsed
    if (!touch.ok) return fail(touch.error);
    const settled = settleTravel(s, touch.updatedAt);
    if (!settled.activeTravel) return (await write(mid, settled)).ok ? OK : fail('The map could not be saved.');
    const frozen = freezeTravel(s.activeTravel, touch.updatedAt);
    const live = travelDetail(frozen, touch.updatedAt);
    const next: CampaignMapState = { ...s, activeTravel: frozen, currentRoutePosition: { routeId: live.routeId, progress: live.forwardProgress } };
    const res = await write(mid, next);
    return res.ok ? OK : fail(res.error);
  }, [canWrite, settleTravel, write]);

  const resumeTravel = useCallback(async (): Promise<Result> => {
    const s = stateRef.current; const mid = activeMapIdRef.current;
    if (!canWrite) return fail('Only the party host can resume travel.');
    if (!s?.activeTravel || s.activeTravel.startedAt !== null) return fail('Travel is not paused.');
    const staged: CampaignMapState = { ...s };
    delete staged.currentRoutePosition;
    const first = await write(mid, staged);
    if (!first.ok) return fail(first.error);
    const res = await write(mid, { ...staged, activeTravel: { ...s.activeTravel, startedAt: first.updatedAt } });
    return res.ok ? OK : fail(res.error);
  }, [canWrite, write]);

  /** Stop here: the party stays at its current point on the road, and the clock keeps the time spent. */
  const cancelTravel = useCallback(async (): Promise<Result> => {
    const s = stateRef.current; const mid = activeMapIdRef.current;
    if (!canWrite) return fail('Only the party host can stop travel.');
    if (!s?.activeTravel && s?.journeyPlan) { const n = { ...s }; delete n.journeyPlan; return (await write(mid, n)).ok ? OK : fail('The map could not be saved.'); }
    if (!s?.activeTravel) return fail('The party is not traveling.');
    const touch = await write(mid, s);
    if (!touch.ok) return fail(touch.error);
    const settled = settleTravel(s, touch.updatedAt);
    if (!settled.activeTravel) { const n = { ...settled }; delete n.journeyPlan; return (await write(mid, n)).ok ? OK : fail('The map could not be saved.'); }
    const live = travelDetail(s.activeTravel, touch.updatedAt);
    const next: CampaignMapState = { ...s, campaignMinute: live.campaignMinute, currentLocationId: null, currentRoutePosition: { routeId: live.routeId, progress: live.forwardProgress } };
    delete next.activeTravel;
    delete next.journeyPlan; // a stopped trip never resumes by surprise
    const res = await write(mid, next);
    return res.ok ? OK : fail(res.error);
  }, [canWrite, settleTravel, write]);

  /** Host override: the leg ends now and the full remaining in-world time passes. */
  const finishTravelNow = useCallback(async (): Promise<Result> => {
    const s = stateRef.current; const mid = activeMapIdRef.current;
    if (!canWrite) return fail('Only the party host can finish travel.');
    if (s?.journeyPlan) {
      const done = finishJourneyState(s, serverNow());
      if (typeof done === 'string') return fail(done);
      const r = await write(mid, done);
      return r.ok ? OK : fail(r.error);
    }
    if (!s?.activeTravel) return fail('The party is not traveling.');
    const done = settleTravel({ ...s, activeTravel: { ...s.activeTravel, startedAt: null, pausedFraction: 1 } }, serverNow());
    const res = await write(mid, done);
    return res.ok ? OK : fail(res.error);
  }, [canWrite, settleTravel, serverNow, write]);

  // ── multi-road journeys ──
  const planJourney = useCallback((destinationLocationId: string, pace?: TravelPace): { ok: true; plan: JourneyPlan; summary: JourneySummary } | { ok: false; error: string } => {
    const base = settleTravel(stateRef.current ?? emptyCampaignMapState(), serverNow());
    if (base.activeTravel) return { ok: false, error: 'The party is already traveling.' };
    if (destinationLocationId === base.currentLocationId) return { ok: false, error: 'The party is already there.' };
    const plan = planJourneyRoute(base, destinationLocationId, pace ?? base.defaultPace);
    const summary = plan && summarizeJourney(base, plan);
    return plan && summary ? { ok: true, plan, summary } : { ok: false, error: "There's no known road there yet." };
  }, [settleTravel, serverNow, rawState]);

  const getReachableDestinations = useCallback((pace?: TravelPace) => {
    const base = settleTravel(stateRef.current ?? emptyCampaignMapState(), serverNow());
    return listReachableDestinations(base, pace ?? base.defaultPace);
  }, [settleTravel, serverNow, rawState]);

  /** Write the tranche, then anchor it to the server's returned time (never this phone's clock). */
  const launchTranche = useCallback(async (mid: string | null, base: CampaignMapState, plan: JourneyPlan): Promise<Result> => {
    const tranche = buildJourneyTranche(base, plan);
    if (!tranche) return fail('A road on this journey has no distance yet. Set its miles (or calibrate the map) first.');
    if (!tranche.segments.length) return fail('The party is already there.');
    const travel = trancheToTravel(tranche, plan.pace, base.campaignMinute, base.realMinutesPerGameHour);
    const cleanPlan: JourneyPlan = { ...plan }; delete cleanPlan.dayComplete;
    const staged: CampaignMapState = { ...base, journeyPlan: cleanPlan, activeTravel: travel, currentLocationId: null };
    delete staged.currentRoutePosition;
    const first = await write(mid, staged);
    if (!first.ok) return fail(first.error);
    const anchored = await write(mid, { ...staged, activeTravel: { ...travel, startedAt: first.updatedAt } });
    return anchored.ok ? OK : fail(anchored.error);
  }, [write]);

  const startJourney = useCallback(async (destinationLocationId: string, pace?: TravelPace): Promise<Result> => {
    if (!canWrite) return fail('Only the party host can start travel.');
    const mid = activeMapIdRef.current;
    const base = settleTravel(stateRef.current ?? emptyCampaignMapState(), serverNow());
    if (base.activeTravel) return fail('The party is already traveling.');
    if (destinationLocationId === base.currentLocationId) return fail('The party is already there.');
    const plan = planJourneyRoute(base, destinationLocationId, pace ?? base.defaultPace);
    if (!plan) return fail("There's no known road there yet.");
    return launchTranche(mid, base, plan);
  }, [canWrite, settleTravel, serverNow, launchTranche]);

  /** Next travel day from the exact saved spot. Does not rest, heal, or change anything on the characters. */
  const continueJourney = useCallback(async (): Promise<Result> => {
    if (!canWrite) return fail('Only the party host can continue travel.');
    const mid = activeMapIdRef.current;
    const base = settleTravel(stateRef.current ?? emptyCampaignMapState(), serverNow());
    if (base.activeTravel) return fail('The party is already traveling.');
    if (!base.journeyPlan) return fail('There is no journey to continue.');
    return launchTranche(mid, base, base.journeyPlan);
  }, [canWrite, settleTravel, serverNow, launchTranche]);

  /** Stop the journey where the party stands right now (no jump to a town). */
  const cancelJourney = useCallback(async (): Promise<Result> => {
    const s = stateRef.current; const mid = activeMapIdRef.current;
    if (!canWrite) return fail('Only the party host can stop travel.');
    if (!s?.journeyPlan && !s?.activeTravel) return fail('There is no journey to stop.');
    let now = serverNow();
    if (s.activeTravel) { const touch = await write(mid, s); if (!touch.ok) return fail(touch.error); now = touch.updatedAt; }
    const settled = settleTravel(s, now);
    const next = foldTravelToPosition(settled, now);
    if (next.currentRoutePosition) delete next.currentRoutePosition.dayComplete;
    delete next.journeyPlan;
    const res = await write(mid, next);
    return res.ok ? OK : fail(res.error);
  }, [canWrite, settleTravel, serverNow, write]);

  // ── campaign saves ──
  /** A save-safe copy: travel in progress is frozen at this moment. Nested collections export whole. */
  const exportSaveSnapshot = useCallback((): CampaignMapState | CampaignAtlas | null => {
    const now = serverNow();
    const freeze = (st: CampaignMapState) => {
      const settled = settleTravel(st, now);
      return settled.activeTravel && settled.activeTravel.startedAt !== null
        ? { ...settled, activeTravel: freezeTravel(settled.activeTravel, now) } : settled;
    };
    const stored = storedRef.current;
    if (stored?.kind === 'atlas') {
      const a = resolveAtlasAt(stored.atlas, now);
      const patched = patchMap(a, a.activeMapId, freeze(projectActive(a)));
      return typeof patched === 'string' ? a : patched;
    }
    const s = stateRef.current;
    return s ? freeze(s) : null;
  }, [rawState, settleTravel, serverNow]);

  /**
   * Full-collection restore. Travel comes back paused; never auto-resumes, completes or descends.
   * - 'campaign': trusted saved campaign. Same-party atlases keep their ids; foreign ones get fresh ids.
   * - 'undo': internal Undo. Keeps ids and requires the current revision to match the snapshot's.
   * - 'portable': JSON file import. Always fresh ids.
   * A legacy single map over a collection is wrapped as a NEW one-root collection with fresh ids.
   * Nothing is written unless the snapshot is recognized and valid.
   */
  const restoreSaveSnapshot = useCallback(async (snapshot: unknown, mode: RestoreMode = 'campaign'): Promise<Result> => {
    if (!partyId || !canWrite) return fail('Only the party host can change the campaign map.');
    const stored = storedRef.current;
    const persistedRev = stored?.kind === 'atlas' ? stored.atlas.revision : 0;
    const pause = (st: CampaignMapState): CampaignMapState =>
      st.activeTravel && st.activeTravel.startedAt !== null ? { ...st, activeTravel: { ...st.activeTravel, startedAt: null, pausedFraction: st.activeTravel.pausedFraction ?? 0 } } : st;
    const kind = classifySnapshot(snapshot);
    if (kind === 'null') return fail('There is no saved map to restore.');
    if (kind === 'unknown') return fail('That saved map is in a format this app does not recognize. Nothing was changed.');
    if (kind === 'atlas') {
      const parsed = parseAtlas(snapshot);
      if (parsed.ok === false) return fail(`${(parsed as { error: string }).error} Nothing was changed.`);
      let a = parsed.value;
      if (mode === 'undo') {
        if (stored?.kind !== 'atlas' || stored.atlas.revision !== a.revision) return fail('The map has changed since then, so Undo is no longer safe. Nothing was changed.');
      }
      const keepIds = mode !== 'portable' && a.sourcePartyId === partyId;
      a = pauseAtlasTravel(keepIds ? a : remapAtlasIds(a, partyId));
      return commitAtlas(a, persistedRev);
    }
    const legacy = parseLegacyMap(snapshot);
    if (legacy.ok === false) return fail(`${(legacy as { error: string }).error} Nothing was changed.`);
    const s = pause(legacy.value);
    if (stored?.kind === 'atlas' || stored?.kind === 'invalid') {
      if (mode === 'undo') return fail('The map has changed since then, so Undo is no longer safe. Nothing was changed.');
      if (mode === 'portable') return fail('This party uses nested maps. Importing a single map into them is not ready yet. Nothing was changed.');
      return commitAtlas(convertLegacyToAtlas(s, partyId), persistedRev);
    }
    const mid = activeMapIdRef.current;
    return write(mid, s).then(r => (r.ok ? OK : fail(r.error)));
  }, [partyId, canWrite, write, commitAtlas]);

  const clearCampaignMap = useCallback(async (): Promise<Result> => {
    if (!partyId || !currentUserId || !canWrite) return fail('Only the party host can clear the map.');
    const { error } = await (supabase.from('party_shared_state') as any)
      .delete().eq('party_id', partyId).eq('user_id', currentUserId).eq('state_type', CAMPAIGN_MAP_STATE_TYPE);
    if (error) return fail(error.message || 'The map could not be cleared.');
    applyStored(null);
    return OK;
  }, [partyId, currentUserId, canWrite, applyStored]);

  /** Reads the latest map at call time, so a moving dot is current even without a re-render. */
  const getPromptContext = useCallback((): string => {
    const stored = storedRef.current;
    const st = stored?.kind === 'atlas' ? projectActive(resolveAtlasAt(stored.atlas, serverNow())) : stateRef.current;
    return st && (st.imageUrl || st.locations.length) ? buildDmLogisticsContext(st, serverNow()) : '';
  }, [serverNow]);

  // ── nested maps (host-only; no UI yet — prompt 5 wires these) ──
  const atlas = stored?.kind === 'atlas' ? stored.atlas : null;
  const isAtlasMode = !!atlas;

  /** Explicit host conversion: the whole current map becomes the top map of a collection. */
  const convertToAtlas = useCallback(async (name?: string): Promise<Result> => {
    if (!partyId || !canWrite) return fail('Only the party host can change the campaign map.');
    const cur = storedRef.current;
    if (cur?.kind === 'atlas') return fail('This party already uses nested maps.');
    const base = settleTravel(stateRef.current ?? emptyCampaignMapState(), serverNow());
    return commitAtlas(convertLegacyToAtlas(base, partyId, name), 0);
  }, [partyId, canWrite, settleTravel, serverNow, commitAtlas]);

  /** Run an atlas operation on the latest collection, then save with compare-and-set. */
  const runAtlasOp = useCallback(async (op: (a: CampaignAtlas) => CampaignAtlas | string): Promise<Result> => {
    if (!canWrite) return fail('Only the party host can change the campaign map.');
    const cur = storedRef.current;
    if (cur?.kind !== 'atlas') return fail('Nested maps are not set up for this party.');
    const base = resolveAtlasAt(cur.atlas, serverNow());
    const next = op(base);
    if (typeof next === 'string') return fail(next);
    return commitAtlas(next, cur.atlas.revision);
  }, [canWrite, serverNow, commitAtlas]);

  const createChild = useCallback((parentMapId: string, parentLocationId: string, opts: { name: string; navigationMode?: NavigationMode; state?: CampaignMapState; entryLocationId?: string | null }) =>
    runAtlasOp(a => createChildMapOp(a, parentMapId, parentLocationId, opts)), [runAtlasOp]);
  const enterChildMap = useCallback((childMapId: string) => runAtlasOp(a => enterChildOp(a, childMapId)), [runAtlasOp]);
  const exitToParentMap = useCallback(() => runAtlasOp(a => exitToParentOp(a)), [runAtlasOp]);
  const moveWithinLocalMap = useCallback((locationId: string) => runAtlasOp(a => moveLocalOp(a, locationId)), [runAtlasOp]);
  /** Edit one specific map (captured id). Other maps are untouched; inactive maps can never get travel. */
  const editMap = useCallback((mapId: string, fn: (s: CampaignMapState) => CampaignMapState | string) =>
    runAtlasOp(a => { const st = projectMapState(a, mapId); if (!st) return 'That map no longer exists.'; const n = fn(st); return typeof n === 'string' ? n : patchMap(a, mapId, sanitizeCampaignMapState(n)); }), [runAtlasOp]);
  const editMapMeta = useCallback((mapId: string, patch: Partial<Pick<AtlasMapNode, 'name' | 'entryLocationId' | 'navigationMode'>>) =>
    runAtlasOp(a => setNodeMeta(a, mapId, patch)), [runAtlasOp]);

  /** Upload + decode a map picture (same types/size as the main map). Nothing is saved to the map here. */
  const uploadDecodedImage = useCallback(async (file: File): Promise<{ ok: true; url: string; w: number; h: number } | { ok: false; error: string }> => {
    if (!canWrite || !partyId || !currentUserId) return { ok: false, error: 'Only the party host can change the map.' };
    if (!IMAGE_TYPES.includes(file.type)) return { ok: false, error: 'Use a PNG, JPG, WebP or GIF image.' };
    if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: 'That image is too big (15 MB at most).' };
    const size = await new Promise<{ w: number; h: number } | null>((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { resolve({ w: img.naturalWidth, h: img.naturalHeight }); URL.revokeObjectURL(url); };
      img.onerror = () => { resolve(null); URL.revokeObjectURL(url); };
      img.src = url;
    });
    if (!size) return { ok: false, error: 'That file could not be read as an image.' };
    const up = await uploadImageFile(file, file.type);
    if (!up.ok) return { ok: false, error: (up as { error: string }).error };
    return { ok: true, url: up.url, w: size.w, h: size.h };
  }, [canWrite, partyId, currentUserId, uploadImageFile]);

  /**
   * Upload an area map for one place on one map. A single map is converted to a collection in the
   * SAME save. Never moves the party and never changes the parent map's picture.
   */
  const addAreaMap = useCallback(async (parentMapId: string | null, parentLocationId: string, file: File, name: string): Promise<Result> => {
    if (!partyId || !canWrite) return fail('Only the party host can change the campaign map.');
    const img = await uploadDecodedImage(file);
    if (!img.ok) return fail((img as { error: string }).error);
    const childState = replaceMapImage(sanitizeCampaignMapState({}), img.url, img.w, img.h);
    const cur = storedRef.current;
    if (cur?.kind === 'invalid') return fail('The saved maps are damaged, so nothing was changed.');
    if (cur?.kind !== 'atlas') {
      const base = settleTravel(stateRef.current ?? emptyCampaignMapState(), serverNow());
      if (!base.locations.some(l => l.id === parentLocationId)) return fail('That place no longer exists.');
      const a = convertLegacyToAtlas(base, partyId);
      const next = createChildMapOp(a, a.rootMapId, parentLocationId, { name, navigationMode: 'local', state: childState });
      if (typeof next === 'string') return fail(next);
      return commitAtlas(next, 0);
    }
    return runAtlasOp(a => createChildMapOp(a, parentMapId ?? a.activeMapId, parentLocationId, { name, navigationMode: 'local', state: childState }));
  }, [partyId, canWrite, uploadDecodedImage, settleTravel, serverNow, commitAtlas, runAtlasOp]);

  /** New picture for one map. Keeps its id, places, child maps, guide links and discoveries; clears calibration. */
  const replaceAreaImage = useCallback(async (mapId: string, file: File): Promise<Result> => {
    const img = await uploadDecodedImage(file);
    if (!img.ok) return fail((img as { error: string }).error);
    return editMap(mapId, st => replaceMapImage(st, img.url, img.w, img.h));
  }, [uploadDecodedImage, editMap]);

  /**
   * Install a Map Pack as an area map at a captured map/place. Order: validate → upload image →
   * private guide rows under the still-inactive reserved id → one compare-and-set atlas commit.
   * Never moves the party. A retry with the same reservedId reuses identical staged guide rows.
   */
  const installAreaPack = useCallback(async (input: {
    parentMapId: string | null; parentLocationId: string; reservedId: string; name: string;
    state: CampaignMapState; image: Blob; imageType: string; replaceExisting: boolean;
    guides: Array<{ scope: 'map' | 'location'; locationId: string | null; name: string; content: string }>;
  }): Promise<{ ok: true; previous: CampaignAtlas | null; previousLegacy: CampaignMapState | null; revisionAfter: number } | { ok: false; error: string; guidesStaged?: boolean }> => {
    if (!partyId || !canWrite) return { ok: false, error: 'Only the party host can change the campaign map.' };
    const cur = storedRef.current;
    if (cur?.kind === 'invalid') return { ok: false, error: 'The saved maps are damaged, so nothing was changed.' };
    // Target check before any upload.
    let baseAtlas: CampaignAtlas; let clientRev: number; let previous: CampaignAtlas | null = null; let previousLegacy: CampaignMapState | null = null;
    if (cur?.kind === 'atlas') {
      baseAtlas = resolveAtlasAt(cur.atlas, serverNow()); clientRev = cur.atlas.revision; previous = cur.atlas;
    } else {
      const legacy = settleTravel(stateRef.current ?? emptyCampaignMapState(), serverNow());
      previousLegacy = stateRef.current;
      baseAtlas = convertLegacyToAtlas(legacy, partyId); clientRev = 0;
    }
    const parentId = input.parentMapId ?? baseAtlas.rootMapId;
    const dry = installAreaPackOp(baseAtlas, parentId, input.parentLocationId, { id: input.reservedId, name: input.name, state: input.state, replaceExisting: input.replaceExisting });
    if (typeof dry === 'string') return { ok: false, error: dry };
    const up = await uploadImageFile(input.image, input.imageType);
    if (!up.ok) return { ok: false, error: (up as { error: string }).error };
    if (input.guides.length) {
      const { data: existing, error: readErr } = await (supabase.from('party_location_guides') as any)
        .select('scope, location_id, name, content').eq('party_id', partyId).eq('map_id', input.reservedId);
      if (readErr) return { ok: false, error: 'Could not check the area guides. Nothing was changed.' };
      const key = (g: { scope: string; location_id?: string | null; locationId?: string | null; name: string; content: string }) => `${g.scope}|${g.location_id ?? g.locationId ?? ''}|${g.name}|${g.content}`;
      const want = input.guides.map(key).sort().join('\n');
      if (existing?.length) {
        const have = (existing as any[]).map(key).sort().join('\n');
        if (have !== want) return { ok: false, error: 'A different earlier attempt saved guides for this install. Start the install again.' };
      } else {
        const { error } = await (supabase.from('party_location_guides') as any).insert(input.guides.map(g => ({
          party_id: partyId, map_id: input.reservedId, scope: g.scope, location_id: g.scope === 'location' ? g.locationId : null,
          name: g.name.slice(0, 120), content: g.content, enabled: true,
        })));
        if (error) return { ok: false, error: 'The area guides could not be saved, so the map was not installed. Nothing else changed.' };
      }
    }
    const st = { ...input.state, imageUrl: up.url };
    // Re-run on the latest atlas so other edits since preview are kept.
    const latest = storedRef.current;
    const nowBase = latest?.kind === 'atlas' ? resolveAtlasAt(latest.atlas, serverNow()) : baseAtlas;
    const rev = latest?.kind === 'atlas' ? latest.atlas.revision : clientRev;
    const next = installAreaPackOp(nowBase, parentId, input.parentLocationId, { id: input.reservedId, name: input.name, state: st, replaceExisting: input.replaceExisting });
    if (typeof next === 'string') return { ok: false, error: next, guidesStaged: input.guides.length > 0 };
    const res = await commitAtlas(next, rev);
    if (!res.ok) return { ok: false, error: (res as { error: string }).error, guidesStaged: input.guides.length > 0 };
    const after = storedRef.current;
    return { ok: true, previous, previousLegacy, revisionAfter: after?.kind === 'atlas' ? after.atlas.revision : rev + 1 };
  }, [partyId, canWrite, serverNow, settleTravel, uploadImageFile, commitAtlas]);

  /** Restore the full atlas from before an install, only if nothing changed since. */
  const undoAtlasInstall = useCallback(async (prev: { previous: CampaignAtlas | null; previousLegacy: CampaignMapState | null; revisionAfter: number }): Promise<Result> => {
    if (!partyId || !canWrite) return fail('Only the party host can change the campaign map.');
    const cur = storedRef.current;
    if (cur?.kind !== 'atlas' || cur.atlas.revision !== prev.revisionAfter) return fail('The map changed after the install (an edit or the party moved), so Undo was stopped. Review the Areas tab instead.');
    if (prev.previous) return commitAtlas(prev.previous, cur.atlas.revision);
    return fail('This install turned a single map into a collection; Undo can only restore collections. Review the Areas tab instead.');
  }, [partyId, canWrite, commitAtlas]);

  const activeMapId = atlas?.activeMapId ?? null;
  const [viewedMapIdRaw, setViewedMapId] = useState<string | null>(null);
  // Local browse only. Never written, never changes party position or GM context.
  const viewedMapId = atlas && viewedMapIdRaw && getNode(atlas, viewedMapIdRaw) ? viewedMapIdRaw : activeMapId;
  const getMapState = useCallback((mapId: string) => (atlas ? projectMapState(atlas, mapId) : null), [atlas]);
  const getBreadcrumbs = useCallback((mapId: string) => (atlas ? breadcrumbs(atlas, mapId) : []), [atlas]);

  return useMemo(() => ({
    rawState, loading, hostUserId, canWrite, getViewState, uploadImageFile,
    initialize, reset, uploadMapImage, replaceMapImage: uploadMapImage, replaceLocationsAndRoutes,
    addLocation, editLocation, removeLocation, addRoute, editRoute, removeRoute,
    setDiscovered, setCampaignClock, setTimeCompression, setDefaultPace, setCalibration, setCurrentLocation,
    startTravel, pauseTravel, resumeTravel, cancelTravel, finishTravelNow, reconcileTravelIfComplete,
    planJourney, getReachableDestinations, startJourney, continueJourney, cancelJourney,
    exportSaveSnapshot, restoreSaveSnapshot, clearCampaignMap, getPromptContext, serverNow, addAreaMap, replaceAreaImage, installAreaPack, undoAtlasInstall,
    atlas, isAtlasMode, activeMapId, viewedMapId, setViewedMapId, getMapState, getBreadcrumbs,
    convertToAtlas, createChild, enterChildMap, exitToParentMap, moveWithinLocalMap, editMap, editMapMeta,
  }), [rawState, loading, hostUserId, canWrite, getViewState, uploadImageFile, initialize, reset, uploadMapImage, replaceLocationsAndRoutes,
    addLocation, editLocation, removeLocation, addRoute, editRoute, removeRoute, setDiscovered, setCampaignClock,
    setTimeCompression, setDefaultPace, setCalibration, setCurrentLocation, startTravel, pauseTravel, resumeTravel, cancelTravel, finishTravelNow,
    reconcileTravelIfComplete, planJourney, getReachableDestinations, startJourney, continueJourney, cancelJourney, exportSaveSnapshot, restoreSaveSnapshot, clearCampaignMap, getPromptContext, serverNow, addAreaMap, replaceAreaImage, installAreaPack, undoAtlasInstall,
    atlas, isAtlasMode, activeMapId, viewedMapId, getMapState, getBreadcrumbs,
    convertToAtlas, createChild, enterChildMap, exitToParentMap, moveWithinLocalMap, editMap, editMapMeta]);
}

export type PartyCampaignMapApi = ReturnType<typeof usePartyCampaignMap>;
