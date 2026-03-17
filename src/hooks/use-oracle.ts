import { useState, useCallback, useRef } from 'react';
import { Message, Personality, CharacterContext, OracleMode } from '@/components/oracle/types';
import { toast } from 'sonner';
import { getAuthToken } from '@/lib/auth-token';
import { getEverywhereKey } from '@/lib/api-keys';

const ORACLE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/oracle-assistant`;

interface UseOracleOptions {
  characterContext: CharacterContext;
}

export function useOracle({ characterContext }: UseOracleOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [personality, setPersonality] = useState<Personality>('deadpool');
  const [mode, setMode] = useState<OracleMode>('recap');
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    // Add user message
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    // Prepare messages for API
    const apiMessages = [...messages, userMessage].map(m => ({
      role: m.role,
      content: m.content,
    }));

    // Create abort controller for this request
    abortControllerRef.current = new AbortController();

    let assistantContent = '';

    try {
      const authToken = await getAuthToken();
      const response = await fetch(ORACLE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          messages: apiMessages,
          personality,
          characterContext,
          mode,
          ...(() => {
            const ek = getEverywhereKey();
            if (!ek) return {};
            return ek.provider === 'anthropic' ? { user_api_key: ek.key } : { user_openai_key: ek.key };
          })(),
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed with status ${response.status}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';

      // Create initial assistant message
      const assistantMessageId = crypto.randomUUID();
      setMessages(prev => [
        ...prev,
        {
          id: assistantMessageId,
          role: 'assistant',
          content: '',
          timestamp: new Date(),
          personality,
          mode,
        },
      ]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });

        // Process line-by-line
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
            // Incomplete JSON, put it back
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
          } catch {
            // ignore
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Request was cancelled
        return;
      }

      console.error('Oracle error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to get response');

      // Remove the empty assistant message if there was an error
      if (!assistantContent) {
        setMessages(prev => prev.filter(m => m.role !== 'assistant' || m.content));
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [messages, personality, characterContext, isLoading, mode]);

  const cancelRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
    }
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const switchPersonality = useCallback((newPersonality: Personality) => {
    setPersonality(newPersonality);
  }, []);

  const switchMode = useCallback((newMode: OracleMode) => {
    setMode(newMode);
  }, []);

  return {
    messages,
    isLoading,
    personality,
    mode,
    sendMessage,
    cancelRequest,
    clearMessages,
    switchPersonality,
    switchMode,
  };
}
