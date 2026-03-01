import { supabase } from '@/integrations/supabase/client';

// ── Storage Keys ──────────────────────────────────────────────────────────
const KEYS = {
  accessToken: 'spotify_access_token',
  refreshToken: 'spotify_refresh_token',
  expiresAt: 'spotify_expires_at',
  codeVerifier: 'spotify_code_verifier',
  moodPresets: 'spotify_mood_presets',
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

    const { data, error } = await supabase.functions.invoke('spotify-auth', {
      body: { action: 'exchange', code, redirect_uri: redirectUri },
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
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Spotify API error ${res.status}`);
  }
  return res.json();
}

export async function searchPlaylists(query: string, limit = 10) {
  const data = await spotifyFetch(`/search?${new URLSearchParams({ q: query, type: 'playlist', limit: String(limit) })}`);
  return data?.playlists?.items || [];
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

// ── Mood Presets ──────────────────────────────────────────────────────────
export interface MoodPreset {
  id: string;
  label: string;
  searchQuery: string;
  emoji: string;
  playlistUri?: string;
  playlistName?: string;
}

export const DEFAULT_MOOD_PRESETS: MoodPreset[] = [
  { id: 'combat', label: 'Combat', searchQuery: 'D&D combat battle epic orchestral', emoji: '⚔️' },
  { id: 'tavern', label: 'Tavern & Inn', searchQuery: 'medieval tavern inn folk music', emoji: '🍺' },
  { id: 'dungeon', label: 'Dark Dungeon', searchQuery: 'dark dungeon ambient horror', emoji: '🕯️' },
  { id: 'exploration', label: 'Forest Exploration', searchQuery: 'fantasy forest exploration ambient nature', emoji: '🌲' },
  { id: 'boss', label: 'Epic Boss Battle', searchQuery: 'epic boss battle orchestral intense', emoji: '🐉' },
  { id: 'mystery', label: 'Mystery & Intrigue', searchQuery: 'mystery intrigue suspense ambient', emoji: '🔮' },
];

export function loadMoodPresets(): MoodPreset[] {
  try {
    const stored = localStorage.getItem(KEYS.moodPresets);
    if (stored) return JSON.parse(stored);
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
