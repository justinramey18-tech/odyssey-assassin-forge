import { useState, useCallback, useEffect } from 'react';
import { getScopedItem, setScopedItem, removeScopedItem } from '@/lib/scoped-storage';

export interface CombatLogEntry {
  id: string;
  timestamp: Date;
  actionType: 'weapon' | 'ability' | 'spell' | 'item' | 'reaction' | 'other';
  actionName: string;
  prompt: string;
  roll?: {
    total: number;
    rolls: number[];
    modifier: number;
    isCrit?: boolean;
    isFumble?: boolean;
  };
  damage?: string;
}

const STORAGE_KEY = 'odyssey-combat-log';
const MAX_ENTRIES = 50;

// Load persisted log from localStorage
function loadLog(): CombatLogEntry[] {
  try {
    const saved = getScopedItem(STORAGE_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    return parsed.map((entry: any) => ({
      ...entry,
      timestamp: new Date(entry.timestamp),
    }));
  } catch {
    return [];
  }
}

// Save log to localStorage
function saveLog(entries: CombatLogEntry[]): void {
  try {
    setScopedItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch (error) {
    console.error('[CombatLog] Failed to save:', error);
  }
}

export function useCombatLog() {
  const [entries, setEntries] = useState<CombatLogEntry[]>(loadLog);

  // Re-init when character is switched in-memory
  useEffect(() => {
    const handleCharacterLoaded = () => setEntries(loadLog());
    window.addEventListener('odyssey-character-loaded', handleCharacterLoaded);
    return () => window.removeEventListener('odyssey-character-loaded', handleCharacterLoaded);
  }, []);

  const addEntry = useCallback((entry: Omit<CombatLogEntry, 'id' | 'timestamp'>) => {
    const newEntry: CombatLogEntry = {
      ...entry,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date(),
    };

    setEntries(prev => {
      const updated = [newEntry, ...prev].slice(0, MAX_ENTRIES);
      saveLog(updated);
      return updated;
    });

    return newEntry;
  }, []);

  const clearLog = useCallback(() => {
    setEntries([]);
    removeScopedItem(STORAGE_KEY);
  }, []);

  const removeEntry = useCallback((id: string) => {
    setEntries(prev => {
      const updated = prev.filter(e => e.id !== id);
      saveLog(updated);
      return updated;
    });
  }, []);

  return {
    entries,
    addEntry,
    clearLog,
    removeEntry,
    entryCount: entries.length,
  };
}

export type UseCombatLogReturn = ReturnType<typeof useCombatLog>;
