import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export interface GuidePreset {
  id: string;
  name: string;
  guideIds: string[];
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = 'dnd-gm-guide-presets';

function loadLocal(): GuidePreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveLocal(presets: GuidePreset[]): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(presets)); }
  catch (e) { console.error('Failed to save presets locally:', e); }
}

export function useGuidePresets() {
  const [presets, setPresets] = useState<GuidePreset[]>(() => loadLocal());

  // Load from cloud on mount
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || cancelled) return;

      const { data, error } = await supabase
        .from('gm_guide_presets')
        .select('*')
        .order('created_at', { ascending: true });

      if (error || cancelled) return;

      if (data && data.length > 0) {
        const cloud: GuidePreset[] = data.map(r => ({
          id: r.id,
          name: r.name,
          guideIds: r.guide_ids,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        }));
        setPresets(cloud);
        saveLocal(cloud);
      } else {
        // Push local presets to cloud
        const local = loadLocal();
        if (local.length > 0) {
          for (const p of local) {
            await supabase.from('gm_guide_presets').upsert({
              id: p.id,
              user_id: session.user.id,
              name: p.name,
              guide_ids: p.guideIds,
              created_at: p.createdAt,
              updated_at: p.updatedAt,
            });
          }
        }
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const persistCloud = useCallback(async (preset: GuidePreset) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from('gm_guide_presets').upsert({
      id: preset.id,
      user_id: session.user.id,
      name: preset.name,
      guide_ids: preset.guideIds,
      created_at: preset.createdAt,
      updated_at: preset.updatedAt,
    });
  }, []);

  const createPreset = useCallback((name: string, guideIds: string[]): GuidePreset => {
    const preset: GuidePreset = {
      id: crypto.randomUUID(),
      name: name.trim() || 'Untitled Preset',
      guideIds,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const next = [...presets, preset];
    setPresets(next);
    saveLocal(next);
    persistCloud(preset);
    toast.success(`Preset "${preset.name}" saved`);
    return preset;
  }, [presets, persistCloud]);

  const deletePreset = useCallback(async (id: string) => {
    const next = presets.filter(p => p.id !== id);
    setPresets(next);
    saveLocal(next);
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await supabase.from('gm_guide_presets').delete().eq('id', id);
    }
    toast.success('Preset deleted');
  }, [presets]);

  const getPresetGuideIds = useCallback((presetId: string): string[] | null => {
    const preset = presets.find(p => p.id === presetId);
    return preset ? preset.guideIds : null;
  }, [presets]);

  return { presets, createPreset, deletePreset, getPresetGuideIds };
}
