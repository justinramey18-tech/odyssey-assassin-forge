# Narrate a DM message, save it, share it with the party

Add a small speaker button under every DM message in the party chat. Tapping it turns that message into spoken audio using Speechify and your chosen narration voice. The finished audio is stored with the game, so every player in the party sees a play button on that same message and can listen to it — no one has to re-generate it, and it survives reloads.

## How it behaves

- Each DM message gets a compact inline button at the bottom of the bubble:
  - No audio yet: speaker icon, "Narrate". Tapping generates the voice-over.
  - While generating: spinner, button disabled, "Voicing…".
  - Audio exists: play/pause icon, "Play". Anyone in the party sees this.
- Generation uses the narration voice and speed already picked in settings, and the message is cleaned first (headings, dividers, status footers stripped) so it reads as prose, exactly like the existing narrate-selected-messages feature.
- Very long messages are split, voiced in order, and joined into one continuous audio file before saving.
- Once saved, the audio appears for other players within a second or two (live sync), with a "voiced by <name>" hint.
- Only one narration plays at a time; starting another stops the previous one.
- The host (and co-hosts) can delete a saved narration from a message if they want it re-done.
- If no Speechify key is saved, the button explains that in a toast rather than failing silently.
- Solo DM mode gets the same button, but plays locally without saving (nothing to share there).

## Where the audio lives

Saved into the existing party audio storage area, one file per message, and remembered in a small new record that links: party, message, audio link, voice used, who made it, when. Party members can create and read these; only host/co-hosts can remove them.

## Technical notes

- New table `public.party_message_audio`: `id`, `party_id`, `message_id` (unique, FK to `party_dm_messages` on delete cascade), `audio_url`, `voice_id`, `provider`, `created_by`, `created_at`. Grants for `authenticated`/`service_role`, RLS enabled: SELECT/INSERT for `is_party_member(auth.uid(), party_id)`, DELETE for party creator or `is_co_host_of`. Added to the realtime publication with `REPLICA IDENTITY FULL`.
- Client generation reuses the existing `speechify-tts` edge function per chunk (`stripMarkdownForTTS` + `splitTextForStitching`), concatenates the returned blobs into a single `audio/mpeg` blob, uploads to the public `party-chat-audio` bucket at `<partyId>/narration/<messageId>.mp3`, then upserts the row.
- New hook `src/hooks/use-message-narration.ts`: loads existing rows for the visible party, subscribes to realtime inserts/deletes, exposes `generate(messageId, text)`, `play(messageId)`, `stop()`, and per-message status. Single shared `HTMLAudioElement` so playback is exclusive.
- New component `src/components/ai-dm/MessageNarrationButton.tsx` rendered inside the existing `PartyDMMessage` footer row (assistant role only), and in the solo message actions in `AIDMScreen.tsx` (local-only mode, no persistence).
- No changes to `party_dm_messages` schema or its policies — regular players cannot update that table, which is why the audio lives in its own record.
