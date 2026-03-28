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

/** Pick the next NPC to speak using weighted random selection. */
function pickNextNpc(
  npcs: string[],
  lastSpeaker: string | null,
  lastMessage: string,
  turnsSinceSpeaking: Map<string, number>,
): string {
  const weights = new Map<string, number>();
  for (const npc of npcs) {
    let w = 1;
    if (npc === lastSpeaker) {
      weights.set(npc, 0);
      continue;
    }
    const nameParts = npc.split(/\s+/);
    const firstName = nameParts[0];
    const msgLower = lastMessage.toLowerCase();
    if (msgLower.includes(npc.toLowerCase())) {
      w += 4;
    } else if (firstName.length >= 3 && msgLower.includes(firstName.toLowerCase())) {
      w += 3;
    }
    const silence = turnsSinceSpeaking.get(npc) || 0;
    if (silence >= 3) {
      w += 2;
    } else if (silence >= 2) {
      w += 1;
    }
    weights.set(npc, w);
  }
  const entries = Array.from(weights.entries()).filter(([, w]) => w > 0);
  if (entries.length === 0) {
    const candidates = npcs.filter(n => n !== lastSpeaker);
    return candidates[Math.floor(Math.random() * candidates.length)] || npcs[0];
  }
  const totalWeight = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = Math.random() * totalWeight;
  for (const [npc, w] of entries) {
    roll -= w;
    if (roll <= 0) return npc;
  }
  return entries[entries.length - 1][0];
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
  const npcSceneActiveRef = useRef(false);
  const npcSceneInterjectionRef = useRef<{ content: string; senderName: string } | null>(null);
  const [npcSceneConfig, setNpcSceneConfig] = useState<{ active: boolean; npcs: string[]; prompt: string; maxMessages: number; messageCount: number } | null>(null);

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
      ? `## NPC VOICING MODE — ABSOLUTE PRIORITY\nThis overrides ALL narrative style instructions. No novelizations. No scene-setting. No atmospheric prose. No additional paragraphs.\n\nYou are voicing ${names[0]} ONLY. Your ENTIRE response must be EXACTLY two lines and nothing else:\n\nLine 1: **${names[0]}:** [1–2 sentences of in-character dialogue — MAX 40 words]\nLine 2: *[One physical beat — italicized, present tense, 10 words or fewer]*\n\nTHAT IS YOUR COMPLETE RESPONSE. STOP AFTER THE BEAT. Do not write a third line. Do not add narration, scene description, other characters' reactions, environmental details, or mechanical tags. Two lines only.\n\nExamples of correct COMPLETE responses:\n\n**${names[0]}:** "I don't owe you an explanation." \n*Turns away, shoulders rigid.*\n\n**${names[0]}:** "You're late. Again." A pause. "Don't let it happen a third time."\n*Doesn't look up from the map.*\n\nStay true to how ${names[0]} has been portrayed so far.`
      : `## NPC VOICING MODE — ABSOLUTE PRIORITY\nThis overrides ALL narrative style instructions below. No novelizations. No walls of text.\n\nWrite a SHORT GROUP CONVERSATION SCENE between ${names.join(' and ')} in response to the player's message. Follow these rules:\n\n1. NATURAL TURN ORDER — Let personality decide who speaks first. A bold or reactive NPC jumps in immediately; a cautious one waits and responds to what was already said.\n2. NPCs REACT TO EACH OTHER — Each NPC should acknowledge or respond to what the other NPC(s) just said, not just independently answer the player.\n3. BODY LANGUAGE BEATS — Before or after each line of dialogue, add a brief italicized physical beat (a look, gesture, expression, or micro-reaction) in present tense, 10 words or fewer.\n4. 2–3 EXCHANGES TOTAL — Allow a short back-and-forth between the NPCs (2–3 total speaking turns across all NPCs combined). Keep it punchy — aim for 100–200 words total.\n5. END WITH THE PLAYER — Close the scene on a beat that invites the player back in: a question directed at them, a meaningful look toward them, or a charged pause.\n6. FORMAT — Use **NPC Name:** for every line of dialogue so the chat renderer can identify speakers. Italicize all physical beats.\n7. NO MECHANICAL INFO — No dice, DCs, stats, or game-system language in the dialogue.\n\nStay true to how each NPC has been portrayed so far.`;

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
          maxTokens: names.length === 1 ? 150 : names.length > 1 ? 500 : undefined,
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

  const startNpcScene = useCallback(async (npcs: string[], scenePrompt: string, maxMessages: number = 12) => {
    if (isLoading) return;
    if (npcs.length < 2 || npcs.length > 6) {
      toast.error('NPC scene requires 2-6 NPCs');
      return;
    }

    setIsLoading(true);
    npcSceneActiveRef.current = true;
    setNpcSceneConfig({ active: true, npcs, prompt: scenePrompt, maxMessages, messageCount: 0 });

    abortControllerRef.current = new AbortController();

    // Insert scene-setting DM message
    const sceneMsg: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: `*${scenePrompt}*`,
      timestamp: new Date(),
      senderName: 'DM',
    };
    setMessages(prev => [...prev, sceneMsg]);

    const contextMessages = messages.map(m => ({ role: m.role, content: m.content }));
    const sceneMessages: Array<{ role: string; content: string }> = [];
    let messageCount = 0;
    let lastSpeaker: string | null = null;
    let lastNpcMessage = '';
    const turnsSinceSpeaking = new Map<string, number>();
    for (const npc of npcs) turnsSinceSpeaking.set(npc, 0);

    try {
      for (let turn = 0; turn < maxMessages; turn++) {
        if (!npcSceneActiveRef.current) break;
        if (abortControllerRef.current?.signal.aborted) break;

        // Weighted NPC selection
        const currentNpc = turn === 0
          ? npcs[Math.floor(Math.random() * npcs.length)]
          : pickNextNpc(npcs, lastSpeaker, lastNpcMessage, turnsSinceSpeaking);
        const otherNpcs = npcs.filter(n => n !== currentNpc);

        // Variable pacing
        if (turn > 0) {
          const prevMsg = lastNpcMessage.toLowerCase();
          const isReactive = /[?!]/.test(prevMsg) || /\b(why|how dare|what did|you (liar|fool|coward)|shut up|enough|stop|never|accus|betray|explain|answer me)\b/i.test(prevMsg);
          const hasInterjection = !!npcSceneInterjectionRef.current;
          let delay: number;
          if (hasInterjection) {
            delay = 600 + Math.random() * 400;
          } else if (isReactive) {
            delay = 800 + Math.random() * 700;
          } else {
            delay = 1400 + Math.random() * 1100;
          }
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(resolve, delay);
            const onAbort = () => { clearTimeout(timeout); reject(new DOMException('Aborted', 'AbortError')); };
            abortControllerRef.current?.signal.addEventListener('abort', onAbort, { once: true });
          });
        }

        if (!npcSceneActiveRef.current) break;
        if (abortControllerRef.current?.signal.aborted) break;

        // Check for player interjection
        const interjection = npcSceneInterjectionRef.current;
        if (interjection) {
          npcSceneInterjectionRef.current = null;
          sceneMessages.push({ role: 'user', content: interjection.content });
          lastNpcMessage = interjection.content;
        }

        // ~15% chance of interrupting
        const isInterrupting = turn > 0 && Math.random() < 0.15;

        const npcSystemPrompt = `## STRICT: ONE NPC, ONE LINE — ${currentNpc} ONLY

You are voicing ${currentNpc} and NOBODY ELSE. Your COMPLETE response must be EXACTLY two lines:

Line 1: *[One italicized physical action or expression — 10 words MAX]*

Line 2: **${currentNpc}:** "[One sentence of dialogue — 30 words MAX]"

STOP AFTER LINE 2. Do not write a third line.

Scene: "${scenePrompt}"

Other NPCs in this scene: ${otherNpcs.join(', ')}

This is line ${turn + 1} of the conversation.

ABSOLUTE RULES:

- You are ${currentNpc}. Do NOT write dialogue or actions for ${otherNpcs.join(', ')} or ANY other character.

- Do NOT write what other characters do, say, think, or feel.

- Do NOT narrate, describe the scene, or set atmosphere.

- Do NOT write prose paragraphs.

- Do NOT include color tags, HTML, or span elements.

- React to what was said before you, but ONLY as ${currentNpc}.

- Two lines. That is your complete response.${interjection ? `\n- A player (${interjection.senderName}) just spoke to you. React to them naturally based on your relationship in this scene.` : ''}${isInterrupting ? `\n- You are INTERRUPTING: start your dialogue with "—" as if cutting someone off. Be abrupt. Keep dialogue under 15 words.` : ''}

EXAMPLES OF CORRECT COMPLETE RESPONSES:

*Crosses arms, jaw tight.*

**${currentNpc}:** "I don't believe a word of it."

*Leans forward, lowering voice.*

**${currentNpc}:** "You heard what I said. Don't make me repeat it."

YOUR RESPONSE MUST FOLLOW THIS EXACT FORMAT. NOTHING MORE.`;

        const apiMessages = [...contextMessages.slice(-40), ...sceneMessages].map(m => ({ role: m.role, content: m.content }));

        const authToken = await getAuthToken();
        const npcResponse = await fetch(AI_DM_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            messages: apiMessages.slice(-50),
            characterContext,
            systemPromptOverride: npcSystemPrompt,
            model: selectedModel || undefined,
            maxTokens: 100,
          }),
          signal: abortControllerRef.current!.signal,
        });

        if (!npcResponse.ok) {
          const err = await npcResponse.json().catch(() => ({}));
          throw new Error((err as { error?: string }).error || 'NPC scene generation failed');
        }

        if (!npcResponse.body) throw new Error('No response body');

        // Stream SSE
        const npcReader = npcResponse.body.getReader();
        const npcDecoder = new TextDecoder();
        let npcBuffer = '';
        let assistantContent = '';

        while (true) {
          const { done, value } = await npcReader.read();
          if (done) break;
          npcBuffer += npcDecoder.decode(value, { stream: true });
          let newlineIndex: number;
          while ((newlineIndex = npcBuffer.indexOf('\n')) !== -1) {
            let line = npcBuffer.slice(0, newlineIndex);
            npcBuffer = npcBuffer.slice(newlineIndex + 1);
            if (line.endsWith('\r')) line = line.slice(0, -1);
            if (line.startsWith(':') || line.trim() === '') continue;
            if (!line.startsWith('data: ')) continue;
            const jsonStr = line.slice(6).trim();
            if (jsonStr === '[DONE]') break;
            try {
              const parsed = JSON.parse(jsonStr);
              const delta = parsed.choices?.[0]?.delta?.content as string | undefined;
              if (delta) assistantContent += delta;
            } catch { /* skip */ }
          }
        }

        if (!npcSceneActiveRef.current) break;
        if (abortControllerRef.current?.signal.aborted) break;

        // Post-process: enforce single-NPC output
        if (assistantContent) {
          let cleaned = assistantContent.trim();
          // Remove any HTML/span color tags
          cleaned = cleaned.replace(/<\/?span[^>]*>/gi, '');
          // If the response contains dialogue from OTHER NPCs (bold name patterns), truncate
          const otherNpcPattern = new RegExp(`\\*\\*(?:${otherNpcs.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\*\\*:`, 'i');
          const otherNpcMatch = cleaned.search(otherNpcPattern);
          if (otherNpcMatch > 0) {
            cleaned = cleaned.slice(0, otherNpcMatch).trim();
          }
          // If response is too long (more than ~100 words), truncate to first 2 non-empty lines
          const words = cleaned.split(/\s+/).length;
          if (words > 80) {
            const lines = cleaned.split('\n').filter(l => l.trim());
            cleaned = lines.slice(0, 2).join('\n');
          }
          assistantContent = cleaned;
        }

        if (assistantContent?.trim()) {
          const npcMsg: Message = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: assistantContent.trim(),
            timestamp: new Date(),
            senderName: currentNpc,
          };
          setMessages(prev => [...prev, npcMsg]);
          sceneMessages.push({ role: 'assistant', content: `[${currentNpc}]: ${assistantContent.trim()}` });
          messageCount++;
          setNpcSceneConfig(prev => prev ? { ...prev, messageCount } : null);
        }

        // Update turn tracking
        lastSpeaker = currentNpc;
        lastNpcMessage = assistantContent?.trim() || '';
        for (const npc of npcs) {
          if (npc === currentNpc) {
            turnsSinceSpeaking.set(npc, 0);
          } else {
            turnsSinceSpeaking.set(npc, (turnsSinceSpeaking.get(npc) || 0) + 1);
          }
        }
      }

      // Post-scene: trigger auto-save and summary
      triggerSummaryIfNeeded(messages);

    } catch (error) {
      const isAbort = error instanceof Error && error.name === 'AbortError';
      if (!isAbort) {
        console.error('Solo DM NPC scene error:', error);
        toast.error(error instanceof Error ? error.message : 'NPC scene failed');
      }
    } finally {
      npcSceneActiveRef.current = false;
      setIsLoading(false);
      abortControllerRef.current = null;
      setNpcSceneConfig(null);
    }
  }, [messages, characterContext, isLoading, selectedModel, triggerSummaryIfNeeded]);

  const stopNpcScene = useCallback(() => {
    npcSceneActiveRef.current = false;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    setNpcSceneConfig(null);
  }, []);

  const submitNpcInterjection = useCallback((content: string) => {
    if (!content.trim() || !npcSceneActiveRef.current) return;

    const playerMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, playerMsg]);

    npcSceneInterjectionRef.current = {
      content: content.trim(),
      senderName: 'Player',
    };
  }, []);

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
    startNpcScene,
    stopNpcScene,
    submitNpcInterjection,
    npcSceneConfig,
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
