// Campaign Map: the shared world map with a live YOU ARE HERE dot.
// Play View for everyone; Host Setup for the original host only.
// All moving-dot animation is computed locally — nothing here writes per frame.

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Compass, Download, Map as MapIcon, MapPin, Pause, Play, Route as RouteIcon, Square, Trash2, Upload, FastForward, Crosshair } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { PartyCampaignMapApi } from '@/hooks/use-party-campaign-map';
import { MapPackAssistant, type MapPackUndo } from './MapPackAssistant';
import {
  LOCATION_KINDS, TIME_COMPRESSION_PRESETS, TRAVEL_PACE_MPH,
  activeCalibration, createCalibration, effectiveRouteMiles, formatCampaignTime, gameToRealMs, TRAVEL_DAY_MINUTES,
  polylineMiles, sanitizeCampaignMapState, locationOverlayMode, routeOverlayMode, travelDetail, withRoutePath,
  listReachableDestinations, summarizeJourney, remainingJourneyRouteIds, foldTravelToPosition,
  type CampaignMapLocation, type CampaignMapRoute, type CampaignMapState, type LocationKind, type MapPoint, type TravelPace,
} from '@/lib/campaign-map';

const TOUCH = { touchAction: 'manipulation' as const };
const PACES: TravelPace[] = ['slow', 'normal', 'fast'];
const PACE_LABEL: Record<TravelPace, string> = { slow: 'Slow', normal: 'Normal', fast: 'Fast' };
const newId = (p: string) => `${p}-${crypto.randomUUID().slice(0, 8)}`;

type Mode =
  | { kind: 'none' }
  | { kind: 'calibA' }
  | { kind: 'calibB'; a: MapPoint }
  | { kind: 'calibMiles'; a: MapPoint; b: MapPoint }
  | { kind: 'pin'; locationId: string }
  | { kind: 'path'; routeId: string };

