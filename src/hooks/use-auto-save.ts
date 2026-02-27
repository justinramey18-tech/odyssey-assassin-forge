import { useEffect, useRef, useCallback } from 'react';
import { Character } from '@/lib/types';
import { CharacterEquipment } from '@/lib/inventory/types';
import { Achievement } from '@/lib/achievements';
import { InventoryItem } from '@/lib/consumables/types';
import { SpellcastingState } from '@/lib/magic/types';
import { ActiveSpellEffect } from '@/lib/magic/durations';
import { PrestigeTreeProgress } from '@/lib/prestigeTree/types';
import { LootState } from '@/lib/loot/types';
import { CombatSettings } from '@/lib/combat/combatSettings';
import { ConditionsState } from '@/lib/conditions/types';
import { CooldownSaveState } from '@/lib/cooldowns/types';
import { getScopedItem, setScopedItem } from '@/lib/scoped-storage';

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
  };
  abilityScores?: {
    strength: number;
    dexterity: number;
    constitution: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
  };
  hpState?: {
    current: number;
    max: number;
    temp: number;
  };
  deathSaves?: {
    successes: number;
    failures: number;
  };
  spellcasting?: SpellcastingState;
  activeSpells?: ActiveSpellEffect[];
  prestigeTree?: PrestigeTreeProgress;
  shopGold?: number;
  loot?: LootState;
  proficiencies?: {
    skills: string[];
    saves: string[];
  };
  expertise?: string[];
  inspiration?: boolean;
  combatSettings?: CombatSettings;
  conditions?: ConditionsState;
  cooldownState?: CooldownSaveState;
  partyId?: string | null;
  backgroundUrl?: string | null;
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

// Version 2: Updated ability points formula (tiered progression)
// Version 2: Updated prestige points formula (variable 2-5 per level)
const CURRENT_VERSION = 2;

/**
 * @deprecated Use useAutoCloudSync instead. This hook is kept only for the
 * SaveData interface and loadAutoSave/clearAutoSave utilities.
 */
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
    
    if (serialized !== lastSaveRef.current) {
      try {
        setScopedItem(STORAGE_KEY, serialized);
        lastSaveRef.current = serialized;
        console.log('[AutoSave] Saved at', new Date().toLocaleTimeString());
      } catch (error) {
        console.error('[AutoSave] Failed to save:', error);
      }
    }
  }, [data, enabled]);

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

/**
 * Load the monolithic autosave snapshot from SCOPED localStorage.
 * Falls back to the unscoped key for migration from pre-scoped versions.
 */
export function loadAutoSave(): SaveData | null {
  try {
    // Try scoped key first (character-isolated)
    let saved = getScopedItem(STORAGE_KEY);
    
    // Fallback to unscoped key for legacy/migration
    if (!saved) {
      saved = localStorage.getItem(STORAGE_KEY);
    }
    
    if (!saved) return null;
    
    const data = JSON.parse(saved) as SaveData;
    
    if (data.version !== CURRENT_VERSION) {
      console.log('[AutoSave] Migrating from version', data.version, 'to', CURRENT_VERSION);
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
    // Also try to remove scoped version
    try {
      const scopedKey = getScopedItem(STORAGE_KEY);
      if (scopedKey !== null) {
        const saveId = localStorage.getItem('odyssey-active-cloud-save-id');
        if (saveId) {
          localStorage.removeItem(`${STORAGE_KEY}::${saveId}`);
        }
      }
    } catch {}
    console.log('[AutoSave] Cleared');
  } catch (error) {
    console.error('[AutoSave] Failed to clear:', error);
  }
}

export function hasAutoSave(): boolean {
  try {
    return getScopedItem(STORAGE_KEY) !== null || localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}
