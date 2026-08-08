import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DEFAULT_QUEST_REWARD_SPLIT, type QuestRewardSplitMode } from '@/lib/questRewardSplit';

const STATE_TYPE = 'quest_reward_split';
const VALID: QuestRewardSplitMode[] = ['full', 'equal', 'weighted', 'contributors'];

const parseMode = (raw: unknown): QuestRewardSplitMode => {
  const mode = (raw as any)?.mode;
  return VALID.includes(mode) ? mode : DEFAULT_QUEST_REWARD_SPLIT;
};

/**
 * Party-wide setting for how quest XP and gold are shared out on completion.
 * Stored once per party (host's row) so every member reads the same rule.
 */
export function useQuestRewardSplit(partyId: string | null, userId: string, ownerUserId?: string | null) {
  const [mode, setMode] = useState<QuestRewardSplitMode>(DEFAULT_QUEST_REWARD_SPLIT);

  const load = useCallback(async () => {
    if (!partyId) return;
    const { data } = await (supabase.from('party_shared_state') as any)
      .select('state_data')
      .eq('party_id', partyId)
      .eq('state_type', STATE_TYPE)
      .maybeSingle();
    setMode(parseMode(data?.state_data));
  }, [partyId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!partyId) return;
    const channel = supabase
      .channel(`party-quest-split-${partyId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'party_shared_state',
        filter: `party_id=eq.${partyId}`,
      }, (payload: any) => {
        const row = payload.new as any;
        if (row?.state_type === STATE_TYPE) setMode(parseMode(row.state_data));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [partyId]);

  const updateMode = useCallback(async (next: QuestRewardSplitMode) => {
    if (!partyId || !VALID.includes(next)) return;
    setMode(next);
    await (supabase.from('party_shared_state') as any).upsert({
      party_id: partyId,
      user_id: ownerUserId || userId,
      state_type: STATE_TYPE,
      state_data: { mode: next },
    }, { onConflict: 'party_id,user_id,state_type' });
  }, [partyId, userId, ownerUserId]);

  return { mode, setMode: updateMode, reload: load };
}
