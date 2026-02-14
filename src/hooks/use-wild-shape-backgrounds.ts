// Wild Shape Background Images Hook
// Stores per-form background images in localStorage
// Returns the active background when transformed

import { useState, useCallback, useEffect } from 'react';
import { getScopedItem, setScopedItem, migrateToScoped } from '@/lib/scoped-storage';

const STORAGE_KEY = 'odyssey-wild-shape-backgrounds';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export interface WildShapeBackgrounds {
  /** Map of form ID → dataURL */
  backgrounds: Record<string, string>;
  /** Get the background for the currently active form (null if none assigned) */
  getActiveBackground: (formId: string | null | undefined) => string | null;
  /** Assign a photo to a form */
  assignBackground: (formId: string, file: File) => Promise<void>;
  /** Remove a form's background */
  removeBackground: (formId: string) => void;
  /** Check if a form has a background */
  hasBackground: (formId: string) => boolean;
}

export function useWildShapeBackgrounds(): WildShapeBackgrounds {
  const [backgrounds, setBackgrounds] = useState<Record<string, string>>(() => {
    migrateToScoped(STORAGE_KEY);
    try {
      const saved = getScopedItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Persist changes
  useEffect(() => {
    try {
      setScopedItem(STORAGE_KEY, JSON.stringify(backgrounds));
    } catch (error) {
      console.error('Failed to save wild shape backgrounds:', error);
    }
  }, [backgrounds]);

  const getActiveBackground = useCallback((formId: string | null | undefined): string | null => {
    if (!formId) return null;
    return backgrounds[formId] ?? null;
  }, [backgrounds]);

  const assignBackground = useCallback(async (formId: string, file: File): Promise<void> => {
    if (!file.type.startsWith('image/')) {
      throw new Error('Please upload an image file');
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new Error('Image must be smaller than 5MB');
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (result) {
          setBackgrounds(prev => ({ ...prev, [formId]: result }));
          resolve();
        } else {
          reject(new Error('Failed to read image'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read image file'));
      reader.readAsDataURL(file);
    });
  }, []);

  const removeBackground = useCallback((formId: string) => {
    setBackgrounds(prev => {
      const next = { ...prev };
      delete next[formId];
      return next;
    });
  }, []);

  const hasBackground = useCallback((formId: string): boolean => {
    return !!backgrounds[formId];
  }, [backgrounds]);

  return {
    backgrounds,
    getActiveBackground,
    assignBackground,
    removeBackground,
    hasBackground,
  };
}
