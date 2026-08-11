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

  // Keep the latest value in a ref so the unload listener is attached once
  // instead of being torn down and re-added on every keystroke.
  const valueRef = useRef(value);
  valueRef.current = value;

  // Flush on unmount / page unload
  useEffect(() => {
    const flush = () => {
      try {
        const v = valueRef.current;
        if (v) setScopedItem(storageKey, v);
        else removeScopedItem(storageKey);
      } catch {}
    };
    window.addEventListener('beforeunload', flush);
    return () => {
      window.removeEventListener('beforeunload', flush);
      flush();
    };
  }, [storageKey]);

  const clear = useCallback(() => {
    setValue('');
    try { removeScopedItem(storageKey); } catch {}
  }, [storageKey]);

  return [value, setValue, clear];
}
