import { useState, useCallback, useEffect } from 'react';
import { getScopedItem, setScopedItem } from '@/lib/scoped-storage';

const STORAGE_KEY = 'odyssey-dm-response-mode';

export function useResponseMode() {
  const [responseMode, setResponseModeState] = useState<string | undefined>(() => {
    try {
      const saved = getScopedItem(STORAGE_KEY);
      return saved || undefined;
    } catch {
      return undefined;
    }
  });

  useEffect(() => {
    try {
      if (responseMode) {
        setScopedItem(STORAGE_KEY, responseMode);
      } else {
        setScopedItem(STORAGE_KEY, '');
      }
    } catch (e) {
      console.error('[useResponseMode] Failed to save:', e);
    }
  }, [responseMode]);

  useEffect(() => {
    const handleCharacterLoaded = () => {
      try {
        const saved = getScopedItem(STORAGE_KEY);
        setResponseModeState(saved || undefined);
      } catch {
        setResponseModeState(undefined);
      }
    };
    window.addEventListener('odyssey-character-loaded', handleCharacterLoaded);
    return () => window.removeEventListener('odyssey-character-loaded', handleCharacterLoaded);
  }, []);

  const setResponseMode = useCallback((mode: string | undefined | null) => {
    setResponseModeState(mode ?? undefined);
  }, []);

  return { responseMode, setResponseMode };
}
