import { useState, useCallback, useRef, useEffect } from 'react';

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
const SYNC_EVENT = 'odyssey-combat-log-sync';

// Load persisted log from localStorage
function loadLog(): CombatLogEntry[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch (error) {
    console.error('[CombatLog] Failed to save:', error);
  }
}

export function useCombatLog() {
  const [entries, setEntries] = useState<CombatLogEntry[]>(loadLog);
  const isSelfUpdate = useRef(false);

  // Listen for external sync events
  useEffect(() => {
    const handler = () => {
      if (isSelfUpdate.current) return;
      setEntries(loadLog());
    };
    window.addEventListener(SYNC_EVENT, handler);
    return () => window.removeEventListener(SYNC_EVENT, handler);
  }, []);

  const addEntry = useCallback((entry: Omit<CombatLogEntry, 'id' | 'timestamp'>) => {
    const newEntry: CombatLogEntry = {
      ...entry,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date(),
    };

    isSelfUpdate.current = true;
    setEntries(prev => {
      const updated = [newEntry, ...prev].slice(0, MAX_ENTRIES);
      saveLog(updated);
      window.dispatchEvent(new CustomEvent(SYNC_EVENT));
      return updated;
    });
    setTimeout(() => { isSelfUpdate.current = false; }, 50);

    return newEntry;
  }, []);

  const clearLog = useCallback(() => {
    isSelfUpdate.current = true;
    setEntries([]);
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(SYNC_EVENT));
    setTimeout(() => { isSelfUpdate.current = false; }, 50);
  }, []);

  const removeEntry = useCallback((id: string) => {
    isSelfUpdate.current = true;
    setEntries(prev => {
      const updated = prev.filter(e => e.id !== id);
      saveLog(updated);
      window.dispatchEvent(new CustomEvent(SYNC_EVENT));
      return updated;
    });
    setTimeout(() => { isSelfUpdate.current = false; }, 50);
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
