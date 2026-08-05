// Plays a celebratory sound whenever a d20 lands above 17 (18, 19, 20),
// anywhere in the app that rolls dice.
import critAsset from '@/assets/crit-roll.m4a.asset.json';

let audio: HTMLAudioElement | null = null;
let lastPlayed = 0;

/** Plays the high-roll sound if the raw d20 roll is greater than 17. */
export function maybePlayCritSound(rawRoll: number, sides: number = 20): void {
  if (sides !== 20 || rawRoll <= 17) return;

  // Guard against double-fires from the same roll being reported twice.
  const now = Date.now();
  if (now - lastPlayed < 400) return;
  lastPlayed = now;

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
