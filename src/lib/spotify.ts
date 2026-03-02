import { supabase } from '@/integrations/supabase/client';

// ── Storage Keys ──────────────────────────────────────────────────────────
const KEYS = {
  accessToken: 'spotify_access_token',
  refreshToken: 'spotify_refresh_token',
  expiresAt: 'spotify_expires_at',
  codeVerifier: 'spotify_code_verifier',
  moodPresets: 'spotify_mood_presets',
  autoMood: 'spotify_auto_mood',
} as const;

// ── PKCE Helpers ──────────────────────────────────────────────────────────
function generateRandomString(length: number): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return values.reduce((acc, x) => acc + possible[x % possible.length], '');
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  return crypto.subtle.digest('SHA-256', encoder.encode(plain));
}

function base64urlEncode(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// ── Token Management ──────────────────────────────────────────────────────
export function getStoredTokens() {
  try {
    return {
      accessToken: localStorage.getItem(KEYS.accessToken),
      refreshToken: localStorage.getItem(KEYS.refreshToken),
      expiresAt: Number(localStorage.getItem(KEYS.expiresAt) || '0'),
    };
  } catch {
    return { accessToken: null, refreshToken: null, expiresAt: 0 };
  }
}

export function storeTokens(accessToken: string, refreshToken: string | null, expiresIn: number) {
  try {
    localStorage.setItem(KEYS.accessToken, accessToken);
    if (refreshToken) localStorage.setItem(KEYS.refreshToken, refreshToken);
    localStorage.setItem(KEYS.expiresAt, String(Date.now() + expiresIn * 1000));
  } catch (e) {
    console.error('[Spotify] Failed to store tokens:', e);
  }
}

export function clearTokens() {
  try {
    Object.values(KEYS).forEach(k => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}

export function isTokenExpired(): boolean {
  const { expiresAt } = getStoredTokens();
  return Date.now() >= expiresAt - 60_000; // 1 min buffer
}

export function isConnected(): boolean {
  const { accessToken } = getStoredTokens();
  return !!accessToken;
}

// ── Auth Flow ─────────────────────────────────────────────────────────────
export async function getClientId(): Promise<string> {
  const { data, error } = await supabase.functions.invoke('spotify-auth', {
    body: { action: 'client_id' },
  });
  if (error) throw new Error('Failed to get Spotify client ID');
  return data.client_id;
}

const SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'playlist-read-private',
  'playlist-read-collaborative',
].join(' ');

export async function startAuth() {
  const clientId = await getClientId();
  const codeVerifier = generateRandomString(64);
  const hashed = await sha256(codeVerifier);
  const codeChallenge = base64urlEncode(hashed);

  localStorage.setItem(KEYS.codeVerifier, codeVerifier);

  const redirectUri = window.location.origin + window.location.pathname;

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
    redirect_uri: redirectUri,
  });

  window.location.href = `https://accounts.spotify.com/authorize?${params}`;
}

export async function handleCallback(code: string): Promise<boolean> {
  try {
    const redirectUri = window.location.origin + window.location.pathname;
    const codeVerifier = localStorage.getItem(KEYS.codeVerifier);

    const { data, error } = await supabase.functions.invoke('spotify-auth', {
      body: { action: 'exchange', code, redirect_uri: redirectUri, code_verifier: codeVerifier },
    });

    if (error || !data?.access_token) {
      console.error('[Spotify] Token exchange failed:', error || data);
      return false;
    }

    storeTokens(data.access_token, data.refresh_token, data.expires_in);
    localStorage.removeItem(KEYS.codeVerifier);
    return true;
  } catch (e) {
    console.error('[Spotify] Callback error:', e);
    return false;
  }
}

export async function refreshAccessToken(): Promise<boolean> {
  const { refreshToken } = getStoredTokens();
  if (!refreshToken) return false;

  try {
    const { data, error } = await supabase.functions.invoke('spotify-auth', {
      body: { action: 'refresh', refresh_token: refreshToken },
    });

    if (error || !data?.access_token) {
      console.error('[Spotify] Token refresh failed:', error || data);
      clearTokens();
      return false;
    }

    storeTokens(data.access_token, data.refresh_token || refreshToken, data.expires_in);
    return true;
  } catch (e) {
    console.error('[Spotify] Refresh error:', e);
    clearTokens();
    return false;
  }
}

