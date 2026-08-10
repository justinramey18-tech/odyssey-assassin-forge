// Audio-focus strategy for narration playback.
//
// Phones hand the speaker to whichever app starts a new "now playing" session,
// which is why Spotify goes quiet the moment narration begins. These helpers
// make our narration behave like a polite, mixable side-channel instead:
//   1. one long-lived audio element reused for every clip (one session, not ten)
//   2. no media-session/lock-screen takeover
//   3. no remote/AirPlay handoff
//   4. on native builds, ask the OS for a "mix with others" audio session

let sharedAudio: HTMLAudioElement | null = null;
let savedMediaSessionState: string | null = null;

/** Marks an element as a background-friendly narration channel. */
export function markAsNarrationChannel(audio: HTMLAudioElement): void {
  try {
    audio.setAttribute('playsinline', '');
    audio.setAttribute('webkit-playsinline', '');
    audio.preload = 'auto';
    audio.crossOrigin = 'anonymous';
    (audio as unknown as { disableRemotePlayback?: boolean }).disableRemotePlayback = true;
  } catch {
    // ignore
  }
}

/**
 * One reusable element for the whole narration queue. Creating a fresh Audio
 * per clip makes the OS re-request focus on every segment, which is what kills
 * the music mid "play all".
 */
export function getNarrationAudio(): HTMLAudioElement {
  if (!sharedAudio) {
    sharedAudio = new Audio();
    markAsNarrationChannel(sharedAudio);
  }
  return sharedAudio;
}

/** Stops the OS from treating narration as the new lock-screen track. */
function suppressMediaSession(): void {
  try {
    const ms = (navigator as unknown as { mediaSession?: MediaSession }).mediaSession;
    if (!ms) return;
    if (savedMediaSessionState === null) savedMediaSessionState = ms.playbackState ?? 'none';
    ms.metadata = null;
    ms.playbackState = 'none';
  } catch {
    // ignore
  }
}

function releaseMediaSession(): void {
  try {
    const ms = (navigator as unknown as { mediaSession?: MediaSession }).mediaSession;
    if (ms && savedMediaSessionState) ms.playbackState = savedMediaSessionState as MediaSessionPlaybackState;
  } catch {
    // ignore
  }
  savedMediaSessionState = null;
}

/** Asks native shells for a mixable audio session, when such a plugin exists. */
async function setNativeMixWithOthers(enabled: boolean): Promise<void> {
  try {
    const cap = (window as unknown as {
      Capacitor?: { isNativePlatform?: () => boolean; Plugins?: Record<string, any> };
    }).Capacitor;
    if (!cap?.isNativePlatform?.()) return;
    const session = cap.Plugins?.NativeAudio || cap.Plugins?.AudioSession;
    if (session?.configure) {
      await session.configure({ mixWithOthers: enabled, focus: !enabled });
    } else if (enabled && session?.setCategory) {
      await session.setCategory({ category: 'ambient', mixWithOthers: true });
    }
  } catch {
    // plugin not installed — web fallback behaviour is fine
  }
}

/** Call right before the first clip of a narration run. */
export async function beginNarrationFocus(): Promise<void> {
  suppressMediaSession();
  await setNativeMixWithOthers(true);
}

/** Call once the whole narration run is finished or cancelled. */
export async function endNarrationFocus(): Promise<void> {
  releaseMediaSession();
  await setNativeMixWithOthers(false);
}
