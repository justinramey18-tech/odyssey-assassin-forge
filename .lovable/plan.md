# Character voices in party DM narration

Today a DM response can be narrated in two clips: the DM's table-talk aside and the story. This adds a third layer — spoken lines by named characters, each in its own assigned voice — and plays everything back in the order it appears in the story.

## What you'll get

1. **Speaker tags in DM responses.** The DM marks each spoken line with the speaker's name, e.g. a hidden tag before dialogue. Everything untagged stays narration.
2. **A Voice Cast list.** In Speechify settings, a new "Voice Cast" panel where you add a character name and pick a voice for it. Names are matched case-insensitively. Anyone not in the cast falls back to the narrator voice.
3. **One-tap narration.** The existing narrate button becomes "Narrate all": it builds the DM aside, then walks the story top to bottom, sending each narration stretch to the narrator voice and each tagged line of dialogue to that character's voice. Progress shows as "3 of 9 clips".
4. **Play all in story order.** Plays the DM aside first, then every clip in the exact order it appears in the response. A small caption under the player shows who is currently speaking.
5. **Shared with the party.** As today, clips are saved and appear for every player, who can press play without regenerating.

## Notes and limits

- Existing single-clip narrations keep working; nothing already generated is lost.
- If the DM forgets to tag a line, that line is simply read by the narrator voice — no failure.
- Regenerating re-does the whole message (per-line regeneration is not part of this).
- Party DM only; solo mode is unchanged.

## Technical detail

**Tagging.** Add a speaker tag convention (`[VOICE:Name] ... [/VOICE]`, plus tolerance for the DM writing `**Name:** "line"`) to the party DM system prompt in `supabase/functions/ai-dm/index.ts`, alongside the existing `[TABLE]` convention. Strip the tags for display in `stripTableTalkTags` (`src/lib/tts-utils.ts`) so players never see them.

**Segmentation.** New `splitDMResponseSegments(text)` in `src/lib/tts-utils.ts` returning an ordered array `{ index, speaker: string | null, text }` after `splitDMResponseParts` has removed the table-talk aside. Adjacent untagged text merges into one narration segment.

**Voice cast.** New helpers `loadVoiceCast()` / `saveVoiceCast()` in `tts-utils.ts` backed by a single localStorage key (`dnd-speechify-voice-cast`, a name → voiceId map). Account-level, not character-scoped. New `VoiceCastSection` rendered inside the Speechify block of `src/components/settings/ElevenLabsSettingsTab.tsx`, reusing the existing voice picker for each row plus add/remove.

**Storage.** No migration needed: `party_message_audio.part` is free text with a unique key on `(message_id, part)`. Segment clips use `part = 'seg-<index>'`; `table` and `story` keep their meaning. Files upload to `${partyId}/narration/${messageId}-seg-<index>.mp3`.

**Hook.** Extend `src/hooks/use-message-narration.ts`:
- `generateAll(messageId, content)` — resolves table talk plus segments, generates each sequentially through the existing `speechify-tts` edge function with the mapped voice, uploads and upserts each row; exposes `{ done, total }` progress.
- `playAll(messageId)` — queues `table`, then `seg-0..n` in index order (falling back to the legacy `story` clip when no segments exist), reusing the current queue runner; expose the current segment's speaker name for the caption.
- `remove` clears all parts for a message.

**UI.** `src/components/ai-dm/MessageNarrationBar.tsx` swaps the two separate generate buttons for a single "Narrate all" (with progress), keeps the DM-aside play button, adds "Play all" with the speaker caption, and keeps delete host/author-gated as today. No change needed in `PartyDMScreen.tsx` beyond passing the new callbacks.
