import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Mic2, Search, Play, Square, RefreshCw, Plus, Trash2, Check, KeyRound, Eye, EyeOff, Volume2, Gauge, Wand2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { loadApiKey, saveApiKey, clearApiKey, maskKey } from '@/lib/api-keys';
import {
  loadVoiceCast, saveVoiceCast, getCachedSpeechifyVoices, setCachedSpeechifyVoices,
  loadSpeechifyVoiceId, saveSpeechifyVoiceId, loadSpeechifyDMVoiceId, saveSpeechifyDMVoiceId,
  loadNarrationSpeed, saveNarrationSpeed,
  type VoiceCastEntry, type CachedSpeechifyVoice,
} from '@/lib/tts-utils';
import { loadNarrationMusicVolume, saveNarrationMusicVolume } from '@/lib/narrationDucking';

const SAMPLE_LINE = 'The torchlight gutters. Something moves in the dark ahead of you.';

type PickerTarget =
  | { kind: 'narrator' }
  | { kind: 'dm' }
  | { kind: 'cast'; index: number };

function Panel({ title, icon: Icon, children, hint }: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-white/[0.03]">
        <Icon className="w-4 h-4 text-amber-400/80 shrink-0" />
        <span className="text-xs font-cinzel tracking-wide text-foreground">{title}</span>
      </div>
      <div className="p-3 space-y-3">
        {hint && <p className="text-[11px] text-white/45 leading-relaxed">{hint}</p>}
        {children}
      </div>
    </div>
  );
}

export interface VoicesTabProps {
  /** Names the app already knows about — offered as one-tap cast entries. */
  suggestedNames?: string[];
}

/**
 * Voice management for the character sheet: the Speechify key, the narrator and
 * DM voices, playback speed, how far the music ducks, and the character cast.
 */
