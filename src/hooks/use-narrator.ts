import { useState, useRef, useCallback, useEffect } from 'react';
import { loadApiKey } from '@/lib/api-keys';
import {
  stripMarkdownForTTS, splitTextForStitching,
  loadSelectedVoiceId, loadNarrationSpeed, loadVoiceSettings,
  loadTTSProvider, loadSpeechifyVoiceId,
} from '@/lib/tts-utils';
import { isSfxEnabled, loadSfxStyle } from '@/components/settings/SoundEffectsWidget';
import { isContextSfxEnabled } from '@/components/settings/SoundEffectsWidget';
import { loadSfxMode, fetchCustomSfxBlob } from '@/lib/custom-sfx';
import { toast } from 'sonner';

// ── SFX Prompt LRU Cache ────────────────────────────────────────────────────
const SFX_CACHE_MAX = 15;
const sfxBlobCache = new Map<string, Blob>();

function getCachedSfx(key: string): Blob | undefined {
  const blob = sfxBlobCache.get(key);
  if (blob) {
    // Move to end (most recent)
    sfxBlobCache.delete(key);
    sfxBlobCache.set(key, blob);
  }
  return blob;
}

function setCachedSfx(key: string, blob: Blob): void {
  if (sfxBlobCache.size >= SFX_CACHE_MAX) {
    // Evict oldest (first key)
    const oldest = sfxBlobCache.keys().next().value;
    if (oldest !== undefined) sfxBlobCache.delete(oldest);
  }
  sfxBlobCache.set(key, blob);
}

// ── Hook ────────────────────────────────────────────────────────────────────

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

  useEffect(() => {
    return () => { cleanupAudio(); };
  }, [cleanupAudio]);

  const stop = useCallback(() => { cleanupAudio(); }, [cleanupAudio]);

  const playMessage = useCallback(async (rawText: string) => {
    const provider = loadTTSProvider();
    cleanupAudio();
    setIsLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const cleanText = stripMarkdownForTTS(rawText);
      const chunks = splitTextForStitching(cleanText, 5000);

      const audioBlobs: Blob[] = [];

      // Build SFX promise — context-aware or static
      const sfxPromise = buildSfxPromise(provider, rawText, controller.signal);

      if (provider === 'speechify') {
        await playSpeechify(chunks, audioBlobs, controller.signal);
      } else {
        await playElevenLabs(chunks, audioBlobs, controller.signal);
      }

      const finalBlob = new Blob(audioBlobs, { type: 'audio/mpeg' });
      const url = URL.createObjectURL(finalBlob);
      blobUrlRef.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;

      // Start SFX playback alongside narration
      const sfxBlob = await sfxPromise;
      if (sfxBlob) {
        const sfxUrl = URL.createObjectURL(sfxBlob);
        sfxBlobUrlRef.current = sfxUrl;
        const sfxAudio = new Audio(sfxUrl);
        sfxAudio.loop = true;
        sfxAudio.volume = 0.25;
        sfxAudioRef.current = sfxAudio;
      }

      audio.onended = () => { cleanupAudio(); };
      audio.onerror = () => {
        toast.error('Audio playback failed');
        cleanupAudio();
      };

      audio.playbackRate = loadNarrationSpeed();
      setIsLoading(false);
      setIsPlaying(true);
      await audio.play();
      const downloadBlob = finalBlob;
      toast('Narration audio ready', {
        description: 'Download the MP3?',
        action: {
          label: 'Download',
          onClick: () => {
            const a = document.createElement('a');
            const dlUrl = URL.createObjectURL(downloadBlob);
            a.href = dlUrl;
            a.download = `narration-${new Date().toISOString().slice(0, 10)}.mp3`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(dlUrl);
          },
        },
        duration: 10000,
      });
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

// ── SFX builder ─────────────────────────────────────────────────────────────

function buildSfxPromise(provider: string, narrativeText: string, signal: AbortSignal): Promise<Blob | null> {
  if (!isSfxEnabled()) return Promise.resolve(null);

  const mode = loadSfxMode();

  // Custom upload mode — no API key needed
  if (mode === 'custom') {
    return fetchCustomSfxBlob(signal).catch(err => {
      console.warn('[Narrator] Custom SFX load failed:', err);
      return null;
    });
  }

  // ElevenLabs modes require API key
  if (provider !== 'elevenlabs') return Promise.resolve(null);
  const apiKey = loadApiKey('elevenlabs');
  if (!apiKey) return Promise.resolve(null);

  if (mode === 'context') {
    return fetchContextAwareSfx(apiKey, narrativeText, signal).catch(err => {
      console.warn('[Narrator] Context SFX failed, falling back to static:', err);
      return fetchSfxAudio(apiKey, loadSfxStyle(), signal).catch(() => null);
    });
  } else {
    return fetchSfxAudio(apiKey, loadSfxStyle(), signal).catch(err => {
      console.warn('[Narrator] SFX fetch failed (non-blocking):', err);
      return null;
    });
  }
}

async function fetchContextAwareSfx(apiKey: string, narrativeText: string, signal: AbortSignal): Promise<Blob | null> {
  // Step 1: Get AI-generated SFX prompt
  const promptResponse = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/detect-sfx-prompt`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ text: narrativeText }),
      signal,
    }
  );

  if (!promptResponse.ok) {
    const err = await promptResponse.json().catch(() => ({ error: 'SFX prompt detection failed' }));
    throw new Error(err.error || `SFX prompt failed: ${promptResponse.status}`);
  }

  const { sfx_prompt } = await promptResponse.json();
  if (!sfx_prompt) throw new Error('No SFX prompt returned');

  console.log('[Narrator] Context SFX prompt:', sfx_prompt);

  // Step 2: Check cache
  const cached = getCachedSfx(sfx_prompt);
  if (cached) {
    console.log('[Narrator] SFX cache hit');
    return cached;
  }

  // Step 3: Generate SFX audio
  const blob = await fetchSfxAudio(apiKey, sfx_prompt, signal);
  setCachedSfx(sfx_prompt, blob);
  return blob;
}

// ── ElevenLabs provider ─────────────────────────────────────────────────────

async function playElevenLabs(chunks: string[], audioBlobs: Blob[], signal: AbortSignal) {
  const apiKey = loadApiKey('elevenlabs');
  const voiceId = loadSelectedVoiceId();

  if (!apiKey) throw new Error('No ElevenLabs API key. Add one in Settings → API Keys.');
  if (!voiceId) throw new Error('No voice selected. Choose a narrator voice in Settings → ElevenLabs.');

  const voiceSettings = loadVoiceSettings();

  for (let i = 0; i < chunks.length; i++) {
    const body: Record<string, unknown> = {
      text: chunks[i],
      voiceId,
      user_api_key: apiKey,
      voice_settings: voiceSettings,
    };

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

  if (!apiKey) throw new Error('No Speechify API key. Add one in Settings → API Keys.');

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
