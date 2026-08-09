import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { loadApiKey } from '@/lib/api-keys';
import {
  loadVoiceCast, saveVoiceCast, getCachedSpeechifyVoices, setCachedSpeechifyVoices,
  type VoiceCastEntry, type CachedSpeechifyVoice,
} from '@/lib/tts-utils';

/**
 * Maps character / NPC names to Speechify voices so tagged dialogue in DM
 * responses is narrated in that speaker's own voice.
 */
export function VoiceCastPanel() {
  const [cast, setCast] = useState<VoiceCastEntry[]>(() => loadVoiceCast());
  const [voices, setVoices] = useState<CachedSpeechifyVoice[]>(() => getCachedSpeechifyVoices() ?? []);
  const [fetching, setFetching] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => { saveVoiceCast(cast); }, [cast]);

  const fetchVoices = useCallback(async () => {
    const key = loadApiKey('speechify');
    if (!key) { toast.error('Add your Speechify API key first'); return; }
    setFetching(true);
    try {
      const { data, error } = await supabase.functions.invoke('speechify-voices', { body: { user_api_key: key } });
      if (error) throw error;
      const list: CachedSpeechifyVoice[] = data?.voices ?? [];
      setCachedSpeechifyVoices(list);
      setVoices(list);
      toast.success(`Loaded ${list.length} voice(s)`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to fetch Speechify voices');
    } finally {
      setFetching(false);
    }
  }, []);

  const addEntry = useCallback(() => {
    const name = newName.trim();
    if (!name) { toast.error('Enter a character name'); return; }
    if (cast.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      toast.error('That character already has a voice');
      return;
    }
    setCast((prev) => [...prev, { name, voiceId: '' }]);
    setNewName('');
  }, [newName, cast]);

  const update = useCallback((index: number, patch: Partial<VoiceCastEntry>) => {
    setCast((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }, []);

  const removeEntry = useCallback((index: number) => {
    setCast((prev) => prev.filter((_, i) => i !== index));
  }, []);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Assign a voice to each character. When the DM tags their dialogue, "Voice cast" renders each line
        in that voice and "Play all" plays them in story order.
      </p>

      <Button size="sm" variant="outline" className="w-full gap-1.5" onClick={fetchVoices} disabled={fetching}>
        <RefreshCw className={`w-3 h-3 ${fetching ? 'animate-spin' : ''}`} />
        {fetching ? 'Loading…' : 'Fetch My Voices'}
      </Button>

      <div className="space-y-2">
        {cast.map((entry, i) => (
          <div key={`${entry.name}-${i}`} className="p-2 rounded-md border border-border/40 bg-muted/10 space-y-2">
            <div className="flex items-center gap-2">
              <Input
                value={entry.name}
                onChange={(e) => update(i, { name: e.target.value })}
                placeholder="Character name"
                className="h-8 text-xs"
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0 text-destructive"
                style={{ touchAction: 'manipulation' }}
                onClick={() => removeEntry(i)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
            {voices.length > 0 ? (
              <select
                value={voices.some((v) => v.id === entry.voiceId) ? entry.voiceId : ''}
                onChange={(e) => update(i, { voiceId: e.target.value })}
                className="w-full h-8 text-xs rounded-md bg-background border border-border/40 px-2"
              >
                <option value="">Narrator voice (default)</option>
                {voices.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}{v.type ? ` · ${v.type}` : ''}</option>
                ))}
              </select>
            ) : null}
            <Input
              value={entry.voiceId}
              onChange={(e) => update(i, { voiceId: e.target.value.trim() })}
              placeholder="Speechify voice ID"
              className="h-8 text-[11px] font-mono"
            />
          </div>
        ))}
        {cast.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-3">No character voices assigned yet.</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') addEntry(); }}
          placeholder="Add a character name…"
          className="h-8 text-xs"
        />
        <Button size="sm" className="h-8 gap-1" style={{ touchAction: 'manipulation' }} onClick={addEntry}>
          <Plus className="w-3.5 h-3.5" /> Add
        </Button>
      </div>
    </div>
  );
}
