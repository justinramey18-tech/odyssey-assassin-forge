import { useState, useRef, useCallback, useEffect } from 'react';
import { loadApiKey } from '@/lib/api-keys';
import { stripMarkdownForTTS, splitTextForStitching, loadSelectedVoiceId } from '@/lib/tts-utils';
import { toast } from 'sonner';

interface UseNarratorReturn {
  isPlaying: boolean;
  isLoading: boolean;
  playMessage: (text: string) => Promise<void>;
  stop: () => void;
  hasElevenLabsKey: boolean;
}

export function useNarrator(): UseNarratorReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  const hasElevenLabsKey = !!loadApiKey('elevenlabs');

  // Cleanup blob URL
  const cleanupAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setIsPlaying(false);
    setIsLoading(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupAudio();
    };
  }, [cleanupAudio]);

  const stop = useCallback(() => {
    cleanupAudio();
  }, [cleanupAudio]);

  const playMessage = useCallback(async (rawText: string) => {
    const apiKey = loadApiKey('elevenlabs');
    const voiceId = loadSelectedVoiceId();

    if (!apiKey) {
      toast.error('No ElevenLabs API key. Add one in Settings → API Keys.');
      return;
    }
    if (!voiceId) {
      toast.error('No voice selected. Choose a narrator voice in Settings → API Keys.');
      return;
    }

    // Stop any current playback
    cleanupAudio();
    setIsLoading(true);

    try {
      const cleanText = stripMarkdownForTTS(rawText);
      const chunks = splitTextForStitching(cleanText, 5000);

      // For simplicity, fetch all chunks and concatenate
      const audioBlobs: Blob[] = [];

      for (let i = 0; i < chunks.length; i++) {
        const body: Record<string, string> = {
          text: chunks[i],
          voiceId,
          user_api_key: apiKey,
        };

        // Request stitching context
        if (i > 0) {
          const prevSentences = chunks[i - 1].split(/[.!?]+/).filter(Boolean).slice(-3).join('. ');
          (body as any).previous_text = prevSentences;
        }
        if (i < chunks.length - 1) {
          const nextSentences = chunks[i + 1].split(/[.!?]+/).filter(Boolean).slice(0, 3).join('. ');
          (body as any).next_text = nextSentences;
        }

        // CRITICAL: Use fetch().blob() — NOT supabase.functions.invoke() which corrupts binary
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify(body),
          }
        );

        if (!response.ok) {
          const err = await response.json().catch(() => ({ error: 'TTS request failed' }));
          throw new Error(err.error || `TTS failed: ${response.status}`);
        }

        const blob = await response.blob();
        audioBlobs.push(blob);
      }

      // Concatenate all audio blobs
      const finalBlob = new Blob(audioBlobs, { type: 'audio/mpeg' });
      const url = URL.createObjectURL(finalBlob);
      blobUrlRef.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        cleanupAudio();
      };

      audio.onerror = () => {
        toast.error('Audio playback failed');
        cleanupAudio();
      };

      setIsLoading(false);
      setIsPlaying(true);
      await audio.play();
    } catch (error) {
      console.error('[Narrator] TTS error:', error);
      toast.error(error instanceof Error ? error.message : 'Narration failed');
      cleanupAudio();
    }
  }, [cleanupAudio]);

  return { isPlaying, isLoading, playMessage, stop, hasElevenLabsKey };
}
