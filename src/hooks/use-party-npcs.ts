import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { NPC_DEFAULT_MODEL, cleanNpcName, readableFunctionError } from '@/lib/live-npcs';

/** One NPC on the party's roster (Live NPCs, D-22). Everyone at the table can read these. */
export interface PartyNpc {
  id: string;
  party_id: string;
  name: string;
  portrait_url: string | null;
  model: string;
  on_stage: boolean;
  archived: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** An NPC answer in progress, shown as "Grukk is thinking…". */
export interface NpcThinking {
  key: string;
  npcId: string;
  name: string;
  /** The line being answered, or the NPC line being rewritten. */
  messageId: string;
  kind: 'answer' | 'regenerate';
}

const sortNpcs = (list: PartyNpc[]) =>
  [...list].sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));

/** Plain words for a failed roster save. */
function rosterError(error: { code?: string; message?: string } | null, name?: string): string {
  if (!error) return 'Something went wrong. Try again.';
  if (error.code === '23505') return name ? `You already have an NPC called ${name}.` : 'Another NPC already has that name.';
  if (error.code === '42501') return "Only the party's host can change NPCs.";
  if (error.code === '23514') return 'That is too long. Names can be up to 40 characters, guides 20,000 and secrets 10,000.';
  return error.message || 'Something went wrong. Try again.';
}

/** How long another phone's "thinking" note may stay up if its "done" never arrives. */
const REMOTE_THINKING_MS = 90_000;

/**
 * The party's NPC roster with live updates, the host's roster actions, and asking an
 * on-stage NPC to answer a Live Table line (server function npc-reply). Guides and
 * secrets are read only by the host here and by the server; players never load them.
 */
