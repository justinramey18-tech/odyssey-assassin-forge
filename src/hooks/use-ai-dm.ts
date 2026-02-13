import { useState, useCallback, useRef, useEffect } from 'react';
import { Message, CharacterContext } from '@/components/oracle/types';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  loadCampaignSummary,
  saveCampaignSummary,
  clearCampaignSummary,
} from '@/lib/campaign-summary-storage';

const AI_DM_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-dm`;
const SUMMARIZE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-dm-summarize`;
const STORAGE_KEY = 'dnd-ai-dm-session';
const MAX_MESSAGES = 100;
const SUMMARY_INTERVAL = 10;
const SAVE_DEBOUNCE_MS = 1000;
const CLOUD_SAVE_DEBOUNCE_MS = 30000;
const SESSION_VERSION = 1;

interface UseAIDMOptions {
  characterContext: CharacterContext;
  customGuidesContent?: string;
  onMessageComplete?: (content: string) => void;
  /** Current active guide IDs to persist with the campaign */
  activeGuideIds?: string[];
  /** Called when a campaign is loaded so the parent can switch active guides */
  onCampaignSwitch?: (guideIds: string[] | null) => void;
}

interface VersionedSession {
  version: number;
  messages: any[];
}

// Module-level ref for dirty-checking across saves
let lastSavedJson = '';

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

function loadSession(): Message[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
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

function saveSession(messages: Message[]): void {
  const payload: VersionedSession = {
    version: SESSION_VERSION,
    messages,
  };
  const serialized = JSON.stringify(payload);

  // Dirty-check: skip if nothing changed
  if (serialized === lastSavedJson) return;

  try {
    localStorage.setItem(STORAGE_KEY, serialized);
    lastSavedJson = serialized;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      toast.error('Session too large to save locally');
    } else {
      console.error('[AI DM Save] Failed to save:', error);
    }
  }
}

