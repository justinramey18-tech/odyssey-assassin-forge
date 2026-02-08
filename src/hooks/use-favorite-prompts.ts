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

  return {
    favorites,
    favoriteCount: favorites.size,
    toggleFavorite,
    isFavorite,
    clearFavorites,
  };
}
