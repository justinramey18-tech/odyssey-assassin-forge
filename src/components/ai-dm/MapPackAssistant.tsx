// Map Pack Assistant: read a Map Pack ZIP locally, preview it, and install only after
// the host explicitly confirms. Guides install only when the host ticks each one.

import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, Package, Undo2, Upload, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import type { PartyCampaignMapApi } from '@/hooks/use-party-campaign-map';
import type { CampaignMapState } from '@/lib/campaign-map';
import { breadcrumbs, childAt, getNode, subtreeIds, subtreeReplaceBlocker, type CampaignAtlas } from '@/lib/campaign-atlas';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { parseMapPack, revokeMapPackPreview, validateMapData, type MapPackGuide, type MapPackPreview } from '@/lib/campaign-map-pack';
import { MapSetupChat } from './MapSetupChat';

const TOUCH = { touchAction: 'manipulation' as const };

export interface MapPackUndo {
  packName: string; guidesInstalled: string[];
  /** Legacy single-map install: previous single map snapshot. */
  previous?: unknown;
  /** Atlas install: full prior atlas + the revision the install produced. */
  atlas?: { previous: CampaignAtlas | null; previousLegacy: CampaignMapState | null; revisionAfter: number };
}

type Target = { kind: 'root' } | { kind: 'area'; mapId: string | null; locationId: string; label: string };
type ExistingMode = 'image' | 'subtree';
const sig = (g: MapPackGuide) => `${g.scope}|${g.locationId ?? ''}|${g.name}|${g.file}|${g.content.length}|${g.content.slice(0, 64)}`;

