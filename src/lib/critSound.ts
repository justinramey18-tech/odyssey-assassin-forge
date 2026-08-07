// Plays a celebratory sound whenever a d20 lands above 17 (18, 19, 20),
// anywhere in the app that rolls dice. A natural 20 gets its own fanfare.
import critAsset from '@/assets/crit-roll.m4a.asset.json';
import nat20Asset from '@/assets/nat20-fanfare.mp3.asset.json';

let audio: HTMLAudioElement | null = null;
let nat20Audio: HTMLAudioElement | null = null;
let lastPlayed = 0;

/**
 * Pauses Spotify the moment the nat-20 fanfare fires and leaves it paused.
 * The player resumes music themselves from the Spotify settings.
 */
async function duckSpotifyFor(_fanfare: HTMLAudioElement): Promise<void> {
  try {
    const spotify = await import('@/lib/spotify');
    if (!spotify.isConnected()) return;

    const playback = await spotify.getCurrentPlayback().catch(() => null);
    // Nothing playing / paused / no active device → leave Spotify untouched.
    if (!playback?.is_playing) return;

    await spotify.pause().catch(() => {});
  } catch {
    /* spotify unavailable — ignore */
  }
}

/** Set when a nat 20 is rolled; the fanfare waits for the DM to start responding. */
let nat20Pending = false;
let pendingSafety = 0;

function playNat20Fanfare(): void {
  try {
    if (!nat20Audio) {
      nat20Audio = new Audio(nat20Asset.url);
      nat20Audio.preload = 'auto';
      nat20Audio.volume = 0.8;
    }
    nat20Audio.currentTime = 0;
    void nat20Audio.play().catch(() => {});
    void duckSpotifyFor(nat20Audio);
  } catch {
    /* audio unavailable — ignore */
  }
}

/**
 * Fires the queued natural-20 fanfare. Called when the DM begins generating its
 * response to the roll, so the music lands with the reveal rather than the roll.
 */
export function firePendingNat20Fanfare(): void {
  if (!nat20Pending) return;
  nat20Pending = false;
  if (pendingSafety) { clearTimeout(pendingSafety); pendingSafety = 0; }
  playNat20Fanfare();
}

/** Plays the high-roll sound if the raw d20 roll is greater than 17. */
export function maybePlayCritSound(rawRoll: number, sides: number = 20): void {
  if (sides !== 20 || rawRoll <= 17) return;

  // Guard against double-fires from the same roll being reported twice.
  const now = Date.now();
  if (now - lastPlayed < 400) return;
  lastPlayed = now;

  if (rawRoll === 20) {
    // Queue the fanfare — it plays once the DM starts responding.
    nat20Pending = true;
    if (pendingSafety) clearTimeout(pendingSafety);
    // If no DM response is triggered, drop the queued fanfare rather than
    // firing it much later out of context.
    pendingSafety = window.setTimeout(() => { nat20Pending = false; pendingSafety = 0; }, 90000);
  }

  try {
    if (!audio) {
      audio = new Audio(critAsset.url);
      audio.preload = 'auto';
      audio.volume = 0.7;
    }
    audio.currentTime = 0;
    void audio.play().catch(() => {});
  } catch {
    /* audio unavailable — ignore */
  }
}


