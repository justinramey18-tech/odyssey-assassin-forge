import { useMemo } from 'react';
import { useXPProgression } from '@/hooks/use-xp-progression';
import { getXPSnapshot, XPSnapshot } from '@/lib/xpSystem';

/**
 * Single source of truth for XP totals in React surfaces.
 * Reads the live progression pace and returns the same numbers the AI DM
 * receives, so the character sheet and the DM can never disagree.
 */
export function useXPSnapshot(level: number, currentXP: number): XPSnapshot {
  const { mode, multiplier } = useXPProgression();
  return useMemo(
    () => getXPSnapshot(level, currentXP, multiplier),
    [level, currentXP, multiplier, mode]
  );
}
