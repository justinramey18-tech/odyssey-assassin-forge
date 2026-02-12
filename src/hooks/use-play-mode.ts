import { useState, useEffect, useCallback } from 'react';

export type PlayMode = 'solo' | 'party';

const STORAGE_KEY = 'odyssey-play-mode';
export const PLAY_MODE_CHANGE_EVENT = 'odyssey-play-mode-change';

export function usePlayMode() {
  const [playMode, setPlayModeState] = useState<PlayMode>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'solo' || stored === 'party') return stored;
    } catch { /* ignore */ }
    return 'party'; // Default to party mode (existing behavior)
  });

  // Persist and dispatch event on change
  const setPlayMode = useCallback((mode: PlayMode) => {
    setPlayModeState(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
      window.dispatchEvent(new CustomEvent(PLAY_MODE_CHANGE_EVENT, { detail: mode }));
    } catch (e) {
      console.error('Failed to save play mode:', e);
    }
  }, []);

  // Listen for changes from other components
  useEffect(() => {
    const handler = (e: Event) => {
      const mode = (e as CustomEvent).detail as PlayMode;
      setPlayModeState(mode);
    };
    window.addEventListener(PLAY_MODE_CHANGE_EVENT, handler);
    return () => window.removeEventListener(PLAY_MODE_CHANGE_EVENT, handler);
  }, []);

  const isSoloMode = playMode === 'solo';
  const isPartyMode = playMode === 'party';

  const togglePlayMode = useCallback(() => {
    setPlayMode(playMode === 'solo' ? 'party' : 'solo');
  }, [playMode, setPlayMode]);

  return {
    playMode,
    setPlayMode,
    togglePlayMode,
    isSoloMode,
    isPartyMode,
  };
}
