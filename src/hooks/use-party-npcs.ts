import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { NPC_DEFAULT_MODEL, NPC_GUIDE_MAX, cleanNpcName, readableFunctionError, spellCastName } from '@/lib/live-npcs';

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
  /** v2: false when the host switched spell reactions off for this NPC. */
  reacts_to_spells: boolean;
  /** Set when this "NPC" is a player's character played by the AI while they are away. */
  player_user_id?: string | null;
  created_at: string;
  updated_at: string;
}

/** v2: how an NPC feels about one seated player's character. Players only load their own. */
export interface NpcAttitudeRow {
  npc_id: string;
  party_id: string;
  user_id: string;
  character_name: string;
  /** -2 Hostile, -1 Wary, 0 Neutral, 1 Friendly, 2 Loyal. */
  score: number;
  reason: string;
  updated_by: 'ai' | 'host';
  updated_at: string;
}

/** v2: one thing an NPC remembers (host only). */
export interface NpcMemoryNote {
  id: string;
  npc_id: string;
  note: string;
  source: 'ai' | 'host';
  created_at: string;
}

/** An NPC answer in progress, shown as "Grukk is thinking…". */
export interface NpcThinking {
  key: string;
  npcId: string;
  name: string;
  /** The line being answered, or the NPC line being rewritten. */
  messageId: string;
  kind: 'answer' | 'regenerate' | 'spell' | 'roll' | 'banter';
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
  const [attitudes, setAttitudes] = useState<NpcAttitudeRow[]>([]);
  const [sceneRunning, setSceneRunning] = useState(false);
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

  // v2: attitudes. The database returns every row to the host and only their own rows to a player.
  const loadAttitudes = useCallback(async () => {
    if (!partyId) { setAttitudes([]); return; }
    const { data, error } = await (supabase.from('party_npc_attitudes') as any)
      .select('*')
      .eq('party_id', partyId);
    if (error) console.error('[npcs] attitudes load failed:', error);
    else setAttitudes((data || []) as NpcAttitudeRow[]);
  }, [partyId]);

