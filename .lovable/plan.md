# Edit the spoken words of a narration piece

Add a way, inside the Narration Studio, to change the exact words a piece is read
aloud with — fixing a mispronounced name, dropping a stray label, adding a pause —
without ever touching the story text in chat.

## How it works

- Each piece in the Studio gets a small pencil control next to its number box.
- Tapping it turns the piece's text into an editable box, pre-filled with the words
  currently being read aloud (the cleaned-up version, no asterisks or markers).
- Save keeps the edit; Cancel drops it. A short "edited" tag shows on any piece whose
  spoken words differ from the story, with a "Reset to story words" option on it.
- From then on, voicing that piece (single or batch) sends the edited words to the
  voice service. Everything else — order, speed, your own recordings, delete, undo —
  behaves exactly as before.
- If a piece already has audio, editing the words does not change that audio. The tag
  reminds you the clip is out of date; re-voice the piece to hear the new wording.
- Editing is available to the host and co-hosts, the same people who can assign voices
  and generate audio today. Other players see the pieces but no pencil.
- The message shown in chat is never changed, and neither is the split into pieces:
  a piece keeps its identity, so existing clips and voice picks still match.
- Undo covers word edits like it covers order, deletion and voicing.

## Technical notes

Two files only: `src/lib/tts-utils.ts` and `src/components/ai-dm/NarrationStudio.tsx`.

- `NarrationStudioState` gains `scripts?: Record<string, string>` — part id to spoken
  text. Validated and persisted in `saveStudioState` alongside `order`, `rates`,
  `hidden`; an entry equal to the piece's default cleaned text is dropped.
  Keyed by part id deliberately, so `segmentKey` and clip matching are untouched.
- Studio rows: `displayText` falls back to `studio.scripts?.[row.part]` when present;
  `singleVoice`/batch voicing pass that same string to `onVoiceSegment` instead of
  `seg.text.trim()`. Empty or whitespace-only edits are rejected and snap back.
- Edit UI is inline (Textarea + Save/Cancel), gated on `canGenerate`, 48px targets,
  `touchAction: 'manipulation'`.
- `takeSnapshot`/`pushHistory` already capture the whole `NarrationStudioState`, so
  undo restores scripts once the field exists; the reset control clears `scripts` for
  that part, and "Back to story order" clears all of them along with order and hidden.
- No database, edge function or dependency changes; studio state stays on the device.
