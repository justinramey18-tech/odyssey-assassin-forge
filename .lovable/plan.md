# Narration Studio — a full-screen editor for a message's audio

Today you shape a message's audio from the small bar under it: narrate, highlight a passage, pick a voice, record. This adds a dedicated full-screen workspace for one DM message where you can see every piece of the story as a list and polish it until the whole thing plays perfectly.

Under each message only two buttons remain: **Play all** and **Edit narration**. Everything else moves into the new screen.

## What the screen shows

A vertical list, one row per piece of the story, in the order it will play. The DM's out-of-character aside is the first row when it exists.

Each row shows:
- The words of that piece (trimmed, tappable to expand).
- Who voices it: a cast voice, a hand-picked voice, your own recording, or plain narration.
- Whether it has audio yet, or is still silent.
- A play button to hear just that piece.
- A speed control for that piece alone.
- A drag handle to move it up or down.

A bar at the bottom of the screen plays the whole message start to finish, using your custom order, so you can check the draft in one go. A top action voices everything that is still silent in one pass.

## What you can do to a piece

- **Listen** to it on its own.
- **Re-record it** with your microphone, using the existing in-app recorder, with the piece's text shown on screen as your script.
- **Send it to Speechify again** to re-voice it, which replaces the current audio for that piece.
- **Assign a voice** from your cast list or any available voice.
- **Set its play speed** (0.5x to 2x). This changes how it plays back and how it sounds in Play all; it does not re-voice anything and costs nothing.
- **Split it** into two pieces at a point you choose, or **merge** it with the piece below, so a long paragraph can get two voices or two short lines can share one.
- **Delete its audio** so it can be voiced fresh.

Highlighting text directly in the message still works as it does now; the editor is an additional way in, not a replacement.

## Order

Dragging changes only the order the audio plays in. The written story stays exactly as it is on screen. A reset control puts the order back to story order.

## Who can do what

- Hosts and co-hosts: everything.
- Other players: open the screen, listen to any piece, play the draft, set their own playback speeds, and re-record pieces with their own voice. Voice assignment, Speechify re-voicing, splitting, merging, reordering and deleting stay host-only, matching the current rule.

## Technical notes

- New full-screen route/overlay component `src/components/ai-dm/NarrationStudio.tsx`, opened from `MessageNarrationBar` and stacked at the narration layer (below the character sheet, above the DM overlay) per the existing z-index ladder.
- Rows are built from `splitStorySegments(splitDMResponseParts(content).story, messageId)` plus the `table` part, so the studio and `buildOrderedClips` agree on identity. Clip lookup uses `segmentKey(seg)` with the legacy `segmentPart(i)` fallback, unchanged.
- Per-message editing state (custom order, per-piece speed, split points, merge pairs) is stored as a new narration edit record keyed by message id, written through the existing narration-override storage in `tts-utils.ts` rather than a new raw localStorage path. Host edits that must be shared with the party are persisted alongside the existing `party_message_audio` rows so every player sees the same draft; local-only values (a player's own playback speed) stay on device.
- `buildOrderedClips` gains an optional applied order and per-clip `rate`; `runQueue` sets `audio.playbackRate` from the clip's rate, falling back to `loadNarrationSpeed()`. `playAll` behaviour (stop-when-playing guard, gap filling via `castRun`) is unchanged.
- Splits carve a piece via `addNarrationOverride` on the sub-passage, matching the existing highlight path, so keys stay text-derived. Merges record an adjacency hint consumed after `applyOverrides`, preserving `seg.para` rules.
- Re-recording reuses `PartyDMAudioRecorder` and `recordSegment`; re-voicing reuses `generateSegment`; deleting reuses `remove`. `castRun` continues to skip self-recorded clips.
- Download/stitching keeps working because it reads the same ordered clip list.

## Out of scope

Background music per piece, and any change to the message text itself.
