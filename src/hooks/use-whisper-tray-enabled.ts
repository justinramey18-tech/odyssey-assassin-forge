import { useState, useCallback } from 'react';

const STORAGE_KEY = 'odyssey-whisper-tray-enabled';

export function useWhisperTrayEnabled() {
  const [enabled, setEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved !== null ? saved === 'true' : true; // default ON
    } catch {
      return true;
    }
  });

  const toggle = useCallback((value: boolean) => {
    setEnabled(value);
    try { localStorage.setItem(STORAGE_KEY, String(value)); } catch {}
  }, []);

  return { whisperTrayEnabled: enabled, setWhisperTrayEnabled: toggle };
}
