import { useState, useEffect, useCallback, useRef } from 'react';
import {
  isConnected,
  startAuth,
  handleCallback,
  clearTokens,
  getCurrentPlayback,
  play,
  pause,
  skipNext,
  skipPrevious,
  setVolume as setSpotifyVolume,
  searchPlaylists,
  getUserProfile,
  loadMoodPresets,
  saveMoodPresets,
  type MoodPreset,
} from '@/lib/spotify';
import { toast } from 'sonner';

interface PlaybackState {
  isPlaying: boolean;
  trackName: string;
  artistName: string;
  albumArt: string;
  progressMs: number;
  durationMs: number;
  deviceName: string;
}

export function useSpotify() {
  const [connected, setConnected] = useState(isConnected);
  const [userName, setUserName] = useState<string | null>(null);
  const [playback, setPlayback] = useState<PlaybackState | null>(null);
  const [volume, setVolume] = useState(50);
  const [moodPresets, setMoodPresets] = useState<MoodPreset[]>(loadMoodPresets);
  const [isSearching, setIsSearching] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Handle OAuth callback on mount
  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    if (code) {
      // Remove code from URL
      url.searchParams.delete('code');
      window.history.replaceState({}, '', url.toString());

      handleCallback(code).then((ok) => {
        if (ok) {
          setConnected(true);
          toast.success('Spotify connected!');
        } else {
          toast.error('Spotify connection failed');
        }
      });
    }
  }, []);

  // Fetch user profile when connected
  useEffect(() => {
    if (connected) {
      getUserProfile()
        .then(p => setUserName(p?.display_name || p?.email || 'Connected'))
        .catch(() => {});
    } else {
      setUserName(null);
    }
  }, [connected]);

  // Poll playback state
  useEffect(() => {
    if (!connected) return;

    const poll = async () => {
      try {
        const state = await getCurrentPlayback();
        if (state?.item) {
          setPlayback({
            isPlaying: state.is_playing,
            trackName: state.item.name,
            artistName: state.item.artists?.map((a: any) => a.name).join(', ') || '',
            albumArt: state.item.album?.images?.[0]?.url || '',
            progressMs: state.progress_ms || 0,
            durationMs: state.item.duration_ms || 0,
            deviceName: state.device?.name || '',
          });
          if (state.device?.volume_percent != null) {
            setVolume(state.device.volume_percent);
          }
        } else {
          setPlayback(null);
        }
      } catch {
        // token may be invalid
      }
    };

    poll();
    pollRef.current = setInterval(poll, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [connected]);

  const connect = useCallback(async () => {
    try {
      await startAuth();
    } catch (e) {
      toast.error('Failed to start Spotify auth');
      console.error('[Spotify] Auth start error:', e);
    }
  }, []);

  const disconnect = useCallback(() => {
    clearTokens();
    setConnected(false);
    setPlayback(null);
    setUserName(null);
    toast.success('Spotify disconnected');
  }, []);

  const togglePlay = useCallback(async () => {
    try {
      if (playback?.isPlaying) {
        await pause();
      } else {
        await play();
      }
      // Quick update
      setPlayback(p => p ? { ...p, isPlaying: !p.isPlaying } : null);
    } catch (e: any) {
      toast.error(e.message || 'Playback failed');
    }
  }, [playback?.isPlaying]);

  const next = useCallback(async () => {
    try { await skipNext(); } catch (e: any) { toast.error(e.message || 'Skip failed'); }
  }, []);

  const previous = useCallback(async () => {
    try { await skipPrevious(); } catch (e: any) { toast.error(e.message || 'Skip failed'); }
  }, []);

  const changeVolume = useCallback(async (v: number) => {
    setVolume(v);
    try { await setSpotifyVolume(v); } catch {}
  }, []);

  const playPlaylist = useCallback(async (playlistUri: string) => {
    try {
      await play({ context_uri: playlistUri });
      toast.success('Now playing playlist');
    } catch (e: any) {
      toast.error(e.message || 'Failed to play playlist. Make sure Spotify is open on a device.');
    }
  }, []);

  const searchAndAssignPreset = useCallback(async (presetId: string) => {
    const preset = moodPresets.find(p => p.id === presetId);
    if (!preset) return;

    setIsSearching(true);
    try {
      const results = await searchPlaylists(preset.searchQuery, 5);
      if (results.length > 0) {
        const best = results[0];
        const updated = moodPresets.map(p =>
          p.id === presetId
            ? { ...p, playlistUri: best.uri, playlistName: best.name }
            : p
        );
        setMoodPresets(updated);
        saveMoodPresets(updated);
        toast.success(`Set "${best.name}" for ${preset.label}`);
      } else {
        toast.error('No playlists found for this mood');
      }
    } catch (e: any) {
      toast.error(e.message || 'Search failed');
    } finally {
      setIsSearching(false);
    }
  }, [moodPresets]);

  const updateMoodPresets = useCallback((presets: MoodPreset[]) => {
    setMoodPresets(presets);
    saveMoodPresets(presets);
  }, []);

  return {
    connected,
    userName,
    playback,
    volume,
    moodPresets,
    isSearching,
    connect,
    disconnect,
    togglePlay,
    next,
    previous,
    changeVolume,
    playPlaylist,
    searchAndAssignPreset,
    updateMoodPresets,
  };
}
