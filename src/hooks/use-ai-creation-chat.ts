import { useState, useCallback, useRef, useMemo } from 'react';
import { WizardState, QUICK_START_DEFAULTS } from '@/components/wizard/types';
import { HonestModeRules } from '@/lib/gameModes';

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export interface CharacterBuildData {
  name: string;
  level: number;
  portraitIcon: string;
  primaryClass: string;
  abilityScores: {
    strength: number;
    dexterity: number;
    constitution: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
  };
  gameMode: 'honest' | 'infinityPool';
  honestModeRules: HonestModeRules;
  xpPreset: 'standard' | 'fastTrack' | 'epicJourney' | 'milestone';
  diceOddsMode: string;
  selectedPath: string | null;
  starterAbilities: Array<{ abilityId: string; currentTier: number }>;
  selectedPresetId: string | null;
  consumables: string[];
  // Homebrew content arrays
  homebrewGear?: Array<{
    name: string; slotType: string; rarity: string;
    level: number; icon: string; weight: number; value: number;
    description: string; lore: string; properties: string[];
    stats: Record<string, number | string>; damage: string;
  }>;
  homebrewSpells?: Array<{
    name: string; level: number; school: string;
    castingTime: string; range: string;
    components: { verbal: boolean; somatic: boolean; material?: string };
    duration: string; concentration: boolean; ritual: boolean;
    description: string; higherLevels?: string;
    damageType?: string; damageDice?: string;
    iconName: string;
  }>;
  homebrewAbilities?: Array<{
    name: string; tree: string; icon: string;
    type: 'active' | 'passive'; actionType: string; usageType: string;
    tierEffects: Array<{ tier: number; description: string }>;
    dice?: { tier1?: { count: number; die: number }; tier2?: { count: number; die: number }; tier3?: { count: number; die: number } };
    cooldownMinutes: number; attackType?: string; notes?: string;
  }>;
  homebrewConsumables?: Array<{
    name: string; type: string; rarity: string;
    effect: string; duration: string;
    description: string; icon: string;
  }>;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-creation-assistant`;

function tryExtractBuildData(content: string): CharacterBuildData | null {
  // Look for JSON code block with apply_character action
  const jsonMatch = content.match(/```json\s*\n?\s*(\{[\s\S]*?"action"\s*:\s*"apply_character"[\s\S]*?\})\s*\n?\s*```/);
  if (!jsonMatch) return null;
  
  try {
    const parsed = JSON.parse(jsonMatch[1]);
    if (parsed.action === 'apply_character' && parsed.data) {
      return parsed.data as CharacterBuildData;
    }
  } catch (e) {
    console.error('[AICreation] Failed to parse build data:', e);
  }
  return null;
}

function parseSuggestions(content: string): string[] {
  const match = content.match(/\[SUGGESTIONS:\s*(.*?)\]\s*$/);
  if (!match) return [];
  try {
    // Parse comma-separated quoted strings
    const raw = match[1];
    const suggestions: string[] = [];
    const regex = /"([^"]+)"/g;
    let m;
    while ((m = regex.exec(raw)) !== null) {
      suggestions.push(m[1]);
    }
    return suggestions;
  } catch {
    return [];
  }
}

function stripSuggestions(content: string): string {
  return content.replace(/\n?\[SUGGESTIONS:\s*.*?\]\s*$/, '').trimEnd();
}

export function buildDataToWizardState(data: CharacterBuildData): WizardState {
  return {
    currentStep: 8, // summary step
    completedSteps: [0, 1, 2, 3, 4, 5, 6, 7, 8],
    name: data.name,
    level: data.level,
    portraitIcon: (data.portraitIcon || 'Skull') as any,
    primaryClass: (data.primaryClass || 'rogue') as any,
    abilityScores: data.abilityScores || QUICK_START_DEFAULTS.abilityScores!,
    scoreGenerationMethod: 'standard',
    gameMode: data.gameMode || 'infinityPool',
    honestModeRules: data.honestModeRules || {
      requireGearUnlocks: true,
      organicLevelUp: true,
      maxLevelInfinityStones: true,
      noRerolls: true,
      scribeItemVerification: true,
      prestigePointsRequireXP: true,
      prestigeRespecDisabled: true,
      enforceCooldowns: true,
      enforceWildShapeDuration: true,
    },
    xpPreset: (data.xpPreset || 'standard') as any,
    diceOddsMode: (data.diceOddsMode || 'fair') as any,
    selectedPath: data.selectedPath as any,
    starterAbilities: (data.starterAbilities || []).map(a => ({
      abilityId: a.abilityId,
      currentTier: a.currentTier as 0 | 1 | 2 | 3,
    })),
    equipment: { slots: { head: null, chest: null, arms: null, waist: null, legs: null, primary_weapon: null, secondary_weapon: null, ranged_weapon: null, amulet: null, ring1: null, ring2: null }, inventory: [] },
    selectedPresetId: data.selectedPresetId || 'street-runner',
  };
}

export function useAICreationChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [buildData, setBuildData] = useState<CharacterBuildData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (input: string) => {
    const userMsg: ChatMessage = { role: 'user', content: input };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setIsLoading(true);
    setError(null);

    let assistantSoFar = '';

    const upsertAssistant = (nextChunk: string) => {
      assistantSoFar += nextChunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant') {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: 'assistant', content: assistantSoFar }];
      });
    };

    try {
      abortRef.current = new AbortController();
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: allMessages }),
        signal: abortRef.current.signal,
      });

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({ error: 'Request failed' }));
        setError(errorData.error || `Error ${resp.status}`);
        setIsLoading(false);
        return;
      }

      if (!resp.body) throw new Error('No response body');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsertAssistant(content);
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Final flush
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split('\n')) {
          if (!raw) continue;
          if (raw.endsWith('\r')) raw = raw.slice(0, -1);
          if (raw.startsWith(':') || raw.trim() === '') continue;
          if (!raw.startsWith('data: ')) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsertAssistant(content);
          } catch { /* ignore */ }
        }
      }

      // Check if the final message contains build data
      const extractedData = tryExtractBuildData(assistantSoFar);
      if (extractedData) {
        setBuildData(extractedData);
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        console.error('[AICreation] Stream error:', e);
        setError(e.message || 'Connection failed');
      }
    } finally {
      setIsLoading(false);
    }
  }, [messages]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setBuildData(null);
    setError(null);
    setIsLoading(false);
  }, []);

  // Parse suggestions from last assistant message
  const suggestions = useMemo(() => {
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== 'assistant' || isLoading) return [];
    return parseSuggestions(lastMsg.content);
  }, [messages, isLoading]);

  // Strip suggestion tags from displayed messages
  const displayMessages = useMemo(() => {
    return messages.map(m => 
      m.role === 'assistant' ? { ...m, content: stripSuggestions(m.content) } : m
    );
  }, [messages]);

  return {
    messages: displayMessages,
    isLoading,
    buildData,
    error,
    suggestions,
    sendMessage,
    reset,
  };
}
