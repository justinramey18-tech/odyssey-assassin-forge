import { useState, useEffect, useCallback } from 'react';
import { EquipmentSlotType } from '@/lib/inventory/types';

const STORAGE_KEY = 'odyssey-equipment-custom-images';

export type EquipmentImages = Partial<Record<EquipmentSlotType, string>>;

export interface EquipmentImagesState {
  images: EquipmentImages;
  setSlotImage: (slotType: EquipmentSlotType, imageDataUrl: string | null) => void;
  clearSlotImage: (slotType: EquipmentSlotType) => void;
  clearAllImages: () => void;
  handleImageUpload: (slotType: EquipmentSlotType, file: File) => Promise<void>;
}

export function useEquipmentImages(): EquipmentImagesState {
  const [images, setImages] = useState<EquipmentImages>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  // Persist to localStorage whenever images change
  useEffect(() => {
    try {
      if (Object.keys(images).length > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(images));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (error) {
      console.error('Failed to save equipment images:', error);
    }
  }, [images]);

  const setSlotImage = useCallback((slotType: EquipmentSlotType, imageDataUrl: string | null) => {
    setImages(prev => {
      if (imageDataUrl === null) {
        const { [slotType]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [slotType]: imageDataUrl };
    });
  }, []);

  const clearSlotImage = useCallback((slotType: EquipmentSlotType) => {
    setImages(prev => {
      const { [slotType]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  const clearAllImages = useCallback(() => {
    setImages({});
  }, []);

  const handleImageUpload = useCallback(async (slotType: EquipmentSlotType, file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        reject(new Error('Please upload an image file'));
        return;
      }

      // Validate file size (max 2MB per slot image)
      const maxSize = 2 * 1024 * 1024;
      if (file.size > maxSize) {
        reject(new Error('Image must be smaller than 2MB'));
        return;
      }

      const reader = new FileReader();
      
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (result) {
          setSlotImage(slotType, result);
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
  }, [setSlotImage]);

  return {
    images,
    setSlotImage,
    clearSlotImage,
    clearAllImages,
    handleImageUpload,
  };
}
