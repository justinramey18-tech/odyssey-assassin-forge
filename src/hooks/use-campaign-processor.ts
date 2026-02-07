import { useState, useCallback, useRef, useEffect } from 'react';
import { 
  DetectedSession, 
  detectSessions, 
  splitByChunkSize, 
  getSessionContent,
  countWords,
} from '@/lib/scribe/sessionDetection';
import { processTextOffline, ProcessingOptions } from '@/lib/narrativeProcessor';
import { supabase } from '@/integrations/supabase/client';

const STORAGE_KEY = 'campaign-processor-progress';
const DELAY_BETWEEN_AI_CALLS = 2000; // 2 seconds between AI calls

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

// Serializable version for localStorage
interface SerializedProgress {
  fileName: string;
  fileContent: string;
  sessions: DetectedSession[];
  selectedSessionIds: string[];
  processedSessions: Array<[string, ProcessedSession]>;
  processingMode: 'ai' | 'offline';
  processingOptions: ProcessingOptions;
  characterName: string;
  lastSessionIndex: number;
  savedAt: string;
  totalWords: number;
  totalChars: number;
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
  
  // Resume state
  hasSavedProgress: boolean;
  savedProgressInfo: { fileName: string; completedCount: number; totalCount: number; savedAt: string } | null;
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
  resumeProcessing: (mode: 'ai' | 'offline', options: ProcessingOptions, characterName: string) => Promise<string | null>;
  clearSavedProgress: () => void;
  loadSavedProgress: () => boolean;
}

// Helper to save progress to localStorage
function saveProgressToStorage(
  state: CampaignProcessorState,
  processingMode: 'ai' | 'offline',
  processingOptions: ProcessingOptions,
  characterName: string,
  lastSessionIndex: number
): void {
  if (!state.fileName || !state.fileContent) return;

  const serialized: SerializedProgress = {
    fileName: state.fileName,
    fileContent: state.fileContent,
    sessions: state.sessions,
    selectedSessionIds: Array.from(state.selectedSessionIds),
    processedSessions: Array.from(state.processedSessions.entries()),
    processingMode,
    processingOptions,
    characterName,
    lastSessionIndex,
    savedAt: new Date().toISOString(),
    totalWords: state.totalWords,
    totalChars: state.totalChars,
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
  } catch (error) {
    console.error('Failed to save campaign progress:', error);
  }
}

// Helper to load progress from localStorage
function loadProgressFromStorage(): SerializedProgress | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as SerializedProgress;
  } catch (error) {
    console.error('Failed to load campaign progress:', error);
    return null;
  }
}

// Helper to clear saved progress
function clearProgressFromStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear campaign progress:', error);
  }
}

// Check if there's saved progress on mount
function getSavedProgressInfo(): { fileName: string; completedCount: number; totalCount: number; savedAt: string } | null {
  const saved = loadProgressFromStorage();
  if (!saved) return null;

  const completedCount = saved.processedSessions.filter(([, p]) => p.status === 'completed').length;
  const totalCount = saved.selectedSessionIds.length;

  // Only show resume if there's incomplete progress
  if (completedCount >= totalCount) {
    clearProgressFromStorage();
    return null;
  }

  return {
    fileName: saved.fileName,
    completedCount,
    totalCount,
    savedAt: saved.savedAt,
  };
}

