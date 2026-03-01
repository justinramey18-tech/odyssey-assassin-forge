/**
 * Spotify Web Playback SDK wrapper.
 * Creates a virtual player device in the browser (Premium only).
 */

import { getStoredTokens, refreshAccessToken, isTokenExpired } from '@/lib/spotify';

declare global {
  interface Window {
    Spotify: typeof Spotify;
    onSpotifyWebPlaybackSDKReady: () => void;
  }
}

declare namespace Spotify {
  interface Player {
    connect(): Promise<boolean>;
    disconnect(): void;
    addListener(event: string, callback: (state: any) => void): void;
    removeListener(event: string, callback?: () => void): void;
    getCurrentState(): Promise<any>;
    setName(name: string): void;
    getVolume(): Promise<number>;
    setVolume(volume: number): Promise<void>;
    pause(): Promise<void>;
    resume(): Promise<void>;
    togglePlay(): Promise<void>;
    seek(positionMs: number): Promise<void>;
    previousTrack(): Promise<void>;
    nextTrack(): Promise<void>;
  }

  interface PlayerInit {
    name: string;
    getOAuthToken: (cb: (token: string) => void) => void;
    volume?: number;
  }

  // eslint-disable-next-line @typescript-eslint/no-redeclare
  var Player: {
    new (options: PlayerInit): Player;
  };
}

let player: Spotify.Player | null = null;
let deviceId: string | null = null;
let sdkReady = false;
let pendingResolvers: Array<() => void> = [];
let onStateChange: ((state: any) => void) | null = null;

// SDK ready callback — fires when the <script> loads
if (typeof window !== 'undefined') {
  window.onSpotifyWebPlaybackSDKReady = () => {
    sdkReady = true;
    pendingResolvers.forEach(r => r());
    pendingResolvers = [];
  };
  // If SDK already loaded before our code runs
  if (window.Spotify) {
    sdkReady = true;
  }
}

function waitForSDK(): Promise<void> {
  if (sdkReady) return Promise.resolve();
  return new Promise(resolve => {
    pendingResolvers.push(resolve);
  });
}

async function getToken(): Promise<string> {
  if (isTokenExpired()) {
    await refreshAccessToken();
  }
  const { accessToken } = getStoredTokens();
  return accessToken || '';
}

export async function initPlayer(
  onReady?: (id: string) => void,
  onNotReady?: () => void,
  onPlayerStateChanged?: (state: any) => void,
): Promise<void> {
  if (player) return; // already initialised

  await waitForSDK();

  onStateChange = onPlayerStateChanged || null;

  player = new window.Spotify.Player({
    name: 'Odyssey TTRPG Companion',
    getOAuthToken: (cb) => {
      getToken().then(cb);
    },
    volume: 0.5,
  });

  player.addListener('ready', ({ device_id }: { device_id: string }) => {
    console.log('[Spotify SDK] Ready, device:', device_id);
    deviceId = device_id;
    onReady?.(device_id);
  });

  player.addListener('not_ready', () => {
    console.warn('[Spotify SDK] Device went offline');
    deviceId = null;
    onNotReady?.();
  });

  player.addListener('player_state_changed', (state: any) => {
    onStateChange?.(state);
  });

  player.addListener('initialization_error', ({ message }: { message: string }) => {
    console.error('[Spotify SDK] Init error:', message);
  });

  player.addListener('authentication_error', ({ message }: { message: string }) => {
    console.error('[Spotify SDK] Auth error:', message);
  });

  player.addListener('account_error', ({ message }: { message: string }) => {
    console.error('[Spotify SDK] Account error (Premium required):', message);
  });

  const connected = await player.connect();
  if (!connected) {
    console.error('[Spotify SDK] Failed to connect');
  }
}

export function destroyPlayer() {
  if (player) {
    player.disconnect();
    player = null;
    deviceId = null;
    onStateChange = null;
  }
}

export function getSDKDeviceId(): string | null {
  return deviceId;
}

export function isSDKPlayerActive(): boolean {
  return !!player && !!deviceId;
}