export function VoicesTab({ suggestedNames = [] }: VoicesTabProps) {
  const [apiKey, setApiKeyState] = useState<string>(() => loadApiKey('speechify') || '');
  const [showKey, setShowKey] = useState(false);
  const [keyDraft, setKeyDraft] = useState('');

  const [voices, setVoices] = useState<CachedSpeechifyVoice[]>(() => getCachedSpeechifyVoices() ?? []);
  const [fetching, setFetching] = useState(false);

  const [narratorVoice, setNarratorVoice] = useState<string>(() => loadSpeechifyVoiceId());
  const [dmVoice, setDmVoice] = useState<string>(() => loadSpeechifyDMVoiceId());
  const [speed, setSpeed] = useState<number>(() => loadNarrationSpeed());
  const [musicVolume, setMusicVolume] = useState<number>(() => loadNarrationMusicVolume());

  const [cast, setCast] = useState<VoiceCastEntry[]>(() => loadVoiceCast());
  const [newName, setNewName] = useState('');

  const [picker, setPicker] = useState<PickerTarget | null>(null);
  const [query, setQuery] = useState('');
  const [previewing, setPreviewing] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => { saveVoiceCast(cast); }, [cast]);
  useEffect(() => () => {
    audioRef.current?.pause();
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);

  const voiceName = useCallback((id: string) => {
    if (!id) return 'Narrator voice';
    return voices.find(v => v.id === id)?.name || id;
  }, [voices]);

  // ── Key ───────────────────────────────────────────────────────────────────
  const saveKey = useCallback(() => {
    const value = keyDraft.trim();
    if (!value) { toast.error('Paste your Speechify key first'); return; }
    saveApiKey('speechify', value);
    setApiKeyState(value);
    setKeyDraft('');
    toast.success('Speechify key saved');
  }, [keyDraft]);

  const removeKey = useCallback(() => {
    clearApiKey('speechify');
    setApiKeyState('');
    toast.success('Speechify key removed');
  }, []);

  // ── Voice library ─────────────────────────────────────────────────────────
  const fetchVoices = useCallback(async () => {
    const key = loadApiKey('speechify');
    if (!key) { toast.error('Add your Speechify key first'); return; }
    setFetching(true);
    try {
      const { data, error } = await supabase.functions.invoke('speechify-voices', { body: { user_api_key: key } });
      if (error) throw error;
      const list: CachedSpeechifyVoice[] = data?.voices ?? [];
      setCachedSpeechifyVoices(list);
      setVoices(list);
      toast.success(`Loaded ${list.length} voice${list.length === 1 ? '' : 's'}`);
    } catch (err: any) {
      toast.error(err?.message || 'Could not load your voices');
    } finally {
      setFetching(false);
    }
  }, []);

  const stopPreview = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null; }
    setPreviewing(null);
  }, []);

  const preview = useCallback(async (voiceId: string) => {
    if (previewing === voiceId) { stopPreview(); return; }
    stopPreview();
    const key = loadApiKey('speechify');
    if (!key) { toast.error('Add your Speechify key first'); return; }
    setPreviewing(voiceId);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/speechify-tts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ text: SAMPLE_LINE, voice_id: voiceId, user_api_key: key, audio_format: 'mp3' }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Sample failed' }));
        throw new Error(err.error || `Sample failed: ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      const audio = new Audio(url);
      audio.playbackRate = speed;
      audio.onended = () => stopPreview();
      audio.onerror = () => stopPreview();
      audioRef.current = audio;
      await audio.play();
    } catch (err: any) {
      toast.error(err?.message || 'Could not play that sample');
      stopPreview();
    }
  }, [previewing, speed, stopPreview]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return voices;
    return voices.filter(v => v.name.toLowerCase().includes(q) || v.id.toLowerCase().includes(q) || (v.type || '').toLowerCase().includes(q));
  }, [voices, query]);

  const assign = useCallback((voiceId: string) => {
    if (!picker) return;
    if (picker.kind === 'narrator') { setNarratorVoice(voiceId); saveSpeechifyVoiceId(voiceId); }
    else if (picker.kind === 'dm') { setDmVoice(voiceId); saveSpeechifyDMVoiceId(voiceId); }
    else setCast(prev => prev.map((c, i) => (i === picker.index ? { ...c, voiceId } : c)));
    setPicker(null);
    setQuery('');
  }, [picker]);

  // ── Cast ──────────────────────────────────────────────────────────────────
  const addCast = useCallback((rawName: string) => {
    const name = rawName.trim();
    if (!name) { toast.error('Enter a character name'); return; }
    if (cast.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      toast.error(`${name} already has a voice slot`);
      return;
    }
    setCast(prev => [...prev, { name, voiceId: '' }]);
    setNewName('');
  }, [cast]);

  const suggestions = useMemo(() => {
    const seen = new Set(cast.map(c => c.name.toLowerCase()));
    const out: string[] = [];
    for (const n of suggestedNames) {
      const name = (n || '').trim();
      if (!name || seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      out.push(name);
    }
    return out.slice(0, 12);
  }, [suggestedNames, cast]);

  const pickerLabel = picker?.kind === 'narrator' ? 'Narrator voice'
    : picker?.kind === 'dm' ? 'DM (table talk) voice'
      : picker ? cast[picker.index]?.name ?? 'Character' : '';

  return (
    <div className="space-y-3">
      {/* Speechify key */}
      <Panel title="Speechify Account" icon={KeyRound} hint="Your key stays on this device and powers every voice below.">
        {apiKey ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <code className="flex-1 text-[11px] font-mono px-2 py-2 rounded-md bg-white/5 border border-white/10 truncate">
                {showKey ? apiKey : maskKey(apiKey)}
              </code>
              <Button
                size="icon" variant="ghost" className="h-10 w-10 shrink-0"
                style={{ touchAction: 'manipulation' }}
                onClick={() => setShowKey(s => !s)}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
              <Button
                size="icon" variant="ghost" className="h-10 w-10 shrink-0 text-destructive"
                style={{ touchAction: 'manipulation' }}
                onClick={removeKey}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            <Button
              variant="outline" className="w-full gap-2 min-h-[44px]"
              style={{ touchAction: 'manipulation' }}
              onClick={fetchVoices} disabled={fetching}
            >
              <RefreshCw className={cn('w-4 h-4', fetching && 'animate-spin')} />
              {fetching ? 'Loading voices…' : `Refresh voice library${voices.length ? ` (${voices.length})` : ''}`}
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Input
              value={keyDraft}
              onChange={(e) => setKeyDraft(e.target.value)}
              placeholder="Paste Speechify API key"
              className="h-11 text-xs font-mono"
              type="password"
            />
            <Button className="h-11 shrink-0" style={{ touchAction: 'manipulation' }} onClick={saveKey}>Save</Button>
          </div>
        )}
      </Panel>

      {/* Narrator + DM voices */}
      <Panel title="Narrator & DM" icon={Mic2} hint="The narrator reads the story. The DM voice reads the table-talk aside.">
        {[{ key: 'narrator' as const, label: 'Story narrator', value: narratorVoice },
          { key: 'dm' as const, label: 'DM table talk', value: dmVoice }].map(row => (
          <div key={row.key} className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-wider text-white/40">{row.label}</p>
              <p className="text-xs text-foreground truncate">{voiceName(row.value)}</p>
            </div>
            <Button
              size="sm" variant="outline" className="min-h-[44px] shrink-0"
              style={{ touchAction: 'manipulation' }}
              onClick={() => { setPicker({ kind: row.key }); setQuery(''); }}
            >
              Change
            </Button>
            <Button
              size="icon" variant="ghost" className="h-11 w-11 shrink-0"
              style={{ touchAction: 'manipulation' }}
              onClick={() => preview(row.value)}
              disabled={!row.value}
            >
              {previewing === row.value ? <Square className="w-4 h-4 text-amber-300" /> : <Play className="w-4 h-4" />}
            </Button>
          </div>
        ))}
      </Panel>

      {/* Playback */}
      <Panel title="Playback" icon={Gauge}>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] text-white/60">Narration speed</span>
            <span className="text-[11px] text-amber-300 font-mono">{speed.toFixed(2)}×</span>
          </div>
          <Slider
            value={[speed]} min={0.5} max={2} step={0.05}
            onValueChange={([v]) => setSpeed(v)}
            onValueCommit={([v]) => { saveNarrationSpeed(v); toast.success(`Narration speed ${v.toFixed(2)}×`); }}
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] text-white/60 flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5" /> Music volume while narrating
            </span>
            <span className="text-[11px] text-amber-300 font-mono">{musicVolume === 0 ? 'Pause' : `${musicVolume}%`}</span>
          </div>
          <Slider
            value={[musicVolume]} min={0} max={100} step={5}
            onValueChange={([v]) => setMusicVolume(v)}
            onValueCommit={([v]) => { saveNarrationMusicVolume(v); toast.success(v === 0 ? 'Music pauses during narration' : `Music drops to ${v}% during narration`); }}
          />
          <p className="text-[10px] text-white/35 mt-1.5">Spotify dips to this level while a clip plays, then returns to normal. Set to 0% to pause the music instead and resume it afterwards.</p>

        </div>
      </Panel>

      {/* Cast */}
      <Panel title="Character Voice Cast" icon={Wand2} hint="Give each hero and NPC their own voice. Tagged dialogue is read in that voice when you use Voice cast or Play all.">
        {suggestions.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] uppercase tracking-wider text-white/40">Suggested from your story</p>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map(name => (
                <button
                  key={name}
                  onClick={() => addCast(name)}
                  style={{ touchAction: 'manipulation' }}
                  className="px-2.5 py-2 rounded-lg border border-amber-900/40 bg-amber-500/10 text-[11px] text-amber-200 flex items-center gap-1 min-h-[36px]"
                >
                  <Plus className="w-3 h-3" /> {name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          {cast.length === 0 && (
            <p className="text-xs text-white/40 text-center py-3">No character voices assigned yet.</p>
          )}
          {cast.map((entry, i) => (
            <div key={`${entry.name}-${i}`} className="rounded-lg border border-white/10 bg-white/[0.03] p-2 space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  value={entry.name}
                  onChange={(e) => setCast(prev => prev.map((c, idx) => (idx === i ? { ...c, name: e.target.value } : c)))}
                  placeholder="Character name"
                  className="h-10 text-xs"
                />
                <Button
                  size="icon" variant="ghost" className="h-10 w-10 shrink-0 text-destructive"
                  style={{ touchAction: 'manipulation' }}
                  onClick={() => setCast(prev => prev.filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setPicker({ kind: 'cast', index: i }); setQuery(''); }}
                  style={{ touchAction: 'manipulation' }}
                  className="flex-1 min-h-[44px] text-left px-2.5 rounded-lg border border-white/10 bg-black/30 text-xs truncate"
                >
                  {entry.voiceId ? voiceName(entry.voiceId) : 'Narrator voice (default)'}
                </button>
                <Button
                  size="icon" variant="ghost" className="h-11 w-11 shrink-0"
                  style={{ touchAction: 'manipulation' }}
                  onClick={() => preview(entry.voiceId || narratorVoice)}
                >
                  {previewing === (entry.voiceId || narratorVoice) ? <Square className="w-4 h-4 text-amber-300" /> : <Play className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addCast(newName); }}
            placeholder="Add a character name…"
            className="h-11 text-xs"
          />
          <Button className="h-11 gap-1 shrink-0" style={{ touchAction: 'manipulation' }} onClick={() => addCast(newName)}>
            <Plus className="w-4 h-4" /> Add
          </Button>
        </div>
      </Panel>

      {/* Voice picker */}
      {picker && (
        <div className="fixed inset-0 z-[86] bg-black/85 backdrop-blur-sm flex flex-col">
          <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-3 border-b border-amber-900/30">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-white/40">Choose a voice for</p>
              <p className="text-sm font-cinzel text-amber-200 truncate">{pickerLabel}</p>
            </div>
            <Button variant="ghost" className="min-h-[44px]" style={{ touchAction: 'manipulation' }} onClick={() => { stopPreview(); setPicker(null); }}>
              Done
            </Button>
          </div>

          <div className="shrink-0 p-3 space-y-2 border-b border-white/10">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search voices…"
                className="h-11 pl-9 text-xs"
              />
            </div>
            {voices.length === 0 && (
              <Button variant="outline" className="w-full gap-2 min-h-[44px]" style={{ touchAction: 'manipulation' }} onClick={fetchVoices} disabled={fetching}>
                <RefreshCw className={cn('w-4 h-4', fetching && 'animate-spin')} />
                {fetching ? 'Loading…' : 'Load my Speechify voices'}
              </Button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {picker.kind === 'cast' && (
              <button
                onClick={() => assign('')}
                style={{ touchAction: 'manipulation' }}
                className="w-full text-left px-3 min-h-[52px] rounded-lg border border-white/10 bg-white/[0.03] text-xs flex items-center justify-between"
              >
                <span>Narrator voice (default)</span>
                {!cast[picker.index]?.voiceId && <Check className="w-4 h-4 text-amber-300" />}
              </button>
            )}
            {filtered.map(v => {
              const selected =
                picker.kind === 'narrator' ? narratorVoice === v.id
                  : picker.kind === 'dm' ? dmVoice === v.id
                    : cast[picker.index]?.voiceId === v.id;
              return (
                <div key={v.id} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-2">
                  <button
                    onClick={() => assign(v.id)}
                    style={{ touchAction: 'manipulation' }}
                    className="flex-1 min-w-0 text-left min-h-[44px] flex items-center gap-2"
                  >
                    <span className="w-8 h-8 shrink-0 rounded-full bg-amber-500/15 text-amber-200 text-xs font-cinzel flex items-center justify-center">
                      {v.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs text-foreground truncate">{v.name}</span>
                      {v.type && <Badge variant="outline" className="mt-0.5 text-[9px] py-0">{v.type}</Badge>}
                    </span>
                  </button>
                  {selected && <Check className="w-4 h-4 text-amber-300 shrink-0" />}
                  <Button
                    size="icon" variant="ghost" className="h-11 w-11 shrink-0"
                    style={{ touchAction: 'manipulation' }}
                    onClick={() => preview(v.id)}
                  >
                    {previewing === v.id ? <Square className="w-4 h-4 text-amber-300" /> : <Play className="w-4 h-4" />}
                  </Button>
                </div>
              );
            })}
            {voices.length > 0 && filtered.length === 0 && (
              <p className="text-xs text-white/40 text-center py-6">No voices match “{query}”.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
