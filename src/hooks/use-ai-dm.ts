import { useState, useCallback, useRef, useEffect } from 'react';
import { Message, CharacterContext } from '@/components/oracle/types';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

import { parseWhispers } from '@/lib/whisper-parser';
import { getAuthToken } from '@/lib/auth-token';
import {
  loadCampaignSummary,
  saveCampaignSummary,
  clearCampaignSummary,
} from '@/lib/campaign-summary-storage';
import { loadApiKey } from '@/lib/api-keys';
import { loadCombatSettings } from '@/lib/combat/combatSettings';
import { formatPartyPowerForPrompt } from '@/lib/combat/encounterDifficulty';
import { getAlignmentZone, type AlignmentScore } from '@/lib/alignmentSpectrum';

/** Read alignment drift from localStorage (same format as useAlignmentDrift) */
function loadAlignmentDrift(): { position: AlignmentScore; zone: string } | null {
  try {
    const activeId = localStorage.getItem('odyssey-active-cloud-save-id');
    const key = activeId ? `odyssey-alignment-drift_${activeId}` : 'odyssey-alignment-drift';
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entries: Array<{ law: number; good: number }> = JSON.parse(raw);
    if (!entries.length) return null;
    const decay = 0.92;
    let totalW = 0, lawS = 0, goodS = 0;
    for (let i = 0; i < entries.length; i++) {
      const w = Math.pow(decay, entries.length - 1 - i);
      lawS += entries[i].law * w;
      goodS += entries[i].good * w;
      totalW += w;
    }
    const position: AlignmentScore = {
      law: Math.round((lawS / totalW) * 10) / 10,
      good: Math.round((goodS / totalW) * 10) / 10,
    };
    const zone = getAlignmentZone(position);
    return { position, zone: zone.label };
  } catch { return null; }
}

const AI_DM_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-dm`;
const SUMMARIZE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-dm-summarize`;
const DEFAULT_STORAGE_KEY = 'dnd-ai-dm-session';
const DEFAULT_SUMMARY_KEY = 'dnd-ai-dm-campaign-summary';
const MAX_MESSAGES = 100;
const SUMMARY_INTERVAL = 5;
const SAVE_DEBOUNCE_MS = 1000;

const SESSION_VERSION = 1;

interface UseAIDMOptions {
  characterContext: CharacterContext;
  customGuidesContent?: string;
  worldStatePrompt?: string;
  dmPersonaPrompt?: string;
  responseModePrompt?: string;
  onMessageComplete?: (content: string) => void;
  /** Called when quests are extracted from AI narrative */
  onQuestExtracted?: (quests: Array<{ key: string; status: 'active' | 'completed' | 'failed'; notes?: string }>) => void;
  /** Current active guide IDs to persist with the campaign */
  activeGuideIds?: string[];
  /** Called when a campaign is loaded so the parent can switch active guides */
  onCampaignSwitch?: (guideIds: string[] | null) => void;
  /** AI model ID to use for DM responses */
  selectedModel?: string;
  /** Override the localStorage key used for session storage (default: 'dnd-ai-dm-session') */
  sessionStorageKey?: string;
  /** Override the key used for campaign summary storage (default: 'dnd-ai-dm-campaign-summary') */
  summarizeStorageKey?: string;
}

interface VersionedSession {
  version: number;
  messages: any[];
}

// Module-level ref for dirty-checking across saves — keyed by storage key
const lastSavedJsonMap: Record<string, string> = {};

function isValidMessage(m: any): boolean {
  return (
    m &&
    typeof m === 'object' &&
    typeof m.id === 'string' &&
    typeof m.role === 'string' &&
    typeof m.content === 'string' &&
    m.timestamp !== undefined
  );
}

