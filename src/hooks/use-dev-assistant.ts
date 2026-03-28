import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getCodebaseIndex, getFileContents, loadDevAssistantInstructions } from '@/lib/codebase-storage';
import { loadApiKey } from '@/lib/api-keys';

interface DevMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isLoading?: boolean;
  phase?: string;
}

export function useDevAssistant() {
  const [messages, setMessages] = useState<DevMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentPhase, setCurrentPhase] = useState('');

  const updatePlaceholder = (id: string, updates: Partial<DevMessage>) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
  };

  const sendMessage = useCallback(async (userMessage: string) => {
    if (isProcessing) return;
    setIsProcessing(true);

    const userId = crypto.randomUUID();
    const assistantId = crypto.randomUUID();

    const userMsg: DevMessage = { id: userId, role: 'user', content: userMessage };
    const placeholder: DevMessage = { id: assistantId, role: 'assistant', content: 'Scanning codebase index to find relevant files...', isLoading: true, phase: 'identify' };

    setMessages(prev => [...prev, userMsg, placeholder]);
    setCurrentPhase('Scanning index...');

    try {
      const index = await getCodebaseIndex();
      if (!index) {
        updatePlaceholder(assistantId, { content: 'No codebase uploaded yet. Go to the upload section above and upload your project ZIP first.', isLoading: false, phase: undefined });
        setIsProcessing(false);
        setCurrentPhase('');
        return;
      }

      const apiKey = loadApiKey('anthropic');
      if (!apiKey) {
        updatePlaceholder(assistantId, { content: 'No Anthropic API key found. Add your key in Settings > Game Master > API Keys.', isLoading: false, phase: undefined });
        setIsProcessing(false);
        setCurrentPhase('');
        return;
      }

      const customInstructions = loadDevAssistantInstructions();

      // Phase 1: identify
      const { data: identifyData, error: identifyError } = await supabase.functions.invoke('dev-assistant', {
        body: {
          messages: [{ role: 'user', content: userMessage }],
          codebaseIndex: JSON.stringify(index),
          fileContents: '{}',
          customInstructions,
          phase: 'identify',
          user_api_key: apiKey,
          model: 'anthropic/claude-sonnet-4-6',
        },
      });

      if (identifyError) {
        let detail = identifyError.message || 'Identify phase failed';
        try {
          const body = (identifyError as any).context?.body ? await (identifyError as any).context.json() : identifyData;
          if (body?.error) detail = body.error;
        } catch {}
        throw new Error(detail);
      }
      if (identifyData?.error) throw new Error(identifyData.error);

      const filePaths: string[] = identifyData?.filePaths || [];

      // Phase 2: fetch files
      setCurrentPhase('Reading files...');
      updatePlaceholder(assistantId, { content: `Reading ${filePaths.length} relevant files...`, phase: 'reading' });

      const fileContentsMap = await getFileContents(filePaths);

      // Phase 3: answer
      setCurrentPhase('Analyzing...');
      updatePlaceholder(assistantId, { content: 'Analyzing code and building response...', phase: 'answer' });

      // Build conversation history (exclude loading placeholders)
      setMessages(prev => {
        const conversationMessages = prev
          .filter(m => !m.isLoading)
          .map(m => ({ role: m.role, content: m.content }));

        // We need to invoke inside a sync context, so we'll do it outside
        return prev;
      });

      // Get current non-loading messages for conversation
      const currentMessages = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));

      const { data: answerData, error: answerError } = await supabase.functions.invoke('dev-assistant', {
        body: {
          messages: currentMessages,
          codebaseIndex: JSON.stringify(index),
          fileContents: JSON.stringify(fileContentsMap),
          customInstructions,
          phase: 'answer',
          user_api_key: apiKey,
          model: 'anthropic/claude-sonnet-4-6',
        },
      });

      if (answerError) {
        let detail = answerError.message || 'Answer phase failed';
        try {
          const body = (answerError as any).context?.body ? await (answerError as any).context.json() : answerData;
          if (body?.error) detail = body.error;
        } catch {}
        throw new Error(detail);
      }
      if (answerData?.error) throw new Error(answerData.error);

      updatePlaceholder(assistantId, {
        content: answerData?.content || 'No response received.',
        isLoading: false,
        phase: undefined,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      updatePlaceholder(assistantId, { content: `Error: ${errMsg}`, isLoading: false, phase: undefined });
    } finally {
      setIsProcessing(false);
      setCurrentPhase('');
    }
  }, [isProcessing, messages]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setIsProcessing(false);
    setCurrentPhase('');
  }, []);

  return { messages, isProcessing, currentPhase, sendMessage, clearChat };
}
