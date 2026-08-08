import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Quest, normalizeQuestMap, toStored, WorldStateEntry, WORLD_STATE_KEY, normalizeWorldState, toStoredWorldState, mergeWorldState } from '@/lib/quests';

/**
 * Party quest board. Quests live in party_shared_state under the 'quest_flags'
 * row owned by the party host, so every member reads the same list in realtime.
 *
 * Reads never assume a single row exists. Older sessions wrote a copy per
 * player, and a `.maybeSingle()` across those duplicates fails outright and
 * renders an empty board even though the quests are saved. Instead we take the
 * host's row when present and otherwise the most recently updated copy.
 */
export function usePartyQuests(partyId: string | null, userId: string, ownerUserId?: string | null) {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [worldState, setWorldStateList] = useState<WorldStateEntry[]>([]);
  const worldStateRef = useRef<WorldStateEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const rawRef = useRef<Record<string, any>>({});
  // Party host — the single writer of record for the shared board.
  const [hostId, setHostId] = useState<string | null>(ownerUserId ?? null);
  const hostIdRef = useRef<string | null>(ownerUserId ?? null);
  useEffect(() => { hostIdRef.current = hostId; }, [hostId]);

  useEffect(() => {
    if (ownerUserId) { setHostId(ownerUserId); return; }
    if (!partyId) return;
    let cancelled = false;
    (supabase.from('parties') as any)
      .select('created_by')
      .eq('id', partyId)
      .maybeSingle()
      .then(({ data }: any) => {
        if (!cancelled && data?.created_by) setHostId(data.created_by);
      }, () => {});
    return () => { cancelled = true; };
  }, [partyId, ownerUserId]);

  /** Pick the board to trust: the host's copy, else the newest copy. */
  const pickRow = useCallback((rows: any[] | null | undefined) => {
    const list = rows ?? [];
    const host = hostIdRef.current;
    return (host && list.find(r => r.user_id === host)) || list[0] || null;
  }, []);

  const fetchRows = useCallback(async () => {
    if (!partyId) return null;
    const { data, error } = await (supabase.from('party_shared_state') as any)
      .select('user_id, state_data, updated_at')
      .eq('party_id', partyId)
      .eq('state_type', 'quest_flags')
      .order('updated_at', { ascending: false });
    if (error) {
      console.warn('[party-quests] failed to read the quest board:', error);
      return null;
    }
    return data as any[];
  }, [partyId]);

  const load = useCallback(async () => {
    if (!partyId) { setLoading(false); return; }
    const rows = await fetchRows();
    if (rows) {
      rawRef.current = (pickRow(rows)?.state_data as Record<string, any>) ?? {};
      setQuests(normalizeQuestMap(rawRef.current));
      worldStateRef.current = normalizeWorldState(rawRef.current);
      setWorldStateList(worldStateRef.current);
    }
    setLoading(false);
  }, [partyId, fetchRows, pickRow]);

  useEffect(() => { load(); }, [load, hostId]);

  useEffect(() => {
    if (!partyId) return;
    const channel = supabase
      .channel(`party-quests-${partyId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'party_shared_state',
        filter: `party_id=eq.${partyId}`,
      }, (payload: any) => {
        const row = payload.new as any;
        if (row?.state_type !== 'quest_flags') return;
        // Ignore stray per-player copies once we know who the host is.
        const host = hostIdRef.current;
        if (host && row.user_id && row.user_id !== host) return;
        rawRef.current = row.state_data ?? {};
        setQuests(normalizeQuestMap(rawRef.current));
        worldStateRef.current = normalizeWorldState(rawRef.current);
        setWorldStateList(worldStateRef.current);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [partyId]);

  /** Write the whole board back. Always targets the host's row. */
  const persist = useCallback(async (next: Record<string, any>) => {
    if (!partyId) return;
    rawRef.current = next;
    setQuests(normalizeQuestMap(next));
    worldStateRef.current = normalizeWorldState(next);
    setWorldStateList(worldStateRef.current);
    const { error } = await (supabase.from('party_shared_state') as any).upsert({
      party_id: partyId,
      user_id: hostIdRef.current || ownerUserId || userId,
      state_type: 'quest_flags',
      state_data: next,
    }, { onConflict: 'party_id,user_id,state_type' });
    if (error) console.warn('[party-quests] failed to save the quest board:', error);
  }, [partyId, userId, ownerUserId]);

  /** Re-read first so two players acting at once cannot wipe each other's edits. */
  const readCurrent = useCallback(async (): Promise<Record<string, any>> => {
    const rows = await fetchRows();
    if (!rows) return rawRef.current ?? {};
    return (pickRow(rows)?.state_data as Record<string, any>) ?? rawRef.current ?? {};
  }, [fetchRows, pickRow]);

  const upsertQuest = useCallback(async (quest: Quest) => {
    const current = await readCurrent();
    await persist({ ...current, [quest.key]: toStored(quest) });
  }, [readCurrent, persist]);

  const removeQuest = useCallback(async (key: string) => {
    const current = await readCurrent();
    const { [key]: _drop, ...rest } = current;
    await persist(rest);
  }, [readCurrent, persist]);

  /**
   * Fold irreversible story outcomes into the shared world-state log.
   * Returns only the entries that were genuinely new, so callers can announce them.
   */
  const recordWorldState = useCallback(async (incoming: any[]): Promise<WorldStateEntry[]> => {
    const { entries, added } = mergeWorldState(worldStateRef.current, incoming);
    if (added.length === 0) return [];
    const current = await readCurrent();
    const merged = mergeWorldState(normalizeWorldState(current), incoming);
    await persist({ ...current, [WORLD_STATE_KEY]: toStoredWorldState(merged.entries.length ? merged.entries : entries) });
    return merged.added.length ? merged.added : added;
  }, [readCurrent, persist]);

  return { quests, worldState, loading, upsertQuest, removeQuest, recordWorldState, reload: load };
}