export function MapPackAssistant({ map, current, onInstallGuide, undo, setUndo }: {
  map: PartyCampaignMapApi;
  current: CampaignMapState | null;
  onInstallGuide?: (name: string, content: string, customId?: string) => Promise<boolean>;
  undo: MapPackUndo | null;
  setUndo: (u: MapPackUndo | null) => void;
}) {
  const [preview, setPreview] = useState<MapPackPreview | null>(null);
  /** Selected guides by their exact content signature — a changed guide drops its tick. */
  const [approved, setApproved] = useState<Record<string, boolean>>({});
  const [reading, setReading] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [target, setTarget] = useState<Target | null>(null);
  const [existingMode, setExistingMode] = useState<ExistingMode | null>(null);
  const [retry, setRetry] = useState<string | null>(null);
  const reservedRef = useRef<string | null>(null);
  /** Assistant edits live only on this copy until Install. */
  const [staged, setStaged] = useState<{ state: CampaignMapState; guides: MapPackGuide[]; applied: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<MapPackPreview | null>(null);
  previewRef.current = preview;

  useEffect(() => () => revokeMapPackPreview(previewRef.current), []);

  const atlas = map.atlas as CampaignAtlas | null;
  // Every place on every map, labelled with its full breadcrumb (captured ids, not the active map).
  const places = useMemo(() => {
    if (atlas) return atlas.maps.flatMap(m => {
      const crumbs = breadcrumbs(atlas, m.id).map(b => b.name).join(' › ');
      return m.state.locations.map(l => ({ mapId: m.id as string | null, locationId: l.id, label: `${crumbs} › ${l.name}` }));
    });
    return (current?.locations ?? []).map(l => ({ mapId: null as string | null, locationId: l.id, label: l.name }));
  }, [atlas, current]);
  const existingChild = target?.kind === 'area' && atlas && target.mapId ? childAt(atlas, target.mapId, target.locationId) : undefined;
  const affected = existingChild && atlas ? subtreeIds(atlas, existingChild.id).map(id => getNode(atlas, id)?.name ?? id) : [];
  const blocker = existingChild && atlas ? subtreeReplaceBlocker(atlas, existingChild.id) : null;

  const discard = () => { revokeMapPackPreview(preview); setPreview(null); setApproved({}); setConfirming(false); setStaged(null); setTarget(null); setExistingMode(null); setRetry(null); reservedRef.current = null; };

  const read = async (file: File | undefined) => {
    if (!file) return;
    discard();
    setReading(true);
    try { setPreview(await parseMapPack(file)); } catch { toast.error('That Map Pack could not be read.'); }
    finally { setReading(false); }
  };

  const chooseTarget = (t: Target | null) => { setTarget(t); setExistingMode(null); setConfirming(false); setRetry(null); reservedRef.current = null; };

  const installCampaignGuides = async (guides: MapPackGuide[]) => {
    const ok: string[] = []; const failed: string[] = [];
    for (const g of guides) {
      const r = onInstallGuide ? await onInstallGuide(g.name, g.content, g.customId) : false;
      (r ? ok : failed).push(g.name);
    }
    if (failed.length) toast.warning(`The map installed, but these campaign guides were not saved: ${failed.join(', ')}.`);
    return ok;
  };

  const install = async () => {
    const base = preview;
    if (!base?.installable || !base.state || !base.image || !base.imageType || !map.canWrite || !target) return;
    const p = { ...base, state: staged?.state ?? base.state, guides: staged?.guides ?? base.guides };
    if (validateMapData(p.state, base.imageWidth, base.imageHeight).errors.length) { toast.error('The staged changes no longer pass the safety check. Reset to the uploaded pack.'); return; }
    const chosen = p.guides.filter(g => approved[sig(g)] && !g.tooLarge);
    const campaign = chosen.filter(g => g.scope === 'campaign');
    const area = chosen.filter(g => g.scope !== 'campaign');
    const packName = p.manifest?.name ?? 'Map Pack';
    setInstalling(true);
    try {
      if (target.kind === 'area' && existingChild && existingMode === 'image') {
        const file = new File([p.image], `area.${p.imageType.split('/')[1] || 'png'}`, { type: p.imageType });
        const r = await map.replaceAreaImage(existingChild.id, file);
        if (!r.ok) { toast.error(`Not installed: ${(r as { error: string }).error}`); return; }
        toast.success(`Picture replaced for ${existingChild.name}. Its places, inner areas and guides were kept; distance calibration was reset.`);
        discard(); return;
      }
      if (target.kind === 'area') {
        if (!reservedRef.current) reservedRef.current = crypto.randomUUID();
        const res = await map.installAreaPack({
          parentMapId: target.mapId, parentLocationId: target.locationId, reservedId: reservedRef.current,
          name: packName, state: p.state, image: p.image, imageType: p.imageType, replaceExisting: existingMode === 'subtree',
          guides: area.map(g => ({ scope: g.scope as 'map' | 'location', locationId: g.locationId ?? null, name: g.name, content: g.content })),
        });
        if (!res.ok) {
          const e = res as { error: string; guidesStaged?: boolean };
          if (e.guidesStaged) setRetry('The area guides are saved but not active yet. The map was not changed. Tap Install again to retry.');
          toast.error(`Not installed: ${e.error}`); return;
        }
        const r = res as { previous: CampaignAtlas | null; previousLegacy: CampaignMapState | null; revisionAfter: number };
        const okGuides = await installCampaignGuides(campaign);
        setUndo({ packName, guidesInstalled: okGuides, atlas: r });
        toast.success(`${packName} installed at ${target.label}. The party has not moved — use Enter location in Areas when ready.`);
        discard(); return;
      }
      // New root / world.
      if (map.isAtlasMode) {
        const prevAtlas = atlas;
        const up = await map.uploadImageFile(p.image, p.imageType);
        if (!up.ok) { toast.error(`Not installed: ${(up as { error: string }).error}`); return; }
        const res = await map.restoreSaveSnapshot({ ...p.state, imageUrl: up.url }, 'campaign');
        if (!res.ok) { toast.error(`Not installed: ${(res as { error: string }).error}`); return; }
        const okGuides = await installCampaignGuides(campaign);
        const after = map.atlas as CampaignAtlas | null;
        setUndo({ packName, guidesInstalled: okGuides, atlas: { previous: prevAtlas, previousLegacy: null, revisionAfter: after?.revision ?? -1 } });
        toast.success(`${packName} is now the world map. The old collection is kept for Undo.`);
        discard(); return;
      }
      const previous = current ? map.exportSaveSnapshot() : null;
      const up = await map.uploadImageFile(p.image, p.imageType);
      if (!up.ok) { toast.error(`Map Pack not installed: ${(up as { error: string }).error}`); return; }
      const res = await map.restoreSaveSnapshot({ ...p.state, imageUrl: up.url }, 'campaign');
      if (!res.ok) { toast.error(`Map Pack not installed: ${(res as { error: string }).error}`); return; }
      const okGuides = await installCampaignGuides(campaign);
      setUndo({ previous, packName, guidesInstalled: okGuides });
      toast.success(`${packName} installed.`);
      discard();
    } finally { setInstalling(false); }
  };

  const undoInstall = async () => {
    if (!undo) return;
    const r = undo.atlas
      ? await map.undoAtlasInstall(undo.atlas)
      : undo.previous ? await map.restoreSaveSnapshot(undo.previous, 'undo') : await map.clearCampaignMap();
    if (!r.ok) { toast.error((r as { error: string }).error); return; }
    toast.success('Previous maps restored. Campaign guides you added were not removed.');
    setUndo(null);
  };

  const p = preview ? { ...preview, state: staged?.state ?? preview.state, guides: staged?.guides ?? preview.guides } : null;
  const st = p?.state;
  const s = p && st ? { ...p.summary, locations: st.locations.length, routes: st.routes.length, discovered: st.locations.filter(l => l.discovered).length,
    unpinned: st.locations.filter(l => l.x === null || l.y === null).length, startingLocation: st.currentLocationId ? st.locations.find(l => l.id === st.currentLocationId)?.name ?? null : null,
    realMinutesPerGameHour: st.realMinutesPerGameHour, defaultPace: st.defaultPace } : p?.summary;
  return (
    <div className="space-y-2">
      <input ref={fileRef} type="file" accept=".zip,application/zip" className="hidden" onChange={(e) => { void read(e.target.files?.[0]); e.target.value = ''; }} />
      {undo && (
        <div className="rounded-lg border border-white/10 p-2.5 space-y-1.5">
          <Button variant="outline" className="w-full min-h-[44px]" style={TOUCH} onClick={undoInstall}><Undo2 className="w-4 h-4 mr-2" />Undo last map install ({undo.packName})</Button>
          {undo.guidesInstalled.length > 0 && <p className="text-[11px] text-white/50">Undo restores the maps only. Campaign guides you added stay: {undo.guidesInstalled.join(', ')}. Remove them from GM Guides if you don't want them.</p>}
        </div>
      )}
      {!p && (
        <Button variant="secondary" disabled={reading} className="w-full min-h-[48px]" style={TOUCH} onClick={() => fileRef.current?.click()}>
          <Upload className="w-4 h-4 mr-2" />{reading ? 'Reading pack…' : 'Upload Map Pack ZIP'}
        </Button>
      )}
      {p && (
        <div className="rounded-lg border border-white/10 p-2.5 space-y-2">
          <div className="flex items-start gap-2">
            {p.imageUrl ? <img src={p.imageUrl} alt="" className="w-20 h-20 object-cover rounded border border-white/10" /> : <Package className="w-10 h-10 text-white/40" />}
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-white truncate">{p.manifest?.name || 'Unnamed pack'}</p>
              {p.manifest?.description && <p className="text-[11px] text-white/60 line-clamp-3">{p.manifest.description}</p>}
              {p.imageWidth && <p className="text-[11px] text-white/45">{p.imageWidth} × {p.imageHeight}px</p>}
            </div>
          </div>
          {s && p.state && (
            <ul className="text-[12px] text-white/70 grid grid-cols-2 gap-x-2 gap-y-0.5">
              <li>Places: {s.locations}</li>
              <li>Roads: {s.routes}</li>
              <li>Visible to players: {s.discovered}</li>
              <li>Not pinned: {s.unpinned}</li>
              <li>Scale: {s.calibrated ? 'calibrated' : 'not calibrated'}</li>
              <li>Start: {s.startingLocation ?? 'none'}</li>
              <li>Time: {s.realMinutesPerGameHour} min/hour</li>
              <li>Pace: {s.defaultPace}</li>
            </ul>
          )}
          {p.errors.length > 0 && (
            <div className="rounded bg-rose-500/10 border border-rose-400/30 p-2 space-y-0.5">
              <p className="text-[12px] text-rose-200 font-semibold flex items-center gap-1"><XCircle className="w-4 h-4" />Can't install this pack</p>
              {p.errors.slice(0, 8).map((e, i) => <p key={i} className="text-[11px] text-rose-200/90">• {e}</p>)}
              {p.errors.length > 8 && <p className="text-[11px] text-rose-200/70">(+{p.errors.length - 8} more)</p>}
            </div>
          )}
          {p.warnings.length > 0 && (
            <div className="rounded bg-amber-500/10 border border-amber-400/30 p-2 space-y-0.5">
              {p.warnings.slice(0, 8).map((w, i) => <p key={i} className="text-[11px] text-amber-200 flex gap-1"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{w}</p>)}
            </div>
          )}
          {p.installable && map.canWrite && (
            <div className="rounded-lg border border-white/10 p-3 space-y-2">
              <p className="text-[13px] text-white/80 font-semibold">Install where?</p>
              <Select value={target ? (target.kind === 'root' ? '__root' : `${target.mapId ?? ''}::${target.locationId}`) : '__none'}
                onValueChange={v => {
                  if (v === '__none') return chooseTarget(null);
                  if (v === '__root') return chooseTarget({ kind: 'root' });
                  const pl = places.find(x => `${x.mapId ?? ''}::${x.locationId}` === v);
                  if (pl) chooseTarget({ kind: 'area', mapId: pl.mapId, locationId: pl.locationId, label: pl.label });
                }}>
                <SelectTrigger className="min-h-[48px] text-[14px]"><SelectValue placeholder="Choose a target" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Choose a target…</SelectItem>
                  <SelectItem value="__root">New root / world map (replaces the world)</SelectItem>
                  {places.map(pl => <SelectItem key={`${pl.mapId}::${pl.locationId}`} value={`${pl.mapId ?? ''}::${pl.locationId}`}>Area map at {pl.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {target?.kind === 'area' && (
                <p className="text-[12px] text-white/60">Pack time ({s?.realMinutesPerGameHour} min/hour), campaign clock and pace are not applied to area installs. The party will not move.</p>
              )}
              {existingChild && (
                <div className="space-y-2">
                  <p className="text-[12px] text-amber-200">{existingChild.name} already has an area map here.</p>
                  <Button variant={existingMode === 'image' ? 'default' : 'outline'} className="w-full min-h-[48px]" style={TOUCH} onClick={() => setExistingMode('image')}>Replace this area image only</Button>
                  <Button variant={existingMode === 'subtree' ? 'default' : 'outline'} className="w-full min-h-[48px]" style={TOUCH} disabled={!!blocker} onClick={() => setExistingMode('subtree')}>Replace this whole area map</Button>
                  {blocker && <p className="text-[12px] text-rose-200">{blocker}</p>}
                  {existingMode === 'subtree' && <p className="text-[12px] text-white/60">These maps will be unlinked (kept for Undo, not deleted): {affected.join(', ')}.</p>}
                  {existingMode === 'image' && <p className="text-[12px] text-white/60">Only the picture changes. Places, inner areas and guides stay; pack places and guides are not used.</p>}
                </div>
              )}
            </div>
          )}
          {p.guides.length > 0 && (
            <div className="space-y-1">
              <p className="text-[12px] text-white/70">Included guides — tick only the ones you want added and turned on:</p>
              {target?.kind === 'area' && !existingMode && p.guides.some(g => g.scope !== 'campaign') && (
                <Button variant="outline" className="w-full min-h-[48px]" style={TOUCH}
                  onClick={() => setApproved(a => { const n = { ...a }; for (const g of p.guides) if (g.scope !== 'campaign' && !g.tooLarge) n[sig(g)] = true; return n; })}>
                  Select all area/place guides
                </Button>
              )}
              {p.guides.map((g, i) => {
                const areaOnly = g.scope !== 'campaign';
                const disabled = g.tooLarge || (areaOnly ? !(target?.kind === 'area' && existingMode !== 'image') : !onInstallGuide);
                const placeName = g.scope === 'location' ? p.state?.locations.find(l => l.id === g.locationId)?.name ?? g.locationId : null;
                return (
                  <label key={i} className="flex items-center gap-3 min-h-[48px] text-[13px] text-white/80" style={TOUCH}>
                    <Checkbox checked={!!approved[sig(g)] && !disabled} disabled={disabled} onCheckedChange={(v) => setApproved(a => ({ ...a, [sig(g)]: v === true }))} />
                    <span className="flex-1">{g.name}
                      <span className="block text-[12px] text-white/50">
                        {g.scope === 'campaign' ? 'Campaign guide — applies everywhere' : g.scope === 'map' ? 'Area guide for this map (private)' : `Place guide: ${placeName} (private)`}
                        {' · '}{g.content.length.toLocaleString()} chars{g.recommendedEnabled ? ' · pack suggests it' : ''}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
          {staged && staged.applied.length > 0 && (
            <div className="rounded bg-violet-500/10 border border-violet-400/30 p-2 space-y-1">
              <p className="text-[12px] text-violet-100 font-semibold">Staged changes (not installed yet)</p>
              {staged.applied.slice(-10).map((a, i) => <p key={i} className="text-[11px] text-violet-100/80">• {a}</p>)}
              {staged.applied.length > 10 && <p className="text-[11px] text-violet-100/60">(+{staged.applied.length - 10} more)</p>}
              <Button size="sm" variant="outline" className="min-h-[44px]" style={TOUCH} onClick={() => setStaged(null)}>Reset to uploaded pack</Button>
            </div>
          )}
          {p.installable && p.state && map.canWrite && (
            <MapSetupChat key={p.manifest?.id ?? 'pack'} state={p.state} guides={p.guides} imageWidth={p.imageWidth ?? 0} imageHeight={p.imageHeight ?? 0}
              packName={p.manifest?.name} packDescription={p.manifest?.description}
              onStaged={(r) => setStaged(prev => ({ state: r.state, guides: r.guides, applied: [...(prev?.applied ?? []), ...r.applied] }))} />
          )}
          {retry && <p className="text-[12px] text-amber-200">{retry}</p>}
          {confirming && p.installable && !!target && !(existingChild && !existingMode) ? (
            <div className="rounded bg-sky-500/10 border border-sky-400/30 p-3 space-y-2">
              <p className="text-[13px] text-sky-100">
                {target!.kind === 'root'
                  ? `This replaces the whole world map${map.isAtlasMode ? ' and its area maps (kept for Undo)' : current ? ` (${current.locations.length} places, ${current.routes.length} roads)` : ''}. Any trip comes back paused.`
                  : existingMode === 'image' ? `Only the picture of ${existingChild?.name} is replaced.`
                  : existingMode === 'subtree' ? `This replaces ${affected.join(', ')} with the pack at ${(target as { label: string }).label}.`
                  : `This adds an area map at ${(target as { label: string }).label}. Nothing else changes and the party does not move.`}
                {' '}{Object.values(approved).some(Boolean) ? `${p.guides.filter(g => approved[sig(g)]).length} guide(s) will be added.` : 'No guides will be added.'}
                {' '}Characters, quests and story are not touched.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="min-h-[48px]" style={TOUCH} onClick={() => setConfirming(false)}>Back</Button>
                <Button disabled={installing} className="min-h-[48px]" style={TOUCH} onClick={install}><CheckCircle2 className="w-4 h-4 mr-1" />{installing ? 'Installing…' : 'Confirm install'}</Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="min-h-[48px]" style={TOUCH} onClick={discard}>Discard</Button>
              <Button disabled={!(p.installable && !!target && !(existingChild && !existingMode))} className="min-h-[48px]" style={TOUCH} onClick={() => setConfirming(true)}>Install Map Pack</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