function loadSession(storageKey: string): Message[] {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);

    // Support both legacy (raw array) and versioned wrapper
    let rawMessages: any[];
    if (Array.isArray(parsed)) {
      rawMessages = parsed;
    } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.messages)) {
      rawMessages = parsed.messages;
    } else {
      console.warn('[AI DM Save] Unrecognized session format, starting fresh');
      toast.error('Session data was corrupted, starting fresh');
      return [];
    }

    // Validate & rehydrate each message
    const valid: Message[] = [];
    for (const m of rawMessages) {
      if (isValidMessage(m)) {
        valid.push({ ...m, timestamp: new Date(m.timestamp) });
      } else {
        console.warn('[AI DM Save] Dropping invalid message entry:', m);
      }
    }
    return valid;
  } catch (error) {
    console.error('[AI DM Save] Failed to parse session:', error);
    toast.error('Session data was corrupted, starting fresh');
    return [];
  }
}

function saveSession(messages: Message[], storageKey: string): void {
  const payload: VersionedSession = {
    version: SESSION_VERSION,
    messages,
  };
  const serialized = JSON.stringify(payload);

  // Dirty-check: skip if nothing changed
  if (serialized === lastSavedJsonMap[storageKey]) return;

  try {
    localStorage.setItem(storageKey, serialized);
    lastSavedJsonMap[storageKey] = serialized;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      toast.error('Session too large to save locally');
    } else {
      console.error('[AI DM Save] Failed to save:', error);
    }
  }
}

