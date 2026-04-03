import { useState, useCallback } from 'react';

const STORAGE_KEY = 'odyssey-cinematic-mode-enabled';

export function useCinematicMode() {
  const [cinematicModeEnabled, setCinematicModeEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved !== null ? saved === 'true' : true; // default ON
    } catch {
      return true;
    }
  });

  const setCinematicMode = useCallback((value: boolean) => {
    setCinematicModeEnabled(value);
    try { localStorage.setItem(STORAGE_KEY, String(value)); } catch {}
  }, []);

  return { cinematicModeEnabled, setCinematicMode };
}
