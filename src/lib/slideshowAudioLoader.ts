/**
 * Cinematic Slideshow Audio Loader
 *
 * Fetches audio files (.mp3) from the "cinematic-audio" Supabase public storage
 * bucket, decodes them into AudioBuffers, and caches them in memory.
 *
 * File layout in the bucket:
 *   sfx/dragon-roar.mp3
 *   sfx/thunder.mp3
 *   ambience/rain.mp3
 *   ambience/wind.mp3
 *   etc.
 *
 * Returns null if a file doesn't exist or can't be loaded — the caller
 * should fall back to synthesized audio.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const BUCKET = 'cinematic-audio';

// In-memory AudioBuffer cache (persists for the browser session)
const bufferCache = new Map<string, AudioBuffer>();

// Track in-flight fetches to avoid duplicate requests
const pendingFetches = new Map<string, Promise<AudioBuffer | null>>();

// Track keys we already tried and failed (404 / decode error) — don't retry
const failedKeys = new Set<string>();

/**
 * Build the public URL for a file in the cinematic-audio bucket.
 * Supabase public bucket URLs follow the pattern:
 *   {SUPABASE_URL}/storage/v1/object/public/{bucket}/{path}
 */
function buildUrl(path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

/**
 * Load a single audio file and decode it into an AudioBuffer.
 * Returns the cached buffer if already loaded, null if unavailable.
 */
export async function loadAudioBuffer(
  audioCtx: AudioContext,
  category: 'sfx' | 'ambience',
  name: string,
): Promise<AudioBuffer | null> {
  const key = `${category}/${name}`;

  // Return cached buffer immediately
  if (bufferCache.has(key)) return bufferCache.get(key)!;

  // Don't retry known failures
  if (failedKeys.has(key)) return null;

  // Deduplicate in-flight requests
  if (pendingFetches.has(key)) return pendingFetches.get(key)!;

  const promise = (async () => {
    try {
      const url = buildUrl(`${key}.mp3`);
      const response = await fetch(url);

      if (!response.ok) {
        failedKeys.add(key);
        return null;
      }

      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

      bufferCache.set(key, audioBuffer);
      return audioBuffer;
    } catch {
      failedKeys.add(key);
      return null;
    } finally {
      pendingFetches.delete(key);
    }
  })();

  pendingFetches.set(key, promise);
  return promise;
}

/**
 * Check if a buffer is already cached (synchronous).
 */
export function getCachedBuffer(
  category: 'sfx' | 'ambience',
  name: string,
): AudioBuffer | null {
  return bufferCache.get(`${category}/${name}`) ?? null;
}

/**
 * Preload a list of audio files in the background.
 * Call this when the slideshow opens to start loading sounds
 * that will be needed soon. Does not block.
 */
export function preloadAudioFiles(
  audioCtx: AudioContext,
  sfxNames: string[],
  ambienceNames: string[],
): void {
  for (const name of sfxNames) {
    loadAudioBuffer(audioCtx, 'sfx', name).catch(() => {});
  }
  for (const name of ambienceNames) {
    loadAudioBuffer(audioCtx, 'ambience', name).catch(() => {});
  }
}

/**
 * Extract all unique SFX and ambience names from a slides array.
 * Useful for preloading all audio needed for a DM response.
 */
export function extractAudioNames(slides: Array<{ sfx: string[]; ambience: string | null }>): {
  sfxNames: string[];
  ambienceNames: string[];
} {
  const sfxSet = new Set<string>();
  const ambienceSet = new Set<string>();

  for (const slide of slides) {
    for (const s of slide.sfx) sfxSet.add(s);
    if (slide.ambience && slide.ambience !== 'silence') ambienceSet.add(slide.ambience);
  }

  return {
    sfxNames: Array.from(sfxSet),
    ambienceNames: Array.from(ambienceSet),
  };
}
