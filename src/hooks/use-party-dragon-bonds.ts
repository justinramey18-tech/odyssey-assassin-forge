import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { type PartyDragonConfig } from '@/hooks/use-party-dm';

const DEFAULT_DRAGON: PartyDragonConfig = {
  dragonName: '',
  signetType: '',
  yearAtBasgiath: '',
  dragonNotes: '',
  bond: 15,
  trust: 10,
  mood: 'calm',
  burnout: 0,
  memories: [],
};

interface DragonEntry {
  userId: string;
  config: PartyDragonConfig;
}

export function usePartyDragonBonds(partyId: string | null, userId: string | null) {
  const [myDragon, setMyDragon] = useState<PartyDragonConfig | null>(null);
  const [allDragonConfigs, setAllDragonConfigs] = useState<DragonEntry[]>([]);
  const [myRowId, setMyRowId] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Fetch all dragon configs for this party
  const fetchAll = useCallback(async () => {
    if (!partyId) return;
    const { data } = await supabase
      .from('party_shared_state')
      .select('*')
      .eq('party_id', partyId)
      .eq('state_type', 'dragon_bond');

    if (!mountedRef.current || !data) return;

    const entries: DragonEntry[] = data.map(row => ({
      userId: row.user_id,
      config: { ...DEFAULT_DRAGON, ...(row.state_data as unknown as PartyDragonConfig) },
    }));
    setAllDragonConfigs(entries);

    if (userId) {
      const myRow = data.find(r => r.user_id === userId);
      if (myRow) {
        setMyDragon({ ...DEFAULT_DRAGON, ...(myRow.state_data as unknown as PartyDragonConfig) });
        setMyRowId(myRow.id);
      } else {
        setMyDragon(null);
        setMyRowId(null);
      }
    }
  }, [partyId, userId]);

  // Initial fetch
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Realtime subscription
  useEffect(() => {
    if (!partyId) return;

    const channel = supabase
      .channel(`dragon-bonds-${partyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'party_shared_state',
          filter: `party_id=eq.${partyId}`,
        },
        (payload) => {
          const row = (payload.new as Record<string, unknown>) || {};
          if (row.state_type !== 'dragon_bond') return;
          // Re-fetch all on any change for simplicity
          fetchAll();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [partyId, fetchAll]);

  // Save full dragon config
  const saveMyDragon = useCallback(async (config: PartyDragonConfig) => {
    if (!partyId || !userId) return;

    setMyDragon(config);

    if (myRowId) {
      await supabase
        .from('party_shared_state')
        .update({ state_data: config as unknown as Record<string, unknown>, updated_at: new Date().toISOString() })
        .eq('id', myRowId);
    } else {
      const { data } = await supabase
        .from('party_shared_state')
        .insert({
          party_id: partyId,
          user_id: userId,
          state_type: 'dragon_bond',
          state_data: config as unknown as Record<string, unknown>,
        })
        .select('id')
        .single();
      if (data) setMyRowId(data.id);
    }
  }, [partyId, userId, myRowId]);

  // Partial update
  const updateMyDragon = useCallback(async (patch: Partial<PartyDragonConfig>) => {
    const current = myDragon || DEFAULT_DRAGON;
    const merged = { ...current, ...patch };
    await saveMyDragon(merged);
  }, [myDragon, saveMyDragon]);

  // Burnout shortcut
  const updateBurnout = useCallback(async (level: number) => {
    await updateMyDragon({ burnout: Math.max(0, Math.min(5, level)) });
  }, [updateMyDragon]);

  // Bond & trust delta shortcut
  const updateBondAndTrust = useCallback(async (bondDelta: number, trustDelta: number) => {
    const current = myDragon || DEFAULT_DRAGON;
    await updateMyDragon({
      bond: Math.max(0, Math.min(100, current.bond + bondDelta)),
      trust: Math.max(0, Math.min(100, current.trust + trustDelta)),
    });
  }, [myDragon, updateMyDragon]);

  const isSetup = Boolean(myDragon && myDragon.dragonName);

  return useMemo(() => ({
    myDragon,
    isSetup,
    allDragonConfigs,
    saveMyDragon,
    updateMyDragon,
    updateBurnout,
    updateBondAndTrust,
  }), [myDragon, isSetup, allDragonConfigs, saveMyDragon, updateMyDragon, updateBurnout, updateBondAndTrust]);
}