export function useCampaignProcessor(): UseCampaignProcessorReturn {
  const [state, setState] = useState<CampaignProcessorState>(() => {
    const savedInfo = getSavedProgressInfo();
    return {
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
      hasSavedProgress: savedInfo !== null,
      savedProgressInfo: savedInfo,
    };
  });

  const cancelledRef = useRef(false);

  // Check for saved progress on mount
  useEffect(() => {
    const savedInfo = getSavedProgressInfo();
    if (savedInfo) {
      setState(prev => ({
        ...prev,
        hasSavedProgress: true,
        savedProgressInfo: savedInfo,
      }));
    }
  }, []);

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

    setState(prev => ({
      ...prev,
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
    }));
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
    characterName: string,
    startFromIndex: number = 0,
    existingProcessed?: Map<string, ProcessedSession>
  ): Promise<string | null> => {
    const { sessions, selectedSessionIds, fileContent } = state;
    
    if (!fileContent || selectedSessionIds.size === 0) {
      return null;
    }

    cancelledRef.current = false;
    const selectedSessions = sessions.filter(s => selectedSessionIds.has(s.id));
    const totalSessions = selectedSessions.length;

    // Start with existing processed sessions if resuming
    const newProcessed = existingProcessed ? new Map(existingProcessed) : new Map<string, ProcessedSession>();

    setState(prev => ({
      ...prev,
      isProcessing: true,
      progress: Math.round((startFromIndex / totalSessions) * 100),
      error: null,
      processedSessions: newProcessed,
    }));

    for (let i = startFromIndex; i < selectedSessions.length; i++) {
      if (cancelledRef.current) {
        // Save progress when cancelled
        saveProgressToStorage(
          { ...state, processedSessions: newProcessed },
          mode,
          options,
          characterName,
          i
        );
        break;
      }

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

      // Save progress after each session (for recovery)
      saveProgressToStorage(
        { ...state, processedSessions: newProcessed },
        mode,
        options,
        characterName,
        i + 1
      );

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

    const wasCompleted = !cancelledRef.current;

    setState(prev => ({
      ...prev,
      isProcessing: false,
      currentlyProcessing: null,
      progress: wasCompleted ? 100 : prev.progress,
    }));

    // Clear saved progress if completed successfully
    if (wasCompleted) {
      clearProgressFromStorage();
      setState(prev => ({
        ...prev,
        hasSavedProgress: false,
        savedProgressInfo: null,
      }));
    }

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
      hasSavedProgress: true,
      savedProgressInfo: getSavedProgressInfo(),
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
      hasSavedProgress: getSavedProgressInfo() !== null,
      savedProgressInfo: getSavedProgressInfo(),
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

  const loadSavedProgress = useCallback((): boolean => {
    const saved = loadProgressFromStorage();
    if (!saved) return false;

    setState(prev => ({
      ...prev,
      fileName: saved.fileName,
      fileContent: saved.fileContent,
      sessions: saved.sessions,
      selectedSessionIds: new Set(saved.selectedSessionIds),
      processedSessions: new Map(saved.processedSessions),
      totalWords: saved.totalWords,
      totalChars: saved.totalChars,
      hasSavedProgress: true,
      savedProgressInfo: getSavedProgressInfo(),
    }));

    return true;
  }, []);

  const resumeProcessing = useCallback(async (
    mode: 'ai' | 'offline',
    options: ProcessingOptions,
    characterName: string
  ): Promise<string | null> => {
    const saved = loadProgressFromStorage();
    if (!saved) return null;

    // First restore the state
    const restoredProcessed = new Map(saved.processedSessions);
    
    setState(prev => ({
      ...prev,
      fileName: saved.fileName,
      fileContent: saved.fileContent,
      sessions: saved.sessions,
      selectedSessionIds: new Set(saved.selectedSessionIds),
      processedSessions: restoredProcessed,
      totalWords: saved.totalWords,
      totalChars: saved.totalChars,
    }));

    // Wait for state to update
    await new Promise(resolve => setTimeout(resolve, 100));

    // Resume from where we left off
    const selectedSessions = saved.sessions.filter(s => saved.selectedSessionIds.includes(s.id));
    const startIndex = saved.lastSessionIndex;

    // Process remaining sessions
    cancelledRef.current = false;
    const totalSessions = selectedSessions.length;
    const newProcessed = new Map(restoredProcessed);

    setState(prev => ({
      ...prev,
      isProcessing: true,
      progress: Math.round((startIndex / totalSessions) * 100),
      error: null,
    }));

    for (let i = startIndex; i < selectedSessions.length; i++) {
      if (cancelledRef.current) {
        saveProgressToStorage(
          { 
            ...state, 
            fileName: saved.fileName,
            fileContent: saved.fileContent,
            sessions: saved.sessions,
            selectedSessionIds: new Set(saved.selectedSessionIds),
            processedSessions: newProcessed,
            totalWords: saved.totalWords,
            totalChars: saved.totalChars,
          },
          mode,
          options,
          characterName,
          i
        );
        break;
      }

      const session = selectedSessions[i];
      
      setState(prev => ({
        ...prev,
        currentlyProcessing: session.id,
        progress: Math.round((i / totalSessions) * 100),
      }));

      const result = await processSession(
        session,
        saved.fileContent,
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

      saveProgressToStorage(
        { 
          ...state,
          fileName: saved.fileName,
          fileContent: saved.fileContent,
          sessions: saved.sessions,
          selectedSessionIds: new Set(saved.selectedSessionIds),
          processedSessions: newProcessed,
          totalWords: saved.totalWords,
          totalChars: saved.totalChars,
        },
        mode,
        options,
        characterName,
        i + 1
      );

      setState(prev => ({
        ...prev,
        processedSessions: new Map(newProcessed),
        progress: Math.round(((i + 1) / totalSessions) * 100),
      }));

      if (mode === 'ai' && i < selectedSessions.length - 1 && !cancelledRef.current) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_AI_CALLS));
      }
    }

    const wasCompleted = !cancelledRef.current;

    setState(prev => ({
      ...prev,
      isProcessing: false,
      currentlyProcessing: null,
      progress: wasCompleted ? 100 : prev.progress,
    }));

    if (wasCompleted) {
      clearProgressFromStorage();
      setState(prev => ({
        ...prev,
        hasSavedProgress: false,
        savedProgressInfo: null,
      }));
    }

    const outputs: string[] = [];
    for (const session of selectedSessions) {
      const processed = newProcessed.get(session.id);
      if (processed?.output) {
        outputs.push(processed.output);
      }
    }

    return outputs.join('\n\n---\n\n');
  }, [state]);

  const clearSavedProgress = useCallback(() => {
    clearProgressFromStorage();
    setState(prev => ({
      ...prev,
      hasSavedProgress: false,
      savedProgressInfo: null,
    }));
  }, []);

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
    resumeProcessing,
    clearSavedProgress,
    loadSavedProgress,
  };
}
