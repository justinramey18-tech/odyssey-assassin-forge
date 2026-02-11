import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const STORAGE_KEY = 'odyssey-custom-home-background';
const STORAGE_URL_KEY = 'odyssey-custom-home-background-url';

export interface CustomBackgroundState {
  customBackground: string | null;
  backgroundUrl: string | null;
  setCustomBackground: (imageDataUrl: string | null) => void;
  clearCustomBackground: () => void;
  handleImageUpload: (file: File, userId?: string) => Promise<void>;
  setBackgroundFromUrl: (url: string | null) => void;
}

export function useCustomBackground(): CustomBackgroundState {
  const [customBackground, setCustomBackgroundState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  });

  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_URL_KEY);
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
      // Load the image from URL into the local state for display
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        // Create a canvas to convert to dataURL for local caching
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
            // CORS issue, just set the URL directly
            setCustomBackgroundState(url);
          }
        }
      };
      img.onerror = () => {
        // Fallback: use URL directly as background
        setCustomBackgroundState(url);
      };
      img.src = url;
    } else {
      setCustomBackgroundState(null);
    }
  }, []);

  const handleImageUpload = useCallback(async (file: File, userId?: string): Promise<void> => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      throw new Error('Please upload an image file');
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new Error('Image must be smaller than 5MB');
    }

    // Read as dataURL for immediate local display
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

    // Set locally immediately
    setCustomBackgroundState(dataUrl);

    // Upload to cloud storage if authenticated
    if (userId) {
      try {
        const ext = file.name.split('.').pop() || 'jpg';
        const path = `backgrounds/${userId}/home-bg.${ext}`;
        
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
          // Add cache-buster to prevent stale images
          const url = `${urlData.publicUrl}?t=${Date.now()}`;
          setBackgroundUrl(url);
          console.log('[Background] Uploaded to cloud:', url);
        }
      } catch (error) {
        console.error('[Background] Cloud upload failed:', error);
        // Local still works, cloud just didn't save
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
