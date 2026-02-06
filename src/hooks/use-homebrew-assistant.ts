import { useState, useCallback } from 'react';
import { toast } from 'sonner';

const ASSISTANT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/homebrew-assistant`;

export type HomebrewAssistantMode = 'name' | 'description' | 'full' | 'balance' | 'enhance';

interface HomebrewContext {
  tree: 'hunter' | 'warrior' | 'assassin';
  type: 'active' | 'passive';
  currentName?: string;
  currentDescription?: string;
}

interface FullAbilitySuggestion {
  name: string;
  actionType: string;
  usageType: string;
  tier1: string;
  tier2: string;
  tier3: string;
  dice?: { tier1?: string; tier2?: string; tier3?: string };
  cooldown?: number;
  notes?: string;
}

interface TierDescriptions {
  tier1: string;
  tier2: string;
  tier3: string;
}

export function useHomebrewAssistant() {
  const [isLoading, setIsLoading] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const callAssistant = useCallback(async (
    prompt: string,
    context: HomebrewContext,
    mode: HomebrewAssistantMode
  ): Promise<string | null> => {
    setIsLoading(true);
    setLastError(null);

    try {
      const response = await fetch(ASSISTANT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ prompt, context, mode }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error || `Request failed (${response.status})`;
        setLastError(errorMsg);
        toast.error(errorMsg);
        return null;
      }

      const data = await response.json();
      return data.result || null;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to get AI suggestion';
      setLastError(errorMsg);
      toast.error(errorMsg);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get name suggestions
  const suggestNames = useCallback(async (
    context: HomebrewContext,
    userPrompt?: string
  ): Promise<string[]> => {
    const prompt = userPrompt || `Suggest creative ${context.type} ability names for the ${context.tree} tree.`;
    const result = await callAssistant(prompt, context, 'name');
    
    if (!result) return [];
    
    try {
      // Try to parse JSON array from the response
      const jsonMatch = result.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return [];
    } catch {
      // If not valid JSON, try to extract names
      return result.split('\n').filter(line => line.trim()).slice(0, 5);
    }
  }, [callAssistant]);

  // Get tier descriptions
  const suggestDescriptions = useCallback(async (
    context: HomebrewContext,
    userPrompt?: string
  ): Promise<TierDescriptions | null> => {
    const prompt = userPrompt || `Create tier descriptions for "${context.currentName}" - a ${context.type} ability in the ${context.tree} tree.`;
    const result = await callAssistant(prompt, context, 'description');
    
    if (!result) return null;
    
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          tier1: parsed.tier1 || '',
          tier2: parsed.tier2 || '',
          tier3: parsed.tier3 || '',
        };
      }
      return null;
    } catch {
      return null;
    }
  }, [callAssistant]);

  // Get a full ability suggestion
  const suggestFullAbility = useCallback(async (
    context: HomebrewContext,
    userPrompt?: string
  ): Promise<FullAbilitySuggestion | null> => {
    const prompt = userPrompt || `Create a complete ${context.type} ability for the ${context.tree} tree.`;
    const result = await callAssistant(prompt, context, 'full');
    
    if (!result) return null;
    
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return null;
    } catch {
      return null;
    }
  }, [callAssistant]);

  // Get balance feedback
  const getBalanceFeedback = useCallback(async (
    context: HomebrewContext
  ): Promise<string | null> => {
    const prompt = `Review the balance of "${context.currentName}": ${context.currentDescription}`;
    return await callAssistant(prompt, context, 'balance');
  }, [callAssistant]);

  // Get enhanced descriptions
  const enhanceDescriptions = useCallback(async (
    context: HomebrewContext
  ): Promise<TierDescriptions | null> => {
    const prompt = `Enhance the ability "${context.currentName}": ${context.currentDescription}`;
    const result = await callAssistant(prompt, context, 'enhance');
    
    if (!result) return null;
    
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          tier1: parsed.tier1 || '',
          tier2: parsed.tier2 || '',
          tier3: parsed.tier3 || '',
        };
      }
      return null;
    } catch {
      return null;
    }
  }, [callAssistant]);

  return {
    isLoading,
    lastError,
    suggestNames,
    suggestDescriptions,
    suggestFullAbility,
    getBalanceFeedback,
    enhanceDescriptions,
  };
}
