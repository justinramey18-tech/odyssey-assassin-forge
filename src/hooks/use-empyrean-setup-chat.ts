import { useState, useCallback, useRef } from 'react';

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export interface EmpyreanSetupBuildData {
  characterName: string;
  yearAtBasgiath: string;
  dragonName: string;
  dragonColor: string;
  signetType: string;
  campaignFocus: 'combat' | 'political' | 'romance' | 'mystery' | 'survival' | 'balanced';
  dragonPersonality?: string;
  openingScene: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/empyrean-campaign-setup-chat`;

function tryExtractBuildData(content: string): EmpyreanSetupBuildData | null {
  const jsonMatch = content.match(/```json\s*\n?\s*(\{[\s\S]*?"action"\s*:\s*"apply_empyrean_setup"[\s\S]*?\})\s*\n?\s*```/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[1]);
    if (parsed.action === 'apply_empyrean_setup' && parsed.data) {
      return parsed.data as EmpyreanSetupBuildData;
    }
  } catch (e) {
    console.error('[EmpyreanSetup] Failed to parse build data:', e);
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

export function useEmpyreanSetupChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [buildData, setBuildData] = useState<EmpyreanSetupBuildData | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (input: string) => {
    const userMsg: ChatMessage = { role: 'user', content: input };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setIsLoading(true);
    setError(null);
    setSuggestions([]);

    let assistantSoFar = '';

    const upsertAssistant = (nextChunk: string) => {
      assistantSoFar += nextChunk;
      const displayContent = stripSuggestions(assistantSoFar);
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant') {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: displayContent } : m));
        }
        return [...prev, { role: 'assistant', content: displayContent }];
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
            const event = JSON.parse(jsonStr);
            const delta = event?.choices?.[0]?.delta?.content;
            if (typeof delta === 'string' && delta.length > 0) {
              upsertAssistant(delta);
            }
          } catch {
            // skip unparseable
          }
        }
      }

      const parsedSuggestions = parseSuggestions(assistantSoFar);
      if (parsedSuggestions.length > 0) {
        setSuggestions(parsedSuggestions);
      }

      const extracted = tryExtractBuildData(assistantSoFar);
      if (extracted) {
        setBuildData(extracted);
      }
    } catch (err) {
      if ((err as any)?.name === 'AbortError') {
        // user cancelled — silent
      } else {
        console.error('[EmpyreanSetup] chat error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  }, [messages]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setBuildData(null);
    setSuggestions([]);
    setError(null);
    setIsLoading(false);
  }, []);

  return { messages, isLoading, buildData, suggestions, error, sendMessage, reset };
}
