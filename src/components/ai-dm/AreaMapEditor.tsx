// Nested area maps: browse, upload area maps for places, edit each map's places, and (host only)
// move the party in/out. Browsing changes only what THIS phone shows.

import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, ChevronRight, DoorOpen, Eye, ImagePlus, LogOut, MapPin, Navigation, ScrollText, Trash2, Upload, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { PartyCampaignMapApi } from '@/hooks/use-party-campaign-map';
import { childAt, getNode, resolveAtlasAt, type CampaignAtlas } from '@/lib/campaign-atlas';
import { resolveGuideScopes } from '@/lib/location-guides';
import type { CampaignMapLocation, CampaignMapState } from '@/lib/campaign-map';
import { LocationGuideEditor, guideStatus, usePartyLocationGuides, type GuideRow } from './LocationGuideEditor';

const TOUCH = { touchAction: 'manipulation' as const };
const newId = () => `loc-${crypto.randomUUID().slice(0, 8)}`;
const busy = (s: CampaignMapState) => !!(s.activeTravel || s.journeyPlan);

type GuideTarget = { mapId: string; scope: 'map' | 'location'; locationId: string | null; title: string };

export function AreaMapEditor({ map, partyId }: { map: PartyCampaignMapApi; partyId: string | null }) {
  const host = map.canWrite;
  const atlas = map.atlas as CampaignAtlas | null;
  const resolved = useMemo(() => (atlas ? resolveAtlasAt(atlas, map.serverNow()) : null), [atlas, map]);
  const viewedId = map.viewedMapId as string | null;
  const viewedNode = atlas && viewedId ? getNode(atlas, viewedId) : null;
  const state: CampaignMapState | null = viewedNode ? viewedNode.state : map.rawState;
  const guides = usePartyLocationGuides(partyId, host);
  const [guideFor, setGuideFor] = useState<GuideTarget | null>(null);
  const [pinFor, setPinFor] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [busyOp, setBusyOp] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingUpload = useRef<{ kind: 'child'; locId: string; name: string } | { kind: 'replace'; mapId: string } | null>(null);

  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg?: string) => {
    if (busyOp) return false;
    setBusyOp(true);
    try {
      const r = await fn();
      if (!r.ok) { toast.error((r as { error: string }).error || 'That could not be saved.'); return false; }
      if (okMsg) toast.success(okMsg);
      return true;
    } finally { setBusyOp(false); }
  };

  const pickFile = (p: NonNullable<typeof pendingUpload.current>) => { pendingUpload.current = p; fileRef.current?.click(); };
  const onFile = async (file: File | undefined) => {
    const p = pendingUpload.current; pendingUpload.current = null;
    if (!file || !p) return;
    if (p.kind === 'child') await run(() => map.addAreaMap(viewedId, p.locId, file, p.name), `Area map added for ${p.name}. The party has not moved.`);
    else await run(() => map.replaceAreaImage(p.mapId, file), 'Picture replaced. Distance calibration was reset for this map; places were kept.');
  };

  const activeId = resolved?.activeMapId ?? null;
  const partyPath = resolved && activeId ? map.getBreadcrumbs(activeId) : [];
  const viewPath = atlas && viewedId ? map.getBreadcrumbs(viewedId) : [];
  const browsing = !!atlas && viewedId !== activeId;
  const activeState = resolved && activeId ? getNode(resolved, activeId)?.state ?? null : null;
  const partyHere = (locId: string) => viewedId === activeId && activeState?.currentLocationId === locId && !!activeState && !busy(activeState);
  const guidePath = useMemo(() => { if (!resolved) return null; const r = resolveGuideScopes(resolved); return r.ok ? r.scopes.map(s => s.label) : null; }, [resolved]);

  const editViewed = (fn: (s: CampaignMapState) => CampaignMapState | string, msg?: string) =>
    viewedId ? run(() => map.editMap(viewedId, fn), msg) : Promise.resolve(false);

  const status = (mapId: string, scope: 'map' | 'location', locId: string | null) =>
    guideStatus(resolved, mapId, scope, locId, guides.find(mapId, scope, locId));

  if (!state) return <p className="text-white/60 text-[14px]">There is no map yet. Upload one in Host Setup first.</p>;

  const locs = state.locations;
  const childOf = (locId: string) => (atlas && viewedId ? childAt(atlas, viewedId, locId) : undefined);
  const isEntrance = (locId: string) => !!childOf(locId) && !!atlas && (() => {
    // An entrance on the party's path can't be removed.
    let n = getNode(atlas, atlas.activeMapId); while (n) { if (n.parentMapId === viewedId && n.parentLocationId === locId) return true; n = n.parentMapId ? getNode(atlas, n.parentMapId) : undefined; } return false;
  })();

  const guideBlock = (t: GuideTarget) => partyId && guideFor && guideFor.mapId === t.mapId && guideFor.scope === t.scope && guideFor.locationId === t.locationId ? (
    <LocationGuideEditor key={`${t.mapId}|${t.locationId}`} partyId={partyId} mapId={t.mapId} scope={t.scope} locationId={t.locationId} defaultTitle={t.title}
      row={guides.find(t.mapId, t.scope, t.locationId)} status={status(t.mapId, t.scope, t.locationId)}
      onSaved={(r: GuideRow) => guides.setRows(rs => [...rs.filter(x => x.id !== r.id), r])} onClose={() => setGuideFor(null)} />
  ) : null;

  return (
    <div className="space-y-4 pb-6" data-vaul-no-drag>
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; void onFile(f); }} />

      {atlas && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-3.5 space-y-2">
          <p className="text-[13px] text-white/80 flex items-center gap-2"><Users className="w-4 h-4 text-amber-300" />
            <span>Party is in: <span className="text-amber-200">{partyPath.map(p => p.name).join(' › ') || '—'}</span></span></p>
          <div className="text-[13px] text-white/80 flex items-center gap-1 flex-wrap"><Eye className="w-4 h-4 text-sky-300 mr-1" /> Viewing:
            {viewPath.map((p, i) => (
              <span key={p.mapId} className="flex items-center">
                {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-white/40" />}
                <button style={TOUCH} className="px-2 min-h-[40px] text-sky-200 underline-offset-2 hover:underline" onClick={() => map.setViewedMapId(p.mapId)}>{p.name}</button>
              </span>
            ))}
          </div>
          {browsing && (
            <Button className="w-full min-h-[48px]" variant="secondary" style={TOUCH} onClick={() => map.setViewedMapId(null)}>
              <Navigation className="w-4 h-4 mr-2" /> Return to party
            </Button>
          )}
          {viewedNode?.parentMapId && (
            <Button className="w-full min-h-[48px]" variant="outline" style={TOUCH} onClick={() => map.setViewedMapId(viewedNode.parentMapId)}>
              <ArrowLeft className="w-4 h-4 mr-2" /> View the map around this area
            </Button>
          )}
          {host && guidePath && <p className="text-[12px] text-white/50">DM guide path (host only): {guidePath.join(' → ')}</p>}
        </div>
      )}

      {/* picture with tap-to-pin */}
      {state.imageUrl && (
        <div className={cn('relative w-full rounded-xl overflow-hidden border border-white/10 select-none', pinFor && 'ring-2 ring-amber-400')}
          style={TOUCH} data-vaul-no-drag
          onPointerUp={e => {
            if (!pinFor || !host) return;
            const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
            const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
            const id = pinFor; setPinFor(null);
            void editViewed(s => ({ ...s, locations: s.locations.map(l => (l.id === id ? { ...l, x, y } : l)) }), 'Pin placed');
          }}>
          <img src={state.imageUrl} alt={viewedNode?.name || 'Map'} className="block w-full h-auto pointer-events-none" draggable={false} />
          {locs.filter(l => l.x !== null && l.y !== null && (host || l.discovered)).map(l => (
            <span key={l.id} className={cn('absolute -translate-x-1/2 -translate-y-full text-[11px] px-1.5 py-0.5 rounded bg-black/70 border pointer-events-none whitespace-nowrap',
              activeState?.currentLocationId === l.id && viewedId === activeId ? 'border-amber-400 text-amber-200' : 'border-white/20 text-white/85')}
              style={{ left: `${(l.x as number) * 100}%`, top: `${(l.y as number) * 100}%` }}>{l.name}</span>
          ))}
        </div>
      )}
      {pinFor && <p className="text-[13px] text-amber-200">Tap the picture where this place is.</p>}

      {/* map settings (host, atlas only) */}
      {host && viewedNode && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-3.5 space-y-3">
          <p className="font-cinzel text-amber-300 text-[14px]">This map</p>
          <Input defaultValue={viewedNode.name} key={viewedNode.id} maxLength={120} className="min-h-[48px] text-[15px]"
            onBlur={e => { const v = e.target.value.trim(); if (v && v !== viewedNode.name) void run(() => map.editMapMeta(viewedNode.id, { name: v }), 'Name saved'); }} />
          <div className="grid grid-cols-1 gap-2">
            <label className="text-[13px] text-white/70">How the party moves here</label>
            <Select value={viewedNode.navigationMode === 'local' ? 'local' : state.travelScale === 'city' ? 'city' : 'regional'}
              onValueChange={v => void run(async () => {
                const id = viewedNode.id;
                const mode = v === 'local' ? 'local' : 'regional';
                if (viewedNode.navigationMode !== mode) { const r = await map.editMapMeta(id, { navigationMode: mode }); if (!r.ok) return r; }
                return map.editMap(id, st => {
                  if (st.activeTravel || st.journeyPlan) return 'Finish or stop the current trip before changing the travel style.';
                  const next = { ...st }; if (v === 'city') next.travelScale = 'city'; else delete next.travelScale; return next;
                });
              }, v === 'city' ? 'City streets: trips take minutes, no travel days.' : undefined)}>
              <SelectTrigger className="min-h-[48px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="local">Local area (walk between rooms, no travel time)</SelectItem>
                <SelectItem value="city">City streets (walk the streets; minutes, yards)</SelectItem>
                <SelectItem value="regional">Regional travel (roads, miles, travel days)</SelectItem>
              </SelectContent>
            </Select>
            {viewedNode.parentMapId && (<>
              <label className="text-[13px] text-white/70">Arrival point when entering</label>
              <Select value={viewedNode.entryLocationId ?? '__none'} onValueChange={v => void run(() => map.editMapMeta(viewedNode.id, { entryLocationId: v === '__none' ? null : v }))}>
                <SelectTrigger className="min-h-[48px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">No set arrival point</SelectItem>
                  {locs.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </>)}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="min-h-[48px]" style={TOUCH} disabled={busyOp} onClick={() => pickFile({ kind: 'replace', mapId: viewedNode.id })}>
              <ImagePlus className="w-4 h-4 mr-2" /> Replace picture
            </Button>
            <Button variant="outline" className="min-h-[48px]" style={TOUCH} onClick={() => setGuideFor({ mapId: viewedNode.id, scope: 'map', locationId: null, title: `${viewedNode.name} — area guide` })}>
              <ScrollText className="w-4 h-4 mr-2" /> Area guide
            </Button>
          </div>
          {guideBlock({ mapId: viewedNode.id, scope: 'map', locationId: null, title: `${viewedNode.name} — area guide` })}
          {viewedId === activeId && viewedNode.parentMapId && (
            <Button className="w-full min-h-[48px]" variant="secondary" style={TOUCH} disabled={busyOp || !!(activeState && busy(activeState))}
              onClick={() => void run(() => map.exitToParentMap(), 'The party left the area.')}>
              <LogOut className="w-4 h-4 mr-2" /> Leave area (party returns to the entrance)
            </Button>
          )}
        </div>
      )}

      {/* places */}
      <div className="space-y-2">
        <p className="font-cinzel text-amber-300 text-[14px]">Places on this map</p>
        {!atlas && host && <p className="text-[12px] text-white/55">Adding an area map turns this map into the top of a collection. The whole map is kept and the party does not move.</p>}
        {locs.filter(l => host || l.discovered).map((l: CampaignMapLocation) => {
          const child = childOf(l.id);
          const localMode = viewedNode?.navigationMode === 'local';
          return (
            <div key={l.id} className="rounded-xl border border-white/10 bg-white/5 p-3.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[15px] text-white/90 flex items-center gap-2 min-w-0"><MapPin className="w-4 h-4 shrink-0 text-amber-300" /><span className="truncate">{l.name}</span></p>
                {host && viewedNode && (
                  <label className="flex items-center gap-2 text-[12px] text-white/70 min-h-[44px] shrink-0">
                    <Switch checked={l.discovered} onCheckedChange={v => void editViewed(s => ({ ...s, locations: s.locations.map(x => (x.id === l.id ? { ...x, discovered: v } : x)) }))} /> Known
                  </label>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {child && (
                  <Button variant="outline" className="min-h-[48px]" style={TOUCH} onClick={() => map.setViewedMapId(child.id)}>
                    <Eye className="w-4 h-4 mr-2" /> View area map
                  </Button>
                )}
                {host && !child && (
                  <Button variant="outline" className="min-h-[48px]" style={TOUCH} disabled={busyOp} onClick={() => pickFile({ kind: 'child', locId: l.id, name: l.name })}>
                    <Upload className="w-4 h-4 mr-2" /> Upload area map
                  </Button>
                )}
                {host && child && (
                  <Button variant="outline" className="min-h-[48px]" style={TOUCH} disabled={busyOp} onClick={() => pickFile({ kind: 'replace', mapId: child.id })}>
                    <ImagePlus className="w-4 h-4 mr-2" /> Replace image
                  </Button>
                )}
                {host && viewedNode && (
                  <Button variant="outline" className="min-h-[48px]" style={TOUCH} onClick={() => setGuideFor({ mapId: viewedNode.id, scope: 'location', locationId: l.id, title: `${l.name} — guide` })}>
                    <ScrollText className="w-4 h-4 mr-2" /> Area guide
                  </Button>
                )}
                {host && viewedNode && state.imageUrl && (
                  <Button variant="outline" className="min-h-[48px]" style={TOUCH} onClick={() => setPinFor(pinFor === l.id ? null : l.id)}>
                    <MapPin className="w-4 h-4 mr-2" /> {pinFor === l.id ? 'Cancel pin' : 'Place pin'}
                  </Button>
                )}
                {host && child && partyHere(l.id) && (
                  <Button className="min-h-[48px]" style={TOUCH} disabled={busyOp} onClick={() => void run(() => map.enterChildMap(child.id), `The party entered ${child.name}.`)}>
                    <DoorOpen className="w-4 h-4 mr-2" /> Enter location
                  </Button>
                )}
                {host && localMode && viewedId === activeId && activeState?.currentLocationId !== l.id && (
                  <Button variant="secondary" className="min-h-[48px]" style={TOUCH} disabled={busyOp || !!(activeState && busy(activeState))}
                    onClick={() => void run(() => map.moveWithinLocalMap(l.id), `The party moved to ${l.name}.`)}>
                    <Navigation className="w-4 h-4 mr-2" /> Move here
                  </Button>
                )}
                {host && viewedNode && (
                  <Button variant="ghost" className="min-h-[48px] text-red-300" style={TOUCH}
                    disabled={busyOp || !!child || isEntrance(l.id) || (viewedId === activeId && (activeState?.currentLocationId === l.id || !!(activeState && busy(activeState))))}
                    onClick={() => void editViewed(s => ({ ...s, locations: s.locations.filter(x => x.id !== l.id).map(x => (x.parentLocationId === l.id ? { ...x, parentLocationId: undefined } : x)), routes: s.routes.filter(r => r.fromLocationId !== l.id && r.toLocationId !== l.id) }), 'Place removed')}>
                    <Trash2 className="w-4 h-4 mr-2" /> Remove
                  </Button>
                )}
              </div>
              {host && viewedNode && guideBlock({ mapId: viewedNode.id, scope: 'location', locationId: l.id, title: `${l.name} — guide` })}
              {host && viewedNode && guideFor?.locationId !== l.id && (() => {
                const st = status(viewedNode.id, 'location', l.id);
                return st !== 'empty' ? <p className="text-[12px] text-white/50">Guide: {st === 'current' ? 'Active in current area' : st === 'enclosing' ? 'Active through enclosing area' : st === 'disabled' ? 'Manually disabled' : 'Inactive elsewhere'}</p> : null;
              })()}
            </div>
          );
        })}
        {host && viewedNode && (
          <div className="flex gap-2">
            <Input value={newName} onChange={e => setNewName(e.target.value)} maxLength={80} placeholder="New place name" className="min-h-[48px] text-[15px]" />
            <Button className="min-h-[48px] shrink-0" style={TOUCH} disabled={!newName.trim() || busyOp}
              onClick={async () => {
                const name = newName.trim();
                const ok = await editViewed(s => ({ ...s, locations: [...s.locations, { id: newId(), name, x: null, y: null, discovered: true, kind: 'other' }] }), 'Place added');
                if (ok) setNewName('');
              }}>Add</Button>
          </div>
        )}
        {host && guides.error && <p className="text-[12px] text-red-300">{guides.error}</p>}
        {host && <p className="text-[12px] text-white/45">Map pictures are visible to every player, including anything drawn on them. Keep secrets in the private guides.</p>}
      </div>
    </div>
  );
}
