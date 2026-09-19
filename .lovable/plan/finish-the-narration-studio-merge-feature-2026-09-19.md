# Finish the Narration Studio merge feature

## What happens today

The Merge button on a piece joins it with the piece directly below by deleting both pieces' instructions and hoping the story falls back to one natural paragraph. That only works when both pieces came from the same paragraph and in their original order. It fails silently (nothing visibly changes) when:

- the two pieces sit on opposite sides of a paragraph break
- the pieces were reordered
- the words the code searches for no longer match after markdown trimming

## The change

Make merge work like split does: instead of deleting both pieces and hoping, write one explicit merged piece that covers the combined words, in the position the pair used to sit.

## Details

- **Merged piece is real**: the two pieces' words are joined into one stored piece, so merging works across paragraph breaks and after reordering, with no guessing about where the story "naturally" splits.
- **Voice of the merged piece**: the top piece's voice assignment wins. If the two pieces had different voices, the merged piece takes the top piece's voice — a toast says so when the voices differed, so it is never a surprise.
- **Audio after merging**: the merged piece starts unvoiced. Each piece's existing audio (a cast take or a personal recording) is left untouched on its old piece, and Undo brings both pieces back with their audio.
- **Position**: the merged piece appears exactly where the pair was in the list, including any custom order.
- **Merge button**: still joins a piece with the one below it, but is now also disabled when the piece below is the intro (nothing to merge into a story piece), and shows a short hint when there is nothing to merge.
- **Undo**: unchanged — one tap restores both original pieces, their voices, and any audio that was on them.

## Files touched

- `src/components/ai-dm/NarrationStudio.tsx` — merge logic and button states.

No other files change. Playback, recording, speeds, ordering, and split are untouched.
