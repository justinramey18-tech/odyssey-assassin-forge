import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const SYNC_STATE_TYPE = 'spotify_sync';

interface SpotifySyncState {
  playlistUri?: string;
  playlistName?: string;
  trackUri?: string;
  isPlaying?: boolean;
  updatedAt: string;
}

interface UsePartySpotifySyncOptions {
  partyId: string | null | undefined;
  isCreator: boolean;
  connected: boolean;
  playback: { isPlaying: boolean; trackName: string } | null;
  playPlaylist: (uri: string) => Promise<void>;
  pausePlayback: () => Promise<void>;
}

export function usePartySpotifySync({
  partyId,
  isCreator,
  connected,
  playback,
  playPlaylist,
  pausePlayback,
}: UsePartySpotifySyncOptions) {
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [hostPlaylist, setHostPlaylist] = useState<{ uri: string; name: string } | null>(null);
  const lastBroadcastRef = useRef<string | null>(null);
  const lastPlayedUriRef = useRef<string | null>(null);

  // ── Host: Broadcast current playback to party_shared_state ──────────
  const broadcastPlayback = useCallback(async (playlistUri: string, playlistName: string, isPlaying: boolean) => {
    if (!partyId || !isCreator || !connected) return;

    const key = `${playlistUri}:${isPlaying ? 'playing' : 'paused'}`;
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
        isPlaying,
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
  const onHostPlayPlaylist = useCallback((uri: string, name: string) => {
    if (!isCreator || !partyId) return;
    setHostPlaylist({ uri, name });
    void broadcastPlayback(uri, name, true);
  }, [isCreator, partyId, broadcastPlayback]);

  // ── Host: Keep member playback synced to host pause/resume state ─────
  useEffect(() => {
    if (!partyId || !isCreator || !connected || !hostPlaylist) return;
    void broadcastPlayback(hostPlaylist.uri, hostPlaylist.name, playback?.isPlaying ?? false);
  }, [partyId, isCreator, connected, hostPlaylist, playback?.isPlaying, broadcastPlayback]);

  const applyHostState = useCallback(async (state: SpotifySyncState) => {
    if (!state?.playlistUri || !state?.playlistName) return;

    setHostPlaylist({ uri: state.playlistUri, name: state.playlistName });

    if (!connected) return;

    const hostIsPlaying = state.isPlaying !== false;

    if (!hostIsPlaying) {
      if (playback?.isPlaying) {
        await pausePlayback();
      }
      return;
    }

    if (state.playlistUri !== lastPlayedUriRef.current) {
      lastPlayedUriRef.current = state.playlistUri;
      await playPlaylist(state.playlistUri);
      toast.success(`🎵 Synced: ${state.playlistName}`, { duration: 3000 });
      return;
    }

    if (!playback?.isPlaying) {
      await playPlaylist(state.playlistUri);
    }
  }, [connected, playback?.isPlaying, pausePlayback, playPlaylist]);

  // ── Member: Subscribe to host's broadcast via real-time ─────────────
  useEffect(() => {
    if (!partyId || isCreator || !syncEnabled) return;

    const fetchInitial = async () => {
      const { data } = await supabase
        .from('party_shared_state')
        .select('state_data')
        .eq('party_id', partyId)
        .eq('state_type', SYNC_STATE_TYPE)
        .maybeSingle();

      if (data?.state_data) {
        const state = data.state_data as unknown as SpotifySyncState;
        await applyHostState(state);
      }
    };
    void fetchInitial();

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
          void applyHostState(state);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [partyId, isCreator, syncEnabled, applyHostState]);

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
