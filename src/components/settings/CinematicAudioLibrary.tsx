import { useState, useRef, useCallback, useEffect } from 'react';
import { Play, Square, Upload, Trash2, Volume2, RefreshCw, Music } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const BUCKET = 'cinematic-audio';

const SFX_SLOTS = [
  { name: 'dragon-roar', label: 'Dragon Roar' },
  { name: 'sword-clash', label: 'Sword Clash' },
  { name: 'thunder', label: 'Thunder' },
  { name: 'signet-crackle', label: 'Signet Crackle' },
  { name: 'ward-hum', label: 'Ward Hum' },
  { name: 'bone-snap', label: 'Bone Snap' },
  { name: 'fire-whoosh', label: 'Fire Whoosh' },
  { name: 'horse-gallop', label: 'Horse Gallop' },
  { name: 'bell-toll', label: 'Bell Toll' },
  { name: 'whisper', label: 'Whisper' },
  { name: 'arrow-hit', label: 'Arrow Hit' },
  { name: 'magic-cast', label: 'Magic Cast' },
  { name: 'door-creak', label: 'Door Creak' },
  { name: 'coin-drop', label: 'Coin Drop' },
  { name: 'explosion', label: 'Explosion' },
];

const AMBIENCE_SLOTS = [
  { name: 'rain', label: 'Rain' },
  { name: 'wind', label: 'Wind' },
  { name: 'tavern', label: 'Tavern' },
  { name: 'forest', label: 'Forest' },
  { name: 'combat-drums', label: 'Combat Drums' },
  { name: 'tension-drone', label: 'Tension Drone' },
  { name: 'campfire', label: 'Campfire' },
  { name: 'dungeon', label: 'Dungeon' },
  { name: 'crowd', label: 'Crowd' },
  { name: 'flying', label: 'Flying' },
];

