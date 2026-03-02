import { useState } from 'react';
import { Music, LogOut, Search, Play, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { SettingsSection } from './SettingsSection';
import { useSpotify } from '@/hooks/use-spotify';
import { searchPlaylists } from '@/lib/spotify';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function SpotifySettingsTab() {
  const spotify = useSpotify();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearchingManual, setIsSearchingManual] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearchingManual(true);
    try {
      const results = await searchPlaylists(searchQuery, 10);
      const safeResults = Array.isArray(results) ? results.filter(Boolean) : [];
      setSearchResults(safeResults);
      if (safeResults.length === 0) toast.info('No playlists found');
    } catch (e: any) {
      toast.error(e.message || 'Search failed');
    } finally {
      setIsSearchingManual(false);
    }
  };

  if (!spotify.connected) {
    return (
      <div className="flex-1 overflow-y-auto max-h-[70vh]">
        <div className="space-y-3 pb-6">
          <SettingsSection title="Spotify Connection">
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="p-4 rounded-full bg-[#1DB954]/10 border border-[#1DB954]/30">
                <Music className="w-8 h-8 text-[#1DB954]" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="font-cinzel font-bold text-lg">Connect Spotify</h3>
                <p className="text-sm text-muted-foreground max-w-[280px]">
                  Play ambient D&D music during your sessions. Requires a Spotify account.
                </p>
                <p className="text-xs text-muted-foreground/60">
                  Premium required for in-browser playback. Free users can control their Spotify app.
                </p>
              </div>
              <Button
                onClick={spotify.connect}
                className="gap-2 bg-[#1DB954] hover:bg-[#1DB954]/90 text-white"
              >
                <Music className="w-4 h-4" />
                Connect with Spotify
              </Button>
            </div>
          </SettingsSection>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto max-h-[70vh]">
      <div className="space-y-3 pb-6">
        {/* Connection Status */}
        <SettingsSection title="Spotify Connection">
          <div className="flex items-center justify-between p-3 rounded-lg border border-[#1DB954]/30 bg-[#1DB954]/5">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-[#1DB954] animate-pulse" />
              <div>
                <p className="text-sm font-semibold">{spotify.userName || 'Connected'}</p>
                <p className="text-xs text-muted-foreground">Spotify linked</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={spotify.disconnect} className="text-muted-foreground hover:text-destructive">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </SettingsSection>

        {/* Now Playing */}
        {spotify.playback && (
          <SettingsSection title="Now Playing">
            <div className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-card/50">
              {spotify.playback.albumArt && (
                <img src={spotify.playback.albumArt} alt="" className="w-12 h-12 rounded" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{spotify.playback.trackName}</p>
                <p className="text-xs text-muted-foreground truncate">{spotify.playback.artistName}</p>
              </div>
              <Badge variant="outline" className="text-xs shrink-0">
                {spotify.playback.isPlaying ? '▶' : '⏸'}
              </Badge>
            </div>
          </SettingsSection>
        )}


        {/* Mood Presets */}
        <SettingsSection title="Mood Presets">
          <div className="space-y-2">
            {spotify.moodPresets.map((preset) => (
              <div
                key={preset.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-card/30 hover:bg-card/60 transition-colors"
              >
                <span className="text-lg shrink-0">{preset.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{preset.label}</p>
                  {preset.playlistName ? (
                    <p className="text-xs text-[#1DB954] truncate">{preset.playlistName}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">No playlist assigned</p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  {preset.playlistUri && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => spotify.playPlaylist(preset.playlistUri!)}
                      className="h-8 w-8 p-0 text-[#1DB954]"
                    >
                      <Play className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => spotify.searchAndAssignPreset(preset.id)}
                    disabled={spotify.isSearching}
                    className="h-8 w-8 p-0 text-muted-foreground"
                  >
                    <Search className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </SettingsSection>

        {/* Manual Search */}
        <SettingsSection title="Search Playlists">
          <div className="flex gap-2">
            <Input
              placeholder="Search Spotify playlists..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={isSearchingManual} size="sm" className="shrink-0">
              <Search className="w-4 h-4" />
            </Button>
          </div>
          {searchResults.length > 0 && (
            <div className="space-y-2 mt-3">
              {searchResults.map((pl: any) => (
                <button
                  key={pl.id}
                  onClick={() => spotify.playPlaylist(pl.uri)}
                  className="flex items-center gap-3 p-2 rounded-lg border border-border/30 bg-card/20 hover:bg-card/50 transition-colors w-full text-left"
                >
                  {pl.images?.[0]?.url ? (
                    <img src={pl.images[0].url} alt="" className="w-10 h-10 rounded" />
                  ) : (
                    <div className="w-10 h-10 rounded bg-muted/30 flex items-center justify-center">
                      <Music className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{pl.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {pl.tracks?.total != null ? `${pl.tracks.total} tracks` : 'Playlist'}
                      {pl._personal && ' · Yours'}
                    </p>
                  </div>
                  <Play className="w-4 h-4 text-[#1DB954] shrink-0" />
                </button>
              ))}
            </div>
          )}
        </SettingsSection>
      </div>
    </div>
  );
}
