# Record your own voice for a highlighted passage

Today you can highlight text in a DM response and pick a voice for it. This adds a third option: record that passage yourself with your microphone, listen back, re-record if you don't like it, and save it so it plays in its place during "Play all".

## How it will work

1. Highlight a passage in the DM response and tap **Voice selection** (unchanged).
2. The voice picker now shows a **Record my voice** option next to the existing cast/Narrator/DM choices.
3. Tapping it opens the same in-app recorder already used elsewhere in party chat:
   - Up to 60 seconds, big start/stop control, live timer.
   - When you stop, you get a playback preview with **Discard / Record again** and **Save for this passage**.
4. Saving uploads the clip to the party's shared audio storage and files it against that passage, exactly like an AI-generated clip. Everyone in the party hears it.
5. **Play all** runs clips in story order; your recording plays when it reaches that passage.
6. If that passage already had AI audio, your recording replaces it. Re-recording overwrites again; deleting the clip (existing "Clear audio" / per-clip delete) restores the ability to generate AI audio for it.
7. The passage shows a small "your voice" marker so it's obvious it isn't AI narration.

## Technical notes

- Reuse `PartyDMAudioRecorder` (60s cap, MediaRecorder, preview + re-record) rather than writing a new recorder; open it from `MessageNarrationBar` when the user picks "Record my voice".
- The highlighted passage already registers as a narration override via `addNarrationOverride`, which makes it its own segment with a stable `segmentKey`. Save the recording under that same segment key.
- Add a `storeRecording(messageId, part, blob)` path in `use-message-narration.ts` that mirrors `storeClip`: upload to the `party-chat-audio` bucket under `${partyId}/narration/...`, then upsert into `party_message_audio` on `message_id,part`. Upsert means a re-record replaces the previous clip and any AI clip for that segment.
- Store the recording's real container/extension (m4a on iOS, webm elsewhere) instead of forcing `.mp3`, and set the matching content type on upload so playback works on all devices.
- Mark the row so the UI can label it as a human recording (a `voice_id` sentinel such as `self-recorded`, no schema change needed).
- `playAll` already resolves clips by segment key, so no change is needed there beyond the clip existing.
- Cast/AI generation should skip segments that already hold a recorded clip so it never overwrites your voice.
