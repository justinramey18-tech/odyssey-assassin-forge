// Gear Image Upload and Management
import { supabase } from '@/integrations/supabase/client';
import { EquipmentSlotType } from './types';

// Local storage key for gear images (fallback when no cloud)
const GEAR_IMAGES_KEY = 'gear-custom-images';

export interface GearImageMap {
  [itemId: string]: string; // itemId -> imageUrl
}

// Get all custom gear images from local storage
export function getLocalGearImages(): GearImageMap {
  try {
    const stored = localStorage.getItem(GEAR_IMAGES_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

// Save gear image URL to local storage
export function saveLocalGearImage(itemId: string, imageUrl: string): void {
  const images = getLocalGearImages();
  images[itemId] = imageUrl;
  localStorage.setItem(GEAR_IMAGES_KEY, JSON.stringify(images));
}

// Remove gear image from local storage
export function removeLocalGearImage(itemId: string): void {
  const images = getLocalGearImages();
  delete images[itemId];
  localStorage.setItem(GEAR_IMAGES_KEY, JSON.stringify(images));
}

// Upload image to Supabase storage
export async function uploadGearImage(
  itemId: string,
  file: File
): Promise<string | null> {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${itemId}-${Date.now()}.${fileExt}`;
    const filePath = `gear/${fileName}`;

    const { data, error } = await supabase.storage
      .from('gear-images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (error) {
      console.error('Upload error:', error);
      return null;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('gear-images')
      .getPublicUrl(filePath);

    const imageUrl = urlData.publicUrl;
    
    // Also save to local storage for quick access
    saveLocalGearImage(itemId, imageUrl);
    
    return imageUrl;
  } catch (error) {
    console.error('Upload error:', error);
    return null;
  }
}

// Get image for a specific gear item
export function getGearImage(itemId: string): string | null {
  const images = getLocalGearImages();
  return images[itemId] || null;
}

// Get first available gear image for a slot type
export function getSlotTypeImage(
  slotType: EquipmentSlotType,
  equippedItemId?: string | null,
  inventoryItemIds?: string[]
): string | null {
  const images = getLocalGearImages();
  
  // First check equipped item
  if (equippedItemId && images[equippedItemId]) {
    return images[equippedItemId];
  }
  
  // Then check inventory items
  if (inventoryItemIds) {
    for (const id of inventoryItemIds) {
      if (images[id]) {
        return images[id];
      }
    }
  }
  
  return null;
}
