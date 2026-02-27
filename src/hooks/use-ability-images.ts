import { useState, useEffect, useCallback } from 'react';
import { getScopedItem, setScopedItem, removeScopedItem } from '@/lib/scoped-storage';

const STORAGE_KEY = 'odyssey-ability-custom-images';

export type AbilityImages = Record<string, string>;

export interface AbilityImagesState {
  images: AbilityImages;
  setAbilityImage: (abilityId: string, imageDataUrl: string | null) => void;
  clearAbilityImage: (abilityId: string) => void;
  clearAllImages: () => void;
  handleImageUpload: (abilityId: string, file: File) => Promise<void>;
}

export function useAbilityImages(): AbilityImagesState {
  const [images, setImages] = useState<AbilityImages>(() => {
    try {
      const stored = getScopedItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  // Persist to localStorage whenever images change
  useEffect(() => {
    try {
      if (Object.keys(images).length > 0) {
        setScopedItem(STORAGE_KEY, JSON.stringify(images));
      } else {
        removeScopedItem(STORAGE_KEY);
      }
    } catch (error) {
      console.error('Failed to save ability images:', error);
    }
  }, [images]);

  const setAbilityImage = useCallback((abilityId: string, imageDataUrl: string | null) => {
    setImages(prev => {
      if (imageDataUrl === null) {
        const { [abilityId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [abilityId]: imageDataUrl };
    });
  }, []);

  const clearAbilityImage = useCallback((abilityId: string) => {
    setImages(prev => {
      const { [abilityId]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  const clearAllImages = useCallback(() => {
    setImages({});
  }, []);

  const handleImageUpload = useCallback(async (abilityId: string, file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        reject(new Error('Please upload an image file'));
        return;
      }

      // Validate file size (max 2MB per ability image)
      const maxSize = 2 * 1024 * 1024;
      if (file.size > maxSize) {
        reject(new Error('Image must be smaller than 2MB'));
        return;
      }

      const reader = new FileReader();
      
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (result) {
          setAbilityImage(abilityId, result);
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
  }, [setAbilityImage]);

  return {
    images,
    setAbilityImage,
    clearAbilityImage,
    clearAllImages,
    handleImageUpload,
  };
}
