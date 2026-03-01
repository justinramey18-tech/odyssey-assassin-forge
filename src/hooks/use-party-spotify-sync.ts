import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const SYNC_STATE_TYPE = 'spotify_sync';
const BROADCAST_INTERVAL_MS = 8_000;

interface SpotifySyncState {
  playlistUri?: string;
  playlistName?: string;
  trackUri?: string;
  updatedAt: string;
}

interface UsePartySpotifySyncOptions {
  partyId: string | null | undefined;
  isCreator: boolean;
  connected: boolean;
  playback: { isPlaying: boolean; trackName: string } | null;
  playPlaylist: (uri: string) => Promise<void>;
}

export function usePartySpotifySync({
  partyId,
  isCreator,
  connected,
  playback,
  playPlaylist,
}: UsePartySpotifySyncOptions) {
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [hostPlaylist, setHostPlaylist] = useState<{ uri: string; name: string } | null>(null);
  const lastBroadcastRef = useRef<string | null>(null);
  const lastPlayedUriRef = useRef<string | null>(null);

  // ── Host: Broadcast current playback to party_shared_state ──────────
  const broadcastPlayback = useCallback(async (playlistUri: string, playlistName: string) => {
    if (!partyId || !isCreator || !connected) return;

    const key = `${playlistUri}`;
    if (key === lastBroadcastRef.current) return;
    lastBroadcastRef.current = key;

    try {
      const { data: existing } = await supabase
        .from('party_shared_state')
        .select('id')
        .eq('party_id', partyId)
        .eq('state_type', SYNC_STATE_TYPE)
        .maybeSingle();

      const stateData: SpotifySyncState = {
        playlistUri,
        playlistName,
        updatedAt: new Date().toISOString(),
      };

      if (existing) {
        await supabase
          .from('party_shared_state')
          .update({ state_data: stateData as any, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        await supabase
          .from('party_shared_state')
          .insert({
            party_id: partyId,
            user_id: user.id,
            state_type: SYNC_STATE_TYPE,
            state_data: stateData as any,
          });
      }
    } catch (e) {
      console.error('[SpotifySync] Broadcast error:', e);
    }
  }, [partyId, isCreator, connected]);

  // ── Host: Auto-broadcast on mood preset play ────────────────────────
  // This is called externally when the host plays a playlist
  const onHostPlayPlaylist = useCallback((uri: string, name: string) => {
    if (isCreator && partyId) {
      broadcastPlayback(uri, name);
    }
  }, [isCreator, partyId, broadcastPlayback]);

  // ── Member: Subscribe to host's broadcast via real-time ─────────────
  useEffect(() => {
    if (!partyId || isCreator || !syncEnabled || !connected) return;

    // Fetch initial state
    const fetchInitial = async () => {
      const { data } = await supabase
        .from('party_shared_state')
        .select('state_data')
        .eq('party_id', partyId)
        .eq('state_type', SYNC_STATE_TYPE)
        .maybeSingle();

      if (data?.state_data) {
        const state = data.state_data as unknown as SpotifySyncState;
        if (state.playlistUri && state.playlistName) {
          setHostPlaylist({ uri: state.playlistUri, name: state.playlistName });
          // Auto-play on initial sync
          if (state.playlistUri !== lastPlayedUriRef.current) {
            lastPlayedUriRef.current = state.playlistUri;
            playPlaylist(state.playlistUri);
            toast.success(`🎵 Synced: ${state.playlistName}`, { duration: 3000 });
          }
        }
      }
    };
    fetchInitial();

    // Subscribe to real-time changes
    const channel = supabase
      .channel(`spotify-sync-${partyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'party_shared_state',
          filter: `party_id=eq.${partyId}`,
        },
        (payload) => {
          const row = (payload.new as any);
          if (row?.state_type !== SYNC_STATE_TYPE) return;

          const state = row.state_data as SpotifySyncState;
          if (state?.playlistUri && state?.playlistName) {
            setHostPlaylist({ uri: state.playlistUri, name: state.playlistName });
            if (state.playlistUri !== lastPlayedUriRef.current) {
              lastPlayedUriRef.current = state.playlistUri;
              playPlaylist(state.playlistUri);
              toast.success(`🎵 Synced: ${state.playlistName}`, { duration: 3000 });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [partyId, isCreator, syncEnabled, connected, playPlaylist]);

  // Reset when sync is disabled
  useEffect(() => {
    if (!syncEnabled) {
      lastPlayedUriRef.current = null;
      setHostPlaylist(null);
    }
  }, [syncEnabled]);

  const toggleSync = useCallback((enabled: boolean) => {
    setSyncEnabled(enabled);
    if (enabled) {
      toast.success('🔗 Synced to host music');
    } else {
      toast('🔓 Music sync disabled — choose your own audio');
    }
  }, []);

  return {
    syncEnabled,
    toggleSync,
    hostPlaylist,
    onHostPlayPlaylist,
    isCreator,
  };
}
