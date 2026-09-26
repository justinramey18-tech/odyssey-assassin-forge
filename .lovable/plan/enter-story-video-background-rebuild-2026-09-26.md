# Enter Story video background rebuild

## What will change
- Replace the default party home background with the paused Enter Story video and its exact first-frame poster.
- Keep custom, Momo, and other mode backgrounds unchanged; those paths will open Party DM immediately.
- Start the already-mounted background video after two seconds while Party DM loads behind it.
- Remove the old black video overlay, retaining only skip handling, failure safeguards, and the white ending fade.

## Timing and safeguards
- The existing Home interface fades for four seconds while the background remains unchanged.
- The video starts once at two seconds and ends with the existing 400ms white handoff.
- Reduced-motion, playback errors, safety timeouts, taps, and Skip all bypass safely to Party DM.
- Stable callback references and activation-only timing remain intact to prevent timer restarts.

## Verification
- Check the poster matches frame zero, the video is paused by default, existing looping backgrounds are untouched, and the two edited files pass the project checks.
- Do not open authentication or create test data. Physical iPhone notification/rendering behavior cannot be proven in this environment; the required iOS poster and inline-video settings will be verified in source.
