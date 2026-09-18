# Narration Studio — the single place to shape a message's audio

Today voice work is spread across the small bar under a message and highlighting text to pick voices. This replaces that flow entirely. All of it moves into one full-screen screen per DM message: assigning voices, Speechify voicing, mic recording, splitting and merging, ordering, and per-piece speed.

Under each message only two controls remain: **Play all** and **Edit narration**. Highlighting text to assign a voice is removed.

## What the screen shows

A vertical list, one row per piece of the story, in the order it will play. The DM's out-of-character aside is the first row when it exists. The pieces start as the paragraphs exactly as they appear in the story text — you do not define what counts as a paragraph up front. From there you reshape them with Split and Merge until the pieces match how you want the audio to sound.

Each row shows:
- The words of that piece, in full, so it can be read aloud as a script while recording.
- Who voices it: a cast voice, a hand-picked voice, your own recording, or plain narration.
- Whether it has audio yet, or is still silent.
- A play button to hear just that piece.
- A speed control for that piece alone.
- A checkbox so it can be included in a batch action.
- A drag handle to move it up or down.

A bar at the bottom plays the whole message start to finish using your custom order, so you can check the draft in one go.

## What you can do

To a single piece:
- **Listen** to it on its own.
- **Assign a voice** from your cast list or any available voice.
- **Send it to Speechify** to voice or re-voice it, replacing the current audio for that piece.
- **Record it with your microphone**, with the piece's words on screen as your script; a recording replaces whatever was there and is never overwritten by Speechify.
- **Set its play speed** (0.5x to 2x). Playback only — it does not re-voice anything and costs nothing. Speed stays strictly per piece; nothing carries over automatically.
- **Split it** into two pieces at a point you choose, or **merge** it with the piece below, so a long paragraph can get two voices or two short lines can share one.
- **Delete its audio** so it can be voiced fresh.

Across pieces:
- **Voice several pieces at once**: tick the rows, pick a voice, and every ticked piece is sent to Speechify in that voice in one batch, with progress shown.
- **Undo**: every editing action — delete, split, merge, reorder, re-voice, record, voice assignment — can be undone with one tap while the screen is open.
- **Play the draft**: Play all at the bottom, using your custom order and speeds.

## Order

Dragging changes only the order the audio plays in. The written story stays exactly as it is on screen. A reset control restores story order.

## Who can do what

- Hosts and co-hosts: everything.
- Other players: open the screen, listen to any piece, play the draft, set their own playback speeds, and record pieces with their own voice. Voice assignment, Speechify voicing, splitting, merging, reordering and deleting stay host-only, matching the current rule.

## Removed

- Highlight-to-assign-voice and its passage-matching chip in the message view.
- The voice picker, Record my voice, and voice-cast controls on the message bar. Existing saved audio, overrides, and recordings keep working — the studio reads and writes the same storage.

## Technical notes

- New full-screen overlay `src/components/ai-dm/NarrationStudio.tsx`, opened from `MessageNarrationBar`, stacked in the narration layer (below the character sheet, above the DM overlay) per the existing z-index ladder.
- Rows come from `splitStorySegments(splitDMResponseParts(content).story, messageId)` plus the `table` part, so the studio and `buildOrderedClips` agree on identity. Clip lookup uses `segmentKey(seg)` with the legacy `segmentPart(i)` fallback, unchanged.
- Per-message editing state (custom order, per-piece speed, split/merge records) is stored as narration overrides in the existing `tts-utils.ts` storage, not raw localStorage. Values the party must share (order, splits, merges, voice assignments, audio) are persisted alongside the existing `party_message_audio` rows; a player's own playback speed stays on device.
- Undo is an in-memory history stack of the message's edit records plus clip rows, session-scoped to the open screen; closing the screen clears it.
- Batch voicing iterates selected rows through the existing `generateSegment` path with progress reporting, skipping self-recorded clips unless explicitly chosen.
- `buildOrderedClips` gains the applied order and a per-clip `rate`; `runQueue` sets `audio.playbackRate` from the clip's rate, falling back to `loadNarrationSpeed()`. `playAll` behaviour (stop-when-playing guard, gap filling via `castRun`) is unchanged.
- Splits carve a piece via `addNarrationOverride` on the sub-passage so keys stay text-derived. Merges record an adjacency hint consumed after `applyOverrides`, preserving the `seg.para` merge rules.
- Re-recording reuses `PartyDMAudioRecorder` and `recordSegment`; deleting reuses `remove`. `castRun` continues to skip self-recorded clips.
- Download/stitching keeps working because it reads the same ordered clip list.
- `MessageNarrationBar` is trimmed to Play all and Edit narration; `generateSegment`'s passage-based entry point is kept internally because the studio's split and record flows call it.

## Out of scope

Background music per piece, read-along highlighting during playback, clip-length display, free device-voice previews, and any change to the message text itself.
