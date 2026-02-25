import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';
import { loadApiKey } from '@/lib/api-keys';
import { getCachedVoices, setCachedVoices, loadSelectedVoiceId, saveSelectedVoiceId, type CachedVoice } from '@/lib/tts-utils';
import { toast } from 'sonner';

export function ElevenLabsVoicePicker() {
  const [voices, setVoices] = useState<CachedVoice[]>(() => getCachedVoices() || []);
  const [selectedId, setSelectedId] = useState<string>(() => loadSelectedVoiceId() || '');
  const [isLoading, setIsLoading] = useState(false);

  const fetchVoices = useCallback(async () => {
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
    } catch (error) {
      console.error('[VoicePicker] Fetch error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to fetch voices');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Auto-fetch on mount if no cache
  useEffect(() => {
    if (voices.length === 0 && loadApiKey('elevenlabs')) {
      fetchVoices();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelect = useCallback((voiceId: string) => {
    setSelectedId(voiceId);
    saveSelectedVoiceId(voiceId);
  }, []);

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

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground">
          Narrator Voice
        </label>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchVoices}
          disabled={isLoading}
          className="h-6 px-1.5 text-muted-foreground hover:text-foreground"
        >
          {isLoading ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <RefreshCw className="w-3 h-3" />
          )}
        </Button>
      </div>

      {voices.length > 0 ? (
        <Select value={selectedId} onValueChange={handleSelect}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Choose a voice..." />
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
      ) : (
        <p className="text-[10px] text-muted-foreground italic">
          {isLoading ? 'Loading voices...' : 'Save an API key to load voices'}
        </p>
      )}
    </div>
  );
}
