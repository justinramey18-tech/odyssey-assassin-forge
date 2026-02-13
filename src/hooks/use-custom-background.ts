import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const STORAGE_KEY = 'odyssey-custom-home-background';
const STORAGE_URL_KEY = 'odyssey-custom-home-background-url';
const STORAGE_VIDEO_URL_KEY = 'odyssey-custom-home-background-video-url';

export interface CustomBackgroundState {
  customBackground: string | null;
  backgroundUrl: string | null;
  customVideoBackground: string | null;
  setCustomBackground: (imageDataUrl: string | null) => void;
  clearCustomBackground: () => void;
  handleImageUpload: (file: File, userId?: string) => Promise<void>;
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

  const [customVideoBackground, setCustomVideoBackground] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_VIDEO_URL_KEY);
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
      // Quota exceeded is expected for large images - the URL fallback handles this
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

  // Persist video URL to localStorage
  useEffect(() => {
    try {
      if (customVideoBackground) {
        localStorage.setItem(STORAGE_VIDEO_URL_KEY, customVideoBackground);
      } else {
        localStorage.removeItem(STORAGE_VIDEO_URL_KEY);
      }
    } catch (error) {
      console.error('Failed to save video background URL:', error);
    }
  }, [customVideoBackground]);

  const setCustomBackground = useCallback((imageDataUrl: string | null) => {
    setCustomBackgroundState(imageDataUrl);
    if (!imageDataUrl) {
      setBackgroundUrl(null);
    }
  }, []);

  const clearCustomBackground = useCallback(() => {
    setCustomBackgroundState(null);
    setBackgroundUrl(null);
    setCustomVideoBackground(null);
  }, []);

  const setBackgroundFromUrl = useCallback((url: string | null) => {
    setBackgroundUrl(url);
    if (url) {
      // Immediately use the URL as background (no waiting for canvas conversion)
      setCustomBackgroundState(url);
      
      // Optionally try to cache as dataURL for faster loads, but URL is the reliable fallback
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
      // Don't set onerror — URL is already set as background
      img.src = url;
    } else {
      setCustomBackgroundState(null);
    }
  }, []);

  const handleImageUpload = useCallback(async (file: File, userId?: string): Promise<void> => {
    const isVideo = file.type.startsWith('video/');

    // Validate file type
    if (!isVideo && !file.type.startsWith('image/')) {
      throw new Error('Please upload an image or video file');
    }

    // Validate file size
    const maxSize = isVideo ? 50 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new Error(isVideo ? 'Video must be smaller than 50MB' : 'Image must be smaller than 5MB');
    }

    if (isVideo) {
      // For videos, upload to cloud storage and use URL
      setCustomVideoBackground(null); // clear old while uploading
      setCustomBackgroundState(null);

      if (userId) {
        const ext = file.name.split('.').pop() || 'mp4';
        const path = `backgrounds/${userId}/home-bg-video.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('gear-images')
          .upload(path, file, { upsert: true });

        if (uploadError) throw new Error('Video upload failed');

        const { data: urlData } = supabase.storage
          .from('gear-images')
          .getPublicUrl(path);

        if (urlData?.publicUrl) {
          const url = `${urlData.publicUrl}?t=${Date.now()}`;
          setCustomVideoBackground(url);
        }
      } else {
        // No user — create a local object URL (won't persist across reloads without cloud)
        const objectUrl = URL.createObjectURL(file);
        setCustomVideoBackground(objectUrl);
      }
      return;
    }

    // Image flow (existing)
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
    setCustomVideoBackground(null); // clear video when image is set

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
    customVideoBackground,
    setCustomBackground,
    clearCustomBackground,
    handleImageUpload,
    setBackgroundFromUrl,
  };
}
