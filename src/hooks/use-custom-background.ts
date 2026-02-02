import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'odyssey-custom-home-background';

export interface CustomBackgroundState {
  customBackground: string | null;
  setCustomBackground: (imageDataUrl: string | null) => void;
  clearCustomBackground: () => void;
  handleImageUpload: (file: File) => Promise<void>;
}

export function useCustomBackground(): CustomBackgroundState {
  const [customBackground, setCustomBackgroundState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  });

  // Persist to localStorage whenever it changes
  useEffect(() => {
    try {
      if (customBackground) {
        localStorage.setItem(STORAGE_KEY, customBackground);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (error) {
      console.error('Failed to save custom background:', error);
    }
  }, [customBackground]);

  const setCustomBackground = useCallback((imageDataUrl: string | null) => {
    setCustomBackgroundState(imageDataUrl);
  }, []);

  const clearCustomBackground = useCallback(() => {
    setCustomBackgroundState(null);
  }, []);

  const handleImageUpload = useCallback(async (file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        reject(new Error('Please upload an image file'));
        return;
      }

      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        reject(new Error('Image must be smaller than 5MB'));
        return;
      }

      const reader = new FileReader();
      
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (result) {
          setCustomBackgroundState(result);
          resolve();
        } else {
          reject(new Error('Failed to read image'));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read image file'));
      };
      
      reader.readAsDataURL(file);
    });
  }, []);

  return {
    customBackground,
    setCustomBackground,
    clearCustomBackground,
    handleImageUpload,
  };
}
