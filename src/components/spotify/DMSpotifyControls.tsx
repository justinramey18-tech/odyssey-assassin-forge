import { useState, useRef } from 'react';
import { Play, Pause, SkipForward, SkipBack, Volume2, Music, Wifi, WifiOff, Plus, Trash2, X, Sparkles, Monitor, Link, Unlink, Radio } from 'lucide-react';
import { useSpotify } from '@/hooks/use-spotify';
import { usePartySpotifySync } from '@/hooks/use-party-spotify-sync';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { MoodPreset } from '@/lib/spotify';

interface DMSpotifyControlsProps {
  partyId?: string | null;
  isCreator?: boolean;
}

function PresetPill({ preset, spotify, onPlay }: { preset: MoodPreset; spotify: ReturnType<typeof useSpotify>; onPlay?: (uri: string, name: string) => void }) {
  const [linkInput, setLinkInput] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [open, setOpen] = useState(false);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);

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
      onPlay?.(preset.playlistUri, preset.playlistName || preset.label);
    } else {
      spotify.searchAndAssignPreset(preset.id);
    }
  };

  const handleTouchStart = () => {
    didLongPress.current = false;
    longPressRef.current = setTimeout(() => {
      didLongPress.current = true;
      setOpen(true);
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
    // Short tap = play (only if not a long press)
    if (!didLongPress.current && !open) {
      handlePlay();
    }
  };

  const handleTouchMove = () => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  };

  return (
    <div className="group relative">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchMove={handleTouchMove}
            onContextMenu={(e) => { e.preventDefault(); setOpen(true); }}
            onClick={(e) => {
              // Desktop: single click = play
              if (e.detail === 1) handlePlay();
            }}
            onDoubleClick={() => setOpen(true)}
            disabled={spotify.isSearching}
            className={cn(
              "text-xs px-2.5 py-1 rounded-full border transition-colors flex items-center gap-1 select-none",
              preset.playlistUri
                ? "border-border/50 hover:bg-emerald-500/10 hover:border-emerald-500/30"
                : "border-dashed border-muted-foreground/30 hover:border-muted-foreground/50 text-muted-foreground"
            )}
            title={preset.playlistUri ? `Play: ${preset.playlistName} (hold to edit)` : `Tap to search, hold to paste link`}
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

export function DMSpotifyControls({ partyId, isCreator = false }: DMSpotifyControlsProps = {}) {
  const spotify = useSpotify();
  const partySync = usePartySpotifySync({
    partyId: partyId || null,
    isCreator,
    connected: spotify.connected,
    playback: spotify.playback,
    playPlaylist: spotify.playPlaylist,
    pausePlayback: spotify.pausePlayback,
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newQuery, setNewQuery] = useState('');
  const [newEmoji, setNewEmoji] = useState('🎵');
  const [newPlaylistLink, setNewPlaylistLink] = useState('');

  const isMemberSynced = !isCreator && partySync.syncEnabled;

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

  const handleSyncToggle = (enabled: boolean) => {
    partySync.toggleSync(enabled);
  };

  const isMemberConnectedAndSynced = isMemberSynced && spotify.connected;

  // ── Party member without Spotify: show sync toggle + optional connect ──
  if (!spotify.connected && partyId && !isCreator) {
    return (
      <div className="px-3 py-2 space-y-3">
        {/* Sync to Host — always visible for party members */}
        <div className="flex items-center justify-between py-1">
          <div className="flex items-center gap-2 min-w-0">
            <Radio className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-medium">Sync to Host</p>
              <p className="text-[10px] text-muted-foreground">
                {partySync.syncEnabled
                  ? partySync.hostPlaylist
                    ? `Playing: ${partySync.hostPlaylist.name}`
                    : 'Waiting for host to play...'
                  : 'Hear the same music as the host'
                }
              </p>
            </div>
          </div>
          <Switch
            checked={partySync.syncEnabled}
            onCheckedChange={handleSyncToggle}
            className="data-[state=checked]:bg-blue-600"
          />
        </div>

        {/* Info banner when synced */}
        {partySync.syncEnabled && (
          <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2">
            <p className="text-[10px] text-blue-300 leading-relaxed">
              🎧 The host is sharing music with the party. Connect your own Spotify below for playback controls on your device.
            </p>
          </div>
        )}

        {/* Host playlist display when synced */}
        {partySync.syncEnabled && partySync.hostPlaylist && (
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-md bg-blue-500/15 flex items-center justify-center shrink-0">
              <Music className="w-4 h-4 text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate">{partySync.hostPlaylist.name}</p>
              <p className="text-[9px] text-blue-400 flex items-center gap-1 mt-0.5">
                <Radio className="w-2.5 h-2.5" /> Synced to host
              </p>
            </div>
          </div>
        )}

        {/* Optional: Connect own Spotify */}
        <button
          onClick={spotify.connect}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/20 active:scale-[0.98] transition-colors min-h-[44px] border border-border/30"
          style={{ touchAction: 'manipulation' }}
        >
          <WifiOff className="w-4 h-4 text-muted-foreground shrink-0" />
          <div className="flex-1 text-left min-w-0">
            <span className="text-sm font-medium text-foreground">Connect Spotify</span>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Optional — play the host's music on your own device
            </p>
          </div>
        </button>
      </div>
    );
  }

  // ── Not connected, not in party (or is creator): standard connect prompt ──
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
            {isMemberSynced && (
              <p className="text-[9px] text-blue-400 flex items-center gap-1 mt-0.5">
                <Radio className="w-2.5 h-2.5" /> Synced to host
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-md bg-muted/30 flex items-center justify-center shrink-0">
            <Music className="w-4 h-4 text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground">
            {isMemberSynced ? 'Waiting for host to play music...' : 'No track playing'}
          </p>
        </div>
      )}

      {/* Playback controls — host-only while synced */}
      {isMemberConnectedAndSynced ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2">
          <Radio className="w-3 h-3 text-blue-400" />
          <p className="text-[10px] text-blue-300">Host controls playback while synced</p>
        </div>
      ) : (
        /* Host / unsynced member: full controls */
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
      )}

      {/* Auto-Mood toggle — host only when in party */}
      {(!partyId || isCreator) && (
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
      )}

      {/* Party Music Sync */}
      {partyId && (
        <div className="flex items-center justify-between py-1">
          <div className="flex items-center gap-2 min-w-0">
            <Radio className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <div className="min-w-0">
              {isCreator ? (
                <>
                  <p className="text-xs font-medium">Broadcasting Music</p>
                  <p className="text-[10px] text-muted-foreground">Party members synced to your audio</p>
                </>
              ) : (
                <>
                  <p className="text-xs font-medium">Sync to Host</p>
                  <p className="text-[10px] text-muted-foreground">
                    {partySync.syncEnabled
                      ? partySync.hostPlaylist
                        ? `Playing: ${partySync.hostPlaylist.name}`
                        : 'Waiting for host to play...'
                      : 'Hear the same music as the host'
                    }
                  </p>
                </>
              )}
            </div>
          </div>
          {!isCreator && (
            <Switch
              checked={partySync.syncEnabled}
              onCheckedChange={handleSyncToggle}
              className="data-[state=checked]:bg-blue-600"
            />
          )}
          {isCreator && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 font-medium">Live</span>
          )}
        </div>
      )}

      {/* Synced member info banner */}
      {isMemberSynced && (
        <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2">
          <p className="text-[10px] text-blue-300 leading-relaxed">
            🎧 You're hearing the host's music on your device. Pausing only stops it on your end — the host's music keeps playing for everyone.
          </p>
        </div>
      )}

      {/* Mood presets — host only when in party */}
      {(!partyId || isCreator) && (
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
              <PresetPill key={preset.id} preset={preset} spotify={spotify} onPlay={partySync.onHostPlayPlaylist} />
            ))}
          </div>

          <p className="text-[9px] text-muted-foreground/60 text-center">Tap to play · Hold to edit link</p>
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
