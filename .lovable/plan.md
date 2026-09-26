# Enter the Story cinematic transition

## What will change
- Add a reusable full-screen cinematic layer that preloads the supplied 8-second video as soon as the Home screen mounts.
- Replace the direct Party DM launch from the roster emblem with a guarded sequence: fade the Home screen, begin the video and load Party DM behind it after 2 seconds, then reveal the loaded screen through the video's white ending.
- Add tap-to-skip, a delayed Skip button, reduced-motion bypass, playback fallback, error recovery, a safety timeout, and complete timer cleanup.
- Place the supplied video at `public/enter-story-cinematic.mp4` so it streams without joining the app bundle.

## Timing and behavior
1. Tap: haptic fires immediately and the Home screen begins a 4-second ease-out fade.
2. At 2 seconds: the cinematic fades in over 300ms, playback starts, and Party DM begins loading behind it.
3. At video end: the video is replaced by pure white, which fades away over 400ms to reveal Party DM.
4. If playback fails, the video errors, the player skips, or the safety timer expires, the cinematic closes without trapping the player.
5. Reduced-motion users go directly to Party DM.

## Technical details
- Only `HomeScreen.tsx`, the new `EnterStoryCinematic.tsx`, and the supplied public video are involved.
- Existing Party DM opening behavior and the roster button's public interface remain unchanged.
- The fixed overlay uses full-viewport cover sizing, including a 360px-wide phone viewport.
