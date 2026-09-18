# Your own recording takes over a piece — without losing the cast voice

When you record yourself over a piece of the story that already has a Speechify cast voice, your recording should simply win: it saves straight onto that piece, plays in Play all, and the earlier cast audio stays safely in place so you can switch back at any time.

## What's happening today

Recording over a piece does replace it with your voice, but the piece quietly changes identity underneath. The old cast audio is still stored, just no longer reachable — there is no way back to it, and the studio gives you no hint that a cast take exists.

## What changes

**In the Narration Studio, for any piece you've recorded yourself:**

- The piece is labelled as your recording, and if it had a cast voice before, it says which one it's covering (for example: "Your voice — covering Narrator").
- A **Revert to cast voice** button appears. Tapping it brings the earlier Speechify take straight back, instantly, with no new Speechify call and no cost.
- If you revert and then record again, your recording comes back the same way. Both takes keep existing side by side.
- **Re-record** stays available on a piece that already has your voice, and overwrites only your own take.

**When you finish a recording:**

- It is saved to that exact piece as soon as you submit it — no extra confirm step — and shared with the party so everyone hears it in Play all.
- Nothing is deleted. The cast audio for that piece is left untouched in storage.

**Deleting audio** on a piece removes only the take you are currently hearing; the other take stays available.

## Technical notes

- Recording a piece currently writes a self-voice override, which changes the piece's `segmentKey` (voice id is part of the hash). The prior Speechify row remains in `party_message_audio` under the old key but becomes unreachable. That mechanism stays — we add memory of what was displaced.
- Add per-message, per-piece "displaced voice" memory alongside the existing studio state in `src/lib/tts-utils.ts` (same localStorage record as order/rates): map self-recorded part key -> `{ previousOverride | null, previousPart, previousVoiceId, previousLabel }`. Written when a recording is saved, read for labelling and revert.
- In `src/hooks/use-message-narration.ts`, `recordSegment` captures the segment's pre-existing override/voice and resulting old part key before adding the self override, then stores that memory after a successful upload. Add a `revertToCastVoice(messageId, content, part)` that removes the self override, restores the remembered prior override (if any), republishes overrides, and dispatches the existing overrides event so every client re-splits. No storage or table rows are deleted.
- `src/components/ai-dm/NarrationStudio.tsx`: rows for self-recorded pieces show the displaced voice label and a Revert button (only when memory exists and the old clip row is still present in `narrationMap`); Record becomes Re-record. Wire the new callback as an optional prop through `MessageNarrationBar.tsx` and `PartyDMScreen.tsx`, matching the existing optional-callback pattern.
- Deletion stays scoped to the current part key only.
