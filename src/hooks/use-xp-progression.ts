import { useState, useEffect, useCallback } from 'react';
import { 
  XPProgressionMode, 
  loadXPProgressionMode, 
  getXPMultiplier 
} from '@/components/settings/XPProgressionWidget';

const XP_PROGRESSION_CHANGE_EVENT = 'odyssey-xp-progression-change';

/**
 * Hook to manage and react to XP progression mode changes throughout the app.
 */
export function useXPProgression() {
  const [mode, setMode] = useState<XPProgressionMode>(() => loadXPProgressionMode());

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'odyssey-xp-progression') {
        setMode(loadXPProgressionMode());
      }
    };

    const handleProgressionChange = (e: CustomEvent<XPProgressionMode>) => {
      setMode(e.detail);
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener(XP_PROGRESSION_CHANGE_EVENT, handleProgressionChange as EventListener);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener(XP_PROGRESSION_CHANGE_EVENT, handleProgressionChange as EventListener);
    };
  }, []);

  const refreshMode = useCallback(() => {
    setMode(loadXPProgressionMode());
  }, []);

  const multiplier = getXPMultiplier(mode);

  return {
    mode,
    multiplier,
    refreshMode,
    isSlow: mode === 'slow',
    isNatural: mode === 'natural',
    isFast: mode === 'fast',
  };
}
