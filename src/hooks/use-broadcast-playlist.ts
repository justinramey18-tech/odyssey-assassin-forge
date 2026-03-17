import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Subscribes to the broadcast playlist indicator for a party.
 * Isolated to prevent unrelated state updates from re-rendering the parent.
 */
export function useBroadcastPlaylist(partyId: string | null | undefined) {
  const [broadcastPlaylist, setBroadcastPlaylist] = useState<string | null>(null);

  useEffect(() => {
    if (!partyId) return;

    // Fetch initial
    supabase
      .from('party_shared_state')
      .select('state_data')
      .eq('party_id', partyId)
      .eq('state_type', 'spotify_sync')
      .maybeSingle()
      .then(({ data }) => {
        if (data?.state_data && typeof data.state_data === 'object') {
          const sd = data.state_data as any;
          setBroadcastPlaylist(sd.playlistName || null);
        }
      });

    // Subscribe to real-time changes — only reacts to spotify_sync state_type
    const channel = supabase
      .channel(`broadcast-indicator-${partyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'party_shared_state', filter: `party_id=eq.${partyId}` },
        (payload) => {
          const row = payload.new as any;
          if (row?.state_type !== 'spotify_sync') return;
          const sd = row.state_data;
          setBroadcastPlaylist(sd?.playlistName || null);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [partyId]);

  return broadcastPlaylist;
}
