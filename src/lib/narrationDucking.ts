// Lowers Spotify while a narration clip is playing and restores it after.
// The player picks how quiet the music gets in Character Sheet → Voices.

const MUSIC_VOLUME_KEY = 'dnd-narration-music-volume';
const DEFAULT_MUSIC_VOLUME = 20;

/** Music volume (0-100) to hold while narration plays. */
export function loadNarrationMusicVolume(): number {
  try {
    const raw = Number(localStorage.getItem(MUSIC_VOLUME_KEY));
    if (!Number.isFinite(raw)) return DEFAULT_MUSIC_VOLUME;
    return Math.min(100, Math.max(0, Math.round(raw)));
  } catch {
    return DEFAULT_MUSIC_VOLUME;
  }
}

export function saveNarrationMusicVolume(value: number): void {
  try {
    const clamped = Math.min(100, Math.max(0, Math.round(value)));
    localStorage.setItem(MUSIC_VOLUME_KEY, String(clamped));
  } catch {
    // ignore
  }
}

let previousVolume: number | null = null;
let ducking = false;

/** Drops Spotify to the chosen narration volume. Safe to call repeatedly. */
export async function duckMusicForNarration(): Promise<void> {
  if (ducking) return;
  ducking = true;
  try {
    const spotify = await import('@/lib/spotify');
    if (!spotify.isConnected()) { ducking = false; return; }
    const playback = await spotify.getCurrentPlayback().catch(() => null);
    if (!playback?.is_playing) { ducking = false; return; }
    const current = (playback as any)?.device?.volume_percent;
    previousVolume = Number.isFinite(current) ? Number(current) : null;
    await spotify.setVolume(loadNarrationMusicVolume()).catch(() => {});
  } catch {
    ducking = false;
  }
}

/** Puts the music back where it was once narration finishes. */
export async function restoreMusicAfterNarration(): Promise<void> {
  if (!ducking) return;
  ducking = false;
  const restoreTo = previousVolume;
  previousVolume = null;
  if (restoreTo == null) return;
  try {
    const spotify = await import('@/lib/spotify');
    if (!spotify.isConnected()) return;
    await spotify.setVolume(restoreTo).catch(() => {});
  } catch {
    // ignore
  }
}
