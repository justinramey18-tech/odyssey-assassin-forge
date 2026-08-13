/**
 * Downloading a finished narration as one audio file.
 *
 * Play all runs a message's clips in story order (DM aside, then each voiced
 * passage). This module joins those same clips into a single MP3 and hands it
 * to the device — share sheet on mobile when available, plain download on the
 * web.
 */

import { cacheClip, clipKey, getOfflineUrl } from './narrationOfflineCache';

export interface DownloadClip {
  key: string;
  url: string;
  speaker?: string | null;
}

/**
 * Fetches every clip (preferring the offline copy) and concatenates the MP3
 * bytes into one blob. Throws with the offending speaker/part when a clip
 * cannot be fetched, so we never save a half-broken file.
 */
export async function buildMessageAudioBlob(
  clips: DownloadClip[],
  onProgress?: (done: number, total: number) => void,
): Promise<Blob> {
  const parts: Blob[] = [];
  const total = clips.length;
  for (let i = 0; i < total; i++) {
    const clip = clips[i];
    const local = await getOfflineUrl(clip.url);
    const src = local || clip.url;
    let blob: Blob | null = null;
    try {
      const res = await fetch(src, local ? undefined : { cache: 'no-store' });
      if (res.ok) blob = await res.blob();
    } catch {
      blob = null;
    }
    if (!blob || blob.size === 0) {
      const label = clip.speaker ? `“${clip.speaker}”` : `part ${i + 1}`;
      throw new Error(`Could not fetch the audio for ${label}. Check your connection and try again.`);
    }
    parts.push(blob);
    // Keep a copy on the device while we're here.
    if (!local) void cacheClip(clip.url);
    onProgress?.(i + 1, total);
  }
  return new Blob(parts, { type: 'audio/mpeg' });
}

/** Safe, readable file name: `Odyssey-DM-2026-08-13-<short id>.mp3`. */
export function narrationFileName(messageId: string, prefix = 'Odyssey-DM'): string {
  const date = new Date().toISOString().slice(0, 10);
  const short = (messageId || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 6) || 'clip';
  return `${prefix}-${date}-${short}.mp3`;
}

/**
 * Saves the blob to the phone. Uses the native share sheet when the browser
 * can share files (iOS/Android PWA + native shell), otherwise a normal
 * download.
 */
export async function saveAudioFile(blob: Blob, filename: string): Promise<void> {
  const file = typeof File !== 'undefined' ? new File([blob], filename, { type: 'audio/mpeg' }) : null;
  const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;

  if (file && nav?.canShare?.({ files: [file] }) && typeof nav.share === 'function') {
    try {
      await nav.share({ files: [file], title: filename });
      return;
    } catch (err: any) {
      // User dismissed the sheet — nothing more to do.
      if (err?.name === 'AbortError') return;
      // Anything else: fall through to the plain download.
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export { clipKey };
