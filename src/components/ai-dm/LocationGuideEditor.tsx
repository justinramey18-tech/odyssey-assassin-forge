// Private area/location guides. Original host only — this component is never rendered for anyone else,
// and the text lives only in memory while it is open (no storage, no logs, no broadcasts).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { CampaignAtlas } from '@/lib/campaign-atlas';
import { resolveGuideScopes } from '@/lib/location-guides';

export const GUIDE_MAX = 30000;
const TOUCH = { touchAction: 'manipulation' as const };

export interface GuideRow {
  id: string; map_id: string; scope: 'map' | 'location'; location_id: string | null;
  name: string; content: string; enabled: boolean; updated_at: string;
}

const keyOf = (mapId: string, scope: string, locationId: string | null) => `${mapId}|${scope}|${locationId ?? ''}`;

/** Host-only, memory-only list of this party's guide rows. */
export function usePartyLocationGuides(partyId: string | null | undefined, enabled: boolean) {
  const [rows, setRows] = useState<GuideRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const scopeRef = useRef(`${partyId}|${enabled}`);
  scopeRef.current = `${partyId}|${enabled}`;
  const reload = useCallback(async () => {
    const scope = scopeRef.current;
    if (!partyId || !enabled) { setRows([]); return; }
    const { data, error: e } = await (supabase.from('party_location_guides') as any)
      .select('id, map_id, scope, location_id, name, content, enabled, updated_at').eq('party_id', partyId);
    if (scope !== scopeRef.current) return;
    if (e) { setError('Could not load the area guides.'); return; }
    setError(null);
    setRows((data || []) as GuideRow[]);
  }, [partyId, enabled]);
  useEffect(() => { setRows([]); void reload(); }, [reload]);
  useEffect(() => {
    const f = () => { void reload(); };
    window.addEventListener('focus', f);
    return () => window.removeEventListener('focus', f);
  }, [reload]);
  const byKey = useMemo(() => new Map(rows.map(r => [keyOf(r.map_id, r.scope, r.location_id), r])), [rows]);
  const find = useCallback((mapId: string, scope: 'map' | 'location', locationId: string | null) => byKey.get(keyOf(mapId, scope, locationId)) ?? null, [byKey]);
  return { rows, error, reload, find, setRows };
}

export type GuideStatus = 'current' | 'enclosing' | 'elsewhere' | 'disabled' | 'empty';
const STATUS_LABEL: Record<GuideStatus, string> = {
  current: 'Active in current area', enclosing: 'Active through enclosing area', elsewhere: 'Inactive elsewhere',
  disabled: 'Manually disabled', empty: 'Empty draft',
};

/** Status from the shared party position (resolved atlas), never from the map being viewed. */
export function guideStatus(atlas: CampaignAtlas | null, mapId: string, scope: 'map' | 'location', locationId: string | null, row: GuideRow | null): GuideStatus {
  if (!row || !row.content.trim()) return 'empty';
  if (!row.enabled) return 'disabled';
  if (!atlas) return 'elsewhere';
  const r = resolveGuideScopes(atlas);
  if (!r.ok) return 'elsewhere';
  const k = keyOf(mapId, scope, locationId);
  const idx = r.scopes.findIndex(s => keyOf(s.mapId, s.scope, s.locationId) === k);
  if (idx < 0) return 'elsewhere';
  const inner = r.scopes[r.scopes.length - 1];
  const isActiveMapOwn = mapId === atlas.activeMapId && (scope === 'map' || idx === r.scopes.length - 1);
  return isActiveMapOwn || keyOf(inner.mapId, inner.scope, inner.locationId) === k ? 'current' : 'enclosing';
}

export function LocationGuideEditor({ partyId, mapId, scope, locationId, defaultTitle, row, status, onSaved, onClose }: {
  partyId: string; mapId: string; scope: 'map' | 'location'; locationId: string | null; defaultTitle: string;
  row: GuideRow | null; status: GuideStatus; onSaved: (r: GuideRow) => void; onClose: () => void;
}) {
  const [title, setTitle] = useState(row?.name ?? defaultTitle);
  const [text, setText] = useState(row?.content ?? '');
  const [on, setOn] = useState(row?.enabled ?? true);
  const [saving, setSaving] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const dirty = title !== (row?.name ?? defaultTitle) || text !== (row?.content ?? '') || on !== (row?.enabled ?? true);

  const save = async () => {
    if (saving) return;
    if (text.length > GUIDE_MAX) { toast.error(`Guides are ${GUIDE_MAX.toLocaleString()} characters at most.`); return; }
    setSaving(true);
    const name = title.trim().slice(0, 120) || defaultTitle;
    try {
      if (row) {
        const { data, error } = await (supabase.from('party_location_guides') as any)
          .update({ name, content: text, enabled: on }).eq('id', row.id).eq('updated_at', row.updated_at)
          .select('id, map_id, scope, location_id, name, content, enabled, updated_at');
        if (error) throw new Error('The guide could not be saved. Your text is still here.');
        if (!data?.length) throw new Error('This guide was changed on another screen. Copy your text, close and reopen it.');
        onSaved(data[0] as GuideRow);
      } else {
        const { data, error } = await (supabase.from('party_location_guides') as any)
          .insert({ party_id: partyId, map_id: mapId, scope, location_id: locationId, name, content: text, enabled: on })
          .select('id, map_id, scope, location_id, name, content, enabled, updated_at');
        if (error) throw new Error(error.code === '23505'
          ? 'Another screen already saved a guide here. Copy your text, close and reopen it.'
          : 'The guide could not be saved. Your text is still here.');
        onSaved((data as GuideRow[])[0]);
      }
      toast.success('Guide saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'The guide could not be saved.');
    } finally { setSaving(false); }
  };

  return (
    <div className="mt-2 rounded-xl border border-amber-500/30 bg-black/40 p-3.5 space-y-3" data-vaul-no-drag>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold text-amber-200">Private guide</p>
        <span className="text-[12px] text-white/60">{STATUS_LABEL[status]}</span>
      </div>
      <Input value={title} onChange={e => setTitle(e.target.value)} maxLength={120} className="min-h-[48px] text-[15px]" placeholder="Title" />
      <Textarea value={text} onChange={e => setText(e.target.value)} rows={8} className="text-[15px] min-h-[180px] max-h-[50vh] overflow-y-auto"
        placeholder="Only the DM sees this. Secrets, NPCs, what's really here…" />
      <div className="flex items-center justify-between">
        <span className={text.length > GUIDE_MAX ? 'text-[12px] text-red-400' : 'text-[12px] text-white/50'}>{text.length.toLocaleString()} / {GUIDE_MAX.toLocaleString()}</span>
        <label className="flex items-center gap-2 text-[13px] text-white/80 min-h-[48px]">
          <Switch checked={on} onCheckedChange={setOn} /> Enabled
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" className="min-h-[48px]" style={TOUCH} onClick={() => (dirty ? setConfirmClose(true) : onClose())}>Close</Button>
        <Button className="min-h-[48px]" style={TOUCH} disabled={saving || !dirty || text.length > GUIDE_MAX} onClick={save}>{saving ? 'Saving…' : 'Save'}</Button>
      </div>
      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent data-vaul-no-drag>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard your changes?</AlertDialogTitle>
            <AlertDialogDescription>This guide has unsaved text. Closing will throw it away.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-[48px]">Keep editing</AlertDialogCancel>
            <AlertDialogAction className="min-h-[48px]" onClick={onClose}>Discard</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
