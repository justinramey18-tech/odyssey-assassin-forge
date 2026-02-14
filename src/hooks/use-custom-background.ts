import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const STORAGE_KEY = 'odyssey-custom-home-background';
const STORAGE_URL_KEY = 'odyssey-custom-home-background-url';

export interface CustomBackgroundState {
  customBackground: string | null;
  backgroundUrl: string | null;
  setCustomBackground: (imageDataUrl: string | null) => void;
  clearCustomBackground: () => void;
  handleImageUpload: (file: File, userId?: string, saveId?: string) => Promise<void>;
  setBackgroundFromUrl: (url: string | null) => void;
}

export function useCustomBackground(): CustomBackgroundState {
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_URL_KEY);
    } catch {
      return null;
    }
  });

  const [customBackground, setCustomBackgroundState] = useState<string | null>(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) return cached;
      const url = localStorage.getItem(STORAGE_URL_KEY);
      if (url) return url;
      return null;
    } catch {
      return null;
    }
  });

  // Persist dataURL to localStorage (best-effort, may fail for large images)
  useEffect(() => {
    try {
      if (customBackground) {
        localStorage.setItem(STORAGE_KEY, customBackground);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (error) {
      console.warn('[Background] localStorage cache failed (likely quota exceeded), using URL fallback');
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [customBackground]);

  // Persist URL to localStorage
  useEffect(() => {
    try {
      if (backgroundUrl) {
        localStorage.setItem(STORAGE_URL_KEY, backgroundUrl);
      } else {
        localStorage.removeItem(STORAGE_URL_KEY);
      }
    } catch (error) {
      console.error('Failed to save background URL:', error);
    }
  }, [backgroundUrl]);

  const setCustomBackground = useCallback((imageDataUrl: string | null) => {
    setCustomBackgroundState(imageDataUrl);
    if (!imageDataUrl) {
      setBackgroundUrl(null);
    }
  }, []);

  const clearCustomBackground = useCallback(() => {
    setCustomBackgroundState(null);
    setBackgroundUrl(null);
  }, []);

  const setBackgroundFromUrl = useCallback((url: string | null) => {
    setBackgroundUrl(url);
    if (url) {
      setCustomBackgroundState(url);
      
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          try {
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            setCustomBackgroundState(dataUrl);
          } catch {
            // CORS or quota — URL is already set, no action needed
          }
        }
      };
      img.src = url;
    } else {
      setCustomBackgroundState(null);
    }
  }, []);

  const handleImageUpload = useCallback(async (file: File, userId?: string, saveId?: string): Promise<void> => {
    if (!file.type.startsWith('image/')) {
      throw new Error('Please upload an image file');
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new Error('Image must be smaller than 5MB');
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (result) resolve(result);
        else reject(new Error('Failed to read image'));
      };
      reader.onerror = () => reject(new Error('Failed to read image file'));
      reader.readAsDataURL(file);
    });

    setCustomBackgroundState(dataUrl);

    if (userId) {
      try {
        const ext = file.name.split('.').pop() || 'jpg';
        const path = saveId
          ? `backgrounds/${userId}/${saveId}/home-bg.${ext}`
          : `backgrounds/${userId}/home-bg.${ext}`;
        
        const { error: uploadError } = await supabase.storage
          .from('gear-images')
          .upload(path, file, { upsert: true });
        
        if (uploadError) {
          console.error('[Background] Cloud upload failed:', uploadError);
          return;
        }

        const { data: urlData } = supabase.storage
          .from('gear-images')
          .getPublicUrl(path);

        if (urlData?.publicUrl) {
          const url = `${urlData.publicUrl}?t=${Date.now()}`;
          setBackgroundUrl(url);
        }
      } catch (error) {
        console.error('[Background] Cloud upload failed:', error);
      }
    }
  }, []);

  return {
    customBackground,
    backgroundUrl,
    setCustomBackground,
    clearCustomBackground,
    handleImageUpload,
    setBackgroundFromUrl,
  };
}