  useEffect(() => { void loadAttitudes(); }, [loadAttitudes]);

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
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'party_npc_attitudes', filter: `party_id=eq.${partyId}`,
      }, (payload: any) => {
        if (payload.eventType === 'DELETE') {
          const old = payload.old as Partial<NpcAttitudeRow>;
          setAttitudes(prev => prev.filter(a => !(a.npc_id === old?.npc_id && a.user_id === old?.user_id)));
          return;
        }
        const row = payload.new as NpcAttitudeRow;
        if (!row?.npc_id) return;
        setAttitudes(prev => {
          const others = prev.filter(a => !(a.npc_id === row.npc_id && a.user_id === row.user_id));
          return [...others, row];
        });
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
  const patchNpc = useCallback(async (id: string, patch: Partial<Pick<PartyNpc, 'name' | 'model' | 'portrait_url' | 'on_stage' | 'archived' | 'sort_order' | 'reacts_to_spells'>>) => {
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
  const setReactsToSpells = useCallback((id: string, on: boolean) => patchNpc(id, { reacts_to_spells: on }), [patchNpc]);

  // ── Player stand-ins: an away player's character played as a live NPC ──

  /** Puts a seated player's character on stage, using their AFK guide as its personality guide. */
  const addStandIn = useCallback(async (seat: { user_id: string; character_name: string }): Promise<PartyNpc> => {
    if (!partyId) throw new Error('No party is open.');
    const [{ data: member }, { data: avatar }] = await Promise.all([
      (supabase.from('party_members') as any).select('character_status').eq('party_id', partyId).eq('user_id', seat.user_id).maybeSingle(),
      (supabase.from('player_chat_avatars') as any).select('ic_url').eq('user_id', seat.user_id).maybeSingle(),
    ]);
    const afk = String(member?.character_status?.afkPersonalityGuide || '').trim();
    const guide = (`You are ${seat.character_name}, a player character in this party, being played while their player is away. ` +
      `Stay true to who they are and keep their goals; do not make big permanent choices for them (no deals, oaths, deaths or giving away their things).\n\n` +
      (afk ? `THEIR PLAYER'S GUIDE:\n${afk}` : 'Their player left no guide; play them as the story so far shows them.')).slice(0, NPC_GUIDE_MAX);
    const existing = npcsRef.current.find(n => n.player_user_id === seat.user_id);
    if (existing) {
      await patchNpc(existing.id, { on_stage: true, archived: false, portrait_url: existing.portrait_url || avatar?.ic_url || null });
      await saveGuide(existing.id, guide, '');
      return existing;
    }
    let name = cleanNpcName(seat.character_name);
    if (npcsRef.current.some(n => n.name.toLowerCase() === name.toLowerCase())) name = cleanNpcName(`${name} (away)`);
    const nextSort = npcsRef.current.reduce((max, n) => Math.max(max, n.sort_order), 0) + 1;
    const { data, error } = await (supabase.from('party_npcs') as any)
      .insert({ party_id: partyId, name, model: NPC_DEFAULT_MODEL, portrait_url: avatar?.ic_url ?? null, sort_order: nextSort, on_stage: true, player_user_id: seat.user_id })
      .select('*').single();
    if (error) throw new Error(rosterError(error, name));
    const npc = data as PartyNpc;
    setNpcs(prev => sortNpcs(prev.some(n => n.id === npc.id) ? prev : [...prev, npc]));
    await saveGuide(npc.id, guide, '');
    return npc;
  }, [partyId, patchNpc, saveGuide]);

  /** Steps a stand-in off stage when the real player speaks in the Live Table or readies up (host's device does the update). */
  useEffect(() => {
    if (!partyId) return;
    const stepDown = async (userId: string) => {
      const npc = npcsRef.current.find(n => n.player_user_id === userId && n.on_stage && !n.archived);
      if (!npc) return;
      const { data } = await (supabase.from('party_npcs') as any).update({ on_stage: false }).eq('id', npc.id).select('id');
      if (data?.length) toast.info(`${npc.name}'s player is back, so their stand-in left the stage.`);
    };
    const ch = supabase.channel(`npc-stand-ins:${partyId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'party_round_chat', filter: `party_id=eq.${partyId}` }, ({ new: row }: any) => {
        if (row?.user_id && !row.npc_id) void stepDown(row.user_id);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'party_dm_prompts', filter: `party_id=eq.${partyId}` }, ({ new: row }: any) => {
        if (row?.user_id && row.is_ready) void stepDown(row.user_id);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [partyId]);

  /** The signed-in player's own stand-in, if the host ever made one. */
  const standInFor = useCallback((userId: string | null | undefined) => npcsRef.current.find(n => n.player_user_id === userId) ?? null, []);

  // ── v2, host: memory and attitudes ──

  /** Seated characters, for the attitude list. */
  const loadSeats = useCallback(async (): Promise<Array<{ user_id: string; character_name: string }>> => {
    if (!partyId) return [];
    const { data, error } = await (supabase.from('party_members') as any)
      .select('user_id, character_name')
      .eq('party_id', partyId);
    if (error) throw new Error(error.message || 'Could not load the party.');
    return ((data || []) as Array<{ user_id: string; character_name: string | null }>)
      .filter(s => (s.character_name || '').trim())
      .map(s => ({ user_id: s.user_id, character_name: (s.character_name || '').trim() }));
  }, [partyId]);

  /** What an NPC remembers, oldest first (host only; the database refuses anyone else). */
  const loadMemories = useCallback(async (npcId: string): Promise<NpcMemoryNote[]> => {
    const { data, error } = await (supabase.from('party_npc_memories') as any)
      .select('id, npc_id, note, source, created_at')
      .eq('npc_id', npcId)
      .order('created_at', { ascending: true });
    if (error) throw new Error(rosterError(error));
    return (data || []) as NpcMemoryNote[];
  }, []);

  const addMemory = useCallback(async (npcId: string, note: string): Promise<NpcMemoryNote> => {
    if (!partyId) throw new Error('No party is open.');
    const text = note.replace(/\s+/g, ' ').trim().slice(0, 300);
    if (!text) throw new Error('Write the note first.');
    const { data, error } = await (supabase.from('party_npc_memories') as any)
      .insert({ npc_id: npcId, party_id: partyId, note: text, source: 'host' })
      .select('id, npc_id, note, source, created_at')
      .single();
    if (error) throw new Error(rosterError(error));
    return data as NpcMemoryNote;
  }, [partyId]);

  /** Editing a note makes it the host's own, so it never drops off. */
  const updateMemory = useCallback(async (id: string, note: string) => {
    const text = note.replace(/\s+/g, ' ').trim().slice(0, 300);
    if (!text) throw new Error('A note cannot be empty. Delete it instead.');
    const { error } = await (supabase.from('party_npc_memories') as any).update({ note: text, source: 'host' }).eq('id', id);
    if (error) throw new Error(rosterError(error));
  }, []);

  const deleteMemory = useCallback(async (id: string) => {
    const { error } = await (supabase.from('party_npc_memories') as any).delete().eq('id', id);
    if (error) throw new Error(rosterError(error));
  }, []);

  /** Host: set how an NPC feels about a character (-2 … 2). */
  const setAttitude = useCallback(async (npcId: string, userId: string, characterName: string, score: number) => {
    if (!partyId) throw new Error('No party is open.');
    const clamped = Math.max(-2, Math.min(2, Math.round(score)));
    const { data, error } = await (supabase.from('party_npc_attitudes') as any)
      .upsert({
        npc_id: npcId,
        party_id: partyId,
        user_id: userId,
        character_name: characterName,
        score: clamped,
        reason: 'Set by the host',
        updated_by: 'host',
      }, { onConflict: 'npc_id,user_id' })
      .select('*')
      .single();
    if (error) throw new Error(rosterError(error));
    const row = data as NpcAttitudeRow;
    setAttitudes(prev => [...prev.filter(a => !(a.npc_id === npcId && a.user_id === userId)), row]);
  }, [partyId]);

  /** An NPC's attitude toward a player, or 0 (Neutral) when there is none. */
  const attitudeFor = useCallback(
    (npcId: string, userId: string | null | undefined) =>
      attitudes.find(a => a.npc_id === npcId && a.user_id === userId)?.score ?? 0,
    [attitudes],
  );

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
  const askNpc = useCallback(async (messageId: string, npcId: string, kind: 'answer' | 'roll' = 'answer'): Promise<boolean> => {
    const name = npcsRef.current.find(n => n.id === npcId)?.name || 'The NPC';
    const key = `${messageId}:${npcId}`;
    startThinking({ key, npcId, name, messageId, kind });
    try {
      const { error } = await supabase.functions.invoke('npc-reply', { body: { messageId, npcId } });
      if (!error) return true;
      const { message, status } = await readableFunctionError(error, `${name} couldn't answer. Check your connection and try again.`);
      if (status === 409 || status === 403 || status === 404) {
        toast.info(message, { duration: 8000 });
      } else {
        toast.error(message, {
          duration: 15000,
          action: { label: 'Retry', onClick: () => { void askRef.current(messageId, npcId, kind); } },
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

  // ── v2: spells, scenes, memory ──

  /**
   * After a player posts a line: if it casts a spell and an on-stage NPC reacts to spells,
   * the server lets up to 3 of them react (one after another). Does nothing otherwise.
   */
  const reactToSpell = useCallback(async (messageId: string, content: string): Promise<void> => {
    if (!spellCastName(content)) return;
    const reactors = npcsRef.current.filter(n => n.on_stage && !n.archived && n.reacts_to_spells !== false).slice(0, 3);
    if (reactors.length === 0) return;
    const keys = reactors.map(n => `spell:${messageId}:${n.id}`);
    reactors.forEach((n, i) => startThinking({ key: keys[i], npcId: n.id, name: n.name, messageId, kind: 'spell' }));
    try {
      const { data, error } = await supabase.functions.invoke('npc-reply', { body: { action: 'spell', messageId } });
      if (error) {
        const { message, status } = await readableFunctionError(error, 'The NPCs could not react to that spell.');
        if (status === 409 || status === 400) toast.info(message, { duration: 8000 });
        else toast.error(message, { duration: 12000 });
        return;
      }
      const failed = (data?.failed || []) as Array<{ npc: string }>;
      if (failed.length) toast.info(`${failed.map(f => f.npc).join(' and ')} couldn't react to the spell.`, { duration: 8000 });
    } finally {
      keys.forEach(k => stopThinking(k));
    }
  }, [startThinking, stopThinking]);

  /** Host only: 2 or 3 on-stage NPCs talk to each other for 2 to 4 lines. Any player line stops it. */
  const runScene = useCallback(async (npcIds: string[], topic: string, turns: number): Promise<boolean> => {
    if (!partyId || sceneRunning) return false;
    const cast = npcIds.map(id => npcsRef.current.find(n => n.id === id)).filter((n): n is PartyNpc => !!n);
    if (cast.length < 2) { toast.info('Pick 2 or 3 NPCs on stage.'); return false; }
    const stamp = Date.now();
    const keys = cast.map(n => `banter:${stamp}:${n.id}`);
    setSceneRunning(true);
    cast.forEach((n, i) => startThinking({ key: keys[i], npcId: n.id, name: n.name, messageId: '', kind: 'banter' }));
    try {
      const { data, error } = await supabase.functions.invoke('npc-reply', {
        body: { action: 'banter', partyId, npcIds: cast.map(n => n.id), topic, turns },
      });
      if (error) {
        const { message } = await readableFunctionError(error, 'The scene could not start. Try again.');
        toast.error(message, { duration: 12000 });
        return false;
      }
      if (data?.stopped) toast.info(String(data.stopped), { duration: 8000 });
      return true;
    } finally {
      keys.forEach(k => stopThinking(k));
      setSceneRunning(false);
    }
  }, [partyId, sceneRunning, startThinking, stopThinking]);

  /**
   * After a Send to DM: the NPCs in the handed-off lines remember the scene and may warm up
   * or cool down toward the characters in it (server function npc-memory). Never blocks the
   * hand-off; resolves with a plain message when it failed.
   */
  const rememberScene = useCallback(async (npcLineIds: string[]): Promise<{ ok: boolean; message?: string }> => {
    const ids = Array.from(new Set(npcLineIds.filter(Boolean)));
    if (ids.length === 0) return { ok: true };
    const { error } = await supabase.functions.invoke('npc-memory', { body: { lineIds: ids } });
    if (!error) return { ok: true };
    const { message } = await readableFunctionError(error, 'NPC memory could not be updated.');
    console.warn('[npcs] memory update failed:', message);
    return { ok: false, message };
  }, []);

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
    // v2
    attitudes,
    attitudeFor,
    setAttitude,
    reloadAttitudes: loadAttitudes,
    setReactsToSpells,
    loadSeats,
    loadMemories,
    addMemory,
    updateMemory,
    deleteMemory,
    reactToSpell,
    runScene,
    sceneRunning,
    rememberScene,
  };
}

export type PartyNpcsApi = ReturnType<typeof usePartyNpcs>;
