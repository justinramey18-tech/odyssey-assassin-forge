import { useState, useEffect, useCallback } from 'react';
import { getScopedItem, setScopedItem, removeScopedItem } from '@/lib/scoped-storage';

const STORAGE_KEY = 'odyssey-party-chat-background';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export interface PartyChatBackgroundState {
  background: string | null;
  setBackground: (dataUrl: string | null) => void;
  clearBackground: () => void;
  handleImageUpload: (file: File) => Promise<void>;
}

export function usePartyChatBackground(): PartyChatBackgroundState {
  const [background, setBackgroundState] = useState<string | null>(() => {
    try {
      return getScopedItem(STORAGE_KEY);
    } catch {
      return null;
    }
  });

  useEffect(() => {
    try {
      if (background) setScopedItem(STORAGE_KEY, background);
      else removeScopedItem(STORAGE_KEY);
    } catch (e) {
      console.error('[PartyChatBackground] Failed to save:', e);
    }
  }, [background]);

  useEffect(() => {
    const handleCharacterLoaded = () => {
      try {
        setBackgroundState(getScopedItem(STORAGE_KEY) ?? null);
      } catch {
        setBackgroundState(null);
      }
    };
    window.addEventListener('odyssey-character-loaded', handleCharacterLoaded);
    return () => window.removeEventListener('odyssey-character-loaded', handleCharacterLoaded);
  }, []);

  const setBackground = useCallback((dataUrl: string | null) => {
    setBackgroundState(dataUrl);
  }, []);

  const clearBackground = useCallback(() => {
    setBackgroundState(null);
  }, []);

  const handleImageUpload = useCallback(async (file: File): Promise<void> => {
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
          setBackgroundState(result);
          resolve();
        } else {
          reject(new Error('Failed to read image'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read image file'));
      reader.readAsDataURL(file);
    });
  }, []);

  return { background, setBackground, clearBackground, handleImageUpload };
}
