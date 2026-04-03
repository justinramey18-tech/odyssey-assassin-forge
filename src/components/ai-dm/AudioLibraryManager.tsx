import { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, Upload, Play, Trash2, Check, Music, Volume2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const BUCKET = 'cinematic-audio';

const SFX_SLOTS = [
  'dragon-roar', 'thunder', 'sword-clash', 'heartbeat', 'signet-crackle',
  'explosion', 'door-creak', 'crowd-gasp', 'arrow-impact', 'ward-hum',
  'bone-snap', 'fire-whoosh', 'horse-gallop', 'bell-toll', 'whisper',
];

const AMBIENCE_SLOTS = [
  'rain', 'wind', 'tavern', 'forest', 'combat-drums',
  'tension-drone', 'campfire', 'dungeon', 'crowd', 'flying',
];

interface AudioLibraryManagerProps {
  onBack: () => void;
}

export function AudioLibraryManager({ onBack }: AudioLibraryManagerProps) {
  const [uploadedFiles, setUploadedFiles] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingSlotRef = useRef<string | null>(null);

  // Load list of existing files from the bucket
  const loadFiles = useCallback(async () => {
    try {
      setLoading(true);
      const found = new Set<string>();

      const { data: sfxFiles } = await supabase.storage.from(BUCKET).list('sfx');
      if (sfxFiles) {
        for (const f of sfxFiles) {
          const name = f.name.replace(/\.mp3$/i, '');
          found.add(`sfx/${name}`);
        }
      }

      const { data: ambFiles } = await supabase.storage.from(BUCKET).list('ambience');
      if (ambFiles) {
        for (const f of ambFiles) {
          const name = f.name.replace(/\.mp3$/i, '');
          found.add(`ambience/${name}`);
        }
      }

      setUploadedFiles(found);
    } catch (err) {
      console.error('Failed to load audio library:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  const getPublicUrl = (path: string) => {
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data?.publicUrl ?? '';
  };

  const handleUploadClick = (category: string, name: string) => {
    pendingSlotRef.current = `${category}/${name}`;
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const slot = pendingSlotRef.current;
    if (!file || !slot) return;

    // Reset input so the same file can be re-selected
    e.target.value = '';

    if (!file.type.startsWith('audio/')) {
      toast.error('Please select an audio file (.mp3)');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File must be under 10MB');
      return;
    }

    setUploading(slot);
    try {
      const filePath = `${slot}.mp3`;

      // Delete existing first
      await supabase.storage.from(BUCKET).remove([filePath]);

      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, file, { upsert: true, contentType: 'audio/mpeg' });

      if (error) throw error;

      setUploadedFiles(prev => new Set([...prev, slot]));
      toast.success(`Uploaded ${slot.split('/')[1]}`);
    } catch (err: any) {
      toast.error(err?.message || 'Upload failed');
    } finally {
      setUploading(null);
    }
  };

  const handleDelete = async (category: string, name: string) => {
    const slot = `${category}/${name}`;
    const filePath = `${slot}.mp3`;

    try {
      await supabase.storage.from(BUCKET).remove([filePath]);
      setUploadedFiles(prev => {
        const next = new Set(prev);
        next.delete(slot);
        return next;
      });
      toast.success(`Deleted ${name}`);
    } catch (err: any) {
      toast.error(err?.message || 'Delete failed');
    }
  };

  const handlePreview = (category: string, name: string) => {
    const slot = `${category}/${name}`;

    // Stop current playback
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    if (playing === slot) {
      setPlaying(null);
      return;
    }

    const url = getPublicUrl(`${slot}.mp3`);
    const audio = new Audio(url);
    audioRef.current = audio;
    setPlaying(slot);

    audio.play().catch(() => toast.error('Could not play audio'));
    audio.onended = () => { setPlaying(null); audioRef.current = null; };

    // Auto-stop after 8 seconds for ambience previews
    if (category === 'ambience') {
      setTimeout(() => {
        if (audioRef.current === audio) {
          audio.pause();
          setPlaying(null);
          audioRef.current = null;
        }
      }, 8000);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const renderSlot = (category: string, name: string) => {
    const slot = `${category}/${name}`;
    const hasFile = uploadedFiles.has(slot);
    const isUploading = uploading === slot;
    const isPlaying = playing === slot;
    const displayName = name.replace(/-/g, ' ');

    return (
      <div
        key={slot}
        className={cn(
          'flex items-center justify-between px-4 py-2.5 border-b border-white/5',
          hasFile ? 'bg-amber-500/5' : '',
        )}
      >
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          {hasFile ? (
            <Check className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
          ) : (
            <div className="w-3.5 h-3.5 rounded-full border border-white/20 flex-shrink-0" />
          )}
          <span className="text-sm text-white/80 truncate capitalize">{displayName}</span>
        </div>

        <div className="flex items-center gap-1.5">
          {hasFile && (
            <>
              <button
                onClick={() => handlePreview(category, name)}
                className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
                  isPlaying ? 'bg-amber-500/30 text-amber-300' : 'bg-white/5 text-white/40 hover:text-white/70',
                )}
                style={{ touchAction: 'manipulation' }}
              >
                <Play className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleDelete(category, name)}
                className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/5 text-red-400/60 hover:text-red-400 transition-colors"
                style={{ touchAction: 'manipulation' }}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          <button
            onClick={() => handleUploadClick(category, name)}
            disabled={isUploading}
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
              isUploading ? 'bg-amber-500/20 text-amber-300 animate-pulse' : 'bg-purple-500/20 text-purple-300 hover:bg-purple-500/30',
            )}
            style={{ touchAction: 'manipulation' }}
          >
            <Upload className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  const sfxCount = SFX_SLOTS.filter(s => uploadedFiles.has(`sfx/${s}`)).length;
  const ambCount = AMBIENCE_SLOTS.filter(s => uploadedFiles.has(`ambience/${s}`)).length;

  return (
    <div className="fixed inset-0 z-[66] bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-amber-900/30 bg-black/30">
        <button
          onClick={onBack}
          className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/5 text-white/60 hover:text-white transition-colors"
          style={{ touchAction: 'manipulation' }}
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-base font-cinzel text-amber-300">Audio Library</h2>
          <p className="text-[10px] text-white/40">
            {sfxCount}/{SFX_SLOTS.length} SFX · {ambCount}/{AMBIENCE_SLOTS.length} Ambience
          </p>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/mpeg,audio/mp3,audio/*"
        className="hidden"
        onChange={handleFileSelected}
      />

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* SFX Section */}
            <div className="px-4 py-2.5 bg-black/20 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs font-cinzel font-semibold text-amber-300 tracking-wider uppercase">
                  Sound Effects
                </span>
                <span className="text-[10px] text-white/30 ml-auto">{sfxCount}/{SFX_SLOTS.length}</span>
              </div>
            </div>
            {SFX_SLOTS.map(name => renderSlot('sfx', name))}

            {/* Ambience Section */}
            <div className="px-4 py-2.5 bg-black/20 border-b border-white/5 mt-2">
              <div className="flex items-center gap-2">
                <Music className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-xs font-cinzel font-semibold text-blue-300 tracking-wider uppercase">
                  Ambience Loops
                </span>
                <span className="text-[10px] text-white/30 ml-auto">{ambCount}/{AMBIENCE_SLOTS.length}</span>
              </div>
            </div>
            {AMBIENCE_SLOTS.map(name => renderSlot('ambience', name))}

            {/* Bottom padding */}
            <div className="h-8" />
          </>
        )}
      </div>
    </div>
  );
}
