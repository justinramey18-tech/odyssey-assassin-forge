# Fix the Full Access Enter Story cinematic

## What will change
- Correct the cinematic eligibility check so Full Access mode runs it unless reduced motion is preferred or the video has failed.
- Use the paused, poster-backed Enter Story video as the Full Access home background without changing Party, Magic Build, Empyrean, or Storyteller backgrounds.
- Keep the ambient zoom running before playback, then freeze it at its current position when the video starts to avoid a visual jump.
- Reset the temporary video failure state whenever the Home screen mounts.

## Verification
- Check the source and current build result after the edit.
- Confirm the Full Access background video has no autoplay or loop and retains its poster, inline playback, mute, and preload settings.
- Do not open any sign-in or account flows.
