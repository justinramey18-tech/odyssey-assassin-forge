import { useState } from 'react';
import { Play, Pause, SkipForward, SkipBack, Volume2, Music, Wifi, WifiOff, Plus, Trash2, X, Sparkles, Monitor, Link, Unlink } from 'lucide-react';
import { useSpotify } from '@/hooks/use-spotify';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { MoodPreset } from '@/lib/spotify';

function PresetPill({ preset, spotify }: { preset: MoodPreset; spotify: ReturnType<typeof useSpotify> }) {
  const [linkInput, setLinkInput] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [open, setOpen] = useState(false);

  const handleAssign = async () => {
    if (!linkInput.trim()) return;
    setIsAssigning(true);
    const ok = await spotify.assignPlaylistToPreset(preset.id, linkInput.trim());
    setIsAssigning(false);
    if (ok) {
      setLinkInput('');
      setOpen(false);
    }
  };

  const handlePlay = () => {
    if (preset.playlistUri) {
      spotify.playPlaylist(preset.playlistUri);
    } else {
      spotify.searchAndAssignPreset(preset.id);
    }
  };

  return (
    <div className="group relative">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            onClick={(e) => {
              // Single click = play, long press handled by popover
              // We use onContextMenu-like UX: tap plays, the popover trigger wraps for edit
            }}
            onDoubleClick={() => setOpen(true)}
            disabled={spotify.isSearching}
            className={cn(
              "text-xs px-2.5 py-1 rounded-full border transition-colors flex items-center gap-1",
              preset.playlistUri
                ? "border-border/50 hover:bg-emerald-500/10 hover:border-emerald-500/30"
                : "border-dashed border-muted-foreground/30 hover:border-muted-foreground/50 text-muted-foreground"
            )}
            title={preset.playlistUri ? `Play: ${preset.playlistName} (double-tap to edit)` : `Tap to search, double-tap to paste link`}
          >
            {preset.emoji} <span className="text-[10px]">{preset.label}</span>
            {preset.playlistUri && preset.playlistName && (
              <Link className="w-2.5 h-2.5 text-emerald-500 shrink-0" />
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3 space-y-2" side="top" align="start">
          <div className="space-y-1">
            <p className="text-xs font-semibold">{preset.emoji} {preset.label}</p>
            {preset.playlistName && (
              <p className="text-[10px] text-muted-foreground truncate">🎵 {preset.playlistName}</p>
            )}
          </div>

          {/* Play button */}
          <button
            onClick={() => { handlePlay(); setOpen(false); }}
            disabled={spotify.isSearching}
            className="w-full text-xs py-1.5 rounded bg-emerald-600 hover:bg-emerald-600/80 text-white disabled:opacity-40 transition-colors"
          >
            {preset.playlistUri ? '▶ Play Playlist' : '🔍 Search & Play'}
          </button>

          {/* Paste link */}
          <div className="space-y-1.5">
            <p className="text-[10px] text-muted-foreground font-medium">Paste Spotify playlist link:</p>
            <div className="flex gap-1">
              <input
                type="text"
                value={linkInput}
                onChange={e => setLinkInput(e.target.value.slice(0, 200))}
                onKeyDown={e => { if (e.key === 'Enter') handleAssign(); }}
                className="flex-1 text-[11px] bg-background/50 border border-border/50 rounded px-2 py-1 placeholder:text-muted-foreground/40"
                placeholder="https://open.spotify.com/playlist/..."
                maxLength={200}
                disabled={isAssigning}
              />
              <button
                onClick={handleAssign}
                disabled={!linkInput.trim() || isAssigning}
                className="text-[10px] px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-600/80 text-white disabled:opacity-40 transition-colors shrink-0"
              >
                {isAssigning ? '...' : 'Set'}
              </button>
            </div>
          </div>

          {/* Clear custom assignment */}
          {preset.playlistUri && (
            <button
              onClick={() => { spotify.clearPresetPlaylist(preset.id); setOpen(false); }}
              className="w-full text-[10px] py-1 rounded border border-destructive/30 text-destructive hover:bg-destructive/10 flex items-center justify-center gap-1 transition-colors"
            >
              <Unlink className="w-3 h-3" /> Clear custom playlist
            </button>
          )}
        </PopoverContent>
      </Popover>

      {/* Delete custom presets */}
      {preset.id.startsWith('custom_') && (
        <button
          onClick={(e) => { e.stopPropagation(); spotify.updateMoodPresets(spotify.moodPresets.filter(p => p.id !== preset.id)); }}
          className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          title="Remove preset"
        >
          <Trash2 className="w-2.5 h-2.5 text-destructive-foreground" />
        </button>
      )}
    </div>
  );
}

export function DMSpotifyControls() {
  const spotify = useSpotify();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newQuery, setNewQuery] = useState('');
  const [newEmoji, setNewEmoji] = useState('🎵');
  const [newPlaylistLink, setNewPlaylistLink] = useState('');

  const handleAddPreset = async () => {
    const label = newLabel.trim();
    const query = newQuery.trim();
    if (!label || !query) return;

    const id = `custom_${Date.now()}`;
    const newPreset: MoodPreset = { id, label, searchQuery: query, emoji: newEmoji || '🎵' };
    spotify.updateMoodPresets([...spotify.moodPresets, newPreset]);

    // If they also pasted a playlist link, assign it
    if (newPlaylistLink.trim()) {
      await spotify.assignPlaylistToPreset(id, newPlaylistLink.trim());
    }

    setNewLabel('');
    setNewQuery('');
    setNewEmoji('🎵');
    setNewPlaylistLink('');
    setShowAddForm(false);
  };

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

      {/* Auto-Mood toggle */}
      <div className="flex items-center justify-between py-1">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-medium">Auto-Mood</p>
            <p className="text-[10px] text-muted-foreground">AI picks music based on the story</p>
          </div>
        </div>
        <Switch
          checked={spotify.autoMoodEnabled}
          onCheckedChange={spotify.setAutoMoodEnabled}
          className="data-[state=checked]:bg-emerald-600"
        />
      </div>

      {/* Mood presets */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Mood Presets</p>
          <button
            onClick={() => setShowAddForm(s => !s)}
            className="text-[10px] text-emerald-500 hover:text-emerald-400 flex items-center gap-0.5 transition-colors"
          >
            {showAddForm ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
            {showAddForm ? 'Cancel' : 'Add'}
          </button>
        </div>

        {showAddForm && (
          <div className="p-2 rounded-lg border border-border/50 bg-muted/10 space-y-2">
            <div className="flex gap-1.5">
              <input
                type="text"
                value={newEmoji}
                onChange={e => setNewEmoji(e.target.value.slice(0, 2))}
                className="w-9 text-center text-sm bg-background/50 border border-border/50 rounded px-1 py-1"
                placeholder="🎵"
                maxLength={2}
              />
              <input
                type="text"
                value={newLabel}
                onChange={e => setNewLabel(e.target.value.slice(0, 30))}
                className="flex-1 text-xs bg-background/50 border border-border/50 rounded px-2 py-1 placeholder:text-muted-foreground/50"
                placeholder="Preset name"
                maxLength={30}
              />
            </div>
            <input
              type="text"
              value={newQuery}
              onChange={e => setNewQuery(e.target.value.slice(0, 100))}
              className="w-full text-xs bg-background/50 border border-border/50 rounded px-2 py-1 placeholder:text-muted-foreground/50"
              placeholder="Search query (e.g. dark cave ambient)"
              maxLength={100}
            />
            <div className="flex items-center gap-1.5">
              <Link className="w-3 h-3 text-muted-foreground shrink-0" />
              <input
                type="text"
                value={newPlaylistLink}
                onChange={e => setNewPlaylistLink(e.target.value.slice(0, 200))}
                className="flex-1 text-[11px] bg-background/50 border border-border/50 rounded px-2 py-1 placeholder:text-muted-foreground/40"
                placeholder="Playlist link (optional)"
                maxLength={200}
              />
            </div>
            <button
              onClick={handleAddPreset}
              disabled={!newLabel.trim() || !newQuery.trim()}
              className="w-full text-xs py-1.5 rounded bg-emerald-600 hover:bg-emerald-600/80 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Add Preset
            </button>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          {spotify.moodPresets.map(preset => (
            <PresetPill key={preset.id} preset={preset} spotify={spotify} />
          ))}
        </div>

        <p className="text-[9px] text-muted-foreground/60 text-center">Tap to play · Double-tap to edit link</p>
      </div>

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

      {/* Browser player status */}
      {spotify.isPremium && spotify.sdkReady && (
        <div className="flex items-center gap-1.5 px-1">
          <Monitor className="w-3 h-3 text-emerald-500" />
          <span className="text-[10px] text-emerald-400">Playing in browser — no Spotify app needed</span>
        </div>
      )}
      {spotify.isPremium === false && (
        <p className="text-[9px] text-muted-foreground/70 text-center">
          Free accounts require the Spotify app open to play music
        </p>
      )}
    </div>
  );
}