export function useAIDM({ characterContext, customGuidesContent, worldStatePrompt, dmPersonaPrompt, responseModePrompt, onMessageComplete, onQuestExtracted, activeGuideIds, onCampaignSwitch, selectedModel, sessionStorageKey, summarizeStorageKey }: UseAIDMOptions) {
  const STORAGE_KEY = sessionStorageKey ?? DEFAULT_STORAGE_KEY;
  const SUMMARY_KEY = summarizeStorageKey ?? DEFAULT_SUMMARY_KEY;
  // Store onMessageComplete in a ref so sendMessage always calls the latest version
  const onMessageCompleteRef = useRef(onMessageComplete);
  useEffect(() => { onMessageCompleteRef.current = onMessageComplete; }, [onMessageComplete]);
  const onQuestExtractedRef = useRef(onQuestExtracted);
  useEffect(() => { onQuestExtractedRef.current = onQuestExtracted; }, [onQuestExtracted]);

  const [messages, setMessages] = useState<Message[]>(() => loadSession(STORAGE_KEY));
  const [isLoading, setIsLoading] = useState(false);
  const [campaignSummary, setCampaignSummary] = useState<string | null>(() => loadCampaignSummary(SUMMARY_KEY));
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [lastUsage, setLastUsage] = useState<{ input_tokens: number; output_tokens: number } | null>(null);
  const [sessionUsage, setSessionUsage] = useState<{ input_tokens: number; output_tokens: number; requests: number }>({ input_tokens: 0, output_tokens: 0, requests: 0 });
  const abortControllerRef = useRef<AbortController | null>(null);

  // Local save debounce
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const onCampaignSwitchRef = useRef(onCampaignSwitch);
  useEffect(() => { onCampaignSwitchRef.current = onCampaignSwitch; }, [onCampaignSwitch]);

  const saveNow = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    saveSession(messages, STORAGE_KEY);
  }, [messages]);

  useEffect(() => {
    debounceTimerRef.current = setTimeout(() => {
      saveSession(messages, STORAGE_KEY);
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [messages]);

  // Save immediately on tab close (bypass debounce) — local only
  useEffect(() => {
    const handleBeforeUnload = () => {
      saveNow();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveNow]);

  // Trigger summary generation after every Nth assistant message
  const triggerSummaryIfNeeded = useCallback(async (allMessages: Message[]) => {
    const assistantCount = allMessages.filter(m => m.role === 'assistant' && m.content).length;
    if (assistantCount === 0 || assistantCount % SUMMARY_INTERVAL !== 0) return;

    setIsSummarizing(true);
    try {
      const apiMessages = allMessages.map(m => ({ role: m.role, content: m.content }));
      const authToken = await getAuthToken();
      const response = await fetch(SUMMARIZE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          messages: apiMessages,
          previousSummary: campaignSummary || undefined,
        }),
      });

      if (!response.ok) {
        console.error('Summary generation failed:', response.status);
        return;
      }

      const data = await response.json();
      if (data.summary) {
        saveCampaignSummary(data.summary, SUMMARY_KEY);
        setCampaignSummary(data.summary);
        toast.success('Campaign summary updated', { duration: 2000 });
      }
    } catch (error) {
      console.error('Summary generation error:', error);
    } finally {
      setIsSummarizing(false);
    }
  }, [campaignSummary]);

  const sendMessage = useCallback(async (content: string, overrideHistory?: Message[]) => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    // Build API messages with sliding window
    const baseMessages = overrideHistory ?? messages;
    const allMessages = [...baseMessages, userMessage];
    const apiMessages = allMessages.length > MAX_MESSAGES
      ? [...allMessages.slice(0, 2), ...allMessages.slice(-(MAX_MESSAGES - 2))]
      : allMessages;

    const apiPayload = apiMessages.map(m => ({
      role: m.role,
      content: m.content,
    }));

    abortControllerRef.current = new AbortController();
    let assistantContent = '';
    let usageAccum = { input_tokens: 0, output_tokens: 0 };
    setLastUsage(null);
    try {
      const authToken = await getAuthToken();
      const response = await fetch(AI_DM_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          messages: apiPayload,
          characterContext,
          customGuides: customGuidesContent || undefined,
          campaignSummary: campaignSummary || undefined,
          worldStatePrompt: worldStatePrompt || undefined,
          dmPersonaPrompt: dmPersonaPrompt || undefined,
          responseModePrompt: responseModePrompt || undefined,
          model: selectedModel || undefined,
          user_api_key: loadApiKey('anthropic') || undefined,
          user_openai_key: loadApiKey('openai') || undefined,
          ...(() => {
            const cs = loadCombatSettings();
            const feats: string[] = [];
            if (cs.hasGreatWeaponMaster) feats.push('Great Weapon Master');
            if (cs.hasSharpshooter) feats.push('Sharpshooter');
            if (cs.hasSentinel) feats.push('Sentinel');
            if (cs.hasPolearmMaster) feats.push('Polearm Master');
            if (cs.hasDualWielderFeat) feats.push('Dual Wielder');
            if (cs.hasTwoWeaponFightingStyle) feats.push('Two-Weapon Fighting Style');
            if (cs.hasMonkMartialArts) feats.push('Monk Martial Arts');
            const drift = loadAlignmentDrift();
            return {
              encounterGuidance: formatPartyPowerForPrompt([characterContext.level ?? 1], cs.difficultyPreference) || undefined,
              combatFeats: feats.length > 0 ? feats : undefined,
              alignmentContext: drift ? { law: drift.position.law, good: drift.position.good, zone: drift.zone } : undefined,
            };
          })(),
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed with status ${response.status}`);
      }

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';

      const assistantMessageId = crypto.randomUUID();
      setMessages(prev => [
        ...prev,
        {
          id: assistantMessageId,
          role: 'assistant',
          content: '',
          timestamp: new Date(),
        },
      ]);

      while (true) {
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
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            // Check for usage metadata from Anthropic adapter
            if (parsed.__usage) {
              usageAccum.input_tokens += parsed.__usage.input_tokens || 0;
              usageAccum.output_tokens += parsed.__usage.output_tokens || 0;
              continue;
            }
            const deltaContent = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (deltaContent) {
              assistantContent += deltaContent;
              setMessages(prev =>
                prev.map(m =>
                  m.id === assistantMessageId
                    ? { ...m, content: assistantContent }
                    : m
                )
              );
            }
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
            const deltaContent = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (deltaContent) {
              assistantContent += deltaContent;
              setMessages(prev =>
                prev.map(m =>
                  m.id === assistantMessageId
                    ? { ...m, content: assistantContent }
                    : m
                )
              );
            }
          } catch { /* ignore */ }
        }
      }

      // Set usage stats if we got any (Anthropic models)
      if (usageAccum.input_tokens > 0 || usageAccum.output_tokens > 0) {
        setLastUsage({ ...usageAccum });
        setSessionUsage(prev => ({
          input_tokens: prev.input_tokens + usageAccum.input_tokens,
          output_tokens: prev.output_tokens + usageAccum.output_tokens,
          requests: prev.requests + 1,
        }));
      }

      // After successful response, parse whispers and clean the narrative
      if (assistantContent) {
        const { narrative, whispers } = parseWhispers(assistantContent);

        // Update the assistant message with clean narrative + whispers metadata
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantMessageId
              ? { ...m, content: narrative, whispers: whispers.length > 0 ? whispers : undefined }
              : m
          )
        );

        const updatedMessages = [...allMessages, {
          id: assistantMessageId,
          role: 'assistant' as const,
          content: narrative,
          timestamp: new Date(),
          whispers: whispers.length > 0 ? whispers : undefined,
        }];
        triggerSummaryIfNeeded(updatedMessages);
        onMessageCompleteRef.current?.(narrative);

        // Non-blocking quest extraction
        if (narrative.length > 100 && onQuestExtractedRef.current) {
          (async () => {
            try {
              const { data: { session } } = await supabase.auth.getSession();
              const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
              const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-dm`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                  model: 'google/gemini-2.5-flash-lite',
                  messages: [
                    { role: 'system', content: 'Extract any quests, missions, tasks, or objectives from this D&D narrative. Return ONLY a JSON array of objects with {key: string, status: "active"|"completed"|"failed", notes: string} where key is a snake_case identifier (e.g. "retrieve_the_dragons_eye"). If completing or failing an existing quest, set status accordingly. If no quests found, return []. Raw JSON only, no markdown.' },
                    { role: 'user', content: narrative }
                  ],
                  max_tokens: 500,
                  systemPromptOverride: 'Extract quests as JSON array only.'
                })
              });
              const data = await res.json();
              const text = data.choices?.[0]?.message?.content || '[]';
              const quests = JSON.parse(text.replace(/```json|```/g, '').trim());
              if (Array.isArray(quests) && quests.length > 0) {
                onQuestExtractedRef.current?.(quests);
              }
            } catch { /* non-blocking */ }
          })();
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;

      console.error('AI DM error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to get response');

      if (!assistantContent) {
        setMessages(prev => prev.filter(m => m.role !== 'assistant' || m.content));
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [messages, characterContext, customGuidesContent, campaignSummary, isLoading, triggerSummaryIfNeeded]);

  const voiceNPC = useCallback(async (npcNames: string | string[], playerMessage: string) => {
    if (!playerMessage.trim() || isLoading) return;

    const names = Array.isArray(npcNames) ? npcNames : [npcNames];
    const nameLabel = names.join(' & ');

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: `(to ${nameLabel}) "${playerMessage.trim()}"`,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    const baseMessages = messages;
    const allMessages = [...baseMessages, userMessage];
    const apiMessages = allMessages.length > MAX_MESSAGES
      ? [...allMessages.slice(0, 2), ...allMessages.slice(-(MAX_MESSAGES - 2))]
      : allMessages;

    const apiPayload = apiMessages.map(m => ({
      role: m.role,
      content: m.content,
    }));

    abortControllerRef.current = new AbortController();
    let assistantContent = '';
    let usageAccum = { input_tokens: 0, output_tokens: 0 };
    setLastUsage(null);

    const npcVoicingPrompt = names.length === 1
      ? `## NPC VOICING MODE — ABSOLUTE PRIORITY\nThis overrides ALL narrative style instructions below. No novelizations. No scene-setting. No atmospheric prose.\n\nYou are voicing ${names[0]} ONLY. Respond in this exact two-part format — nothing more, nothing less:\n\n**${names[0]}:** [1–2 sentences of in-character dialogue]\n*[One beat: a look, a gesture, a micro-expression, or a physical tell — italicized, present tense, 10 words or fewer]*\n\nExamples of good beats: *glances away.* / *jaw tightens.* / *a slow smile, no warmth in it.* / *doesn't answer right away.*\nDo NOT add narration, backstory, or follow-up prose after the beat.\nStay true to how ${names[0]} has been portrayed so far.`
      : `## NPC VOICING MODE — ABSOLUTE PRIORITY\nThis overrides ALL narrative style instructions below. No novelizations. No scene-setting. No atmospheric prose.\n\nYou are voicing these NPCs: ${names.join(', ')}. For EACH NPC, use this exact format on separate lines:\n\n**NPC Name:** [1–2 sentences of in-character dialogue]\n*[One beat: a look, a gesture, a micro-expression, or a physical tell — italicized, present tense, 10 words or fewer]*\n\nOrder: ${names.map((n, i) => `${i + 1}. ${n}`).join(', ')}.\nExamples of good beats: *glances away.* / *jaw tightens.* / *a slow smile, no warmth in it.*\nDo NOT add narration or prose after the beats.\nStay true to how each NPC has been portrayed so far.`;

    try {
      const authToken = await getAuthToken();
      const response = await fetch(AI_DM_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          messages: apiPayload,
          characterContext,
          customGuides: customGuidesContent || undefined,
          campaignSummary: campaignSummary || undefined,
          worldStatePrompt: worldStatePrompt || undefined,
          dmPersonaPrompt: dmPersonaPrompt || undefined,
          responseModePrompt: responseModePrompt || undefined,
          model: selectedModel || undefined,
          user_api_key: loadApiKey('anthropic') || undefined,
          user_openai_key: loadApiKey('openai') || undefined,
          npcVoicingContext: npcVoicingPrompt,
          ...(() => {
            const cs = loadCombatSettings();
            const feats: string[] = [];
            if (cs.hasGreatWeaponMaster) feats.push('Great Weapon Master');
            if (cs.hasSharpshooter) feats.push('Sharpshooter');
            if (cs.hasSentinel) feats.push('Sentinel');
            if (cs.hasPolearmMaster) feats.push('Polearm Master');
            if (cs.hasDualWielderFeat) feats.push('Dual Wielder');
            if (cs.hasTwoWeaponFightingStyle) feats.push('Two-Weapon Fighting Style');
            if (cs.hasMonkMartialArts) feats.push('Monk Martial Arts');
            const drift = loadAlignmentDrift();
            return {
              encounterGuidance: formatPartyPowerForPrompt([characterContext.level ?? 1], cs.difficultyPreference) || undefined,
              combatFeats: feats.length > 0 ? feats : undefined,
              alignmentContext: drift ? { law: drift.position.law, good: drift.position.good, zone: drift.zone } : undefined,
            };
          })(),
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed with status ${response.status}`);
      }

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';

      const assistantMessageId = crypto.randomUUID();
      setMessages(prev => [
        ...prev,
        {
          id: assistantMessageId,
          role: 'assistant',
          content: '',
          timestamp: new Date(),
          senderName: nameLabel,
        },
      ]);

      while (true) {
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
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.__usage) {
              usageAccum.input_tokens += parsed.__usage.input_tokens || 0;
              usageAccum.output_tokens += parsed.__usage.output_tokens || 0;
              continue;
            }
            const deltaContent = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (deltaContent) {
              assistantContent += deltaContent;
              setMessages(prev =>
                prev.map(m =>
                  m.id === assistantMessageId
                    ? { ...m, content: assistantContent }
                    : m
                )
              );
            }
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
            const deltaContent = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (deltaContent) {
              assistantContent += deltaContent;
              setMessages(prev =>
                prev.map(m =>
                  m.id === assistantMessageId
                    ? { ...m, content: assistantContent }
                    : m
                )
              );
            }
          } catch { /* ignore */ }
        }
      }

      if (usageAccum.input_tokens > 0 || usageAccum.output_tokens > 0) {
        setLastUsage({ ...usageAccum });
        setSessionUsage(prev => ({
          input_tokens: prev.input_tokens + usageAccum.input_tokens,
          output_tokens: prev.output_tokens + usageAccum.output_tokens,
          requests: prev.requests + 1,
        }));
      }

      if (assistantContent) {
        const { narrative, whispers } = parseWhispers(assistantContent);
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantMessageId
              ? { ...m, content: narrative, whispers: whispers.length > 0 ? whispers : undefined }
              : m
          )
        );
        onMessageCompleteRef.current?.(narrative);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      console.error('AI DM NPC voice error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to get NPC response');
      if (!assistantContent) {
        setMessages(prev => prev.filter(m => m.role !== 'assistant' || m.content));
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [messages, characterContext, customGuidesContent, campaignSummary, isLoading]);

  const cancelRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
    }
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
    clearCampaignSummary(SUMMARY_KEY);
    setCampaignSummary(null);
    setActiveCampaignId(null);
  }, [STORAGE_KEY, SUMMARY_KEY]);

  const newGame = useCallback(() => {
    if (messages.length > 0) {
      saveSession(messages, STORAGE_KEY);
    }
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
    clearCampaignSummary(SUMMARY_KEY);
    setCampaignSummary(null);
    setActiveCampaignId(null);
    onCampaignSwitchRef.current?.(null);
    toast.success('New game started! The DM awaits your adventure.');
  }, [messages, STORAGE_KEY, SUMMARY_KEY]);

  const updateCampaignSummary = useCallback((summary: string) => {
    saveCampaignSummary(summary, SUMMARY_KEY);
    setCampaignSummary(summary || null);
  }, [SUMMARY_KEY]);

  const loadCampaign = useCallback((loadedMessages: Message[], summary: string | null, campaignId?: string, guideIds?: string[] | null) => {
    setMessages(loadedMessages);
    saveSession(loadedMessages, STORAGE_KEY);
    if (summary) {
      saveCampaignSummary(summary, SUMMARY_KEY);
      setCampaignSummary(summary);
    } else {
      clearCampaignSummary(SUMMARY_KEY);
      setCampaignSummary(null);
    }
    setActiveCampaignId(campaignId ?? null);
    // Switch active guides to match the loaded campaign
    if (guideIds !== undefined) {
      onCampaignSwitchRef.current?.(guideIds);
    }
  }, []);

  // Add a media-only message (video/photo) without triggering AI response
  const addMediaMessage = useCallback((content: string) => {
    const mediaMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, mediaMessage]);
  }, []);

  const editMessage = useCallback((messageId: string, newContent: string) => {
    setMessages(prev =>
      prev.map(m => m.id === messageId ? { ...m, content: newContent } : m)
    );
  }, []);

  const deleteMessage = useCallback((messageId: string) => {
    setMessages(prev => {
      const idx = prev.findIndex(m => m.id === messageId);
      if (idx === -1) return prev;
      const msg = prev[idx];
      if (msg.role === 'user') {
        // Also remove the paired assistant response (next message)
        const next = prev[idx + 1];
        if (next && next.role === 'assistant') {
          return prev.filter((_, i) => i !== idx && i !== idx + 1);
        }
      }
      return prev.filter(m => m.id !== messageId);
    });
  }, []);

  const regenerateMessage = useCallback(async (messageId: string) => {
    if (isLoading) return;

    const idx = messages.findIndex(m => m.id === messageId);
    if (idx === -1) return;

    const precedingMessages = messages.slice(0, idx);
    const lastUserMsg = [...precedingMessages].reverse().find(m => m.role === 'user');
    if (!lastUserMsg) {
      toast.error('No user message to regenerate from');
      return;
    }

    const trimmedHistory = precedingMessages.filter(m => m.id !== lastUserMsg.id);
    setMessages(trimmedHistory);

    // Pass trimmed history directly to avoid stale closure
    sendMessage(lastUserMsg.content, trimmedHistory);
  }, [messages, isLoading, sendMessage]);

  return {
    messages,
    isLoading,
    isSummarizing,
    campaignSummary,
    updateCampaignSummary,
    loadCampaign,
    sendMessage,
    voiceNPC,
    addMediaMessage,
    cancelRequest,
    clearMessages,
    newGame,
    activeCampaignId,
    setActiveCampaignId,
    editMessage,
    deleteMessage,
    regenerateMessage,
    lastUsage,
    sessionUsage,
  };
}
