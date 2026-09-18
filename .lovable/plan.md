# Instant Live DM presence and table-talk border

## What will change
- Make the green/grey dots in the Live DM Table react immediately when live party membership changes, while leaving the home-screen player cards on their existing refresh timing.
- Add a clear blue border to table-talk message bubbles whenever table-talk is the selected writing mode.
- Preserve existing selected, consumed, image, reply, swipe, and message-action behavior.

## Technical details
- Use the party's existing live updates as the immediate refresh signal for chat-only presence rather than changing the shared player-card timer.
- Keep the existing one-minute online threshold as a fallback for stale sessions.
- Apply the blue border only when a message is table talk and matches the current composer mode.

## Verification
- Confirm the app builds cleanly.
- Check the Live DM Table at a mobile viewport to ensure the border and status dots remain correctly positioned.
