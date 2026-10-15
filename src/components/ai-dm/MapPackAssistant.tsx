// Map Pack Assistant: read a Map Pack ZIP locally, preview it, and install only after
// the host explicitly confirms. Guides install only when the host ticks each one.

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, Package, Undo2, Upload, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import type { PartyCampaignMapApi } from '@/hooks/use-party-campaign-map';
import type { CampaignMapState } from '@/lib/campaign-map';
import { parseMapPack, revokeMapPackPreview, validateMapData, type MapPackGuide, type MapPackPreview } from '@/lib/campaign-map-pack';
import { MapSetupChat } from './MapSetupChat';

const TOUCH = { touchAction: 'manipulation' as const };

export interface MapPackUndo { previous: unknown; packName: string; guidesInstalled: string[] }

export function MapPackAssistant({ map, current, onInstallGuide, undo, setUndo }: {
  map: PartyCampaignMapApi;
  current: CampaignMapState | null;
  onInstallGuide?: (name: string, content: string, customId?: string) => boolean;
  undo: MapPackUndo | null;
  setUndo: (u: MapPackUndo | null) => void;
}) {
  const [preview, setPreview] = useState<MapPackPreview | null>(null);
  const [approved, setApproved] = useState<Record<number, boolean>>({});
  const [reading, setReading] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [confirming, setConfirming] = useState(false);
  /** Assistant edits live only on this copy until Install. */
  const [staged, setStaged] = useState<{ state: CampaignMapState; guides: MapPackGuide[]; applied: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<MapPackPreview | null>(null);
  previewRef.current = preview;

  useEffect(() => () => revokeMapPackPreview(previewRef.current), []);

  const discard = () => { revokeMapPackPreview(preview); setPreview(null); setApproved({}); setConfirming(false); setStaged(null); };

  const read = async (file: File | undefined) => {
    if (!file) return;
    discard();
    setReading(true);
    try { setPreview(await parseMapPack(file)); } catch { toast.error('That Map Pack could not be read.'); }
    finally { setReading(false); }
  };

  const install = async () => {
    const base = preview;
    if (!base?.installable || !base.state || !base.image || !base.imageType || !map.canWrite) return;
    if (map.isAtlasMode) { toast.error('This party uses nested maps. Installing a Map Pack into an area is not ready yet, so nothing was changed.'); return; }
    const p = { ...base, state: staged?.state ?? base.state, guides: staged?.guides ?? base.guides };
    if (validateMapData(p.state, base.imageWidth, base.imageHeight).errors.length) { toast.error('The staged changes no longer pass the safety check. Reset to the uploaded pack.'); return; }
    setInstalling(true);
    try {
      // 1) remember the current map for Undo
      const previous = current ? map.exportSaveSnapshot() : null;
      // 2) upload the pack's image
      const up = await map.uploadImageFile(p.image, p.imageType);
      if (!up.ok) { toast.error(`Map Pack not installed: ${(up as { error: string }).error}`); return; }
      // 3–4) replace the live map
      const res = await map.restoreSaveSnapshot({ ...p.state, imageUrl: up.url }, 'campaign');
      if (!res.ok) { toast.error(`Map Pack not installed: ${(res as { error: string }).error}`); return; }
      // 5) only the guides the host ticked
      const installed: string[] = [];
      p.guides.forEach((g, i) => {
        if (!approved[i]) return;
        const ok = onInstallGuide ? onInstallGuide(g.name, g.content, g.customId) : false;
        if (ok) installed.push(g.name);
        else toast.warning(`The map installed, but the guide "${g.name}" did not.`);
      });
      setUndo({ previous, packName: p.manifest?.name ?? 'Map Pack', guidesInstalled: installed });
      toast.success(`${p.manifest?.name ?? 'Map Pack'} installed.`);
      discard();
    } finally { setInstalling(false); }
  };

  const undoInstall = async () => {
    if (!undo) return;
    const r = undo.previous ? await map.restoreSaveSnapshot(undo.previous, 'undo') : await map.clearCampaignMap();
    if (!r.ok) { toast.error((r as { error: string }).error); return; }
    toast.success('Previous map restored.');
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
          {undo.guidesInstalled.length > 0 && <p className="text-[11px] text-white/50">Undo restores the map only. Guides you installed stay: {undo.guidesInstalled.join(', ')}. Remove them from GM Guides if you don't want them.</p>}
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
          {p.guides.length > 0 && (
            <div className="space-y-1">
              <p className="text-[12px] text-white/70">Included GM guides — tick only the ones you want added and turned on:</p>
              {p.guides.map((g, i) => (
                <label key={i} className="flex items-center gap-3 min-h-[44px] text-[12px] text-white/80" style={TOUCH}>
                  <Checkbox checked={!!approved[i]} disabled={g.tooLarge || !onInstallGuide} onCheckedChange={(v) => setApproved(a => ({ ...a, [i]: v === true }))} />
                  <span className="flex-1">{g.name} <span className="text-white/40">({g.content.length.toLocaleString()} chars{g.recommendedEnabled ? ', pack suggests it' : ''})</span></span>
                </label>
              ))}
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
          {confirming && p.installable ? (
            <div className="rounded bg-sky-500/10 border border-sky-400/30 p-2 space-y-2">
              <p className="text-[12px] text-sky-100">
                This replaces the whole current map{current ? ` (${current.locations.length} places, ${current.routes.length} roads, clock and party position)` : ''} with this pack. Any trip in progress will be stopped and come back paused.
                {Object.values(approved).some(Boolean) ? ` ${Object.values(approved).filter(Boolean).length} guide(s) will be added and turned on.` : ' No guides will be added.'}
                {' '}Characters, quests and story are not touched.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="min-h-[44px]" style={TOUCH} onClick={() => setConfirming(false)}>Back</Button>
                <Button disabled={installing} className="min-h-[44px]" style={TOUCH} onClick={install}><CheckCircle2 className="w-4 h-4 mr-1" />{installing ? 'Installing…' : 'Install Map Pack'}</Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="min-h-[44px]" style={TOUCH} onClick={discard}>Discard</Button>
              <Button disabled={!p.installable || map.isAtlasMode} className="min-h-[44px]" style={TOUCH} onClick={() => setConfirming(true)}>Install Map Pack</Button>
            </div>
          )}
          {map.isAtlasMode && <p className="text-[11px] text-amber-200/80">This party uses nested maps. Installing a pack into an area is not ready yet, so it can't replace your world.</p>}
        </div>
      )}
    </div>
  );
}
