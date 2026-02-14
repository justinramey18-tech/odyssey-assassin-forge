import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SaveData } from './use-auto-save';
import { Json } from '@/integrations/supabase/types';
import { getScopedKey } from '@/lib/scoped-storage';

// Keys whose localStorage data should be captured per-character in cloud saves
const SCOPED_KEYS = [
  'odyssey-shop',
  'dnd-wild-shape-state',
  'odyssey-wild-shape-backgrounds',
  'narrative-forge-saved-stories',
  'narrative-forge-active-story-id',
  'odyssey-chronicle-sessions',
  'odyssey-chronicle-analytics',
  'dnd-ai-dm-campaign-summary',
] as const;

export interface CloudSavePreview {
  gold?: number;
  spellsKnown?: number;
  lootItems?: number;
  consumables?: number;
  conditions?: number;
  proficiencies?: number;
  hasInspiration?: boolean;
}

export interface CloudSave {
  id: string;
  save_name: string;
  updated_at: string;
  created_at: string;
  // Character preview data
  character_name?: string;
  character_level?: number;
  // Extended data preview
  preview?: CloudSavePreview;
}

export function useCloudSave(userId: string | undefined) {
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cloudSaves, setCloudSaves] = useState<CloudSave[]>([]);

  const fetchSaves = useCallback(async () => {
    if (!userId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('character_saves')
        .select('id, save_name, updated_at, created_at, character_data, consumables_data, extended_data')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      
      // Extract character preview info from character_data and extended_data
      const savesWithPreview: CloudSave[] = (data || []).map(save => {
        const charData = save.character_data as Record<string, unknown> | null;
        const extData = save.extended_data as Record<string, unknown> | null;
        const consumablesData = save.consumables_data as Array<{ quantity?: number }> | null;
        
        // Build preview from extended data
        const preview: CloudSavePreview = {};
        if (extData) {
          preview.gold = extData.shopGold as number | undefined;
          preview.spellsKnown = (extData.spellcasting as Record<string, unknown>)?.knownSpells 
            ? ((extData.spellcasting as Record<string, unknown>).knownSpells as unknown[]).length 
            : undefined;
          preview.lootItems = (extData.loot as Record<string, unknown>)?.items 
            ? ((extData.loot as Record<string, unknown>).items as unknown[]).length 
            : undefined;
          preview.conditions = (extData.conditions as Record<string, unknown>)?.conditions 
            ? ((extData.conditions as Record<string, unknown>).conditions as unknown[]).length 
            : undefined;
          preview.proficiencies = extData.proficiencies 
            ? ((extData.proficiencies as Record<string, unknown>).skills as unknown[] || []).length + 
              ((extData.proficiencies as Record<string, unknown>).saves as unknown[] || []).length
            : undefined;
          preview.hasInspiration = extData.inspiration as boolean | undefined;
        }
        if (consumablesData) {
          preview.consumables = consumablesData.reduce((sum, c) => sum + (c.quantity ?? 0), 0);
        }
        
        return {
          id: save.id,
          save_name: save.save_name,
          updated_at: save.updated_at,
          created_at: save.created_at,
          character_name: charData?.name as string | undefined,
          character_level: charData?.level as number | undefined,
          preview: Object.keys(preview).length > 0 ? preview : undefined,
        };
      });
      
      setCloudSaves(savesWithPreview);
    } catch (error) {
      console.error('[CloudSave] Failed to fetch saves:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const saveToCloud = useCallback(async (
    saveData: Omit<SaveData, 'savedAt' | 'version'>,
    saveName: string = 'Main Character',
    saveId?: string // Optional: update specific save by ID
  ) => {
    if (!userId) return { error: new Error('Not authenticated') };
    
    setSaving(true);
    try {
      // Prepare extended data (all the new fields)
      const extendedData: Record<string, unknown> = {
        abilityScores: saveData.abilityScores,
        hpState: saveData.hpState,
        deathSaves: saveData.deathSaves,
        spellcasting: saveData.spellcasting,
        activeSpells: saveData.activeSpells,
        prestigeTree: saveData.prestigeTree,
        shopGold: saveData.shopGold,
        loot: saveData.loot,
        proficiencies: saveData.proficiencies,
        expertise: saveData.expertise,
        inspiration: saveData.inspiration,
        combatSettings: saveData.combatSettings,
        conditions: saveData.conditions,
        cooldownState: saveData.cooldownState,
        partyId: saveData.partyId,
        backgroundUrl: saveData.backgroundUrl,
      };

      // Capture scoped localStorage data for this character
      const scopedLocalStorage: Record<string, string | null> = {};
      for (const baseKey of SCOPED_KEYS) {
        try {
          const value = localStorage.getItem(getScopedKey(baseKey));
          if (value !== null) {
            scopedLocalStorage[baseKey] = value;
          }
        } catch {
          // ignore read errors
        }
      }
      extendedData.scopedLocalStorage = scopedLocalStorage;
      
      // Prepare data for database (cast to Json type)
      const dbData = {
        character_data: JSON.parse(JSON.stringify(saveData.character)) as Json,
        equipment_data: JSON.parse(JSON.stringify(saveData.equipment)) as Json,
        achievements_data: JSON.parse(JSON.stringify(saveData.achievements)) as Json,
        consumables_data: JSON.parse(JSON.stringify(saveData.consumables)) as Json,
        prestige_data: JSON.parse(JSON.stringify(saveData.prestige)) as Json,
        xp_data: JSON.parse(JSON.stringify(saveData.xp)) as Json,
        extended_data: JSON.parse(JSON.stringify(extendedData)) as Json,
      };
      
      let result;
      
      if (saveId) {
        // Update existing save by ID
        result = await supabase
          .from('character_saves')
          .update({ ...dbData, save_name: saveName })
          .eq('id', saveId)
          .eq('user_id', userId)
          .select()
          .single();
      } else {
        // Insert new save
        result = await supabase
          .from('character_saves')
          .insert({
            user_id: userId,
            save_name: saveName,
            ...dbData,
          })
          .select()
          .single();
      }
      
      if (result.error) throw result.error;
      
      // Refresh saves list
      await fetchSaves();
      
      return { data: result.data, error: null };
    } catch (error) {
      console.error('[CloudSave] Failed to save:', error);
      return { data: null, error };
    } finally {
      setSaving(false);
    }
  }, [userId, fetchSaves]);

  const renameSave = useCallback(async (saveId: string, newName: string) => {
    if (!userId) return { error: new Error('Not authenticated') };
    
    try {
      const { error } = await supabase
        .from('character_saves')
        .update({ save_name: newName })
        .eq('id', saveId)
        .eq('user_id', userId);
      
      if (error) throw error;
      
      await fetchSaves();
      return { error: null };
    } catch (error) {
      console.error('[CloudSave] Failed to rename:', error);
      return { error };
    }
  }, [userId, fetchSaves]);

  const loadFromCloud = useCallback(async (saveId: string): Promise<SaveData | null> => {
    if (!userId) return null;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('character_saves')
        .select('*')
        .eq('id', saveId)
        .eq('user_id', userId)
        .single();
      
      if (error) throw error;
      if (!data) return null;
      
      // Parse extended data
      const extendedData = (data.extended_data as Record<string, unknown>) || {};
      
      // Restore scoped localStorage for this character
      const scopedLocalStorage = extendedData.scopedLocalStorage as Record<string, string> | undefined;
      if (scopedLocalStorage && typeof scopedLocalStorage === 'object') {
        for (const [baseKey, value] of Object.entries(scopedLocalStorage)) {
          if (value !== null && value !== undefined) {
            try {
              // Write directly to the save-specific scoped key
              localStorage.setItem(`${baseKey}::${saveId}`, value);
            } catch {
              console.warn(`[CloudSave] Failed to restore scoped key: ${baseKey}`);
            }
          }
        }
      }
      
      // Convert database format to SaveData format
      const saveData: SaveData = {
        character: data.character_data as unknown as SaveData['character'],
        equipment: data.equipment_data as unknown as SaveData['equipment'],
        achievements: data.achievements_data as unknown as SaveData['achievements'],
        consumables: data.consumables_data as unknown as SaveData['consumables'],
        xp: data.xp_data as unknown as SaveData['xp'],
        prestige: data.prestige_data as unknown as SaveData['prestige'],
        // Extended data fields
        abilityScores: extendedData.abilityScores as SaveData['abilityScores'],
        hpState: extendedData.hpState as SaveData['hpState'],
        deathSaves: extendedData.deathSaves as SaveData['deathSaves'],
        spellcasting: extendedData.spellcasting as SaveData['spellcasting'],
        activeSpells: extendedData.activeSpells as SaveData['activeSpells'],
        prestigeTree: extendedData.prestigeTree as SaveData['prestigeTree'],
        shopGold: extendedData.shopGold as SaveData['shopGold'],
        loot: extendedData.loot as SaveData['loot'],
        proficiencies: extendedData.proficiencies as SaveData['proficiencies'],
        expertise: extendedData.expertise as SaveData['expertise'],
        inspiration: extendedData.inspiration as SaveData['inspiration'],
        combatSettings: extendedData.combatSettings as SaveData['combatSettings'],
        conditions: extendedData.conditions as SaveData['conditions'],
        cooldownState: extendedData.cooldownState as SaveData['cooldownState'],
        partyId: extendedData.partyId as SaveData['partyId'],
        backgroundUrl: extendedData.backgroundUrl as SaveData['backgroundUrl'],
        savedAt: data.updated_at,
        version: 1,
      };
      
      return saveData;
    } catch (error) {
      console.error('[CloudSave] Failed to load:', error);
      return null;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const deleteCloudSave = useCallback(async (saveId: string) => {
    if (!userId) return { error: new Error('Not authenticated') };
    
    try {
      const { error } = await supabase
        .from('character_saves')
        .delete()
        .eq('id', saveId)
        .eq('user_id', userId);
      
      if (error) throw error;
      
      // Refresh saves list
      await fetchSaves();
      
      return { error: null };
    } catch (error) {
      console.error('[CloudSave] Failed to delete:', error);
      return { error };
    }
  }, [userId, fetchSaves]);

  return {
    saving,
    loading,
    cloudSaves,
    fetchSaves,
    saveToCloud,
    loadFromCloud,
    deleteCloudSave,
    renameSave,
  };
}
