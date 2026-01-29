import { useEffect, useRef, useCallback } from 'react';
import { Character } from '@/lib/types';
import { CharacterEquipment } from '@/lib/inventory/types';
import { Achievement } from '@/lib/achievements';
import { InventoryItem } from '@/lib/consumables/types';

const STORAGE_KEY = 'odyssey-character-autosave';
const DEBOUNCE_MS = 1000; // Save 1 second after last change

export interface SaveData {
  character: Character;
  equipment: CharacterEquipment;
  achievements: Achievement[];
  consumables: { consumableId: string; quantity: number }[];
  xp: {
    currentXP: number;
    xpPreset: string;
  };
  prestige: {
    prestigeXP: number;
    prestigeLevel: number;
    totalPrestigePoints: number;
    spentPrestigePoints: number;
  };
  savedAt: string;
  version: number;
}

// Helper to convert InventoryItem[] to serializable format
export function serializeConsumables(inventory: InventoryItem[]): SaveData['consumables'] {
  return inventory.map(item => ({
    consumableId: item.consumable.id,
    quantity: item.quantity,
  }));
}

const CURRENT_VERSION = 1;

export function useAutoSave(
  data: Omit<SaveData, 'savedAt' | 'version'>,
  enabled: boolean = true
) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSaveRef = useRef<string>('');

  const save = useCallback(() => {
    if (!enabled) return;
    
    const saveData: SaveData = {
      ...data,
      savedAt: new Date().toISOString(),
      version: CURRENT_VERSION,
    };
    
    const serialized = JSON.stringify(saveData);
    
    // Only save if data changed
    if (serialized !== lastSaveRef.current) {
      try {
        localStorage.setItem(STORAGE_KEY, serialized);
        lastSaveRef.current = serialized;
        console.log('[AutoSave] Saved at', new Date().toLocaleTimeString());
      } catch (error) {
        console.error('[AutoSave] Failed to save:', error);
      }
    }
  }, [data, enabled]);

  // Debounced auto-save on data change
  useEffect(() => {
    if (!enabled) return;
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      save();
    }, DEBOUNCE_MS);
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, save, enabled]);

  // Save on page unload
  useEffect(() => {
    if (!enabled) return;
    
    const handleBeforeUnload = () => {
      save();
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [save, enabled]);

  return { save };
}

export function loadAutoSave(): SaveData | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    
    const data = JSON.parse(saved) as SaveData;
    
    // Version migration if needed
    if (data.version !== CURRENT_VERSION) {
      console.log('[AutoSave] Migrating from version', data.version);
      // Add migration logic here if needed
    }
    
    return data;
  } catch (error) {
    console.error('[AutoSave] Failed to load:', error);
    return null;
  }
}

export function clearAutoSave(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    console.log('[AutoSave] Cleared');
  } catch (error) {
    console.error('[AutoSave] Failed to clear:', error);
  }
}

export function hasAutoSave(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}