export function usePartyNpcs(partyId: string | null) {
  const [npcs, setNpcs] = useState<PartyNpc[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [localThinking, setLocalThinking] = useState<NpcThinking[]>([]);
  const [remoteThinking, setRemoteThinking] = useState<NpcThinking[]>([]);
  const npcsRef = useRef<PartyNpc[]>([]);
  npcsRef.current = npcs;
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const remoteTimers = useRef<Record<string, number>>({});

  const load = useCallback(async () => {
    if (!partyId) { setNpcs([]); setLoaded(true); return; }
    const { data, error } = await (supabase.from('party_npcs') as any)
      .select('*')
      .eq('party_id', partyId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) console.error('[npcs] roster load failed:', error);
    else setNpcs(sortNpcs((data || []) as PartyNpc[]));
    setLoaded(true);
  }, [partyId]);

  useEffect(() => { setLoaded(false); void load(); }, [load]);

  // Live roster updates, plus "thinking" notes from other phones (broadcast, never stored).
  useEffect(() => {
    if (!partyId) return;
    const dropRemote = (key: string) => {
      window.clearTimeout(remoteTimers.current[key]);
      delete remoteTimers.current[key];
      setRemoteThinking(prev => prev.filter(t => t.key !== key));
    };
    const channel = supabase
      .channel(`party-npcs-${partyId}`, { config: { broadcast: { self: false } } })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'party_npcs', filter: `party_id=eq.${partyId}`,
      }, (payload: any) => {
        if (payload.eventType === 'DELETE') {
          const oldId = payload.old?.id;
          setNpcs(prev => prev.filter(n => n.id !== oldId));
          return;
        }
        const row = payload.new as PartyNpc;
        if (!row?.id) return;
        setNpcs(prev => sortNpcs(prev.some(n => n.id === row.id) ? prev.map(n => (n.id === row.id ? row : n)) : [...prev, row]));
      })
      .on('broadcast', { event: 'npc-thinking' }, ({ payload }: { payload: NpcThinking }) => {
        if (!payload?.key || !payload.npcId) return;
        setRemoteThinking(prev => (prev.some(t => t.key === payload.key) ? prev : [...prev, payload]));
        window.clearTimeout(remoteTimers.current[payload.key]);
        remoteTimers.current[payload.key] = window.setTimeout(() => dropRemote(payload.key), REMOTE_THINKING_MS);
      })
      .on('broadcast', { event: 'npc-done' }, ({ payload }: { payload: { key?: string } }) => {
        if (payload?.key) dropRemote(payload.key);
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      channelRef.current = null;
      Object.values(remoteTimers.current).forEach(id => window.clearTimeout(id));
      remoteTimers.current = {};
      setRemoteThinking([]);
      supabase.removeChannel(channel);
    };
  }, [partyId]);

  const active = useMemo(() => npcs.filter(n => !n.archived), [npcs]);
  const onStage = useMemo(() => npcs.filter(n => n.on_stage && !n.archived), [npcs]);
  const byId = useMemo(() => new Map(npcs.map(n => [n.id, n])), [npcs]);
  const thinking = useMemo(() => {
    const keys = new Set(localThinking.map(t => t.key));
    return [...localThinking, ...remoteThinking.filter(t => !keys.has(t.key))];
  }, [localThinking, remoteThinking]);

  // ── Host: the roster ──

  /** Changes one NPC row. Throws a plain-language Error when the save fails. */
  const patchNpc = useCallback(async (id: string, patch: Partial<Pick<PartyNpc, 'name' | 'model' | 'portrait_url' | 'on_stage' | 'archived' | 'sort_order'>>) => {
    const before = npcsRef.current.find(n => n.id === id);
    if (before) setNpcs(prev => sortNpcs(prev.map(n => (n.id === id ? { ...n, ...patch } : n))));
    const { data, error } = await (supabase.from('party_npcs') as any)
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error) {
      if (before) setNpcs(prev => sortNpcs(prev.map(n => (n.id === id ? before : n))));
      throw new Error(rosterError(error, patch.name ?? before?.name));
    }
    const row = data as PartyNpc;
    setNpcs(prev => sortNpcs(prev.map(n => (n.id === id ? row : n))));
    return row;
  }, []);

  /** Saves an NPC's guide and secrets (host only). Throws a plain-language Error on failure. */
  const saveGuide = useCallback(async (npcId: string, guide: string, secrets: string) => {
    if (!partyId) throw new Error('No party is open.');
    const { error } = await (supabase.from('party_npc_guides') as any).upsert({
      npc_id: npcId,
      party_id: partyId,
      guide,
      secrets,
    }, { onConflict: 'npc_id' });
    if (error) throw new Error(rosterError(error));
  }, [partyId]);

  /** Reads an NPC's guide and secrets (host only; the database refuses anyone else). */
  const loadGuide = useCallback(async (npcId: string): Promise<{ guide: string; secrets: string }> => {
    const { data, error } = await (supabase.from('party_npc_guides') as any)
      .select('guide, secrets')
      .eq('npc_id', npcId)
      .maybeSingle();
    if (error) throw new Error(rosterError(error));
    return { guide: data?.guide ?? '', secrets: data?.secrets ?? '' };
  }, []);

  /** Adds an NPC (off stage) and, when given, its guide. Throws a plain-language Error on failure. */
  const addNpc = useCallback(async (input: { name: string; model?: string; portraitUrl?: string | null; guide?: string; secrets?: string }) => {
    if (!partyId) throw new Error('No party is open.');
    const name = cleanNpcName(input.name);
    const nextSort = npcsRef.current.reduce((max, n) => Math.max(max, n.sort_order), 0) + 1;
    const { data, error } = await (supabase.from('party_npcs') as any)
      .insert({
        party_id: partyId,
        name,
        model: input.model || NPC_DEFAULT_MODEL,
        portrait_url: input.portraitUrl ?? null,
        sort_order: nextSort,
      })
      .select('*')
      .single();
    if (error) throw new Error(rosterError(error, name));
    const npc = data as PartyNpc;
    setNpcs(prev => sortNpcs(prev.some(n => n.id === npc.id) ? prev : [...prev, npc]));
    if ((input.guide || '').trim() || (input.secrets || '').trim()) {
      try {
        await saveGuide(npc.id, input.guide || '', input.secrets || '');
      } catch (err) {
        throw new Error(`${npc.name} was added, but the guide did not save: ${err instanceof Error ? err.message : 'unknown error'}. Open ${npc.name} and save again.`);
      }
    }
    return npc;
  }, [partyId, saveGuide]);

  const updateNpc = useCallback(
    (id: string, patch: Partial<Pick<PartyNpc, 'name' | 'model' | 'portrait_url' | 'sort_order'>>) =>
      patchNpc(id, patch.name !== undefined ? { ...patch, name: cleanNpcName(patch.name) } : patch),
    [patchNpc],
  );
  const setOnStage = useCallback((id: string, on: boolean) => patchNpc(id, { on_stage: on }), [patchNpc]);
  const archiveNpc = useCallback((id: string) => patchNpc(id, { archived: true, on_stage: false }), [patchNpc]);
  const restoreNpc = useCallback((id: string) => patchNpc(id, { archived: false }), [patchNpc]);

  /** Uploads a portrait and returns its public address. Throws a plain-language Error on failure. */
  const uploadPortrait = useCallback(async (file: File): Promise<string> => {
    if (!partyId) throw new Error('No party is open.');
    if (file.size > 8 * 1024 * 1024) throw new Error('Image too large (max 8MB).');
    const ext = (file.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
    const path = `npc-portraits/${partyId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('party-chat-images').upload(path, file);
    if (error) throw new Error(error.message || 'Upload failed.');
    return supabase.storage.from('party-chat-images').getPublicUrl(path).data.publicUrl;
  }, [partyId]);

  // ── Anyone: asking an NPC ──

  const startThinking = useCallback((entry: NpcThinking) => {
    setLocalThinking(prev => (prev.some(t => t.key === entry.key) ? prev : [...prev, entry]));
    void channelRef.current?.send({ type: 'broadcast', event: 'npc-thinking', payload: entry });
  }, []);

  const stopThinking = useCallback((key: string) => {
    setLocalThinking(prev => prev.filter(t => t.key !== key));
    void channelRef.current?.send({ type: 'broadcast', event: 'npc-done', payload: { key } });
  }, []);

  /**
   * Ask an on-stage NPC to answer one of your own Live Table lines. The answer arrives
   * as a new Live Table line. Resolves true when the NPC answered; failures show a
   * message (with Retry when trying again can help) and resolve false.
   */
  const askNpc = useCallback(async (messageId: string, npcId: string): Promise<boolean> => {
    const name = npcsRef.current.find(n => n.id === npcId)?.name || 'The NPC';
    const key = `${messageId}:${npcId}`;
    startThinking({ key, npcId, name, messageId, kind: 'answer' });
    try {
      const { error } = await supabase.functions.invoke('npc-reply', { body: { messageId, npcId } });
      if (!error) return true;
      const { message, status } = await readableFunctionError(error, `${name} couldn't answer. Check your connection and try again.`);
      if (status === 409 || status === 403 || status === 404) {
        toast.info(message, { duration: 8000 });
      } else {
        toast.error(message, {
          duration: 15000,
          action: { label: 'Retry', onClick: () => { void askRef.current(messageId, npcId); } },
        });
      }
      return false;
    } finally {
      stopThinking(key);
    }
  }, [startThinking, stopThinking]);
  const askRef = useRef(askNpc);
  askRef.current = askNpc;

  /** Ask several NPCs about the same line, one after another, so each can hear the one before. */
  const askNpcs = useCallback(async (messageId: string, npcIds: string[]) => {
    for (const npcId of npcIds) await askNpc(messageId, npcId);
  }, [askNpc]);

  /** Host only: replace an NPC's answer with a new one (the same line is rewritten). */
  const regenerateLine = useCallback(async (replyMessageId: string, npcId: string | null) => {
    const name = (npcId && npcsRef.current.find(n => n.id === npcId)?.name) || 'The NPC';
    const key = `regen:${replyMessageId}`;
    startThinking({ key, npcId: npcId || '', name, messageId: replyMessageId, kind: 'regenerate' });
    try {
      const { error } = await supabase.functions.invoke('npc-reply', { body: { action: 'regenerate', replyMessageId } });
      if (!error) return true;
      const { message } = await readableFunctionError(error, `${name} couldn't answer again. The old line was kept.`);
      toast.error(message, { duration: 12000 });
      return false;
    } finally {
      stopThinking(key);
    }
  }, [startThinking, stopThinking]);

  return {
    partyId,
    npcs,
    active,
    onStage,
    byId,
    loaded,
    thinking,
    reload: load,
    addNpc,
    updateNpc,
    setOnStage,
    archiveNpc,
    restoreNpc,
    loadGuide,
    saveGuide,
    uploadPortrait,
    askNpc,
    askNpcs,
    regenerateLine,
  };
}

export type PartyNpcsApi = ReturnType<typeof usePartyNpcs>;
