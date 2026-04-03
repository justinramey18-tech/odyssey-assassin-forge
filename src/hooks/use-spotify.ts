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
  extractPlaylistId,
  getPlaylistInfo,
  type MoodPreset,
} from '@/lib/spotify';
import { initPlayer, destroyPlayer, getSDKDeviceId, isSDKPlayerActive } from '@/lib/spotify-player-sdk';
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

const AUTO_MOOD_COOLDOWN_MS = 10_000;

export function useSpotify() {
  const [connected, setConnected] = useState(isConnected);
  const [userName, setUserName] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState<boolean | null>(null);
  const [playback, setPlayback] = useState<PlaybackState | null>(null);
  const [volume, setVolume] = useState(50);
  const [moodPresets, setMoodPresets] = useState<MoodPreset[]>(loadMoodPresets);
  const [isSearching, setIsSearching] = useState(false);
  const [autoMoodEnabled, setAutoMoodEnabledState] = useState(loadAutoMood);
  const [sdkDeviceId, setSdkDeviceId] = useState<string | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
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

  // Initialize SDK player for Premium users
  useEffect(() => {
    if (!connected || isPremium !== true) return;

    initPlayer(
      (id) => {
        setSdkDeviceId(id);
        setSdkReady(true);
        console.log('[Spotify] Browser player ready');
      },
      () => {
        setSdkDeviceId(null);
        setSdkReady(false);
      },
    );

    return () => {
      destroyPlayer();
      setSdkDeviceId(null);
      setSdkReady(false);
    };
  }, [connected, isPremium]);

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
    destroyPlayer();
    clearTokens();
    setConnected(false);
    setPlayback(null);
    setUserName(null);
    setSdkDeviceId(null);
    setSdkReady(false);
    toast.success('Spotify disconnected');
  }, []);

  const switchAccount = useCallback(async () => {
    destroyPlayer();
    clearTokens();
    setConnected(false);
    setPlayback(null);
    setUserName(null);
    setSdkDeviceId(null);
    setSdkReady(false);
    try {
      await startAuth();
    } catch (e) {
      toast.error('Failed to start Spotify auth');
      console.error('[Spotify] Switch account error:', e);
    }
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

  const pausePlayback = useCallback(async () => {
    try {
      await pause();
      setPlayback(p => (p ? { ...p, isPlaying: false } : p));
    } catch (e: any) {
      toast.error(e.message || 'Pause failed');
    }
  }, []);

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
      // Silently ignore "cannot control device volume" — common on mobile/external devices
      const msg = (e.message || '').toLowerCase();
      if (msg.includes('volume') || msg.includes('player command failed')) {
        console.warn('[Spotify] Volume control not supported on current device');
      } else {
        toast.error(e.message || 'Volume control requires Spotify Premium');
      }
    }
  }, []);

  const playPlaylist = useCallback(async (playlistUri: string, retryCount = 0) => {
    try {
      const devices = await getDevices();
      const activeDevice = devices?.find((d: any) => d.is_active);

      // Priority: active device > SDK browser player > any listed device
      let targetDeviceId = activeDevice?.id;
      let targetDeviceName = activeDevice?.name;

      if (!targetDeviceId && sdkDeviceId) {
        targetDeviceId = sdkDeviceId;
        targetDeviceName = 'Browser Player';
      } else if (!targetDeviceId && devices?.length > 0) {
        targetDeviceId = devices[0].id;
        targetDeviceName = devices[0].name;
      }

      if (targetDeviceId) {
        // We have a device — play on it directly
        await play({ context_uri: playlistUri, device_id: targetDeviceId });
        toast.success(`Now playing on ${targetDeviceName}`);
        return;
      }

      // No device found in device list. This is common on mobile where the
      // Spotify app doesn't always register as a Connect device.
      // Try playing WITHOUT a device_id — Spotify will route to the last
      // active device automatically. This often works on mobile.
      try {
        await play({ context_uri: playlistUri });
        toast.success('Now playing on Spotify');
        return;
      } catch (devicelessError: any) {
        // Device-less play failed too. If we haven't retried yet, wait and retry.
        if (retryCount < 2) {
          if (retryCount === 0) {
            toast.info('Looking for Spotify... make sure the app is open', { duration: 4000 });
          }
          setTimeout(() => playPlaylist(playlistUri, retryCount + 1), 3000);
          return;
        }

        // Nuclear fallback: open the playlist directly in the Spotify app via deep link.
        // This bypasses the Connect API entirely and works on mobile even when
        // no device is detected, because it launches/focuses the Spotify app directly.
        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        if (isMobile) {
          const playlistId = playlistUri.replace('spotify:playlist:', '');
          window.location.href = `spotify:playlist:${playlistId}:play`;
          toast.success('Opening playlist in Spotify...', { duration: 3000 });
          setTimeout(() => {
            lastAutoMoodPresetIdRef.current = null;
          }, 5000);
        } else {
          const playlistId = playlistUri.replace('spotify:playlist:', '');
          window.open(`https://open.spotify.com/playlist/${playlistId}`, '_blank');
          toast.info('Opened playlist in Spotify', { duration: 3000 });
        }
      }
    } catch (e: any) {
      if (e.message?.toLowerCase().includes('no active device') || e.message?.toLowerCase().includes('player command failed')) {
        // One more attempt without device_id before giving up
        try {
          await play({ context_uri: playlistUri });
          toast.success('Now playing on Spotify');
          return;
        } catch {
          const isMobile2 = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
          if (isMobile2) {
            const playlistId2 = playlistUri.replace('spotify:playlist:', '');
            window.location.href = `spotify:playlist:${playlistId2}:play`;
            toast.success('Opening playlist in Spotify...', { duration: 3000 });
            setTimeout(() => {
              lastAutoMoodPresetIdRef.current = null;
            }, 5000);
          } else {
            const playlistId2 = playlistUri.replace('spotify:playlist:', '');
            window.open(`https://open.spotify.com/playlist/${playlistId2}`, '_blank');
            toast.info('Opened playlist in Spotify', { duration: 3000 });
          }
        }
      } else {
        toast.error(e.message || 'Failed to play playlist');
      }
    }
  }, [sdkDeviceId, isPremium]);

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
            ? { ...p, playlistUri: best.uri, playlistName: best.name, manuallyAssigned: false }
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

  const assignPlaylistToPreset = useCallback(async (presetId: string, input: string): Promise<boolean> => {
    const playlistId = extractPlaylistId(input);
    if (!playlistId) {
      toast.error('Invalid Spotify playlist link');
      return false;
    }

    try {
      const info = await getPlaylistInfo(playlistId);
      if (!info) {
        toast.error('Could not find that playlist. It may be private or invalid.');
        return false;
      }

      const updated = moodPresets.map(p =>
        p.id === presetId
          ? { ...p, playlistUri: info.uri, playlistName: info.name }
          : p
      );
      setMoodPresets(updated);
      saveMoodPresets(updated);
      toast.success(`Linked "${info.name}" to preset`);
      return true;
    } catch (e: any) {
      toast.error(e.message || 'Failed to assign playlist');
      return false;
    }
  }, [moodPresets]);

  const clearPresetPlaylist = useCallback((presetId: string) => {
    const updated = moodPresets.map(p =>
      p.id === presetId
        ? { ...p, playlistUri: undefined, playlistName: undefined }
        : p
    );
    setMoodPresets(updated);
    saveMoodPresets(updated);
    toast.success('Custom playlist removed — will use search instead');
  }, [moodPresets]);

  const setAutoMoodEnabled = useCallback((enabled: boolean) => {
    setAutoMoodEnabledState(enabled);
    saveAutoMood(enabled);
  }, []);

  const playMoodForText = useCallback(async (text: string) => {
    if (!connected || !autoMoodEnabled) return;

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

  const playPresetById = useCallback(async (presetId: string) => {
    if (!connected) return;

    const now = Date.now();
    if (now - lastAutoMoodTimeRef.current < AUTO_MOOD_COOLDOWN_MS) return;

    if (presetId === lastAutoMoodPresetIdRef.current) return;

    const preset = moodPresets.find(p => p.id === presetId);
    if (!preset) return;

    lastAutoMoodPresetIdRef.current = presetId;
    lastAutoMoodTimeRef.current = now;

    try {
      if (preset.playlistUri) {
        await playPlaylist(preset.playlistUri);
      } else {
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
          await playPlaylist(best.uri);
        }
      }
      toast.success(`🎵 ${preset.emoji} ${preset.label}`, { duration: 3000 });
    } catch (e) {
      console.error('[Spotify] playPresetById error:', e);
    }
  }, [connected, moodPresets, playPlaylist]);

  return {
    connected,
    userName,
    isPremium,
    playback,
    volume,
    moodPresets,
    isSearching,
    autoMoodEnabled,
    sdkReady,
    connect,
    disconnect,
    switchAccount,
    togglePlay,
    pausePlayback,
    next,
    previous,
    changeVolume,
    playPlaylist,
    searchAndAssignPreset,
    updateMoodPresets,
    assignPlaylistToPreset,
    clearPresetPlaylist,
    setAutoMoodEnabled,
    playMoodForText,
    playPresetById,
  };
}
