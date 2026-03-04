import { useState, useEffect, useCallback, useRef } from 'react';
import { getScopedItem, setScopedItem, removeScopedItem } from '@/lib/scoped-storage';

const DEBOUNCE_MS = 300;

type SetDraft = (v: string | ((prev: string) => string)) => void;

/**
 * useState-like hook that auto-persists draft text to scoped localStorage.
 * Restores saved draft on mount; clears on explicit clear().
 */
export function useDraftPersist(storageKey: string): [string, SetDraft, () => void] {
  const [value, setValue] = useState(() => {
    try {
      return getScopedItem(storageKey) ?? '';
    } catch {
      return '';
    }
  });

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persist on change (debounced)
  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      try {
        if (value) {
          setScopedItem(storageKey, value);
        } else {
          removeScopedItem(storageKey);
        }
      } catch {}
    }, DEBOUNCE_MS);
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [value, storageKey]);

  // Flush on unmount / page unload
  useEffect(() => {
    const flush = () => {
      try {
        if (value) setScopedItem(storageKey, value);
        else removeScopedItem(storageKey);
      } catch {}
    };
    window.addEventListener('beforeunload', flush);
    return () => {
      window.removeEventListener('beforeunload', flush);
      flush();
    };
  }, [value, storageKey]);

  const clear = useCallback(() => {
    setValue('');
    try { removeScopedItem(storageKey); } catch {}
  }, [storageKey]);

  return [value, setValue, clear];
}
