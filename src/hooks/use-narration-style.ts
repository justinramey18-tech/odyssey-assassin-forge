import { useCallback, useEffect, useState } from 'react';
import { getScopedItem, setScopedItem, migrateToScoped } from '@/lib/scoped-storage';
import {
  DEFAULT_NARRATION_STATE,
  normalizeNarrationState,
  type NarrationIntensity,
  type NarrationStyleId,
  type NarrationStyleState,
} from '@/lib/narrationStyle';

export const NARRATION_STYLE_KEY = 'odyssey-narration-style';

const read = (): NarrationStyleState => {
  try {
    const saved = getScopedItem(NARRATION_STYLE_KEY);
    if (saved) return normalizeNarrationState(JSON.parse(saved));
  } catch (e) {
    console.error('[narration-style] failed to load:', e);
  }
  return DEFAULT_NARRATION_STATE;
};

/** Solo campaign narration tone. Scoped per character. */
export function useNarrationStyle() {
  const [state, setState] = useState<NarrationStyleState>(() => {
    migrateToScoped(NARRATION_STYLE_KEY);
    return read();
  });

  useEffect(() => {
    try {
      setScopedItem(NARRATION_STYLE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('[narration-style] failed to save:', e);
    }
  }, [state]);

  useEffect(() => {
    const handler = () => setState(read());
    window.addEventListener('odyssey-character-loaded', handler);
    return () => window.removeEventListener('odyssey-character-loaded', handler);
  }, []);

  const setStyle = useCallback((style: NarrationStyleId) => setState(prev => ({ ...prev, style })), []);
  const setIntensity = useCallback((intensity: NarrationIntensity) => setState(prev => ({ ...prev, intensity })), []);

  return { state, setStyle, setIntensity };
}

/** Read the current solo narration style outside React (request time). */
export function loadNarrationStyle(): NarrationStyleState {
  return read();
}
