# Fix recorded-piece verification in Narration Studio

## Goal
After **Send audio**, the recording must visibly remain attached to the exact piece, its **Listen** button must work immediately, and the whole piece must clearly highlight while it plays.

## Plan
1. **Keep one exact piece identity through the entire save**
   - Have the recording save return the final saved piece and audio details instead of making the screen rediscover them from the passage text.
   - Use that returned identity for the refreshed Studio row, the Listen action, and Play all.
   - Keep the existing text matching only as a fallback for older callers.

2. **Make the saved take available immediately**
   - Update the narration list with the completed recording before closing the recorder.
   - Refresh the Studio row from that saved result so it changes from **silent** to **has audio** without reopening the screen.
   - Only show the success message after the exact row can resolve the saved recording.
   - If saving or attaching fails, keep the recorder open and retain the take for another attempt.

3. **Make playback verification obvious**
   - Ensure **Listen** uses the recording attached to that exact piece, including its current playback speed.
   - Highlight the complete piece while it is playing, not just swap the Listen icon to Stop.
   - Clear the highlight when playback ends, is stopped, or fails.

4. **Preserve narration behavior**
   - Keep the covered Speechify take intact and preserve **Revert to cast voice**.
   - Keep microphone recordings excluded from Speechify generation.
   - Confirm Play all uses the microphone take at the correct point in the custom order.

## Verification
- Record a piece, choose **Send audio**, and confirm it immediately shows **has audio** with an enabled **Listen** button.
- Tap **Listen** and confirm that exact row highlights while the microphone take plays.
- Stop and replay it, then verify Play all uses the same take in sequence.
- Re-record the piece and confirm the new take replaces the active microphone take while the prior Speechify take remains available for reverting.
- Verify the behavior on a mobile-sized screen and check for playback or save errors.

## Technical scope
Only the narration hook and Narration Studio/message wiring will change. No story text, unrelated audio controls, or database structure will be changed unless verification reveals a confirmed storage-policy blocker.
