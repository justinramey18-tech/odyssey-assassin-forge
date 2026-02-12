import { useState, useCallback, useRef, useEffect } from 'react';
import { Message, CharacterContext } from '@/components/oracle/types';
import { toast } from 'sonner';
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

interface UseAIDMOptions {
  characterContext: CharacterContext;
  customGuidesContent?: string;
}

function loadSession(): Message[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((m: any) => ({
      ...m,
      timestamp: new Date(m.timestamp),
    }));
  } catch {
    return [];
  }
}

function saveSession(messages: Message[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch (error) {
    console.error('Failed to save AI DM session:', error);
  }
}

export function useAIDM({ characterContext, customGuidesContent }: UseAIDMOptions) {
  const [messages, setMessages] = useState<Message[]>(() => loadSession());
  const [isLoading, setIsLoading] = useState(false);
  const [campaignSummary, setCampaignSummary] = useState<string | null>(() => loadCampaignSummary());
  const [isSummarizing, setIsSummarizing] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Persist messages to localStorage
  useEffect(() => {
    saveSession(messages);
  }, [messages]);

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
  }, []);

  const newGame = useCallback(() => {
    clearMessages();
    toast.success('New game started! The DM awaits your adventure.');
  }, [clearMessages]);

  const updateCampaignSummary = useCallback((summary: string) => {
    saveCampaignSummary(summary);
    setCampaignSummary(summary || null);
  }, []);

  return {
    messages,
    isLoading,
    isSummarizing,
    campaignSummary,
    updateCampaignSummary,
    sendMessage,
    cancelRequest,
    clearMessages,
    newGame,
  };
}
