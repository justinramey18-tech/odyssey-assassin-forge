import { useState, useCallback } from 'react';

const STORAGE_KEY = 'dnd-saved-prompts';

export interface SavedPrompt {
  key: string;
  originalPrompt: string;
  customPrompt: string;
  updatedAt: string;
}

function loadSavedPrompts(): Record<string, SavedPrompt> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function persistSavedPrompts(prompts: Record<string, SavedPrompt>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prompts));
  } catch (error) {
    console.error('Failed to save prompts:', error);
  }
}

export function useSavedPrompts() {
  const [prompts, setPrompts] = useState<Record<string, SavedPrompt>>(loadSavedPrompts);

  const getSavedPrompt = useCallback((key: string): SavedPrompt | null => {
    return prompts[key] ?? null;
  }, [prompts]);

  const hasSavedPrompt = useCallback((key: string): boolean => {
    return key in prompts;
  }, [prompts]);

  const savePrompt = useCallback((key: string, originalPrompt: string, customPrompt: string): void => {
    const updated = {
      ...prompts,
      [key]: {
        key,
        originalPrompt,
        customPrompt,
        updatedAt: new Date().toISOString(),
      },
    };
    setPrompts(updated);
    persistSavedPrompts(updated);
  }, [prompts]);

  const deleteSavedPrompt = useCallback((key: string): void => {
    const updated = { ...prompts };
    delete updated[key];
    setPrompts(updated);
    persistSavedPrompts(updated);
  }, [prompts]);

  return { getSavedPrompt, hasSavedPrompt, savePrompt, deleteSavedPrompt };
}
