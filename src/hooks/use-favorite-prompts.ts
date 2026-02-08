// Hook for managing favorite roleplay prompts

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'infinity-stone-favorite-prompts';

export function useFavoritePrompts() {
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return new Set(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load favorite prompts:', e);
    }
    return new Set();
  });

  // Persist to localStorage whenever favorites change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...favorites]));
    } catch (e) {
      console.error('Failed to save favorite prompts:', e);
    }
  }, [favorites]);

  const toggleFavorite = useCallback((promptId: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(promptId)) {
        next.delete(promptId);
      } else {
        next.add(promptId);
      }
      return next;
    });
  }, []);

  const isFavorite = useCallback((promptId: string) => {
    return favorites.has(promptId);
  }, [favorites]);

  const clearFavorites = useCallback(() => {
    setFavorites(new Set());
  }, []);

  const exportFavorites = useCallback((): string => {
    return JSON.stringify([...favorites], null, 2);
  }, [favorites]);

  const importFavorites = useCallback((jsonString: string): { success: boolean; count: number; error?: string } => {
    try {
      const parsed = JSON.parse(jsonString);
      if (!Array.isArray(parsed)) {
        return { success: false, count: 0, error: 'Invalid format: expected an array' };
      }
      const validIds = parsed.filter((id): id is string => typeof id === 'string');
      setFavorites(new Set(validIds));
      return { success: true, count: validIds.length };
    } catch (e) {
      return { success: false, count: 0, error: 'Failed to parse JSON' };
    }
  }, []);

  return {
    favorites,
    favoriteCount: favorites.size,
    toggleFavorite,
    isFavorite,
    clearFavorites,
    exportFavorites,
    importFavorites,
  };
}
