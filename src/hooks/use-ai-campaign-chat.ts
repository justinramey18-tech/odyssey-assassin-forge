import { useState, useCallback, useRef, useMemo } from 'react';

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export interface CampaignBuildData {
  campaignName: string;
  campaignSummary: string;
  openingScene: string;
  gmGuide: string;
  memoryAnchors: Array<{
    category: 'npc' | 'location' | 'quest' | 'fact' | 'secret' | 'reputation';
    key: string;
    value: string;
  }>;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-campaign-builder`;

function tryExtractBuildData(content: string): CampaignBuildData | null {
  const jsonMatch = content.match(/```json\s*\n?\s*(\{[\s\S]*?"action"\s*:\s*"apply_campaign"[\s\S]*?\})\s*\n?\s*```/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[1]);
    if (parsed.action === 'apply_campaign' && parsed.data) {
      return parsed.data as CampaignBuildData;
    }
  } catch (e) {
    console.error('[AICampaign] Failed to parse build data:', e);
  }
  return null;
}

function parseSuggestions(content: string): string[] {
  const match = content.match(/\[SUGGESTIONS:\s*(.*?)\]\s*$/);
  if (!match) return [];
  try {
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

export function useAICampaignChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [buildData, setBuildData] = useState<CampaignBuildData | null>(null);
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
      } else if (assistantSoFar.includes('"action":"apply_campaign"') || assistantSoFar.includes('"action": "apply_campaign"')) {
        setError('The campaign data was too large and got cut off. Please ask the assistant to try again with shorter descriptions.');
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        console.error('[AICampaign] Stream error:', e);
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

  const suggestions = useMemo(() => {
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== 'assistant' || isLoading) return [];
    return parseSuggestions(lastMsg.content);
  }, [messages, isLoading]);

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
