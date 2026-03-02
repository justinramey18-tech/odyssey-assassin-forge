import { useState, useRef, useCallback, useEffect } from 'react';
import { loadApiKey } from '@/lib/api-keys';
import {
  stripMarkdownForTTS, splitTextForStitching,
  loadSelectedVoiceId, loadNarrationSpeed, loadVoiceSettings,
  loadTTSProvider, loadSpeechifyVoiceId,
} from '@/lib/tts-utils';
import { isSfxEnabled, loadSfxStyle } from '@/components/settings/SoundEffectsWidget';
import { toast } from 'sonner';

interface UseNarratorReturn {
  isPlaying: boolean;
  isLoading: boolean;
  playMessage: (text: string) => Promise<void>;
  stop: () => void;
  hasElevenLabsKey: boolean;
  hasSpeechifyKey: boolean;
  hasTTSKey: boolean;
}

export function useNarrator(): UseNarratorReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sfxAudioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const sfxBlobUrlRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const hasElevenLabsKey = !!loadApiKey('elevenlabs');
  const hasSpeechifyKey = !!loadApiKey('speechify');
  const hasTTSKey = hasElevenLabsKey || hasSpeechifyKey;

  // Cleanup blob URL and abort in-flight requests
  const cleanupAudio = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (sfxAudioRef.current) {
      sfxAudioRef.current.pause();
      sfxAudioRef.current = null;
    }
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    if (sfxBlobUrlRef.current) {
      URL.revokeObjectURL(sfxBlobUrlRef.current);
      sfxBlobUrlRef.current = null;
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
    const provider = loadTTSProvider();

    // Stop any current playback
    cleanupAudio();
    setIsLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const cleanText = stripMarkdownForTTS(rawText);
      const chunks = splitTextForStitching(cleanText, 5000);

      const audioBlobs: Blob[] = [];

      // Fetch TTS and SFX in parallel
      const sfxPromise = (provider === 'elevenlabs' && isSfxEnabled())
        ? fetchSfxAudio(loadApiKey('elevenlabs')!, loadSfxStyle(), controller.signal).catch(err => {
            console.warn('[Narrator] SFX fetch failed (non-blocking):', err);
            return null;
          })
        : Promise.resolve(null);

      if (provider === 'speechify') {
        await playSpeechify(chunks, audioBlobs, controller.signal);
      } else {
        await playElevenLabs(chunks, audioBlobs, controller.signal);
      }

      // Concatenate all audio blobs
      const finalBlob = new Blob(audioBlobs, { type: 'audio/mpeg' });
      const url = URL.createObjectURL(finalBlob);
      blobUrlRef.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;

      // Start SFX playback alongside narration (lower volume, looping)
      const sfxBlob = await sfxPromise;
      if (sfxBlob) {
        const sfxUrl = URL.createObjectURL(sfxBlob);
        sfxBlobUrlRef.current = sfxUrl;
        const sfxAudio = new Audio(sfxUrl);
        sfxAudio.loop = true;
        sfxAudio.volume = 0.25;
        sfxAudioRef.current = sfxAudio;
      }

      audio.onended = () => {
        cleanupAudio();
      };

      audio.onerror = () => {
        toast.error('Audio playback failed');
        cleanupAudio();
      };

      audio.playbackRate = loadNarrationSpeed();
      setIsLoading(false);
      setIsPlaying(true);
      await audio.play();
      // Start ambient SFX after narration begins
      if (sfxAudioRef.current) {
        sfxAudioRef.current.play().catch(() => {});
      }
    } catch (error) {
      console.error('[Narrator] TTS error:', error);
      toast.error(error instanceof Error ? error.message : 'Narration failed');
      cleanupAudio();
    }
  }, [cleanupAudio]);

  return { isPlaying, isLoading, playMessage, stop, hasElevenLabsKey, hasSpeechifyKey, hasTTSKey };
}

// ── ElevenLabs provider ─────────────────────────────────────────────────────

async function playElevenLabs(chunks: string[], audioBlobs: Blob[], signal: AbortSignal) {
  const apiKey = loadApiKey('elevenlabs');
  const voiceId = loadSelectedVoiceId();

  if (!apiKey) {
    throw new Error('No ElevenLabs API key. Add one in Settings → API Keys.');
  }
  if (!voiceId) {
    throw new Error('No voice selected. Choose a narrator voice in Settings → ElevenLabs.');
  }

  const voiceSettings = loadVoiceSettings();

  for (let i = 0; i < chunks.length; i++) {
    const body: Record<string, unknown> = {
      text: chunks[i],
      voiceId,
      user_api_key: apiKey,
      voice_settings: voiceSettings,
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
        signal,
      }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'TTS request failed' }));
      throw new Error(err.error || `TTS failed: ${response.status}`);
    }

    const blob = await response.blob();
    audioBlobs.push(blob);
  }
}

// ── Speechify provider ──────────────────────────────────────────────────────

async function playSpeechify(chunks: string[], audioBlobs: Blob[], signal: AbortSignal) {
  const apiKey = loadApiKey('speechify');
  const voiceId = loadSpeechifyVoiceId();

  if (!apiKey) {
    throw new Error('No Speechify API key. Add one in Settings → API Keys.');
  }

  for (const chunk of chunks) {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/speechify-tts`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          text: chunk,
          voice_id: voiceId,
          user_api_key: apiKey,
          audio_format: 'mp3',
        }),
        signal,
      }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Speechify TTS request failed' }));
      throw new Error(err.error || `Speechify TTS failed: ${response.status}`);
    }

    const blob = await response.blob();
    audioBlobs.push(blob);
  }
}

// ── SFX provider ────────────────────────────────────────────────────────────

async function fetchSfxAudio(apiKey: string, stylePrompt: string, signal: AbortSignal): Promise<Blob> {
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-sfx`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({
        text: stylePrompt,
        user_api_key: apiKey,
        duration_seconds: 10,
        prompt_influence: 0.4,
      }),
      signal,
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'SFX request failed' }));
    throw new Error(err.error || `SFX failed: ${response.status}`);
  }

  return response.blob();
}
