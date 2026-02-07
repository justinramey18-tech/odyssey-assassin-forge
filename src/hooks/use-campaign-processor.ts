import { useState, useCallback, useRef } from 'react';
import { 
  DetectedSession, 
  detectSessions, 
  splitByChunkSize, 
  getSessionContent,
  countWords,
} from '@/lib/scribe/sessionDetection';
import { processTextOffline, ProcessingOptions } from '@/lib/narrativeProcessor';
import { supabase } from '@/integrations/supabase/client';

export interface ProcessedSession {
  sessionId: string;
  title: string;
  inputPreview: string;
  output: string;
  wordCount: number;
  processedAt: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  error?: string;
}

export interface CampaignProcessorState {
  // File state
  fileName: string | null;
  fileContent: string | null;
  
  // Session state
  sessions: DetectedSession[];
  selectedSessionIds: Set<string>;
  processedSessions: Map<string, ProcessedSession>;
  
  // Processing state
  isProcessing: boolean;
  currentlyProcessing: string | null;
  progress: number;
  error: string | null;
  
  // Stats
  totalWords: number;
  totalChars: number;
}

export interface UseCampaignProcessorReturn extends CampaignProcessorState {
  // Actions
  loadFile: (content: string, fileName: string, sessions: DetectedSession[]) => void;
  toggleSession: (sessionId: string) => void;
  selectAllSessions: () => void;
  deselectAllSessions: () => void;
  processSelectedSessions: (
    mode: 'ai' | 'offline',
    options: ProcessingOptions,
    characterName: string
  ) => Promise<string | null>;
  cancelProcessing: () => void;
  combineProcessedSessions: () => string;
  reset: () => void;
  getFileStats: () => { wordCount: number; charCount: number; sessionCount: number } | null;
}

const DELAY_BETWEEN_AI_CALLS = 2000; // 2 seconds between AI calls

