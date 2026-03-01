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
  getDevices,
  loadMoodPresets,
  saveMoodPresets,
  loadAutoMood,
  saveAutoMood,
  type MoodPreset,
} from '@/lib/spotify';
import { supabase } from '@/integrations/supabase/client';
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

const AUTO_MOOD_COOLDOWN_MS = 30_000; // 30 seconds between mood switches

export function useSpotify() {
  const [connected, setConnected] = useState(isConnected);
  const [userName, setUserName] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState<boolean | null>(null);
  const [playback, setPlayback] = useState<PlaybackState | null>(null);
  const [volume, setVolume] = useState(50);
  const [moodPresets, setMoodPresets] = useState<MoodPreset[]>(loadMoodPresets);
  const [isSearching, setIsSearching] = useState(false);
  const [autoMoodEnabled, setAutoMoodEnabledState] = useState(loadAutoMood);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastAutoMoodPresetIdRef = useRef<string | null>(null);
  const lastAutoMoodTimeRef = useRef<number>(0);

  // Handle OAuth callback on mount
  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    if (code) {
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
        .then(p => {
          setUserName(p?.display_name || p?.email || 'Connected');
          setIsPremium(p?.product === 'premium');
        })
        .catch(() => {});
    } else {
      setUserName(null);
      setIsPremium(null);
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
    try {
      await setSpotifyVolume(v);
    } catch (e: any) {
      toast.error(e.message || 'Volume control requires Spotify Premium');
    }
  }, []);

  const playPlaylist = useCallback(async (playlistUri: string) => {
    try {
      const devices = await getDevices();
      if (!devices || devices.length === 0) {
        toast.error('No Spotify device found. Open Spotify on your phone or computer first, then try again.', { duration: 6000 });
        return;
      }
      const activeDevice = devices.find((d: any) => d.is_active) || devices[0];
      await play({ context_uri: playlistUri, device_id: activeDevice.id });
      toast.success(`Now playing on ${activeDevice.name}`);
    } catch (e: any) {
      if (e.message?.toLowerCase().includes('no active device')) {
        toast.error('No Spotify device found. Open Spotify on your phone or computer first.', { duration: 6000 });
      } else {
        toast.error(e.message || 'Failed to play playlist');
      }
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

  const setAutoMoodEnabled = useCallback((enabled: boolean) => {
    setAutoMoodEnabledState(enabled);
    saveAutoMood(enabled);
  }, []);

  // AI-powered mood detection and auto-play
  const playMoodForText = useCallback(async (text: string) => {
    if (!connected || !autoMoodEnabled) return;

    // Cooldown check
    const now = Date.now();
    if (now - lastAutoMoodTimeRef.current < AUTO_MOOD_COOLDOWN_MS) return;

    try {
      const presetsForAI = moodPresets.map(p => ({ id: p.id, label: p.label }));

      const { data, error } = await supabase.functions.invoke('detect-mood', {
        body: { text, presets: presetsForAI },
      });

      if (error) {
        console.error('[AutoMood] Edge function error:', error);
        return;
      }

      const detectedId = data?.preset_id;
      if (!detectedId || detectedId === lastAutoMoodPresetIdRef.current) return;

      const preset = moodPresets.find(p => p.id === detectedId);
      if (!preset) return;

      lastAutoMoodPresetIdRef.current = detectedId;
      lastAutoMoodTimeRef.current = now;

      if (preset.playlistUri) {
        await playPlaylist(preset.playlistUri);
      } else {
        // Search and assign first, then play
        const results = await searchPlaylists(preset.searchQuery, 5);
        if (results.length > 0) {
          const best = results[0];
          const updated = moodPresets.map(p =>
            p.id === detectedId
              ? { ...p, playlistUri: best.uri, playlistName: best.name }
              : p
          );
          setMoodPresets(updated);
          saveMoodPresets(updated);
          await playPlaylist(best.uri);
        }
      }

      toast.success(`🎵 Auto-Mood: ${preset.emoji} ${preset.label}`, { duration: 3000 });
    } catch (e) {
      console.error('[AutoMood] Detection error:', e);
    }
  }, [connected, autoMoodEnabled, moodPresets, playPlaylist]);

  return {
    connected,
    userName,
    isPremium,
    playback,
    volume,
    moodPresets,
    isSearching,
    autoMoodEnabled,
    connect,
    disconnect,
    togglePlay,
    next,
    previous,
    changeVolume,
    playPlaylist,
    searchAndAssignPreset,
    updateMoodPresets,
    setAutoMoodEnabled,
    playMoodForText,
  };
}
