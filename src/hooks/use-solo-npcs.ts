// Solo Empyrean Live NPCs (D-38): the roster for one solo campaign.
// - roster: the canon cast for the campaign's era, plus Quick Build NPCs, with each one's state.
// - onStory: after a DM post, NPCs it names are marked met, and their memories are updated.
// - voiceFor: the block that makes an @mention answer as that NPC (their mind, feelings, memories).
// Rows are written only once the campaign has its cloud id; before that, the roster still shows.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { CANON_ERA_LABELS, matchNames, npcVoiceContext, parseMention, type CanonEra } from '@/lib/empyreanCanon/castNpcs';
import {
  buildRoster, deleteRow, loadEra, loadRows, newRow, rosterNameEntries, saveEra, saveRow, withMemory,
  type CustomMind, type NpcStatus, type RosterEntry, type SoloNpcRow,
} from '@/lib/solo-npcs';

const MAX_SCENE_CHARS = 6000;

export interface SoloNpcs {
  ready: boolean;
  era: CanonEra;
  setEra: (era: CanonEra) => void;
  roster: RosterEntry[];
  entry: (key: string) => RosterEntry | undefined;
  /** "@Dain Aetos, line" → the NPC's name, the line and the voice block; null if nobody matches. */
  mention: (text: string) => { name: string; line: string; voice: string; key: string } | null;
  setStatus: (key: string, status: NpcStatus) => Promise<void>;
  remove: (key: string) => Promise<void>;
  build: (description: string) => Promise<RosterEntry | null>;
  building: boolean;
  onStory: (dmText: string, playerText: string) => void;
}

