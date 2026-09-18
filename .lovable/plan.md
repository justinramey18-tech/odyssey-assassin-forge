# Fix: "Play all" stops with "Nothing to narrate"

## What is going wrong

When you narrate a message and then hand-pick custom voices for a few passages, "Play all" first fills in the pieces that still have no audio, then plays everything in order.

While filling those gaps it walks the story piece by piece. Some pieces contain nothing speakable once decoration is removed — a divider line, a status line with a symbol in front, a heading on its own, a line that was only bold markers. When it reaches one of those, the voice service is handed an empty piece of text, which raises "Nothing to narrate."

That single failure stops the whole run. Nothing is voiced, nothing plays, and you just see the error toast — even though most of the story was ready to go.

## The fix

1. Skip unspeakable pieces instead of sending them to the voice service. If a piece has no real words left after decoration is stripped, it is passed over silently and the run continues.
2. Make one failed piece non-fatal. If a single passage genuinely fails (network hiccup, service error), the run logs it, keeps going with the rest, and reports how many clips were made rather than throwing everything away.
3. Never block playback because of the fill-in step. After the fill-in finishes — fully or partly — "Play all" still plays every clip it has, in story order. It only reports a problem if there is truly nothing to play.
4. Leave empty pieces out of the story split in the first place, so they never appear as gaps needing audio and never leave a silent hole in the running order.

Unchanged: your hand-picked voices, your own recordings, the DM aside, the order the story plays in, and tapping "Play all" while it is playing to stop it.

## Technical notes

- `src/hooks/use-message-narration.ts`
  - `castRun`: before synthesizing a segment, compute `stripMarkdownForTTS(seg.text)`; when it is blank, count it as done and `continue`. Wrap each segment's synthesize/store in its own try/catch so a single failure increments a `failed` counter and continues; the closing toast reports clips created, and mentions skipped pieces when `failed > 0`.
  - `playAll`: treat a `castRun` rejection as non-fatal — log it, then still call `buildOrderedClips` and play. Only show an error toast when the resulting queue is empty.
- `src/lib/tts-utils.ts`
  - `splitStorySegments`: filter out segments whose `stripMarkdownForTTS(text)` is empty before `mergeNarrator`, keeping the existing whole-story fallback when the filter empties the list. `segmentKey`, paragraph numbering, and override matching stay as they are.
