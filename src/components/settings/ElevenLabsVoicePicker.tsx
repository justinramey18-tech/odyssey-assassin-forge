import { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, Loader2, Play, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';
import { loadApiKey } from '@/lib/api-keys';
import { getCachedVoices, setCachedVoices, loadSelectedVoiceId, saveSelectedVoiceId, type CachedVoice } from '@/lib/tts-utils';
import { toast } from 'sonner';

export function ElevenLabsVoicePicker() {
  const [voices, setVoices] = useState<CachedVoice[]>(() => getCachedVoices() || []);
  const [selectedId, setSelectedId] = useState<string>(() => loadSelectedVoiceId() || '');
  const [isLoading, setIsLoading] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const cleanupPreview = useCallback(() => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setIsPreviewing(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => cleanupPreview, [cleanupPreview]);

  const retryCountRef = useRef(0);
  const MAX_RETRIES = 2;

  const fetchVoices = useCallback(async (isRetry = false) => {
    const apiKey = loadApiKey('elevenlabs');
    if (!apiKey) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-voices`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ user_api_key: apiKey }),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Failed to fetch voices' }));
        throw new Error(err.error || 'Failed to fetch voices');
      }

      const data = await response.json();
      const fetchedVoices: CachedVoice[] = data.voices || [];
      setVoices(fetchedVoices);
      setCachedVoices(fetchedVoices);
      retryCountRef.current = 0;
    } catch (error) {
      console.error('[VoicePicker] Fetch error:', error);
      if (!isRetry && retryCountRef.current < MAX_RETRIES) {
        retryCountRef.current += 1;
        const delay = retryCountRef.current * 2000;
        console.log(`[VoicePicker] Retrying in ${delay}ms (attempt ${retryCountRef.current}/${MAX_RETRIES})`);
        setTimeout(() => fetchVoices(true), delay);
        return; // keep isLoading true during retry
      }
      retryCountRef.current = 0;
      toast.error(error instanceof Error ? error.message : 'Failed to fetch voices');
    } finally {
      if (!retryCountRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  // Auto-fetch on mount if no cache
  useEffect(() => {
    if (voices.length === 0 && loadApiKey('elevenlabs')) {
      fetchVoices();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch voices when ElevenLabs API key changes
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.provider === 'elevenlabs') {
        // Clear stale cache from old key
        setCachedVoices([]);
        setVoices([]);
        setSelectedId('');
        if (loadApiKey('elevenlabs')) {
          fetchVoices();
        }
      }
    };
    window.addEventListener('api-key-changed', handler);
    return () => window.removeEventListener('api-key-changed', handler);
  }, [fetchVoices]);

  const handleSelect = useCallback((voiceId: string) => {
    setSelectedId(voiceId);
    saveSelectedVoiceId(voiceId);
  }, []);

  const handlePreview = useCallback(async () => {
    if (isPreviewing) {
      cleanupPreview();
      return;
    }

    // Try preview_url from cached voice data first
    const voice = voices.find(v => v.voice_id === selectedId);
    if (voice?.preview_url) {
      cleanupPreview();
      setIsPreviewing(true);
      try {
        const audio = new Audio(voice.preview_url);
        previewAudioRef.current = audio;
        audio.onended = () => setIsPreviewing(false);
        audio.onerror = (e) => {
          console.error('[VoicePicker] Preview playback error:', e);
          toast.error('Preview playback failed — check your audio output device');
          setIsPreviewing(false);
        };
        await audio.play();
      } catch (error) {
        console.error('[VoicePicker] Preview play() error:', error);
        toast.error(error instanceof DOMException ? `Audio error: ${error.message}` : 'Could not play preview');
        setIsPreviewing(false);
      }
      return;
    }

    // Fallback: generate a short sample via TTS edge function
    const apiKey = loadApiKey('elevenlabs');
    if (!apiKey || !selectedId) return;

    cleanupPreview();
    setIsPreviewing(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            text: 'The ancient dragon stirred in its lair, its eyes gleaming like molten gold in the darkness.',
            voiceId: selectedId,
            user_api_key: apiKey,
          }),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: `TTS error: ${response.status}` }));
        throw new Error(err.error || `Preview failed: ${response.status}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      previewUrlRef.current = url;

      const audio = new Audio(url);
      previewAudioRef.current = audio;
      audio.onended = () => cleanupPreview();
      audio.onerror = (e) => {
        console.error('[VoicePicker] Playback error:', e);
        toast.error('Audio playback failed — check your audio output');
        cleanupPreview();
      };
      await audio.play();
    } catch (error) {
      console.error('[VoicePicker] Voice preview error:', error);
      toast.error(error instanceof Error ? error.message : 'Voice preview failed');
      cleanupPreview();
    }
  }, [isPreviewing, selectedId, voices, cleanupPreview]);

  // Group voices by category
  const grouped = voices.reduce<Record<string, CachedVoice[]>>((acc, v) => {
    const cat = v.category || 'premade';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(v);
    return acc;
  }, {});

  const categoryLabels: Record<string, string> = {
    premade: 'Premade',
    cloned: 'Cloned',
    generated: 'Custom',
    professional: 'Professional',
  };

  const categoryOrder = ['cloned', 'generated', 'professional', 'premade'];
  const sortedCategories = categoryOrder.filter(c => grouped[c]?.length > 0);

  const hasApiKey = !!loadApiKey('elevenlabs');

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground">
          Narrator Voice
        </label>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => fetchVoices()}
          disabled={isLoading || !hasApiKey}
          className="h-6 px-1.5 text-muted-foreground hover:text-foreground"
        >
          {isLoading ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <RefreshCw className="w-3 h-3" />
          )}
        </Button>
      </div>

      {!hasApiKey ? (
        <p className="text-[10px] text-muted-foreground italic">
          Save an API key to load voices
        </p>
      ) : isLoading && voices.length === 0 ? (
        <p className="text-[10px] text-muted-foreground italic">
          Loading voices...
        </p>
      ) : (
        <div className="flex items-center gap-1.5">
          <div className="flex-1">
            <Select value={selectedId} onValueChange={handleSelect}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder={voices.length === 0 ? "Tap refresh to load voices" : "Choose a voice..."} />
              </SelectTrigger>
              <SelectContent>
                {sortedCategories.map(cat => (
                  <SelectGroup key={cat}>
                    <SelectLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {categoryLabels[cat] || cat}
                    </SelectLabel>
                    {grouped[cat].map(voice => (
                      <SelectItem key={voice.voice_id} value={voice.voice_id} className="text-xs">
                        {voice.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePreview}
            disabled={!selectedId}
            className="h-8 w-8 p-0 shrink-0"
            title={isPreviewing ? 'Stop preview' : 'Preview voice'}
          >
            {isPreviewing ? (
              <Square className="w-3 h-3" />
            ) : (
              <Play className="w-3 h-3" />
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
