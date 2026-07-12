import { useState, useEffect, useCallback } from 'react';
import { getScopedItem, setScopedItem, removeScopedItem } from '@/lib/scoped-storage';

const IMAGE_KEY = 'odyssey-party-chat-background';
const SETTINGS_KEY = 'odyssey-party-chat-background-settings';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export interface PartyChatBackgroundSettings {
  opacity: number; // 0..1
  blur: number;    // px
}

const DEFAULT_SETTINGS: PartyChatBackgroundSettings = { opacity: 0.28, blur: 0 };

export interface PartyChatBackgroundState {
  background: string | null;
  settings: PartyChatBackgroundSettings;
  setBackground: (dataUrl: string | null) => void;
  clearBackground: () => void;
  handleImageUpload: (file: File) => Promise<void>;
  setOpacity: (value: number) => void;
  setBlur: (value: number) => void;
}

function readSettings(): PartyChatBackgroundSettings {
  try {
    const raw = getScopedItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      opacity: typeof parsed.opacity === 'number' ? parsed.opacity : DEFAULT_SETTINGS.opacity,
      blur: typeof parsed.blur === 'number' ? parsed.blur : DEFAULT_SETTINGS.blur,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function usePartyChatBackground(): PartyChatBackgroundState {
  const [background, setBackgroundState] = useState<string | null>(() => {
    try {
      return getScopedItem(IMAGE_KEY);
    } catch {
      return null;
    }
  });

  const [settings, setSettings] = useState<PartyChatBackgroundSettings>(readSettings);

  useEffect(() => {
    try {
      if (background) setScopedItem(IMAGE_KEY, background);
      else removeScopedItem(IMAGE_KEY);
    } catch (e) {
      console.error('[PartyChatBackground] Failed to save image:', e);
    }
  }, [background]);

  useEffect(() => {
    try {
      setScopedItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      console.error('[PartyChatBackground] Failed to save settings:', e);
    }
  }, [settings]);

  useEffect(() => {
    const handleCharacterLoaded = () => {
      try {
        setBackgroundState(getScopedItem(IMAGE_KEY) ?? null);
        setSettings(readSettings());
      } catch {
        setBackgroundState(null);
        setSettings(DEFAULT_SETTINGS);
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

  const setOpacity = useCallback((value: number) => {
    setSettings(prev => ({ ...prev, opacity: Math.max(0, Math.min(1, value)) }));
  }, []);

  const setBlur = useCallback((value: number) => {
    setSettings(prev => ({ ...prev, blur: Math.max(0, Math.min(40, value)) }));
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

  return {
    background,
    settings,
    setBackground,
    clearBackground,
    handleImageUpload,
    setOpacity,
    setBlur,
  };
}
