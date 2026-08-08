import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  DEFAULT_NARRATION_STATE,
  normalizeNarrationState,
  type NarrationIntensity,
  type NarrationStyleId,
  type NarrationStyleState,
} from '@/lib/narrationStyle';

export const NARRATION_STYLE_STATE_TYPE = 'narration_style';

/** Table-wide narration tone. Host writes, everyone reads (live). */
export function usePartyNarrationStyle(partyId: string | null, userId: string, ownerUserId?: string | null) {
  const [state, setState] = useState<NarrationStyleState>(DEFAULT_NARRATION_STATE);

  const load = useCallback(async () => {
    if (!partyId) return;
    const { data } = await (supabase.from('party_shared_state') as any)
      .select('state_data')
      .eq('party_id', partyId)
      .eq('state_type', NARRATION_STYLE_STATE_TYPE)
      .maybeSingle();
    setState(normalizeNarrationState(data?.state_data));
  }, [partyId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!partyId) return;
    const channel = supabase
      .channel(`party-narration-style-${partyId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'party_shared_state',
        filter: `party_id=eq.${partyId}`,
      }, (payload: any) => {
        const row = payload.new as any;
        if (row?.state_type === NARRATION_STYLE_STATE_TYPE) setState(normalizeNarrationState(row.state_data));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [partyId]);

  const write = useCallback(async (next: NarrationStyleState) => {
    if (!partyId) return;
    setState(next);
    await (supabase.from('party_shared_state') as any).upsert({
      party_id: partyId,
      user_id: ownerUserId || userId,
      state_type: NARRATION_STYLE_STATE_TYPE,
      state_data: next,
    }, { onConflict: 'party_id,user_id,state_type' });
  }, [partyId, userId, ownerUserId]);

  const setStyle = useCallback((style: NarrationStyleId) => { void write({ ...state, style }); }, [state, write]);
  const setIntensity = useCallback((intensity: NarrationIntensity) => { void write({ ...state, intensity }); }, [state, write]);

  return { state, setStyle, setIntensity, reload: load };
}

/** Read the party narration style outside React (request time). */
export async function fetchPartyNarrationStyle(partyId: string | null): Promise<NarrationStyleState> {
  if (!partyId) return DEFAULT_NARRATION_STATE;
  try {
    const { data } = await (supabase.from('party_shared_state') as any)
      .select('state_data')
      .eq('party_id', partyId)
      .eq('state_type', NARRATION_STYLE_STATE_TYPE)
      .maybeSingle();
    return normalizeNarrationState(data?.state_data);
  } catch (e) {
    console.error('[narration-style] party fetch failed:', e);
    return DEFAULT_NARRATION_STATE;
  }
}
