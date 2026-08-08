import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Quest, normalizeQuestMap, toStored, WorldStateEntry, WORLD_STATE_KEY, normalizeWorldState, toStoredWorldState, mergeWorldState } from '@/lib/quests';

/**
 * Party quest board. Quests live in party_shared_state under the 'quest_flags'
 * row owned by the party host, so every member reads the same list in realtime.
 */
export function usePartyQuests(partyId: string | null, userId: string, ownerUserId?: string | null) {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [worldState, setWorldStateList] = useState<WorldStateEntry[]>([]);
  const worldStateRef = useRef<WorldStateEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const rawRef = useRef<Record<string, any>>({});

  const load = useCallback(async () => {
    if (!partyId) { setLoading(false); return; }
    const { data } = await (supabase.from('party_shared_state') as any)
      .select('state_data')
      .eq('party_id', partyId)
      .eq('state_type', 'quest_flags')
      .maybeSingle();
    rawRef.current = (data?.state_data as Record<string, any>) ?? {};
    setQuests(normalizeQuestMap(rawRef.current));
    worldStateRef.current = normalizeWorldState(rawRef.current);
    setWorldStateList(worldStateRef.current);
    setLoading(false);
  }, [partyId]);

  useEffect(() => { load(); }, [load]);

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
        if (row?.state_type === 'quest_flags') {
          rawRef.current = row.state_data ?? {};
          setQuests(normalizeQuestMap(rawRef.current));
          worldStateRef.current = normalizeWorldState(rawRef.current);
          setWorldStateList(worldStateRef.current);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [partyId]);

  /** Write the whole board back. Uses the host's row so everyone shares one list. */
  const persist = useCallback(async (next: Record<string, any>) => {
    if (!partyId) return;
    rawRef.current = next;
    setQuests(normalizeQuestMap(next));
    worldStateRef.current = normalizeWorldState(next);
    setWorldStateList(worldStateRef.current);
    await (supabase.from('party_shared_state') as any).upsert({
      party_id: partyId,
      user_id: ownerUserId || userId,
      state_type: 'quest_flags',
      state_data: next,
    }, { onConflict: 'party_id,user_id,state_type' });
  }, [partyId, userId, ownerUserId]);

  const upsertQuest = useCallback(async (quest: Quest) => {
    // Re-read first so two players acting at once cannot wipe each other's edits.
    const { data } = await (supabase.from('party_shared_state') as any)
      .select('state_data')
      .eq('party_id', partyId)
      .eq('state_type', 'quest_flags')
      .maybeSingle();
    const current = (data?.state_data as Record<string, any>) ?? rawRef.current ?? {};
    await persist({ ...current, [quest.key]: toStored(quest) });
  }, [partyId, persist]);

  const removeQuest = useCallback(async (key: string) => {
    const { [key]: _drop, ...rest } = rawRef.current;
    await persist(rest);
  }, [persist]);

  /**
   * Fold irreversible story outcomes into the shared world-state log.
   * Returns only the entries that were genuinely new, so callers can announce them.
   */
  const recordWorldState = useCallback(async (incoming: any[]): Promise<WorldStateEntry[]> => {
    const { entries, added } = mergeWorldState(worldStateRef.current, incoming);
    if (added.length === 0) return [];
    // Re-read first so two players acting at once cannot wipe each other's edits.
    const { data } = await (supabase.from('party_shared_state') as any)
      .select('state_data')
      .eq('party_id', partyId)
      .eq('state_type', 'quest_flags')
      .maybeSingle();
    const current = (data?.state_data as Record<string, any>) ?? rawRef.current ?? {};
    const merged = mergeWorldState(normalizeWorldState(current), incoming);
    await persist({ ...current, [WORLD_STATE_KEY]: toStoredWorldState(merged.entries.length ? merged.entries : entries) });
    return merged.added.length ? merged.added : added;
  }, [partyId, persist]);

  return { quests, worldState, loading, upsertQuest, removeQuest, recordWorldState, reload: load };
}
