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
let pausedForNarration = false;
let wasPlayingBeforeNarration = false;

/** Drops Spotify to the chosen narration volume — or pauses it entirely at 0%. */
export async function duckMusicForNarration(): Promise<void> {
  if (ducking) return;
  ducking = true;
  wasPlayingBeforeNarration = false;
  try {
    const spotify = await import('@/lib/spotify');
    if (!spotify.isConnected()) { ducking = false; return; }
    const playback = await spotify.getCurrentPlayback().catch(() => null);
    if (!playback?.is_playing) { ducking = false; return; }
    wasPlayingBeforeNarration = true;
    const target = loadNarrationMusicVolume();
    if (target <= 0) {
      pausedForNarration = true;
      await spotify.pause().catch(() => { pausedForNarration = false; });
      return;
    }
    const current = (playback as any)?.device?.volume_percent;
    previousVolume = Number.isFinite(current) ? Number(current) : null;
    await spotify.setVolume(target).catch(() => {});
  } catch {
    ducking = false;
  }
}

/** Puts the music back where it was once narration finishes. */
export async function restoreMusicAfterNarration(): Promise<void> {
  if (!ducking) return;
  ducking = false;
  const restoreTo = previousVolume;
  const wasPaused = pausedForNarration;
  const wasPlaying = wasPlayingBeforeNarration;
  previousVolume = null;
  pausedForNarration = false;
  wasPlayingBeforeNarration = false;
  if (!wasPlaying) return;
  try {
    const spotify = await import('@/lib/spotify');
    if (!spotify.isConnected()) return;
    if (wasPaused) {
      await spotify.play().catch(() => {});
      return;
    }
    if (restoreTo != null) await spotify.setVolume(restoreTo).catch(() => {});
    // On phones the OS often pauses Spotify when narration audio grabs the
    // speaker, even though we only asked it to turn down. If the music stopped
    // on its own during narration, start it again.
    const playback = await spotify.getCurrentPlayback().catch(() => null);
    if (playback && !playback.is_playing) {
      await spotify.play().catch(() => {});
      if (restoreTo != null) await spotify.setVolume(restoreTo).catch(() => {});
    }
  } catch {
    // ignore
  }
}