export function useCampaignProcessor(): UseCampaignProcessorReturn {
  const [state, setState] = useState<CampaignProcessorState>({
    fileName: null,
    fileContent: null,
    sessions: [],
    selectedSessionIds: new Set(),
    processedSessions: new Map(),
    isProcessing: false,
    currentlyProcessing: null,
    progress: 0,
    error: null,
    totalWords: 0,
    totalChars: 0,
  });

  const cancelledRef = useRef(false);

  const loadFile = useCallback((content: string, fileName: string, sessions: DetectedSession[]) => {
    // If no sessions provided, try to detect or chunk
    let finalSessions = sessions;
    if (finalSessions.length === 0) {
      finalSessions = detectSessions(content);
      if (finalSessions.length === 0 && content.length > 15000) {
        finalSessions = splitByChunkSize(content, 10000);
      }
    }

    // Auto-select all sessions
    const selectedIds = new Set(finalSessions.map(s => s.id));

    setState({
      fileName,
      fileContent: content,
      sessions: finalSessions,
      selectedSessionIds: selectedIds,
      processedSessions: new Map(),
      isProcessing: false,
      currentlyProcessing: null,
      progress: 0,
      error: null,
      totalWords: countWords(content),
      totalChars: content.length,
    });
  }, []);

  const toggleSession = useCallback((sessionId: string) => {
    setState(prev => {
      const newSelected = new Set(prev.selectedSessionIds);
      if (newSelected.has(sessionId)) {
        newSelected.delete(sessionId);
      } else {
        newSelected.add(sessionId);
      }
      return { ...prev, selectedSessionIds: newSelected };
    });
  }, []);

  const selectAllSessions = useCallback(() => {
    setState(prev => ({
      ...prev,
      selectedSessionIds: new Set(prev.sessions.map(s => s.id)),
    }));
  }, []);

  const deselectAllSessions = useCallback(() => {
    setState(prev => ({
      ...prev,
      selectedSessionIds: new Set(),
    }));
  }, []);

  const processSession = async (
    session: DetectedSession,
    content: string,
    mode: 'ai' | 'offline',
    options: ProcessingOptions,
    characterName: string
  ): Promise<{ output: string; error?: string }> => {
    const sessionContent = getSessionContent(content, session);

    if (mode === 'offline') {
      const output = processTextOffline(sessionContent, options);
      return { output };
    }

    // AI mode
    try {
      const { data, error } = await supabase.functions.invoke('narrative-forge', {
        body: {
          text: sessionContent,
          characterName,
          style: options.narrativeStyle,
        },
      });

      if (error) throw error;
      return { output: data.narrative || '' };
    } catch (error) {
      return {
        output: '',
        error: error instanceof Error ? error.message : 'AI processing failed',
      };
    }
  };

  const processSelectedSessions = useCallback(async (
    mode: 'ai' | 'offline',
    options: ProcessingOptions,
    characterName: string
  ): Promise<string | null> => {
    const { sessions, selectedSessionIds, fileContent } = state;
    
    if (!fileContent || selectedSessionIds.size === 0) {
      return null;
    }

    cancelledRef.current = false;
    const selectedSessions = sessions.filter(s => selectedSessionIds.has(s.id));
    const totalSessions = selectedSessions.length;

    setState(prev => ({
      ...prev,
      isProcessing: true,
      progress: 0,
      error: null,
      processedSessions: new Map(),
    }));

    const newProcessed = new Map<string, ProcessedSession>();

    for (let i = 0; i < selectedSessions.length; i++) {
      if (cancelledRef.current) break;

      const session = selectedSessions[i];
      
      setState(prev => ({
        ...prev,
        currentlyProcessing: session.id,
        progress: Math.round((i / totalSessions) * 100),
      }));

      const result = await processSession(
        session,
        fileContent,
        mode,
        options,
        characterName
      );

      const processedSession: ProcessedSession = {
        sessionId: session.id,
        title: session.title,
        inputPreview: session.preview,
        output: result.output,
        wordCount: countWords(result.output),
        processedAt: new Date().toISOString(),
        status: result.error ? 'error' : 'completed',
        error: result.error,
      };

      newProcessed.set(session.id, processedSession);

      setState(prev => ({
        ...prev,
        processedSessions: new Map(newProcessed),
        progress: Math.round(((i + 1) / totalSessions) * 100),
      }));

      // Add delay between AI calls to avoid rate limiting
      if (mode === 'ai' && i < selectedSessions.length - 1 && !cancelledRef.current) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_AI_CALLS));
      }
    }

    setState(prev => ({
      ...prev,
      isProcessing: false,
      currentlyProcessing: null,
      progress: 100,
    }));

    // Return combined output
    const outputs: string[] = [];
    for (const session of selectedSessions) {
      const processed = newProcessed.get(session.id);
      if (processed?.output) {
        outputs.push(processed.output);
      }
    }

    return outputs.join('\n\n---\n\n');
  }, [state]);

  const cancelProcessing = useCallback(() => {
    cancelledRef.current = true;
    setState(prev => ({
      ...prev,
      isProcessing: false,
      currentlyProcessing: null,
    }));
  }, []);

  const combineProcessedSessions = useCallback((): string => {
    const { sessions, selectedSessionIds, processedSessions } = state;
    
    const outputs: string[] = [];
    for (const session of sessions) {
      if (!selectedSessionIds.has(session.id)) continue;
      const processed = processedSessions.get(session.id);
      if (processed?.output) {
        outputs.push(processed.output);
      }
    }

    return outputs.join('\n\n---\n\n');
  }, [state]);

  const reset = useCallback(() => {
    cancelledRef.current = true;
    setState({
      fileName: null,
      fileContent: null,
      sessions: [],
      selectedSessionIds: new Set(),
      processedSessions: new Map(),
      isProcessing: false,
      currentlyProcessing: null,
      progress: 0,
      error: null,
      totalWords: 0,
      totalChars: 0,
    });
  }, []);

  const getFileStats = useCallback(() => {
    if (!state.fileName) return null;
    return {
      wordCount: state.totalWords,
      charCount: state.totalChars,
      sessionCount: state.sessions.length,
    };
  }, [state.fileName, state.totalWords, state.totalChars, state.sessions.length]);

  return {
    ...state,
    loadFile,
    toggleSession,
    selectAllSessions,
    deselectAllSessions,
    processSelectedSessions,
    cancelProcessing,
    combineProcessedSessions,
    reset,
    getFileStats,
  };
}
