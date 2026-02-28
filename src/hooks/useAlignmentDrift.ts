import { useState, useCallback, useMemo } from 'react';
import { type AlignmentScore, getAlignmentZone, getPromptAlignment } from '@/lib/alignmentSpectrum';

const DRIFT_KEY_PREFIX = 'odyssey-alignment-drift';
const MAX_HISTORY = 50;
const DECAY_FACTOR = 0.92; // recent prompts weighted more

interface DriftEntry {
  promptId: string;
  law: number;
  good: number;
  ts: number;
}

function getScopedKey(): string {
  // Try to get active character ID for scoping
  try {
    const activeId = localStorage.getItem('odyssey-active-cloud-save-id');
    if (activeId) return `${DRIFT_KEY_PREFIX}_${activeId}`;
  } catch {}
  return DRIFT_KEY_PREFIX;
}

function loadHistory(): DriftEntry[] {
  try {
    const raw = localStorage.getItem(getScopedKey());
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(entries: DriftEntry[]) {
  try {
    localStorage.setItem(getScopedKey(), JSON.stringify(entries.slice(-MAX_HISTORY)));
  } catch {}
}

function computeWeightedAverage(entries: DriftEntry[]): AlignmentScore {
  if (entries.length === 0) return { law: 0, good: 0 };

  let totalWeight = 0;
  let lawSum = 0;
  let goodSum = 0;

  for (let i = 0; i < entries.length; i++) {
    const weight = Math.pow(DECAY_FACTOR, entries.length - 1 - i);
    lawSum += entries[i].law * weight;
    goodSum += entries[i].good * weight;
    totalWeight += weight;
  }

  return {
    law: Math.round((lawSum / totalWeight) * 10) / 10,
    good: Math.round((goodSum / totalWeight) * 10) / 10,
  };
}

export function useAlignmentDrift() {
  const [history, setHistory] = useState<DriftEntry[]>(loadHistory);

  const logPromptUsage = useCallback((promptId: string) => {
    const alignment = getPromptAlignment(promptId);
    if (!alignment) return;

    const entry: DriftEntry = {
      promptId,
      law: alignment.law,
      good: alignment.good,
      ts: Date.now(),
    };

    setHistory(prev => {
      const next = [...prev, entry].slice(-MAX_HISTORY);
      saveHistory(next);
      return next;
    });
  }, []);

  const driftPosition = useMemo(() => computeWeightedAverage(history), [history]);
  const driftZone = useMemo(() => getAlignmentZone(driftPosition), [driftPosition]);

  return {
    driftPosition,
    driftZone,
    historyCount: history.length,
    logPromptUsage,
  };
}
