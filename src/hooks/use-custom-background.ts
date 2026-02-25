import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const STORAGE_KEY = 'odyssey-custom-home-background';
const STORAGE_URL_KEY = 'odyssey-custom-home-background-url';
const STORAGE_VIDEO_URL_KEY = 'odyssey-custom-home-video-url';

const VIDEO_MIME_TYPES = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];

export interface CustomBackgroundState {
  customBackground: string | null;
  backgroundUrl: string | null;
  /** If the custom background is a video, this holds its URL */
  customVideoUrl: string | null;
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

  const [customVideoUrl, setCustomVideoUrl] = useState<string | null>(() => {
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
      // If we have a video URL, use a placeholder so customBackground is truthy
      const videoUrl = localStorage.getItem(STORAGE_VIDEO_URL_KEY);
      if (videoUrl) return videoUrl;
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

  // Persist video URL to localStorage
  useEffect(() => {
    try {
      if (customVideoUrl) {
        localStorage.setItem(STORAGE_VIDEO_URL_KEY, customVideoUrl);
      } else {
        localStorage.removeItem(STORAGE_VIDEO_URL_KEY);
      }
    } catch (error) {
      console.error('Failed to save video URL:', error);
    }
  }, [customVideoUrl]);

  const setCustomBackground = useCallback((imageDataUrl: string | null) => {
    setCustomBackgroundState(imageDataUrl);
    if (!imageDataUrl) {
      setBackgroundUrl(null);
      setCustomVideoUrl(null);
    }
  }, []);

  const clearCustomBackground = useCallback(() => {
    setCustomBackgroundState(null);
    setBackgroundUrl(null);
    setCustomVideoUrl(null);
  }, []);

  const setBackgroundFromUrl = useCallback((url: string | null) => {
    setBackgroundUrl(url);
    if (url) {
      // Check if URL looks like a video
      const isVideo = /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url);
      if (isVideo) {
        setCustomVideoUrl(url);
        setCustomBackgroundState(url); // truthy marker
        return;
      }

      setCustomVideoUrl(null);
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
      setCustomVideoUrl(null);
    }
  }, []);

  const handleImageUpload = useCallback(async (file: File, userId?: string, saveId?: string): Promise<void> => {
    const isVideo = VIDEO_MIME_TYPES.includes(file.type);
    const isImage = file.type.startsWith('image/');

    if (!isImage && !isVideo) {
      throw new Error('Please upload an image or video file');
    }

    const maxSize = isVideo ? 50 * 1024 * 1024 : 5 * 1024 * 1024; // 50MB for video, 5MB for image
    if (file.size > maxSize) {
      throw new Error(isVideo ? 'Video must be smaller than 50MB' : 'Image must be smaller than 5MB');
    }

    if (isVideo) {
      // For videos, we need cloud storage — can't store as dataURL
      if (!userId) {
        // Create a local object URL as fallback for non-authenticated users
        const objectUrl = URL.createObjectURL(file);
        setCustomVideoUrl(objectUrl);
        setCustomBackgroundState(objectUrl); // truthy marker
        setBackgroundUrl(null);
        return;
      }

      // Upload to cloud storage
      try {
        const ext = file.name.split('.').pop() || 'mp4';
        const path = saveId
          ? `backgrounds/${userId}/${saveId}/home-bg.${ext}`
          : `backgrounds/${userId}/home-bg.${ext}`;
        
        const { error: uploadError } = await supabase.storage
          .from('videos')
          .upload(path, file, { upsert: true });
        
        if (uploadError) {
          console.error('[Background] Video cloud upload failed:', uploadError);
          // Fall back to object URL
          const objectUrl = URL.createObjectURL(file);
          setCustomVideoUrl(objectUrl);
          setCustomBackgroundState(objectUrl);
          return;
        }

        const { data: urlData } = supabase.storage
          .from('videos')
          .getPublicUrl(path);

        if (urlData?.publicUrl) {
          const url = `${urlData.publicUrl}?t=${Date.now()}`;
          setCustomVideoUrl(url);
          setBackgroundUrl(url);
          setCustomBackgroundState(url); // truthy marker
        }
      } catch (error) {
        console.error('[Background] Video cloud upload failed:', error);
        const objectUrl = URL.createObjectURL(file);
        setCustomVideoUrl(objectUrl);
        setCustomBackgroundState(objectUrl);
      }
      return;
    }

    // Image upload (existing logic)
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
    setCustomVideoUrl(null);

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
    customVideoUrl,
    setCustomBackground,
    clearCustomBackground,
    handleImageUpload,
    setBackgroundFromUrl,
  };
}
