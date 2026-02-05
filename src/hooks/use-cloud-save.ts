import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SaveData } from './use-auto-save';
import { Json } from '@/integrations/supabase/types';

export interface CloudSave {
  id: string;
  save_name: string;
  updated_at: string;
  created_at: string;
  // Character preview data
  character_name?: string;
  character_level?: number;
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
        .select('id, save_name, updated_at, created_at, character_data')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      
      // Extract character preview info from character_data
      const savesWithPreview: CloudSave[] = (data || []).map(save => {
        const charData = save.character_data as Record<string, unknown> | null;
        return {
          id: save.id,
          save_name: save.save_name,
          updated_at: save.updated_at,
          created_at: save.created_at,
          character_name: charData?.name as string | undefined,
          character_level: charData?.level as number | undefined,
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
      // Prepare data for database (cast to Json type)
      const dbData = {
        character_data: JSON.parse(JSON.stringify(saveData.character)) as Json,
        equipment_data: JSON.parse(JSON.stringify(saveData.equipment)) as Json,
        achievements_data: JSON.parse(JSON.stringify(saveData.achievements)) as Json,
        consumables_data: JSON.parse(JSON.stringify(saveData.consumables)) as Json,
        prestige_data: JSON.parse(JSON.stringify(saveData.prestige)) as Json,
        xp_data: JSON.parse(JSON.stringify(saveData.xp)) as Json,
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
      
      // Convert database format to SaveData format
      const saveData: SaveData = {
        character: data.character_data as unknown as SaveData['character'],
        equipment: data.equipment_data as unknown as SaveData['equipment'],
        achievements: data.achievements_data as unknown as SaveData['achievements'],
        consumables: data.consumables_data as unknown as SaveData['consumables'],
        xp: data.xp_data as unknown as SaveData['xp'],
        prestige: data.prestige_data as unknown as SaveData['prestige'],
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
