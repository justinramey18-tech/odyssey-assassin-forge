// Plays a celebratory sound whenever a d20 lands above 17 (18, 19, 20),
// anywhere in the app that rolls dice. A natural 20 gets its own fanfare.
import critAsset from '@/assets/crit-roll.m4a.asset.json';
import nat20Asset from '@/assets/nat20-fanfare.mp3.asset.json';

let audio: HTMLAudioElement | null = null;
let nat20Audio: HTMLAudioElement | null = null;
let lastPlayed = 0;

/**
 * Pauses Spotify (if it is currently playing) so the nat-20 fanfare is heard
 * alone, then resumes playback once the fanfare finishes.
 */
async function duckSpotifyFor(fanfare: HTMLAudioElement): Promise<void> {
  try {
    const spotify = await import('@/lib/spotify');
    if (!spotify.isConnected()) return;
    const playback = await spotify.getCurrentPlayback();
    if (!playback?.is_playing) return;
    await spotify.pause();

    let resumed = false;
    const resume = () => {
      if (resumed) return;
      resumed = true;
      fanfare.removeEventListener('ended', resume);
      fanfare.removeEventListener('error', resume);
      void spotify.play().catch(() => {});
    };
    fanfare.addEventListener('ended', resume);
    fanfare.addEventListener('error', resume);
    // Safety net in case the 'ended' event never fires.
    window.setTimeout(resume, 12000);
  } catch {
    /* spotify unavailable — ignore */
  }
}

/** Plays the high-roll sound if the raw d20 roll is greater than 17. */
export function maybePlayCritSound(rawRoll: number, sides: number = 20): void {
  if (sides !== 20 || rawRoll <= 17) return;

  // Guard against double-fires from the same roll being reported twice.
  const now = Date.now();
  if (now - lastPlayed < 400) return;
  lastPlayed = now;

  try {
    if (rawRoll === 20) {
      // Natural 20 → fanfare plus crit sound.
      if (!nat20Audio) {
        nat20Audio = new Audio(nat20Asset.url);
        nat20Audio.preload = 'auto';
        nat20Audio.volume = 0.8;
      }
      nat20Audio.currentTime = 0;
      void nat20Audio.play().catch(() => {});
      void duckSpotifyFor(nat20Audio);
    }

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

