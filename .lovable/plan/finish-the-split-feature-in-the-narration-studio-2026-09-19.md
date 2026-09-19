# Finish the Split feature in the Narration Studio

Split is half-built: you can only cut at a sentence boundary, and a piece that came from an earlier split can't be cut again. This finishes it so any piece can be cut anywhere, as many times as you like, down to a single word.

## What changes

**Choosing where to cut**
- Tapping Split now shows the piece's words laid out with a tap point between each one. Tap between two words and the piece becomes two pieces there.
- Sentence starts are highlighted as quick shortcuts, so the common case stays one tap.
- Split is offered on every piece with more than one word. A one-word piece shows "This piece is a single word — it can't be split further."

**Splitting again and again**
- A piece produced by a split can be split again. Today the second cut silently does nothing; after this it behaves exactly like the first.

**What happens to audio**
- Both new halves start silent, ready to be voiced or recorded.
- The original take is not destroyed — one tap of Undo restores the piece and its audio.

**Merge**
- Merging two pieces back together keeps working and now only affects the two pieces you picked, instead of occasionally clearing the voice on a neighbouring piece whose words overlap.

## Technical notes

All work is in `src/components/ai-dm/NarrationStudio.tsx` and `src/lib/tts-utils.ts`.

- `applyOverrides` currently skips any segment already marked `manual`, so an override carved out of a previously split piece never places. Change the loop to also carve inside `manual` segments when the match is strictly contained in one: the before/after remainders keep the parent's `manual`, `voiceId` and `para`, and the new middle piece takes the incoming override. `placed` semantics and segment order stay as they are; `segmentKey` is untouched.
- Overrides are stored newest-last and applied in array order, which is the nesting order splits need — keep that, and make split always write the two child overrides after removing the parent's own override entry.
- Replace `splitSentences`-only picking with a word-level tokenizer over `stripMarkdownForTTS(seg.text)` that returns words plus their offsets, and mark tokens that begin a sentence. `splitPiece(row, wordIndex)` builds `pieceA`/`pieceB` from the word list, writes both as overrides carrying the piece's resolved voice, then re-splits and calls `replaceInOrder` with the two resulting keys (existing logic, driven by word index instead of sentence index).
- Split UI: a wrap-flow of word chips inside the existing sky-bordered panel, 48px-tall tap targets between words, sentence-start separators emphasised. Keep it inside the same `splitting` block.
- `removeMatchingOverride` currently matches on loose substring in both directions, so a short piece can delete a longer neighbour's override. Tighten it to exact loose equality, with containment only when the stored override is fully inside the segment's own text; use it from `mergeWithNext` and `voicePiece` unchanged otherwise.
- Undo already snapshots overrides plus studio state before each edit; split/merge keep calling `pushHistory(takeSnapshot())`, so audio rows are left in storage and restored by the existing path. No clip deletion is added.
- `onShareVoices()` is still called after split and merge so the party re-splits identically.

## Out of scope

Editing the story text itself, splitting the DM aside row, and any change to playback order, speeds or voicing.
