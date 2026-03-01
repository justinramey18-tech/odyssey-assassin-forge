import { useState } from 'react';
import { Play, Pause, SkipForward, SkipBack, Volume2, ChevronDown, ChevronUp, Music } from 'lucide-react';
import { useSpotify } from '@/hooks/use-spotify';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

export function SpotifyPlayer() {
  const spotify = useSpotify();
  const [expanded, setExpanded] = useState(false);

  if (!spotify.connected || !spotify.playback) return null;

  return (
    <div className={cn(
      "fixed bottom-16 right-3 z-50 rounded-xl border border-border/60 bg-card/95 backdrop-blur-md shadow-lg transition-all",
      expanded ? "w-72" : "w-56"
    )}>
      {/* Compact view */}
      <div className="flex items-center gap-2 p-2">
        {spotify.playback.albumArt ? (
          <img src={spotify.playback.albumArt} alt="" className="w-9 h-9 rounded-md shrink-0" />
        ) : (
          <div className="w-9 h-9 rounded-md bg-[#1DB954]/20 flex items-center justify-center shrink-0">
            <Music className="w-4 h-4 text-[#1DB954]" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate">{spotify.playback.trackName}</p>
          <p className="text-[10px] text-muted-foreground truncate">{spotify.playback.artistName}</p>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <button onClick={spotify.togglePlay} className="p-1.5 rounded-full hover:bg-muted/50 transition-colors">
            {spotify.playback.isPlaying ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4" />
            )}
          </button>
          <button onClick={spotify.next} className="p-1 rounded-full hover:bg-muted/50 transition-colors">
            <SkipForward className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setExpanded(!expanded)} className="p-1 rounded-full hover:bg-muted/50 transition-colors">
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Expanded controls */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-border/30 pt-2">
          {/* Playback controls */}
          <div className="flex items-center justify-center gap-3">
            <button onClick={spotify.previous} className="p-1.5 rounded-full hover:bg-muted/50 transition-colors">
              <SkipBack className="w-4 h-4" />
            </button>
            <button onClick={spotify.togglePlay} className="p-2 rounded-full bg-[#1DB954] hover:bg-[#1DB954]/80 transition-colors">
              {spotify.playback.isPlaying ? (
                <Pause className="w-5 h-5 text-white" />
              ) : (
                <Play className="w-5 h-5 text-white" />
              )}
            </button>
            <button onClick={spotify.next} className="p-1.5 rounded-full hover:bg-muted/50 transition-colors">
              <SkipForward className="w-4 h-4" />
            </button>
          </div>

          {/* Volume */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Volume2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <Slider
                value={[spotify.volume]}
                onValueChange={([v]) => spotify.changeVolume(v)}
                max={100}
                step={1}
                className="flex-1"
                disabled={spotify.isPremium === false}
              />
              <span className="text-[10px] text-muted-foreground w-6 text-right">{spotify.volume}</span>
            </div>
            {spotify.isPremium === false && (
              <p className="text-[9px] text-yellow-500/80 text-center">Premium required for volume control</p>
            )}
          </div>

          {/* Mood quick-select */}
          <div className="flex flex-wrap gap-1">
            {spotify.moodPresets.filter(p => p.playlistUri).map(preset => (
              <button
                key={preset.id}
                onClick={() => spotify.playPlaylist(preset.playlistUri!)}
                className="text-xs px-2 py-1 rounded-full border border-border/50 hover:bg-[#1DB954]/10 hover:border-[#1DB954]/30 transition-colors"
                title={preset.label}
              >
                {preset.emoji}
              </button>
            ))}
          </div>

          <p className="text-[10px] text-muted-foreground text-center">
            {spotify.playback.deviceName}
          </p>
        </div>
      )}
    </div>
  );
}