function fmtMs(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}:${String(sec).padStart(2, '0')}`;
}
function fmtGameMin(min: number): string {
  const m = Math.max(0, Math.round(min));
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}
const miles = (n: number) => `${n < 10 ? n.toFixed(1) : Math.round(n)} mi`;

/** A location's own pin, or its nearest pinned parent (sub-locations inherit). */
function resolvePin(loc: CampaignMapLocation | undefined, byId: Map<string, CampaignMapLocation>): MapPoint | null {
  let cur = loc; let guard = 0;
  while (cur && guard++ < 10) {
    if (cur.x !== null && cur.y !== null) return { x: cur.x, y: cur.y };
    cur = cur.parentLocationId ? byId.get(cur.parentLocationId) : undefined;
  }
  return null;
}
const ownPin = (l: CampaignMapLocation | undefined): MapPoint | null => (l && l.x !== null && l.y !== null ? { x: l.x, y: l.y } : null);

/** Path with endpoints following the pins and the host's waypoints in between. */
function routePath(route: CampaignMapRoute, byId: Map<string, CampaignMapLocation>): MapPoint[] {
  const a = resolvePin(byId.get(route.fromLocationId), byId);
  const b = resolvePin(byId.get(route.toLocationId), byId);
  const mid = route.path.length >= 2 ? route.path.slice(1, -1) : [];
  return a && b ? [a, ...mid, b] : route.path;
}

export interface CampaignMapPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  map: PartyCampaignMapApi;
  /** Host-only; used later by the Map Pack Assistant after explicit approval. */
  onInstallGuide?: (name: string, content: string, customId?: string) => boolean;
}

export function CampaignMapPanel({ open, onOpenChange, map, onInstallGuide }: CampaignMapPanelProps) {
  const [tab, setTab] = useState<'play' | 'setup'>('play');
  const [packUndo, setPackUndo] = useState<MapPackUndo | null>(null);
  const [, setTick] = useState(0);
  const state = map.rawState;
  const host = map.canWrite;
  const traveling = !!state?.activeTravel && state.activeTravel.startedAt !== null;

  // Local animation only: re-render while the dot moves. Never writes.
  useEffect(() => {
    if (!open || !traveling) return;
    let raf = 0; let last = 0;
    const loop = (t: number) => { if (t - last > 200) { last = t; setTick(n => n + 1); } raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [open, traveling]);

  useEffect(() => { if (!host && tab === 'setup') setTab('play'); }, [host, tab]);
  // Every fresh open starts on Play View; switching tabs during an open session is kept.
  useEffect(() => { if (open) setTab('play'); }, [open]);
  const landscape = usePhoneLandscape();
  const playLandscape = landscape && tab !== 'setup';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" data-vaul-no-drag className={cn('p-0 bg-[#0b0b10] overflow-hidden flex flex-col', landscape ? 'h-[100dvh] max-h-[100dvh] rounded-none border-t-0' : 'h-[92vh] border-t border-amber-500/30 rounded-t-2xl')}>
        <div className={cn('shrink-0 border-b border-white/10', landscape ? 'px-3 pt-1.5 pb-1.5 flex items-center gap-3 pr-12' : 'px-4 pt-3 pb-2')}>
          <SheetTitle className="font-cinzel text-amber-300 text-[15px] flex items-center gap-2 pr-8">
            <MapIcon className="w-5 h-5" /> Campaign Map
          </SheetTitle>
          <SheetDescription className={cn('text-[12px] text-white/50 mt-0.5', landscape && 'sr-only')}>
            {host ? 'Where the party is, and where the road leads.' : 'Where the party is. The host controls travel.'}
          </SheetDescription>
          {host && (
            <div className={cn('grid grid-cols-2 gap-2', landscape ? 'ml-auto w-[260px]' : 'mt-2')}>
              {(['play', 'setup'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)} style={TOUCH}
                  className={cn('min-h-[44px] rounded-lg text-[13px] font-semibold border', tab === t ? 'bg-amber-500/20 border-amber-400/50 text-amber-200' : 'bg-white/5 border-white/10 text-white/60')}>
                  {t === 'play' ? 'Play View' : 'Host Setup'}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className={cn('flex-1 min-h-0 overflow-x-hidden', playLandscape ? 'overflow-hidden px-3 py-2' : 'overflow-y-auto px-4 py-3')}>
          {map.loading && !state ? (
            <p className="text-white/50 text-sm">Loading the map…</p>
          ) : tab === 'setup' && host ? (
            <HostSetup map={map} state={state} onInstallGuide={onInstallGuide} packUndo={packUndo} setPackUndo={setPackUndo} />
          ) : (
            <PlayView map={map} state={state} landscape={playLandscape} onSetup={host ? () => setTab('setup') : undefined} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Phone held sideways: wide and short. Scoped to this panel only; never locks orientation.
const PHONE_LANDSCAPE_QUERY = '(orientation: landscape) and (max-height: 540px)';
function usePhoneLandscape(): boolean {
  const [on, setOn] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(PHONE_LANDSCAPE_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(PHONE_LANDSCAPE_QUERY);
    if (!mq) return;
    const fn = () => setOn(mq.matches);
    fn();
    mq.addEventListener?.('change', fn);
    return () => mq.removeEventListener?.('change', fn);
  }, []);
  return on;
}

// ───────────────────────── map canvas ─────────────────────────

function MapCanvas({ state, showAll, editor = false, fitHeight, partyDot, selectedId, onTapPin, onTapMap, highlightRouteId, highlightRouteIds, extraPoints, children }: {
  state: CampaignMapState;
  showAll: boolean;
  /** Host Setup: atlas-background places and roads stay visible so they can be edited. */
  editor?: boolean;
  /** Landscape: shrink the map width so the whole picture fits this CSS height, keeping its shape. */
  fitHeight?: string;
  partyDot: MapPoint | null;
  selectedId?: string | null;
  onTapPin?: (id: string) => void;
  onTapMap?: (p: MapPoint) => void;
  /** Strongest highlight (current/selected road). */
  highlightRouteId?: string | null;
  /** Ordered roads of a planned/active journey; drawn highlighted but lighter than highlightRouteId. */
  highlightRouteIds?: string[];
  extraPoints?: MapPoint[];
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const byId = useMemo(() => new Map(state.locations.map(l => [l.id, l])), [state.locations]);
  const visible = state.locations.filter(l => (showAll || l.discovered) && ownPin(l));
  const routes = state.routes.filter(r => showAll || (byId.get(r.fromLocationId)?.discovered && byId.get(r.toLocationId)?.discovered));
  const tap = (e: React.PointerEvent) => {
    if (!onTapMap || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    onTapMap({ x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) });
  };
  const ar = state.imageNaturalWidth && state.imageNaturalHeight ? state.imageNaturalWidth / state.imageNaturalHeight : null;
  if (!state.imageUrl) return null;
  return (
    <div ref={ref} className={cn('relative w-full rounded-xl overflow-hidden border border-white/10 select-none', fitHeight && 'mx-auto', onTapMap && 'cursor-crosshair')} onPointerUp={tap}
      style={{ ...TOUCH, ...(fitHeight && ar ? { width: `min(100%, calc(${fitHeight} * ${ar}))` } : {}) }} data-vaul-no-drag>
      <img src={state.imageUrl} alt="Campaign map" className="block w-full h-auto pointer-events-none" draggable={false} />
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
        {routes.map(r => {
          const pts = routePath(r, byId);
          if (pts.length < 2) return null;
          const strong = r.id === highlightRouteId;
          const hi = strong || !!highlightRouteIds?.includes(r.id);
          const bg = routeOverlayMode(r) === 'background';
          // Atlas roads are already painted on the picture; only draw them when chosen/active, or for the host editor.
          if (bg && !hi && !editor) return null;
          if (bg && !hi) return <polyline key={r.id} points={pts.map(p => `${p.x * 100},${p.y * 100}`).join(' ')} fill="none"
            stroke="rgba(125,211,252,0.6)" strokeDasharray="0.6 1.2" vectorEffect="non-scaling-stroke" style={{ strokeWidth: 2 }} />;
          return <polyline key={r.id} points={pts.map(p => `${p.x * 100},${p.y * 100}`).join(' ')} fill="none"
            stroke={strong ? 'rgb(252 211 77)' : hi ? 'rgba(252,211,77,0.6)' : 'rgba(255,255,255,0.55)'} strokeWidth={hi ? 0.9 : 0.5} strokeDasharray={hi ? undefined : '1.5 1'} vectorEffect="non-scaling-stroke" style={{ strokeWidth: strong ? 3.5 : hi ? 2.5 : 2 }} />;
        })}
      </svg>
      {extraPoints?.map((p, i) => (
        <span key={i} className="absolute w-3 h-3 -ml-1.5 -mt-1.5 rounded-full bg-sky-400 border border-white pointer-events-none" style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }} />
      ))}
      {visible.map(l => {
        const mode = locationOverlayMode(l);
        if (mode === 'background' && !editor) {
          // Printed on the atlas: no visible marker, just a tappable spot over it.
          if (!onTapPin) return null;
          return (
            <button key={l.id} type="button" aria-label={l.name} style={{ left: `${l.x! * 100}%`, top: `${l.y! * 100}%`, ...TOUCH }}
              onPointerUp={(e) => { e.stopPropagation(); onTapPin(l.id); }}
              className={cn('absolute -translate-x-1/2 -translate-y-1/2 w-11 h-11 rounded-full', selectedId === l.id && 'ring-2 ring-amber-300 bg-amber-300/15')} />
          );
        }
        return (
        <button key={l.id} type="button" style={{ left: `${l.x! * 100}%`, top: `${l.y! * 100}%`, ...TOUCH }}
          onPointerUp={(e) => { if (onTapPin) { e.stopPropagation(); onTapPin(l.id); } }}
          className={cn('absolute -translate-x-1/2 -translate-y-full flex flex-col items-center min-w-[44px] min-h-[44px] justify-end', !onTapPin && 'pointer-events-none')}>
          {(mode === 'full' || editor) && <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap max-w-[120px] truncate', selectedId === l.id ? 'bg-amber-400 text-black' : 'bg-black/70 text-white', !l.discovered && 'opacity-60 italic', editor && mode === 'background' && 'border border-dashed border-sky-300/70')}>{l.name}</span>}
          <MapPin className={cn('w-5 h-5 drop-shadow', selectedId === l.id ? 'text-amber-300' : editor && mode === 'background' ? 'text-sky-300 opacity-80' : 'text-rose-400')} />
        </button>
        );
      })}
      {partyDot && (
        <div className="absolute pointer-events-none -translate-x-1/2 -translate-y-1/2 flex flex-col items-center" style={{ left: `${partyDot.x * 100}%`, top: `${partyDot.y * 100}%` }}>
          <span className="relative flex w-4 h-4">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
            <span className="relative inline-flex w-4 h-4 rounded-full bg-emerald-400 border-2 border-white" />
          </span>
          <span className="mt-1 px-1.5 py-0.5 rounded bg-emerald-500 text-black text-[9px] font-bold tracking-wide">YOU ARE HERE</span>
        </div>
      )}
      {children}
    </div>
  );
}

function partyPoint(map: PartyCampaignMapApi, state: CampaignMapState): MapPoint | null {
  const v = map.getViewState();
  if (v?.position) return v.position;
  const byId = new Map(state.locations.map(l => [l.id, l]));
  return state.currentLocationId ? resolvePin(byId.get(state.currentLocationId), byId) : null;
}

// ───────────────────────── play view ─────────────────────────

function PlayView({ map, state, onSetup, landscape = false }: { map: PartyCampaignMapApi; state: CampaignMapState | null; onSetup?: () => void; landscape?: boolean }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [pace, setPace] = useState<TravelPace | null>(null);
  const [busy, setBusy] = useState(false);
  if (!state || !state.imageUrl) {
    return (
      <div className="text-center py-10 space-y-3">
        <Compass className="w-10 h-10 mx-auto text-amber-300/70" />
        <p className="text-white/70 text-sm">{onSetup ? 'No map yet. Upload one to start tracking travel.' : 'The host has not set up a map yet.'}</p>
        {onSetup && <Button onClick={onSetup} className="min-h-[48px]" style={TOUCH}>Set up the map</Button>}
      </div>
    );
  }
  const host = map.canWrite;
  const byId = new Map(state.locations.map(l => [l.id, l]));
  const view = map.getViewState();
  const t = state.activeTravel;
  const plan = state.journeyPlan;
  const nameOf = (id: string | undefined | null) => (id && byId.get(id)?.name) || '?';
  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg?: string) => {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    if (!r.ok) toast.error((r as { error: string }).error); else if (okMsg) toast.success(okMsg);
    return r.ok;
  };

  const here = state.currentLocationId;
  const onRoad = state.currentRoutePosition;
  const usePace = pace ?? plan?.pace ?? state.defaultPace;
  // Whole discovered map: any reachable place, however many roads away. Only when not on a trip.
  const reachable = !t && !plan ? listReachableDestinations(state, usePace) : [];
  const reachableIds = new Set(reachable.map(r => r.location.id));
  const preview = selected ? reachable.find(r => r.location.id === selected) ?? null : null;
  const selectedUnreachable = !!selected && !preview && !t && !plan;

  // ── active / paused / day-complete journey ──
  let journeyBox: ReactNode = null;
  if ((t || plan) && view) {
    const live = t ? travelDetail(t, Date.now()) : null;
    const stopped = t ? foldTravelToPosition(state, Date.now()) : state;
    const sum = plan ? summarizeJourney(stopped, plan) : null;
    const curRoute = state.routes.find(r => r.id === (live?.routeId ?? onRoad?.routeId));
    const total = plan?.totalMiles ?? (sum ? sum.remainingMiles : 0);
    const done = sum ? Math.max(0, total - sum.remainingMiles) : 0;
    const pct = sum ? Math.round(sum.completedFraction * 100) : live ? Math.round(live.progress * 100) : 0;
    const paused = !!t && t.startedAt === null;
    const dayOver = !t && !!plan;
    const legIdx = live?.legIndex ?? plan?.currentLegIndex ?? 0;
    const ahead = plan ? plan.legs.slice(legIdx).map(l => nameOf(l.toLocationId)) : [];
    const destName = plan ? nameOf(plan.destinationLocationId) : curRoute ? nameOf(live?.reversed ? curRoute.fromLocationId : curRoute.toLocationId) : '?';
    journeyBox = (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-amber-200 text-sm font-semibold truncate">Bound for {destName}</p>
          <span className={cn('text-[11px] px-2 py-0.5 rounded-full shrink-0', dayOver ? 'bg-sky-500/20 text-sky-200' : paused ? 'bg-white/10 text-white/70' : view.legDone ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-200')}>
            {dayOver ? 'Day complete' : paused ? 'Paused' : view.legDone ? 'Day ended' : 'On the road'}
          </span>
        </div>
        <div className="h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-amber-400" style={{ width: `${pct}%` }} /></div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12px] text-white/70">
          {curRoute && <span className="col-span-2 truncate">Road: {nameOf(curRoute.fromLocationId)} – {nameOf(curRoute.toLocationId)}</span>}
          <span>Traveled: {miles(done)}</span>
          <span>Left: {sum ? miles(sum.remainingMiles) : '—'}</span>
          <span>Journey: {pct}%</span>
          <span>Day left: {t && !paused ? fmtMs((1 - (live?.fraction ?? 0)) * t.realDurationMs) : '—'}</span>
          <span>Pace: {PACE_LABEL[t?.pace ?? plan?.pace ?? usePace]}</span>
          <span>Terrain: ×{curRoute?.terrainFactor ?? 1}</span>
          {sum && <span className="col-span-2">In-world travel left: {fmtGameMin(sum.remainingMinutes)}</span>}
        </div>
        {ahead.length > 0 && <p className="text-[12px] text-white/60">Ahead: {ahead.join(' → ')}</p>}
        {dayOver && (
          <p className="text-[12px] rounded-lg bg-sky-500/10 border border-sky-400/30 text-sky-200 px-3 py-2">
            The travel day is over. {host ? 'Continue Journey starts the next travel day. It does not rest or heal anyone; handle rests at the table.' : 'The host decides when the party presses on.'}
          </p>
        )}
        {host && (
          <div className="grid grid-cols-3 gap-2 pt-1">
            {dayOver
              ? <Button disabled={busy} onClick={() => run(map.continueJourney, 'The party presses on.')} className="min-h-[44px]" style={TOUCH}><Play className="w-4 h-4 mr-1" />Continue</Button>
              : paused
                ? <Button disabled={busy} onClick={() => run(map.resumeTravel)} className="min-h-[44px]" style={TOUCH}><Play className="w-4 h-4 mr-1" />Resume</Button>
                : <Button disabled={busy} variant="secondary" onClick={() => run(map.pauseTravel)} className="min-h-[44px]" style={TOUCH}><Pause className="w-4 h-4 mr-1" />Pause</Button>}
            <Button disabled={busy} variant="outline" onClick={() => run(plan ? map.cancelJourney : map.cancelTravel, 'The party stops where it is.')} className="min-h-[44px]" style={TOUCH}><Square className="w-4 h-4 mr-1" />Stop</Button>
            <Button disabled={busy} variant="outline" onClick={() => run(map.finishTravelNow)} className="min-h-[44px]" style={TOUCH}><FastForward className="w-4 h-4 mr-1" />Finish</Button>
          </div>
        )}
      </div>
    );
  }

  // ── preview before departure ──
  let routeBox: ReactNode = null;
  if (preview) {
    const s = preview.summary;
    const multiDay = s.remainingMinutes > TRAVEL_DAY_MINUTES + 1e-6;
    routeBox = (
      <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
        <p className="text-white text-sm font-semibold flex items-center gap-1.5"><RouteIcon className="w-4 h-4 text-amber-300" />To {preview.location.name}</p>
        <p className="text-[12px] text-white/60">Via {s.locationNames.join(' → ')}</p>
        <p className="text-[12px] text-white/70">
          {preview.plan.legs.length} road{preview.plan.legs.length === 1 ? '' : 's'} · {miles(s.remainingMiles)} · {fmtGameMin(s.remainingMinutes)} in-world travel at {PACE_LABEL[usePace].toLowerCase()} pace
          ({fmtMs(gameToRealMs(s.remainingMinutes, state.realMinutesPerGameHour))} real travel time)
        </p>
        {multiDay && <p className="text-[12px] text-sky-200">Odyssey will stop the journey when the travel day ends. Continue after the party rests/chooses to press on.</p>}
        {host ? (
          <div className="flex gap-2">
            <Select value={usePace} onValueChange={(v) => setPace(v as TravelPace)}>
              <SelectTrigger className="min-h-[44px] flex-1"><SelectValue /></SelectTrigger>
              <SelectContent className="z-[200]">{PACES.map(p => <SelectItem key={p} value={p}>{PACE_LABEL[p]} ({TRAVEL_PACE_MPH[p]} mph)</SelectItem>)}</SelectContent>
            </Select>
            <Button disabled={busy} className="min-h-[44px] flex-1" style={TOUCH}
              onClick={() => run(() => map.startJourney(preview.location.id, usePace), 'The party sets out.').then(ok => { if (ok) setSelected(null); })}>Begin Journey</Button>
          </div>
        ) : <p className="text-[11px] text-white/50">The host starts the journey.</p>}
      </div>
    );
  }

  const highlight = plan
    ? remainingJourneyRouteIds(plan, (t ? travelDetail(t, Date.now()).legIndex : undefined) ?? plan.currentLegIndex)
    : preview ? preview.plan.legs.map(l => l.routeId) : undefined;
  const strong = t ? travelDetail(t, Date.now()).routeId : onRoad?.routeId ?? null;

  // Same element tree in both orientations so rotating never resets the chosen place or the countdown.
  return (
    <div className={cn(landscape ? 'grid h-full gap-3 grid-cols-[minmax(0,1fr)_minmax(230px,36%)] grid-rows-[auto_minmax(0,1fr)]' : 'flex flex-col gap-3')}
      style={landscape ? { gridTemplateAreas: '"map head" "map info"' } : undefined}>
      <div style={landscape ? { gridArea: 'head' } : undefined} className="flex items-center justify-between gap-2 text-[12px] text-white/70">
        <span className="font-cinzel text-amber-200 text-[13px]">{formatCampaignTime(view?.campaignMinute ?? state.campaignMinute)}</span>
        <span>{here ? byId.get(here)?.name : onRoad ? (onRoad.dayComplete ? 'Camped on the road' : 'On the road') : t ? 'Traveling' : 'Location unknown'}</span>
      </div>
      <div style={landscape ? { gridArea: 'map' } : undefined} className={cn('min-w-0', landscape ? 'order-none flex items-start justify-center overflow-hidden' : 'order-2')}>
      <MapCanvas state={state} showAll={host} fitHeight={landscape ? 'calc(100dvh - 4.25rem)' : undefined} partyDot={partyPoint(map, state)} selectedId={selected}
        highlightRouteId={strong} highlightRouteIds={highlight}
        onTapPin={(id) => {
          if (t || plan) return;
          const l = byId.get(id);
          if (reachableIds.has(id) || (host && l)) setSelected(id); else setSelected(null);
        }} />
      </div>
      <div style={landscape ? { gridArea: 'info' } : undefined} className={cn('space-y-3 min-h-0', landscape ? 'overflow-y-auto overflow-x-hidden pb-2 pr-0.5' : 'order-3')}>
      {onRoad?.dayComplete && !t && !plan && <p className="text-[12px] rounded-lg bg-sky-500/10 border border-sky-400/30 text-sky-200 px-3 py-2">The travel day is over. The party stopped partway along the road.</p>}
      {journeyBox}
      {routeBox}
      {selectedUnreachable && <p className="text-[12px] rounded-lg bg-white/5 border border-white/10 text-white/70 px-3 py-2">{nameOf(selected)}: No known route.</p>}
      {!t && !plan && reachable.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[12px] text-white/50">Destinations — tap one{host ? ' to see the route and set out' : ' to see the route'}.</p>
          <div className="flex flex-wrap gap-2">
            {reachable.map(r => (
              <button key={r.location.id} type="button" onClick={() => setSelected(r.location.id)} style={TOUCH}
                className={cn('min-h-[44px] px-3 rounded-lg border text-[12px] text-left', selected === r.location.id ? 'bg-amber-500/20 border-amber-400/50 text-amber-100' : 'bg-white/5 border-white/10 text-white/80')}>
                <span className="font-semibold">{r.location.name}</span>
                <span className="block text-[11px] text-white/50">{miles(r.summary.remainingMiles)} · {r.plan.legs.length} road{r.plan.legs.length === 1 ? '' : 's'}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {!t && !plan && reachable.length === 0 && (here || onRoad) && <p className="text-[12px] text-white/50">No known roads lead anywhere from here yet.</p>}
      </div>
    </div>
  );
}

// ───────────────────────── host setup ─────────────────────────

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2">
      <h3 className="font-cinzel text-amber-200 text-[13px]">{title}</h3>
      {children}
    </section>
  );
}

function HostSetup({ map, state, onInstallGuide, packUndo, setPackUndo }: { map: PartyCampaignMapApi; state: CampaignMapState | null; onInstallGuide?: CampaignMapPanelProps['onInstallGuide']; packUndo: MapPackUndo | null; setPackUndo: (u: MapPackUndo | null) => void }) {
  const [mode, setMode] = useState<Mode>({ kind: 'none' });
  const [calMiles, setCalMiles] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const s = state;
  const byId = useMemo(() => new Map((s?.locations ?? []).map(l => [l.id, l])), [s?.locations]);
  const cal = s ? activeCalibration(s) : null;
  const report = (r: { ok: boolean; error?: string }, ok?: string) => { if (!r.ok) toast.error((r as { error: string }).error); else if (ok) toast.success(ok); return r.ok; };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    const r = await map.uploadMapImage(file);
    setBusy(false);
    if (report(r, 'Map image saved.') && s?.mapCalibration) toast.warning('New image: the old map scale no longer applies. Calibrate again.');
  };

  const tapMap = async (p: MapPoint) => {
    if (!s) return;
    if (mode.kind === 'calibA') setMode({ kind: 'calibB', a: p });
    else if (mode.kind === 'calibB') setMode({ kind: 'calibMiles', a: mode.a, b: p });
    else if (mode.kind === 'pin') {
      const locations = s.locations.map(l => (l.id === mode.locationId ? { ...l, x: p.x, y: p.y } : l));
      const nextById = new Map(locations.map(l => [l.id, l]));
      const routes = s.routes.map(r => (r.fromLocationId === mode.locationId || r.toLocationId === mode.locationId) ? withRoutePath(r, routePath(r, nextById), cal) : r);
      setMode({ kind: 'none' });
      report(await map.replaceLocationsAndRoutes(locations, routes), 'Pin placed.');
    } else if (mode.kind === 'path') {
      const r = s.routes.find(x => x.id === mode.routeId);
      if (!r) return;
      const pts = routePath(r, byId);
      if (pts.length < 2) { toast.error('Pin both ends of this road first.'); return; }
      const path = [...pts.slice(0, -1), p, pts[pts.length - 1]];
      report(await map.editRoute(r.id, withRoutePath(r, path, cal)));
    }
  };

  const saveCalibration = async () => {
    if (mode.kind !== 'calibMiles' || !s?.imageNaturalWidth || !s.imageNaturalHeight) return;
    const n = Number(calMiles);
    if (!Number.isFinite(n) || n <= 0) { toast.error('Enter the real distance in miles.'); return; }
    const c = createCalibration(mode.a, mode.b, s.imageNaturalWidth, s.imageNaturalHeight, n);
    if (!c) { toast.error('Those two points are too close together.'); return; }
    if (report(await map.setCalibration(c), 'Map scale saved.')) { setMode({ kind: 'none' }); setCalMiles(''); }
  };

  const exportJson = () => {
    const snap = map.exportSaveSnapshot();
    if (!snap) return;
    const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = map.isAtlasMode ? 'campaign-map-collection.json' : 'campaign-map.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const importJson = async (file: File | undefined) => {
    if (!file) return;
    try {
      // Validated inside restore before anything changes; files always get fresh map ids.
      const parsed: unknown = JSON.parse(await file.text());
      report(await map.restoreSaveSnapshot(parsed, 'portable'), 'Map imported.');
    } catch { toast.error('That file is not a campaign map.'); }
  };

  if (!s) {
    return (
      <div className="text-center py-10 space-y-3">
        <p className="text-white/70 text-sm">Start a campaign map for this party.</p>
        <Button className="min-h-[48px]" style={TOUCH} onClick={async () => report(await map.initialize())}>Create map</Button>
        <div className="text-left pt-4"><Section title="Or install a Map Pack"><MapPackAssistant map={map} current={null} onInstallGuide={onInstallGuide} undo={packUndo} setUndo={setPackUndo} /></Section></div>
      </div>
    );
  }

  const tapHint = mode.kind === 'calibA' ? 'Tap the first point of a known distance.'
    : mode.kind === 'calibB' ? 'Now tap the second point.'
    : mode.kind === 'pin' ? `Tap where ${byId.get(mode.locationId)?.name ?? 'this place'} goes.`
    : mode.kind === 'path' ? 'Tap the map to add bends to the road.' : null;
  const unpinned = s.locations.filter(l => !ownPin(l));
  const pathRoute = mode.kind === 'path' ? s.routes.find(r => r.id === mode.routeId) : undefined;

  return (
    <div className="space-y-3 pb-6">
      {s.imageUrl && (
        <div className="sticky top-0 z-10 bg-[#0b0b10] pb-2 space-y-2">
          {tapHint && (
            <div className="flex items-center justify-between gap-2 rounded-lg bg-sky-500/15 border border-sky-400/40 px-3 py-2">
              <span className="text-[12px] text-sky-100 flex items-center gap-1.5"><Crosshair className="w-4 h-4" />{tapHint}</span>
              <Button size="sm" variant="ghost" className="min-h-[44px]" style={TOUCH} onClick={() => setMode({ kind: 'none' })}>Done</Button>
            </div>
          )}
          <MapCanvas state={s} showAll editor partyDot={partyPoint(map, s)} onTapMap={mode.kind === 'none' || mode.kind === 'calibMiles' ? undefined : tapMap}
            highlightRouteId={pathRoute?.id ?? null}
            extraPoints={mode.kind === 'calibB' ? [mode.a] : mode.kind === 'calibMiles' ? [mode.a, mode.b] : pathRoute ? routePath(pathRoute, byId).slice(1, -1) : undefined} />
          {pathRoute && cal && <p className="text-[12px] text-white/60">Traced length: {miles(polylineMiles(routePath(pathRoute, byId), cal) ?? 0)}</p>}
        </div>
      )}

      <Section title="Map image">
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ''; }} />
        <Button disabled={busy} variant="secondary" className="w-full min-h-[48px]" style={TOUCH} onClick={() => fileRef.current?.click()}>
          <Upload className="w-4 h-4 mr-2" />{busy ? 'Uploading…' : s.imageUrl ? 'Replace map image' : 'Upload map image'}
        </Button>
        {s.imageNaturalWidth && <p className="text-[11px] text-white/50">Image size: {s.imageNaturalWidth} × {s.imageNaturalHeight}px</p>}
      </Section>

      {s.imageUrl && (
        <Section title="Map scale">
          {cal ? <p className="text-[12px] text-emerald-300">Calibrated: {cal.knownMiles} mi between two points.</p>
            : <p className="text-[12px] text-amber-300">{s.mapCalibration ? 'The image changed, so the old scale no longer applies. Calibrate again.' : 'Not calibrated. Roads need a typed distance until you calibrate.'}</p>}
          {mode.kind === 'calibMiles' ? (
            <div className="flex gap-2">
              <Input inputMode="decimal" placeholder="Real miles between the points" value={calMiles} onChange={(e) => setCalMiles(e.target.value)} className="min-h-[44px]" />
              <Button className="min-h-[44px]" style={TOUCH} onClick={saveCalibration}>Save</Button>
            </div>
          ) : (
            <Button variant="outline" className="w-full min-h-[44px]" style={TOUCH} onClick={() => setMode({ kind: 'calibA' })}>Calibrate map</Button>
          )}
        </Section>
      )}

      <Section title="Clock and pace">
        <ClockEditor map={map} state={s} />
      </Section>

      <Section title={`Places (${s.locations.length})`}>
        {unpinned.length > 0 && <p className="text-[12px] text-amber-300">{unpinned.length} not on the map yet: {unpinned.slice(0, 6).map(l => l.name).join(', ')}{unpinned.length > 6 ? ` (+${unpinned.length - 6} more)` : ''}</p>}
        {s.locations.map(l => (
          <LocationCard key={l.id} loc={l} state={s} map={map} pinning={mode.kind === 'pin' && mode.locationId === l.id}
            onPin={() => (s.imageUrl ? setMode({ kind: 'pin', locationId: l.id }) : toast.error('Upload a map image first.'))} />
        ))}
        <Button variant="secondary" className="w-full min-h-[48px]" style={TOUCH}
          onClick={async () => report(await map.addLocation({ id: newId('loc'), name: `New place ${s.locations.length + 1}`, x: null, y: null, discovered: false, kind: 'town' }))}>
          <MapPin className="w-4 h-4 mr-2" />Add place
        </Button>
      </Section>

      <Section title={`Roads (${s.routes.length})`}>
        {s.routes.map(r => (
          <RouteCard key={r.id} route={r} state={s} map={map} editingPath={mode.kind === 'path' && mode.routeId === r.id}
            onEditPath={() => setMode(mode.kind === 'path' && mode.routeId === r.id ? { kind: 'none' } : { kind: 'path', routeId: r.id })} />
        ))}
        <AddRoute map={map} state={s} />
      </Section>

      <Section title="Import and export">
        <input ref={importRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { void importJson(e.target.files?.[0]); e.target.value = ''; }} />
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="min-h-[44px]" style={TOUCH} onClick={exportJson}><Download className="w-4 h-4 mr-1" />{map.isAtlasMode ? 'Export full collection' : 'Export'}</Button>
          <Button variant="outline" className="min-h-[44px]" style={TOUCH} onClick={() => importRef.current?.click()}><Upload className="w-4 h-4 mr-1" />Import</Button>
        </div>
        <p className="text-[11px] text-white/45">{map.isAtlasMode
          ? 'Export saves every map in the collection. Importing a full collection backup replaces all of them; single-map files cannot be imported into a collection yet. Travel comes back paused.'
          : 'Imported places keep their pins only if the file has them. Travel comes back paused.'}</p>
      </Section>

      <Section title="Map Pack Assistant">
        <MapPackAssistant map={map} current={s} onInstallGuide={onInstallGuide} undo={packUndo} setUndo={setPackUndo} />
      </Section>
    </div>
  );
}

function ClockEditor({ map, state }: { map: PartyCampaignMapApi; state: CampaignMapState }) {
  const day = Math.floor(state.campaignMinute / 1440) + 1;
  const inDay = Math.floor(state.campaignMinute % 1440);
  const [d, setD] = useState(String(day));
  const [time, setTime] = useState(`${String(Math.floor(inDay / 60)).padStart(2, '0')}:${String(inDay % 60).padStart(2, '0')}`);
  const [custom, setCustom] = useState(String(state.realMinutesPerGameHour));
  useEffect(() => { setD(String(day)); setTime(`${String(Math.floor(inDay / 60)).padStart(2, '0')}:${String(inDay % 60).padStart(2, '0')}`); }, [day, inDay]);
  useEffect(() => setCustom(String(state.realMinutesPerGameHour)), [state.realMinutesPerGameHour]);
  const saveClock = async () => {
    const dn = Number(d); const [hh, mm] = time.split(':').map(Number);
    if (!Number.isFinite(dn) || dn < 1 || !Number.isFinite(hh) || !Number.isFinite(mm)) { toast.error('That time is not valid.'); return; }
    const r = await map.setCampaignClock((dn - 1) * 1440 + hh * 60 + mm);
    if (!r.ok) toast.error((r as { error: string }).error);
  };
  const preset = TIME_COMPRESSION_PRESETS.find(p => p.realMinutesPerGameHour === state.realMinutesPerGameHour)?.id ?? 'custom';
  const setRate = async (n: number) => { const r = await map.setTimeCompression(n); if (!r.ok) toast.error((r as { error: string }).error); };
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[11px] text-white/50">Day<Input inputMode="numeric" value={d} onChange={(e) => setD(e.target.value)} onBlur={saveClock} className="min-h-[44px] mt-1" /></label>
        <label className="text-[11px] text-white/50">Time<Input type="time" value={time} onChange={(e) => setTime(e.target.value)} onBlur={saveClock} className="min-h-[44px] mt-1" /></label>
      </div>
      <label className="block text-[11px] text-white/50">Real time per in-world hour
        <Select value={preset} onValueChange={(v) => { const p = TIME_COMPRESSION_PRESETS.find(x => x.id === v); if (p) void setRate(p.realMinutesPerGameHour); }}>
          <SelectTrigger className="min-h-[44px] mt-1"><SelectValue /></SelectTrigger>
          <SelectContent className="z-[200]">
            {TIME_COMPRESSION_PRESETS.map(p => <SelectItem key={p.id} value={p.id}>{p.label} ({p.realMinutesPerGameHour} min)</SelectItem>)}
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
      </label>
      <label className="block text-[11px] text-white/50">Custom real minutes per in-world hour
        <Input inputMode="decimal" value={custom} onChange={(e) => setCustom(e.target.value)} onBlur={() => { const n = Number(custom); if (n !== state.realMinutesPerGameHour) void setRate(n); }} className="min-h-[44px] mt-1" />
      </label>
      <label className="block text-[11px] text-white/50">Default pace
        <Select value={state.defaultPace} onValueChange={async (v) => { const r = await map.setDefaultPace(v as TravelPace); if (!r.ok) toast.error((r as { error: string }).error); }}>
          <SelectTrigger className="min-h-[44px] mt-1"><SelectValue /></SelectTrigger>
          <SelectContent className="z-[200]">{PACES.map(p => <SelectItem key={p} value={p}>{PACE_LABEL[p]} ({TRAVEL_PACE_MPH[p]} mph)</SelectItem>)}</SelectContent>
        </Select>
      </label>
    </div>
  );
}

function LocationCard({ loc, state, map, pinning, onPin }: { loc: CampaignMapLocation; state: CampaignMapState; map: PartyCampaignMapApi; pinning: boolean; onPin: () => void }) {
  const [name, setName] = useState(loc.name);
  const [region, setRegion] = useState(loc.region ?? '');
  const [desc, setDesc] = useState(loc.description ?? '');
  useEffect(() => { setName(loc.name); setRegion(loc.region ?? ''); setDesc(loc.description ?? ''); }, [loc.name, loc.region, loc.description]);
  const edit = async (patch: Partial<CampaignMapLocation>) => { const r = await map.editLocation(loc.id, patch); if (!r.ok) toast.error((r as { error: string }).error); };
  const pinned = !!ownPin(loc);
  const here = state.currentLocationId === loc.id;
  return (
    <div className={cn('rounded-lg border p-2.5 space-y-2', pinning ? 'border-sky-400/60' : 'border-white/10', !pinned && 'bg-amber-500/5')}>
      <Input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name !== loc.name && edit({ name: name.trim() })} className="min-h-[44px] font-semibold" />
      <div className="grid grid-cols-2 gap-2">
        <Select value={loc.kind} onValueChange={(v) => edit({ kind: v as LocationKind })}>
          <SelectTrigger className="min-h-[44px]"><SelectValue /></SelectTrigger>
          <SelectContent className="z-[200]">{LOCATION_KINDS.map(k => <SelectItem key={k} value={k}>{k[0].toUpperCase() + k.slice(1)}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={loc.parentLocationId ?? '__none'} onValueChange={(v) => edit({ parentLocationId: v === '__none' ? undefined : v })}>
          <SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Inside…" /></SelectTrigger>
          <SelectContent className="z-[200]">
            <SelectItem value="__none">Not inside another place</SelectItem>
            {state.locations.filter(l => l.id !== loc.id).map(l => <SelectItem key={l.id} value={l.id}>Inside {l.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <label className="block text-[11px] text-white/50">Display on map
        <Select value={locationOverlayMode(loc)} onValueChange={(v) => edit({ overlayMode: v as CampaignMapLocation['overlayMode'] })}>
          <SelectTrigger className="min-h-[44px] mt-1"><SelectValue /></SelectTrigger>
          <SelectContent className="z-[200]">
            <SelectItem value="full">Full (pin and name)</SelectItem>
            <SelectItem value="pin">Pin only</SelectItem>
            <SelectItem value="background">Atlas background (printed on the map)</SelectItem>
          </SelectContent>
        </Select>
      </label>
      <Input placeholder="Region" value={region} maxLength={80} onChange={(e) => setRegion(e.target.value)} onBlur={() => region !== (loc.region ?? '') && edit({ region: region.trim() || undefined })} className="min-h-[44px]" />
      <div>
        <Textarea placeholder="Description" value={desc} maxLength={600} onChange={(e) => setDesc(e.target.value)} onBlur={() => desc !== (loc.description ?? '') && edit({ description: desc.trim() || undefined })} className="min-h-[64px] text-[13px]" />
        <p className="text-[10px] text-white/40 text-right">{desc.length}/600</p>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-white/70">Players can see it</span>
        <Switch checked={loc.discovered} onCheckedChange={async (v) => { const r = await map.setDiscovered(loc.id, v); if (!r.ok) toast.error((r as { error: string }).error); }} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Button size="sm" variant="secondary" className="min-h-[44px]" style={TOUCH} onClick={onPin}>{pinned ? 'Move pin' : 'Pin'}</Button>
        <Button size="sm" variant={here ? 'default' : 'outline'} className="min-h-[44px]" style={TOUCH}
          onClick={async () => { const r = await map.setCurrentLocation(loc.id); if (!r.ok) toast.error((r as { error: string }).error); }}>{here ? 'Party here' : 'Put party here'}</Button>
        <Button size="sm" variant="outline" className="min-h-[44px] text-rose-300" style={TOUCH}
          onClick={async () => { const r = await map.removeLocation(loc.id); if (!r.ok) toast.error((r as { error: string }).error); }}><Trash2 className="w-4 h-4" /></Button>
      </div>
      {!pinned && <p className="text-[11px] text-amber-300/80">Not on the map yet{loc.parentLocationId ? ' (shown at its parent place)' : ''}.</p>}
    </div>
  );
}

function RouteCard({ route, state, map, editingPath, onEditPath }: { route: CampaignMapRoute; state: CampaignMapState; map: PartyCampaignMapApi; editingPath: boolean; onEditPath: () => void }) {
  const byId = new Map(state.locations.map(l => [l.id, l]));
  const cal = activeCalibration(state);
  const path = routePath(route, byId);
  const est = polylineMiles(path, cal);
  const [manual, setManual] = useState(route.distanceSource === 'manual' ? String(route.distanceMiles || '') : '');
  const [terrain, setTerrain] = useState(String(route.terrainFactor));
  const [desc, setDesc] = useState(route.description ?? '');
  useEffect(() => { setTerrain(String(route.terrainFactor)); setDesc(route.description ?? ''); }, [route.terrainFactor, route.description]);
  const edit = async (patch: Partial<CampaignMapRoute>) => { const r = await map.editRoute(route.id, patch); if (!r.ok) toast.error((r as { error: string }).error); };
  const effective = effectiveRouteMiles(route, cal);
  const waypoints = path.slice(1, -1);
  return (
    <div className={cn('rounded-lg border p-2.5 space-y-2', editingPath ? 'border-sky-400/60' : 'border-white/10')}>
      <p className="text-[13px] text-white font-semibold">{byId.get(route.fromLocationId)?.name ?? '?'} ↔ {byId.get(route.toLocationId)?.name ?? '?'}</p>
      <p className={cn('text-[12px]', effective === null ? 'text-rose-300' : 'text-white/60')}>
        {effective === null ? 'Needs a distance' : `Distance used: ${miles(effective)} (${route.distanceSource === 'manual' ? 'typed' : 'map estimate'})`}
        {est !== null && ` · traced ${miles(est)}`}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" variant={route.distanceSource === 'calibrated' ? 'default' : 'outline'} disabled={!cal} className="min-h-[44px]" style={TOUCH}
          onClick={() => edit({ ...withRoutePath({ ...route, distanceSource: 'calibrated' }, path, cal), distanceSource: 'calibrated' })}>Use map estimate</Button>
        <Button size="sm" variant={route.distanceSource === 'manual' ? 'default' : 'outline'} className="min-h-[44px]" style={TOUCH}
          onClick={() => edit({ distanceSource: 'manual', distanceMiles: Number(manual) > 0 ? Number(manual) : route.distanceMiles })}>Typed miles</Button>
      </div>
      {(route.distanceSource === 'manual' || !cal) && (
        <Input inputMode="decimal" placeholder="Miles" value={manual} onChange={(e) => setManual(e.target.value)}
          onBlur={() => { const n = Number(manual); if (Number.isFinite(n) && n > 0) void edit({ distanceSource: 'manual', distanceMiles: n }); }} className="min-h-[44px]" />
      )}
      <label className="block text-[11px] text-white/50">Terrain (1 = open road, 1.5 hills, 2 forest)
        <Input inputMode="decimal" value={terrain} onChange={(e) => setTerrain(e.target.value)}
          onBlur={() => { const n = Number(terrain); if (Number.isFinite(n) && n > 0 && n <= 10 && n !== route.terrainFactor) void edit({ terrainFactor: n }); }} className="min-h-[44px] mt-1" />
      </label>
      <label className="block text-[11px] text-white/50">Display on map
        <Select value={routeOverlayMode(route)} onValueChange={(v) => edit({ overlayMode: v as CampaignMapRoute['overlayMode'] })}>
          <SelectTrigger className="min-h-[44px] mt-1"><SelectValue /></SelectTrigger>
          <SelectContent className="z-[200]">
            <SelectItem value="full">Full (draw the road)</SelectItem>
            <SelectItem value="background">Atlas background (only show when chosen)</SelectItem>
          </SelectContent>
        </Select>
      </label>
      <Textarea placeholder="Road description" value={desc} maxLength={400} onChange={(e) => setDesc(e.target.value)}
        onBlur={() => desc !== (route.description ?? '') && edit({ description: desc.trim() || undefined })} className="min-h-[56px] text-[13px]" />
      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" variant={editingPath ? 'default' : 'secondary'} className="min-h-[44px]" style={TOUCH} onClick={onEditPath}>{editingPath ? 'Done tracing' : 'Trace road'}</Button>
        <Button size="sm" variant="outline" className="min-h-[44px] text-rose-300" style={TOUCH}
          onClick={async () => { const r = await map.removeRoute(route.id); if (!r.ok) toast.error((r as { error: string }).error); }}><Trash2 className="w-4 h-4 mr-1" />Remove</Button>
      </div>
      {editingPath && waypoints.length > 0 && (
        <div className="space-y-1">
          {waypoints.map((_, i) => (
            <div key={i} className="flex items-center justify-between text-[12px] text-white/70">
              <span>Bend {i + 1}</span>
              <Button size="sm" variant="ghost" className="min-h-[44px]" style={TOUCH}
                onClick={() => edit(withRoutePath(route, [path[0], ...waypoints.filter((__, j) => j !== i), path[path.length - 1]], cal))}>Remove</Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AddRoute({ map, state }: { map: PartyCampaignMapApi; state: CampaignMapState }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [manual, setManual] = useState('');
  const cal = activeCalibration(state);
  const byId = new Map(state.locations.map(l => [l.id, l]));
  if (state.locations.length < 2) return <p className="text-[12px] text-white/50">Add at least two places to connect them with a road.</p>;
  const add = async () => {
    if (!from || !to || from === to) { toast.error('Pick two different places.'); return; }
    const a = resolvePin(byId.get(from), byId), b = resolvePin(byId.get(to), byId);
    const path = a && b ? [a, b] : [];
    const n = Number(manual);
    const useManual = Number.isFinite(n) && n > 0;
    const est = polylineMiles(path, cal);
    if (!useManual && est === null) { toast.error('Type the distance in miles (the map is not calibrated or the ends are not pinned).'); return; }
    const route: CampaignMapRoute = {
      id: newId('road'), fromLocationId: from, toLocationId: to, terrainFactor: 1, path,
      distanceSource: useManual ? 'manual' : 'calibrated', distanceMiles: useManual ? n : est!, ...(est !== null ? { calibratedDistanceMiles: est } : {}),
    };
    const r = await map.addRoute(route);
    if (!r.ok) toast.error((r as { error: string }).error); else { setFrom(''); setTo(''); setManual(''); }
  };
  return (
    <div className="rounded-lg border border-dashed border-white/15 p-2.5 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {[{ v: from, set: setFrom, ph: 'From' }, { v: to, set: setTo, ph: 'To' }].map(f => (
          <Select key={f.ph} value={f.v} onValueChange={f.set}>
            <SelectTrigger className="min-h-[44px]"><SelectValue placeholder={f.ph} /></SelectTrigger>
            <SelectContent className="z-[200]">{state.locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
          </Select>
        ))}
      </div>
      <Input inputMode="decimal" placeholder={cal ? 'Miles (optional, overrides the map)' : 'Miles (required)'} value={manual} onChange={(e) => setManual(e.target.value)} className="min-h-[44px]" />
      <Button variant="secondary" className="w-full min-h-[48px]" style={TOUCH} onClick={add}><RouteIcon className="w-4 h-4 mr-2" />Add road</Button>
    </div>
  );
}