// ── Spotify API Helpers ───────────────────────────────────────────────────
async function getValidToken(): Promise<string | null> {
  if (isTokenExpired()) {
    const ok = await refreshAccessToken();
    if (!ok) return null;
  }
  return getStoredTokens().accessToken;
}

async function spotifyFetch(endpoint: string, options: RequestInit = {}): Promise<any> {
  const token = await getValidToken();
  if (!token) throw new Error('No valid Spotify token');

  const res = await fetch(`https://api.spotify.com/v1${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (res.status === 204) return null;

  const contentType = res.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    const text = await res.text().catch(() => '');
    console.error('[Spotify] Non-JSON response:', res.status, text.substring(0, 200));
    throw new Error(`Spotify returned an unexpected response (${res.status}). Try reconnecting Spotify.`);
  }

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    if (!res.ok) throw new Error(`Spotify API error ${res.status}`);
    throw new Error('Spotify returned malformed data. Please try again.');
  }

  if (!res.ok) {
    throw new Error(data?.error?.message || `Spotify API error ${res.status}`);
  }

  return data;
}

export async function getUserPlaylists(query?: string): Promise<any[]> {
  try {
    const data = await spotifyFetch('/me/playlists?limit=50');
    let items = data?.items;
    if (!Array.isArray(items)) return [];
    items = items.filter((item: any) => item && typeof item === 'object' && item.id && item.uri);
    if (query) {
      const q = query.toLowerCase();
      items = items.filter((item: any) => item.name?.toLowerCase().includes(q));
    }
    // Mark as personal so UI can distinguish
    return items.map((item: any) => ({ ...item, _personal: true }));
  } catch (e) {
    console.warn('[Spotify] Failed to fetch user playlists:', e);
    return [];
  }
}

export async function searchPlaylists(query: string, limit = 10) {
  // Fetch personal and public playlists in parallel
  const [personal, publicData] = await Promise.all([
    getUserPlaylists(query).catch(() => []),
    spotifyFetch(`/search?${new URLSearchParams({ q: query, type: 'playlist', limit: String(limit) })}`).catch(() => null),
  ]);

  const publicItems = (publicData?.playlists?.items || [])
    .filter((item: any) => item && typeof item === 'object' && item.id && item.uri);

  // Deduplicate: personal results first
  const seenIds = new Set(personal.map((p: any) => p.id));
  const deduped = [...personal, ...publicItems.filter((p: any) => !seenIds.has(p.id))];
  return deduped.slice(0, Math.max(limit, 20));
}

export async function getPlaylistTracks(playlistId: string) {
  return spotifyFetch(`/playlists/${playlistId}/tracks?limit=50`);
}

export async function getCurrentPlayback() {
  try {
    return await spotifyFetch('/me/player');
  } catch {
    return null;
  }
}

export async function play(options: { context_uri?: string; uris?: string[]; device_id?: string } = {}) {
  const params = options.device_id ? `?device_id=${options.device_id}` : '';
  const body: Record<string, unknown> = {};
  if (options.context_uri) body.context_uri = options.context_uri;
  if (options.uris) body.uris = options.uris;
  await spotifyFetch(`/me/player/play${params}`, { method: 'PUT', body: JSON.stringify(body) });
}

export async function pause() {
  await spotifyFetch('/me/player/pause', { method: 'PUT' });
}

export async function skipNext() {
  await spotifyFetch('/me/player/next', { method: 'POST' });
}

export async function skipPrevious() {
  await spotifyFetch('/me/player/previous', { method: 'POST' });
}

export async function setVolume(volumePercent: number) {
  await spotifyFetch(`/me/player/volume?volume_percent=${Math.round(volumePercent)}`, { method: 'PUT' });
}

export async function getDevices() {
  const data = await spotifyFetch('/me/player/devices');
  return data?.devices || [];
}

export async function getUserProfile() {
  return spotifyFetch('/me');
}

// ── Playlist URI Helpers ──────────────────────────────────────────────────
export function extractPlaylistId(input: string): string | null {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();

  // spotify:playlist:<id>
  const uriMatch = trimmed.match(/^spotify:playlist:([a-zA-Z0-9]{22})$/);
  if (uriMatch) return uriMatch[1];

  // https://open.spotify.com/playlist/<id>?...
  const urlMatch = trimmed.match(/open\.spotify\.com\/playlist\/([a-zA-Z0-9]{22})/);
  if (urlMatch) return urlMatch[1];

  // Raw 22-char alphanumeric ID
  if (/^[a-zA-Z0-9]{22}$/.test(trimmed)) return trimmed;

  return null;
}

export async function getPlaylistInfo(playlistId: string): Promise<{ name: string; uri: string; imageUrl?: string } | null> {
  try {
    const data = await spotifyFetch(`/playlists/${playlistId}?fields=name,uri,images`);
    return {
      name: data?.name || 'Unknown Playlist',
      uri: data?.uri || `spotify:playlist:${playlistId}`,
      imageUrl: data?.images?.[0]?.url,
    };
  } catch {
    return null;
  }
}

// ── Mood Presets ──────────────────────────────────────────────────────────
export interface MoodPreset {
  id: string;
  label: string;
  searchQuery: string;
  emoji: string;
  playlistUri?: string;
  playlistName?: string;
  manuallyAssigned?: boolean;
}

export const DEFAULT_MOOD_PRESETS: MoodPreset[] = [
  { id: 'combat', label: 'Combat', searchQuery: 'D&D combat battle epic orchestral', emoji: '⚔️' },
  { id: 'tavern', label: 'Tavern & Inn', searchQuery: 'medieval tavern inn folk music', emoji: '🍺' },
  { id: 'dungeon', label: 'Dark Dungeon', searchQuery: 'dark dungeon ambient horror', emoji: '🕯️' },
  { id: 'exploration', label: 'Forest Exploration', searchQuery: 'fantasy forest exploration ambient nature', emoji: '🌲' },
  { id: 'boss', label: 'Epic Boss Battle', searchQuery: 'epic boss battle orchestral intense', emoji: '🐉' },
  { id: 'mystery', label: 'Mystery & Intrigue', searchQuery: 'mystery intrigue suspense ambient', emoji: '🔮' },
  { id: 'village', label: 'Peaceful Village', searchQuery: 'peaceful village medieval calm ambient', emoji: '🏘️' },
  { id: 'ocean', label: 'Ocean Voyage', searchQuery: 'ocean sea voyage sailing adventure ambient', emoji: '⛵' },
  { id: 'court', label: 'Royal Court', searchQuery: 'royal court medieval regal fanfare orchestral', emoji: '👑' },
  { id: 'stealth', label: 'Stealth & Shadows', searchQuery: 'stealth shadows sneaking dark ambient tense', emoji: '🗡️' },
  { id: 'temple', label: 'Sacred Temple', searchQuery: 'sacred temple holy choir ambient peaceful', emoji: '⛪' },
  { id: 'campfire', label: 'Campfire Rest', searchQuery: 'campfire rest night calm acoustic ambient', emoji: '🔥' },
];

export function loadMoodPresets(): MoodPreset[] {
  try {
    const stored = localStorage.getItem(KEYS.moodPresets);
    if (stored) {
      const existing: MoodPreset[] = JSON.parse(stored);
      const existingIds = new Set(existing.map(p => p.id));
      const newDefaults = DEFAULT_MOOD_PRESETS.filter(p => !existingIds.has(p.id));
      if (newDefaults.length > 0) {
        const merged = [...existing, ...newDefaults];
        localStorage.setItem(KEYS.moodPresets, JSON.stringify(merged));
        return merged;
      }
      return existing;
    }
  } catch {}
  return DEFAULT_MOOD_PRESETS;
}

export function saveMoodPresets(presets: MoodPreset[]) {
  try {
    localStorage.setItem(KEYS.moodPresets, JSON.stringify(presets));
  } catch (e) {
    console.error('[Spotify] Failed to save mood presets:', e);
  }
}

// ── Auto-Mood ────────────────────────────────────────────────────────────
export function loadAutoMood(): boolean {
  try {
    return localStorage.getItem(KEYS.autoMood) === 'true';
  } catch {
    return false;
  }
}

export function saveAutoMood(enabled: boolean) {
  try {
    localStorage.setItem(KEYS.autoMood, String(enabled));
  } catch {}
}
