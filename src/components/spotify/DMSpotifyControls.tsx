import { Play, Pause, SkipForward, SkipBack, Volume2, Music, Wifi, WifiOff } from 'lucide-react';
import { useSpotify } from '@/hooks/use-spotify';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

/**
 * Compact Spotify controls designed to embed inside DM settings panels.
 * Shows connect button when disconnected, playback + mood presets when connected.
 */
export function DMSpotifyControls() {
  const spotify = useSpotify();

  if (!spotify.connected) {
    return (
      <button
        onClick={spotify.connect}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/20 active:scale-[0.98] transition-colors min-h-[44px]"
        style={{ touchAction: 'manipulation' }}
      >
        <WifiOff className="w-4 h-4 text-muted-foreground shrink-0" />
        <div className="flex-1 text-left min-w-0">
          <span className="text-sm font-medium text-foreground">Connect Spotify</span>
          <p className="text-[11px] text-muted-foreground mt-0.5">Link your account for ambient music</p>
        </div>
      </button>
    );
  }

  return (
    <div className="px-3 py-2 space-y-3">
      {/* Now playing */}
      {spotify.playback ? (
        <div className="flex items-center gap-2.5">
          {spotify.playback.albumArt ? (
            <img src={spotify.playback.albumArt} alt="" className="w-10 h-10 rounded-md shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded-md bg-emerald-500/15 flex items-center justify-center shrink-0">
              <Music className="w-4 h-4 text-emerald-500" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate">{spotify.playback.trackName}</p>
            <p className="text-[10px] text-muted-foreground truncate">{spotify.playback.artistName}</p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-md bg-muted/30 flex items-center justify-center shrink-0">
            <Music className="w-4 h-4 text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground">No track playing</p>
        </div>
      )}

      {/* Playback controls */}
      <div className="flex items-center justify-center gap-2">
        <button onClick={spotify.previous} className="p-1.5 rounded-full hover:bg-muted/30 transition-colors">
          <SkipBack className="w-4 h-4" />
        </button>
        <button
          onClick={spotify.togglePlay}
          className="p-2 rounded-full bg-emerald-600 hover:bg-emerald-600/80 transition-colors"
        >
          {spotify.playback?.isPlaying ? (
            <Pause className="w-4 h-4 text-white" />
          ) : (
            <Play className="w-4 h-4 text-white" />
          )}
        </button>
        <button onClick={spotify.next} className="p-1.5 rounded-full hover:bg-muted/30 transition-colors">
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
          <p className="text-[9px] text-amber-500/80 text-center">Premium required for volume control</p>
        )}
      </div>

      {/* Mood presets */}
      {spotify.moodPresets.some(p => p.playlistUri) && (
        <div className="space-y-1">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Mood</p>
          <div className="flex flex-wrap gap-1.5">
            {spotify.moodPresets.filter(p => p.playlistUri).map(preset => (
              <button
                key={preset.id}
                onClick={() => spotify.playPlaylist(preset.playlistUri!)}
                className={cn(
                  "text-xs px-2.5 py-1 rounded-full border border-border/50 transition-colors",
                  "hover:bg-emerald-500/10 hover:border-emerald-500/30"
                )}
                title={preset.label}
              >
                {preset.emoji} <span className="text-[10px]">{preset.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Connection info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Wifi className="w-3 h-3 text-emerald-500" />
          <span className="text-[10px] text-muted-foreground">{spotify.userName}</span>
          {spotify.isPremium !== null && (
            <span className={cn(
              "text-[9px] px-1.5 py-0.5 rounded-full font-medium",
              spotify.isPremium
                ? "bg-emerald-500/15 text-emerald-400"
                : "bg-muted/30 text-muted-foreground"
            )}>
              {spotify.isPremium ? 'Premium' : 'Free'}
            </span>
          )}
        </div>
        <button
          onClick={spotify.disconnect}
          className="text-[10px] text-destructive/70 hover:text-destructive transition-colors"
        >
          Disconnect
        </button>
      </div>
    </div>
  );
}
