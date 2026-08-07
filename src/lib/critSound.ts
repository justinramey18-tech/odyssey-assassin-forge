// Plays a celebratory sound whenever a d20 lands above 17 (18, 19, 20),
// anywhere in the app that rolls dice. A natural 20 gets its own fanfare.
import critAsset from '@/assets/crit-roll.m4a.asset.json';
import nat20Asset from '@/assets/nat20-fanfare.mp3.asset.json';

let audio: HTMLAudioElement | null = null;
let nat20Audio: HTMLAudioElement | null = null;
let lastPlayed = 0;

/**
 * Smoothly fades Spotify's volume down so the nat-20 fanfare is heard clearly,
 * then fades it back up once the fanfare finishes. Never starts, resumes, or
 * unmutes Spotify — if nothing is playing, or the music is already muted, or
 * the device doesn't report a volume, this quietly does nothing.
 */
async function duckSpotifyFor(fanfare: HTMLAudioElement): Promise<void> {
  try {
    const spotify = await import('@/lib/spotify');
    if (!spotify.isConnected()) return;

    const playback = await spotify.getCurrentPlayback().catch(() => null);
    // Nothing playing / paused / no active device → leave Spotify untouched.
    if (!playback?.is_playing) return;

    const device = playback?.device;
    if (device?.supports_volume === false) return;

    const original = Number(device?.volume_percent);
    // Muted or unknown volume → nothing useful to fade.
    if (!Number.isFinite(original) || original <= 0) return;

    const duckedTarget = Math.max(5, Math.round(original * 0.15));
    if (duckedTarget >= original) return;

    const fadeTo = async (from: number, to: number, steps = 5, stepMs = 90) => {
      for (let i = 1; i <= steps; i++) {
        const level = Math.round(from + ((to - from) * i) / steps);
        await spotify.setVolume(Math.max(0, Math.min(100, level))).catch(() => {});
        if (i < steps) await new Promise(r => setTimeout(r, stepMs));
      }
    };

    await fadeTo(original, duckedTarget);

    let restored = false;
    const restore = () => {
      if (restored) return;
      restored = true;
      fanfare.removeEventListener('ended', restore);
      fanfare.removeEventListener('error', restore);
      void (async () => {
        // Only restore if the user hasn't since paused or changed the volume
        // themselves — and never resume playback.
        const after = await spotify.getCurrentPlayback().catch(() => null);
        if (!after?.is_playing) return;
        const now = Number(after?.device?.volume_percent);
        if (Number.isFinite(now) && Math.abs(now - duckedTarget) > 8) return;
        await fadeTo(duckedTarget, original, 6, 120);
      })();
    };
    fanfare.addEventListener('ended', restore);
    fanfare.addEventListener('error', restore);
    // Safety net in case the 'ended' event never fires.
    window.setTimeout(restore, 12000);
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