export function useSoloNpcs({ campaignId, riderName, enabled }: { campaignId: string | null; riderName: string; enabled: boolean }): SoloNpcs {
  const [rows, setRows] = useState<SoloNpcRow[]>([]);
  const [ready, setReady] = useState(false);
  const [era, setEraState] = useState<CanonEra>(() => loadEra(campaignId));
  const [building, setBuilding] = useState(false);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  useEffect(() => { setEraState(loadEra(campaignId)); }, [campaignId]);

  useEffect(() => {
    let cancelled = false;
    setRows([]);
    setReady(false);
    if (!enabled || !campaignId) return;
    loadRows(campaignId)
      .then(r => { if (!cancelled) { setRows(r); setReady(true); } })
      .catch(err => { console.warn('[SoloNpcs] load failed', err); if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, [enabled, campaignId]);

  const roster = useMemo(() => buildRoster(rows, era), [rows, era]);
  const rosterRef = useRef(roster);
  rosterRef.current = roster;
  const names = useMemo(() => rosterNameEntries(roster), [roster]);
  const namesRef = useRef(names);
  namesRef.current = names;

  const setEra = useCallback((next: CanonEra) => { saveEra(campaignId, next); setEraState(next); }, [campaignId]);
  const entry = useCallback((key: string) => rosterRef.current.find(e => e.key === key), []);

  const store = useCallback(async (row: SoloNpcRow) => {
    const saved = await saveRow(row);
    setRows(prev => [...prev.filter(r => r.npc_key !== saved.npc_key), saved]);
    return saved;
  }, []);

  const rowFor = useCallback((key: string): SoloNpcRow | null => {
    if (!campaignId) return null;
    const existing = rowsRef.current.find(r => r.npc_key === key);
    if (existing) return existing;
    const e = rosterRef.current.find(x => x.key === key);
    return e ? newRow(campaignId, e) : null;
  }, [campaignId]);

  const mention = useCallback((text: string) => {
    const hit = parseMention(text, namesRef.current);
    if (!hit) return null;
    const e = rosterRef.current.find(x => x.key === hit.key);
    if (!e) return null;
    const voice = npcVoiceContext(e.mind, riderName || 'the rider', e.attitude, e.memories, CANON_ERA_LABELS[era]);
    return { name: e.name, line: hit.line, voice, key: e.key };
  }, [riderName, era]);

  const setStatus = useCallback(async (key: string, status: NpcStatus) => {
    const row = rowFor(key);
    if (!row) { toast('Send a message first', { description: 'The campaign saves itself after your first message.' }); return; }
    try { await store({ ...row, status }); } catch { toast.error('Could not save that. Try again.'); }
  }, [rowFor, store]);

  const remove = useCallback(async (key: string) => {
    if (!campaignId) return;
    const e = rosterRef.current.find(x => x.key === key);
    try {
      if (e?.custom) {
        await deleteRow(campaignId, key);
        setRows(prev => prev.filter(r => r.npc_key !== key));
      } else {
        await setStatus(key, 'hidden');
      }
    } catch { toast.error('Could not remove them. Try again.'); }
  }, [campaignId, setStatus]);

  const build = useCallback(async (description: string): Promise<RosterEntry | null> => {
    if (!campaignId) { toast('Send a message first', { description: 'The campaign saves itself after your first message.' }); return null; }
    setBuilding(true);
    try {
      const { data, error } = await supabase.functions.invoke('solo-npc', {
        body: { action: 'build', description, era: CANON_ERA_LABELS[era], riderName },
      });
      const npc = (data as { npc?: CustomMind } | null)?.npc;
      if (error || !npc) { toast.error((data as { error?: string } | null)?.error || 'Quick Build failed. Try again.'); return null; }
      const key = `custom-${crypto.randomUUID().slice(0, 8)}`;
      await store(newRow(campaignId, { key, name: npc.name, attitude: npc.attitude }, npc));
      return rosterRef.current.find(e => e.key === key) ?? null;
    } catch {
      toast.error('Quick Build failed. Try again.');
      return null;
    } finally {
      setBuilding(false);
    }
  }, [campaignId, era, riderName, store]);

  // After a DM post: everyone it names is met, then the scene's NPCs remember it (one call).
  const onStory = useCallback((dmText: string, playerText: string) => {
    if (!enabled || !campaignId || !dmText.trim()) return;
    const keys = matchNames(dmText, namesRef.current).filter(k => {
      const e = rosterRef.current.find(x => x.key === k);
      return e && e.status !== 'dead' && e.status !== 'hidden';
    });
    if (!keys.length) return;
    void (async () => {
      const met = keys.map(k => rowFor(k)).filter((r): r is SoloNpcRow => !!r);
      const current = new Map<string, SoloNpcRow>();
      try {
        for (const r of met) current.set(r.npc_key, r.id ? r : await store(r));
      } catch (err) { console.warn('[SoloNpcs] could not mark met', err); return; }
      const scene = `${playerText ? `PLAYER (${riderName}): ${playerText}\n\n` : ''}DM: ${dmText}`.slice(-MAX_SCENE_CHARS);
      const npcs = keys.slice(0, 8).map(k => {
        const e = rosterRef.current.find(x => x.key === k);
        if (!e) return null;
        return { key: k, name: e.name, personality: e.mind.personality, attitude: e.attitude, recent: e.memories.slice(-3) };
      }).filter(e => e !== null);
      try {
        const { data, error } = await supabase.functions.invoke('solo-npc', {
          body: { action: 'remember', riderName, era: CANON_ERA_LABELS[era], scene, npcs },
        });
        if (error) return;
        const results = ((data as { memories?: Array<{ key: string; memory: string; attitudeChange: number }> } | null)?.memories) ?? [];
        for (const m of results) {
          const row = rowsRef.current.find(r => r.npc_key === m.key && r.id) ?? current.get(m.key);
          if (!row) continue;
          const next = withMemory(row, m.memory, m.attitudeChange);
          if (next.attitude !== row.attitude || next.memories !== row.memories) await store(next);
        }
      } catch (err) { console.warn('[SoloNpcs] remember failed', err); }
    })();
  }, [enabled, campaignId, riderName, era, rowFor, store]);

  return { ready, era, setEra, roster, entry, mention, setStatus, remove, build, building, onStory };
}