export function useAIDM({ characterContext, customGuidesContent, onMessageComplete, activeGuideIds, onCampaignSwitch }: UseAIDMOptions) {
  const [messages, setMessages] = useState<Message[]>(() => loadSession());
  const [isLoading, setIsLoading] = useState(false);
  const [campaignSummary, setCampaignSummary] = useState<string | null>(() => loadCampaignSummary());
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [lastCloudSyncTime, setLastCloudSyncTime] = useState<Date | null>(null);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Local save debounce
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Cloud save refs
  const cloudSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastCloudSaveJsonRef = useRef<string>('');
  const messagesRef = useRef<Message[]>(messages);
  const campaignSummaryRef = useRef<string | null>(campaignSummary);
  const activeCampaignIdRef = useRef<string | null>(activeCampaignId);
  const activeGuideIdsRef = useRef<string[]>(activeGuideIds ?? []);
  const onCampaignSwitchRef = useRef(onCampaignSwitch);

  // Keep refs in sync
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { campaignSummaryRef.current = campaignSummary; }, [campaignSummary]);
  useEffect(() => { activeCampaignIdRef.current = activeCampaignId; }, [activeCampaignId]);
  useEffect(() => { activeGuideIdsRef.current = activeGuideIds ?? []; }, [activeGuideIds]);
  useEffect(() => { onCampaignSwitchRef.current = onCampaignSwitch; }, [onCampaignSwitch]);

  // Auto-load most recent cloud campaign if localStorage was empty
  const hasAttemptedCloudLoad = useRef(false);
  useEffect(() => {
    if (hasAttemptedCloudLoad.current) return;
    hasAttemptedCloudLoad.current = true;

    // Only auto-load if local session is empty
    if (messages.length > 0) return;

    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from('ai_dm_campaigns')
          .select('id, name, messages, campaign_summary, gm_guide_ids')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error || !data) return;

        const loadedMessages: Message[] = Array.isArray(data.messages)
          ? (data.messages as any[])
              .filter(isValidMessage)
              .map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }))
          : [];

        if (loadedMessages.length === 0) return;

        // Use loadCampaign to set everything consistently
        loadCampaign(loadedMessages, data.campaign_summary, data.id, data.gm_guide_ids);
      } catch (err) {
        console.warn('[AI DM] Failed to auto-load cloud campaign:', err);
      }
    })();
  }, []); // Run once on mount

  const saveNow = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    saveSession(messages);
  }, [messages]);

  useEffect(() => {
    debounceTimerRef.current = setTimeout(() => {
      saveSession(messages);
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [messages]);

  // Cloud auto-save function
  const saveToCloudNow = useCallback(async () => {
    const currentMessages = messagesRef.current;
    const currentSummary = campaignSummaryRef.current;
    const currentCampaignId = activeCampaignIdRef.current;
    const currentGuideIds = activeGuideIdsRef.current;

    // Need messages and auth to save
    if (currentMessages.length === 0) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const serializedMessages = currentMessages.map(m => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp,
    }));

    const cloudPayload = JSON.stringify({ messages: serializedMessages, summary: currentSummary, guideIds: currentGuideIds });

    // Dirty-check
    if (cloudPayload === lastCloudSaveJsonRef.current) return;

    setIsCloudSyncing(true);
    try {
      // Derive a name from first user message
      const firstUserMsg = currentMessages.find(m => m.role === 'user');
      const campaignName = firstUserMsg
        ? firstUserMsg.content.slice(0, 50) + (firstUserMsg.content.length > 50 ? '...' : '')
        : 'Auto-Save';

      if (currentCampaignId) {
        const { error } = await supabase
          .from('ai_dm_campaigns')
          .update({
            name: campaignName,
            messages: serializedMessages as any,
            campaign_summary: currentSummary,
            gm_guide_ids: currentGuideIds,
          })
          .eq('id', currentCampaignId)
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('ai_dm_campaigns')
          .insert({
            user_id: user.id,
            name: campaignName,
            messages: serializedMessages as any,
            campaign_summary: currentSummary,
            gm_guide_ids: currentGuideIds,
          })
          .select('id')
          .single();
        if (error) throw error;
        setActiveCampaignId(data.id);
      }

      lastCloudSaveJsonRef.current = cloudPayload;
      setLastCloudSyncTime(new Date());
    } catch (error) {
      console.warn('[Cloud Auto-Save] Failed:', error);
    } finally {
      setIsCloudSyncing(false);
    }
  }, []);

  // 30-second debounced cloud save
  useEffect(() => {
    if (messages.length === 0) return;

    cloudSaveTimerRef.current = setTimeout(() => {
      saveToCloudNow();
    }, CLOUD_SAVE_DEBOUNCE_MS);

    return () => {
      if (cloudSaveTimerRef.current) {
        clearTimeout(cloudSaveTimerRef.current);
      }
    };
  }, [messages, campaignSummary, saveToCloudNow]);

  // Save immediately on tab close (bypass debounce) — local + best-effort cloud
  useEffect(() => {
    const handleBeforeUnload = () => {
      saveNow();
      // Best-effort cloud save (may not complete)
      saveToCloudNow();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveNow, saveToCloudNow]);

  // Trigger summary generation after every Nth assistant message
  const triggerSummaryIfNeeded = useCallback(async (allMessages: Message[]) => {
    const assistantCount = allMessages.filter(m => m.role === 'assistant' && m.content).length;
    if (assistantCount === 0 || assistantCount % SUMMARY_INTERVAL !== 0) return;

    setIsSummarizing(true);
    try {
      const apiMessages = allMessages.map(m => ({ role: m.role, content: m.content }));
      const response = await fetch(SUMMARIZE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
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
        saveCampaignSummary(data.summary);
        setCampaignSummary(data.summary);
        toast.success('Campaign summary updated', { duration: 2000 });
      }
    } catch (error) {
      console.error('Summary generation error:', error);
    } finally {
      setIsSummarizing(false);
    }
  }, [campaignSummary]);

  const sendMessage = useCallback(async (content: string) => {
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
    const allMessages = [...messages, userMessage];
    const apiMessages = allMessages.length > MAX_MESSAGES
      ? [...allMessages.slice(0, 2), ...allMessages.slice(-(MAX_MESSAGES - 2))]
      : allMessages;

    const apiPayload = apiMessages.map(m => ({
      role: m.role,
      content: m.content,
    }));

    abortControllerRef.current = new AbortController();
    let assistantContent = '';

    try {
      const response = await fetch(AI_DM_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: apiPayload,
          characterContext,
          customGuides: customGuidesContent || undefined,
          campaignSummary: campaignSummary || undefined,
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

      // After successful response, check if we should generate a summary
      if (assistantContent) {
        const updatedMessages = [...allMessages, {
          id: assistantMessageId,
          role: 'assistant' as const,
          content: assistantContent,
          timestamp: new Date(),
        }];
        // Fire and forget — don't block the UI
        triggerSummaryIfNeeded(updatedMessages);
        // Notify listener (e.g. auto-sync)
        onMessageComplete?.(assistantContent);
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

  const cancelRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
    }
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
    clearCampaignSummary();
    setCampaignSummary(null);
    setActiveCampaignId(null);
    lastCloudSaveJsonRef.current = '';
  }, []);

  const newGame = useCallback(async () => {
    // Auto-save current campaign to cloud before clearing
    if (messagesRef.current.length > 0) {
      await saveToCloudNow();
    }
    // Clear local state
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
    clearCampaignSummary();
    setCampaignSummary(null);
    setActiveCampaignId(null);
    lastCloudSaveJsonRef.current = '';
    // Disable all guides for fresh campaign
    onCampaignSwitchRef.current?.(null);
    toast.success('New game started! The DM awaits your adventure.');
  }, [saveToCloudNow]);

  const updateCampaignSummary = useCallback((summary: string) => {
    saveCampaignSummary(summary);
    setCampaignSummary(summary || null);
  }, []);

  const loadCampaign = useCallback((loadedMessages: Message[], summary: string | null, campaignId?: string, guideIds?: string[] | null) => {
    setMessages(loadedMessages);
    saveSession(loadedMessages);
    if (summary) {
      saveCampaignSummary(summary);
      setCampaignSummary(summary);
    } else {
      clearCampaignSummary();
      setCampaignSummary(null);
    }
    setActiveCampaignId(campaignId ?? null);
    // Switch active guides to match the loaded campaign
    if (guideIds !== undefined) {
      onCampaignSwitchRef.current?.(guideIds);
    }
    // Reset cloud dirty-check to loaded state
    const serializedMessages = loadedMessages.map(m => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp,
    }));
    lastCloudSaveJsonRef.current = JSON.stringify({ messages: serializedMessages, summary, guideIds: guideIds ?? [] });
  }, []);

  return {
    messages,
    isLoading,
    isSummarizing,
    campaignSummary,
    updateCampaignSummary,
    loadCampaign,
    sendMessage,
    cancelRequest,
    clearMessages,
    newGame,
    activeCampaignId,
    setActiveCampaignId,
    lastCloudSyncTime,
    isCloudSyncing,
    saveToCloudNow,
  };
}
