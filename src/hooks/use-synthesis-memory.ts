import { useState, useCallback, useEffect } from 'react';
import { getScopedItem, setScopedItem } from '@/lib/scoped-storage';

const STORAGE_KEY = 'odyssey-synthesis-recent-modes';
const MAX_MODES = 3;

export function useSynthesisMemory() {
  const [recentModes, setRecentModes] = useState<string[]>(() => {
    try {
      const saved = getScopedItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('[SynthesisMemory] Failed to load:', e);
    }
    return [];
  });

  // Persist on change
  useEffect(() => {
    try {
      setScopedItem(STORAGE_KEY, JSON.stringify(recentModes));
    } catch (e) {
      console.error('[SynthesisMemory] Failed to save:', e);
    }
  }, [recentModes]);

  // Re-init on character switch
  useEffect(() => {
    const handleCharacterLoaded = () => {
      try {
        const saved = getScopedItem(STORAGE_KEY);
        setRecentModes(saved ? JSON.parse(saved) : []);
      } catch { setRecentModes([]); }
    };
    window.addEventListener('odyssey-character-loaded', handleCharacterLoaded);
    return () => window.removeEventListener('odyssey-character-loaded', handleCharacterLoaded);
  }, []);

  const addMode = useCallback((mode: string) => {
    setRecentModes(prev => {
      const updated = [...prev, mode].slice(-MAX_MODES);
      return updated;
    });
  }, []);

  return { recentModes, addMode };
}