function buildPublicUrl(path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

type SlotStatus = 'empty' | 'loaded' | 'checking';

interface AudioSlotProps {
  category: 'sfx' | 'ambience';
  name: string;
  label: string;
  status: SlotStatus;
  isPlaying: boolean;
  onPlay: () => void;
  onStop: () => void;
  onUpload: (file: File) => void;
  onDelete: () => void;
  uploading: boolean;
  deleting: boolean;
}

function AudioSlot({ category, name, label, status, isPlaying, onPlay, onStop, onUpload, onDelete, uploading, deleting }: AudioSlotProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className={cn(
      "flex items-center gap-2 p-2.5 rounded-lg border transition-colors min-h-[48px]",
      status === 'loaded' ? "border-primary/30 bg-primary/5" : "border-border/30 bg-muted/10",
    )}>
      {/* Play/Stop */}
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 shrink-0"
        disabled={status !== 'loaded' || uploading || deleting}
        onClick={isPlaying ? onStop : onPlay}
      >
        {isPlaying ? (
          <Square className="w-4 h-4 text-red-400" />
        ) : (
          <Play className="w-4 h-4 text-primary" />
        )}
      </Button>

      {/* Label + status */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{label}</p>
        <p className="text-[11px] text-muted-foreground">
          {status === 'checking' ? 'Checking...' : status === 'loaded' ? '✓ Audio loaded' : 'Empty slot'}
        </p>
      </div>

      {/* Upload */}
      <input
        ref={fileRef}
        type="file"
        accept="audio/mpeg,audio/mp3"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpload(f);
          e.target.value = '';
        }}
      />
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 shrink-0"
        disabled={uploading || deleting}
        onClick={() => fileRef.current?.click()}
        title="Upload MP3"
      >
        {uploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4 text-muted-foreground" />}
      </Button>

      {/* Delete */}
      {status === 'loaded' && (
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 hover:text-destructive"
          disabled={uploading || deleting}
          onClick={onDelete}
          title="Delete"
        >
          {deleting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
        </Button>
      )}
    </div>
  );
}

export function CinematicAudioLibrary() {
  const [statuses, setStatuses] = useState<Record<string, SlotStatus>>({});
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Check which slots have files
  const checkStatuses = useCallback(async () => {
    const allSlots = [
      ...SFX_SLOTS.map(s => ({ category: 'sfx' as const, ...s })),
      ...AMBIENCE_SLOTS.map(s => ({ category: 'ambience' as const, ...s })),
    ];

    // Set all to checking
    const checking: Record<string, SlotStatus> = {};
    allSlots.forEach(s => { checking[`${s.category}/${s.name}`] = 'checking'; });
    setStatuses(checking);

    // Check each by HEAD request to public URL
    const results: Record<string, SlotStatus> = {};
    await Promise.all(allSlots.map(async (slot) => {
      const key = `${slot.category}/${slot.name}`;
      try {
        const resp = await fetch(buildPublicUrl(`${key}.mp3`), { method: 'HEAD' });
        results[key] = resp.ok ? 'loaded' : 'empty';
      } catch {
        results[key] = 'empty';
      }
    }));

    setStatuses(results);
  }, []);

  useEffect(() => { checkStatuses(); }, [checkStatuses]);

  const stopPlaying = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    setPlayingKey(null);
  }, []);

  const handlePlay = useCallback((key: string) => {
    stopPlaying();
    const url = buildPublicUrl(`${key}.mp3`);
    const audio = new Audio(url);
    audio.onended = () => setPlayingKey(null);
    audio.onerror = () => { setPlayingKey(null); toast.error('Failed to play audio'); };
    audio.play().catch(() => toast.error('Failed to play audio'));
    audioRef.current = audio;
    setPlayingKey(key);
  }, [stopPlaying]);

  const handleUpload = useCallback(async (category: string, name: string, file: File) => {
    const key = `${category}/${name}`;
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File must be under 10MB');
      return;
    }
    if (!file.type.includes('audio')) {
      toast.error('Only audio files allowed');
      return;
    }

    setUploadingKey(key);
    try {
      const path = `${key}.mp3`;
      // Remove existing first
      await supabase.storage.from(BUCKET).remove([path]);
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: 'audio/mpeg',
        upsert: true,
      });
      if (error) throw error;
      setStatuses(prev => ({ ...prev, [key]: 'loaded' }));
      toast.success(`Uploaded ${name}`);
    } catch (e: any) {
      toast.error(e.message || 'Upload failed');
    } finally {
      setUploadingKey(null);
    }
  }, []);

  const handleDelete = useCallback(async (category: string, name: string) => {
    const key = `${category}/${name}`;
    if (playingKey === key) stopPlaying();
    setDeletingKey(key);
    try {
      const { error } = await supabase.storage.from(BUCKET).remove([`${key}.mp3`]);
      if (error) throw error;
      setStatuses(prev => ({ ...prev, [key]: 'empty' }));
      toast.success(`Deleted ${name}`);
    } catch (e: any) {
      toast.error(e.message || 'Delete failed');
    } finally {
      setDeletingKey(null);
    }
  }, [playingKey, stopPlaying]);

  // Cleanup audio on unmount
  useEffect(() => () => { stopPlaying(); }, [stopPlaying]);

  const sfxLoaded = SFX_SLOTS.filter(s => statuses[`sfx/${s.name}`] === 'loaded').length;
  const ambienceLoaded = AMBIENCE_SLOTS.filter(s => statuses[`ambience/${s.name}`] === 'loaded').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {sfxLoaded}/{SFX_SLOTS.length} SFX · {ambienceLoaded}/{AMBIENCE_SLOTS.length} Ambience
        </p>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={checkStatuses}>
          <RefreshCw className="w-3 h-3" /> Refresh
        </Button>
      </div>

      {/* SFX Section */}
      <div className="space-y-1.5">
        <h4 className="text-xs font-cinzel font-semibold text-primary flex items-center gap-1.5">
          <Volume2 className="w-3.5 h-3.5" /> Sound Effects
        </h4>
        <div className="space-y-1">
          {SFX_SLOTS.map(slot => {
            const key = `sfx/${slot.name}`;
            return (
              <AudioSlot
                key={key}
                category="sfx"
                name={slot.name}
                label={slot.label}
                status={statuses[key] || 'checking'}
                isPlaying={playingKey === key}
                onPlay={() => handlePlay(key)}
                onStop={stopPlaying}
                onUpload={(file) => handleUpload('sfx', slot.name, file)}
                onDelete={() => handleDelete('sfx', slot.name)}
                uploading={uploadingKey === key}
                deleting={deletingKey === key}
              />
            );
          })}
        </div>
      </div>

      {/* Ambience Section */}
      <div className="space-y-1.5">
        <h4 className="text-xs font-cinzel font-semibold text-primary flex items-center gap-1.5">
          <Music className="w-3.5 h-3.5" /> Ambience Loops
        </h4>
        <div className="space-y-1">
          {AMBIENCE_SLOTS.map(slot => {
            const key = `ambience/${slot.name}`;
            return (
              <AudioSlot
                key={key}
                category="ambience"
                name={slot.name}
                label={slot.label}
                status={statuses[key] || 'checking'}
                isPlaying={playingKey === key}
                onPlay={() => handlePlay(key)}
                onStop={stopPlaying}
                onUpload={(file) => handleUpload('ambience', slot.name, file)}
                onDelete={() => handleDelete('ambience', slot.name)}
                uploading={uploadingKey === key}
                deleting={deletingKey === key}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
