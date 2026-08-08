import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Quest, normalizeQuestMap, toStored } from '@/lib/quests';

/**
 * Party quest board. Quests live in party_shared_state under the 'quest_flags'
 * row owned by the party host, so every member reads the same list in realtime.
 */
export function usePartyQuests(partyId: string | null, userId: string, ownerUserId?: string | null) {
  const [quests, setQuests] = useState<Quest[]>([]);
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

  return { quests, loading, upsertQuest, removeQuest, reload: load };
}
