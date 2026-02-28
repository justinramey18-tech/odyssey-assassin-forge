import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { getClaudeEverywhereKey } from '@/lib/api-keys';

export interface WorldBuilderState {
  genre: string;
  tone: string;
  setting: string;
  settingNotes: string;
  selectedFactions: string[];
  conflict: string;
  characterHook: string;
}

const INITIAL_STATE: WorldBuilderState = {
  genre: '',
  tone: '',
  setting: '',
  settingNotes: '',
  selectedFactions: [],
  conflict: '',
  characterHook: '',
};

interface UseWorldBuilderOptions {
  characterName: string;
  characterLevel: number;
}

export function useWorldBuilder({ characterName, characterLevel }: UseWorldBuilderOptions) {
  const [worldBuilderState, setWorldBuilderState] = useState<WorldBuilderState>(INITIAL_STATE);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedBible, setGeneratedBible] = useState<string | null>(null);
  const [generatedWorldName, setGeneratedWorldName] = useState<string | null>(null);

  const updateState = useCallback((updates: Partial<WorldBuilderState>) => {
    setWorldBuilderState(prev => ({ ...prev, ...updates }));
  }, []);

  const resetState = useCallback(() => {
    setWorldBuilderState(INITIAL_STATE);
    setGeneratedBible(null);
    setGeneratedWorldName(null);
  }, []);

  const generateWorld = useCallback(async (): Promise<boolean> => {
    setIsGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-dm-worldbuilder`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            genre: worldBuilderState.genre || 'Fantasy',
            tone: worldBuilderState.tone || 'Heroic',
            setting: worldBuilderState.setting || 'Frontier Town',
            settingNotes: worldBuilderState.settingNotes,
            factions: worldBuilderState.selectedFactions,
            conflict: worldBuilderState.conflict,
            characterHook: worldBuilderState.characterHook,
            characterName,
            characterLevel,
            ...(getClaudeEverywhereKey() ? { user_api_key: getClaudeEverywhereKey() } : {}),
          }),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Generation failed' }));
        if (response.status === 429) {
          toast.error('Rate limit hit — try again in a moment');
        } else if (response.status === 402) {
          toast.error('AI credits required');
        } else {
          toast.error(err.error || 'World generation failed');
        }
        return false;
      }

      const data = await response.json();
      setGeneratedBible(data.bible);
      setGeneratedWorldName(data.world_name || 'Campaign World');
      return true;
    } catch (error) {
      console.error('World generation error:', error);
      toast.error('Could not generate world — please try again');
      return false;
    } finally {
      setIsGenerating(false);
    }
  }, [worldBuilderState, characterName, characterLevel]);

  const applyWorldToGuide = useCallback((addGuide: (name: string, content: string) => boolean): boolean => {
    if (!generatedBible) return false;
    const name = `📖 ${generatedWorldName || 'Campaign World'}`;
    return addGuide(name, generatedBible);
  }, [generatedBible, generatedWorldName]);

  return {
    worldBuilderState,
    updateState,
    resetState,
    isGenerating,
    generatedBible,
    generatedWorldName,
    generateWorld,
    applyWorldToGuide,
  };
}
