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

const STORAGE_KEY = 'odyssey-character-autosave';

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
  // Spellcasting state (magic path, slots, spells)
  spellcasting?: SpellcastingState;
  // Active spell effects (duration tracking)
  activeSpells?: ActiveSpellEffect[];
  // Prestige skill tree progress (Drizzt's Legacy)
  prestigeTree?: PrestigeTreeProgress;
  // Shop gold balance
  shopGold?: number;
  // Loot items and sold history
  loot?: LootState;
  // Proficiencies (skills and saves)
  proficiencies?: {
    skills: string[];
    saves: string[];
  };
  // Expertise skills (double proficiency)
  expertise?: string[];
  // D&D Inspiration
  inspiration?: boolean;
  // Combat settings (feat toggles)
  combatSettings?: CombatSettings;
  // Conditions state (buffs/debuffs/concentration)
  conditions?: ConditionsState;
  // Cooldown state (ability timers and session)
  cooldownState?: CooldownSaveState;
  // Party association (persists across sessions)
  partyId?: string | null;
  // Custom home background URL (cloud storage)
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

export function loadAutoSave(): SaveData | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    
    const data = JSON.parse(saved) as SaveData;
    
    // Version migration if needed
    if (data.version !== CURRENT_VERSION) {
      console.log('[AutoSave] Migrating from version', data.version, 'to', CURRENT_VERSION);
      // Character level points auto-migrate via getAbilityPointsForLevel() formula
      // Prestige points migrate via usePrestige hook's migratePrestigeData()
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
