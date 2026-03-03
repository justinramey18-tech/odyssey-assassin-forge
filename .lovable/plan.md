

## Current State

The app already has a "Custom Voice ID" text input where you can manually paste a Speechify voice ID. Your cloned voices will work if you enter the correct ID — the API call already passes whatever `voice_id` is selected.

## Proposed Enhancement: Auto-Fetch Cloned Voices

Instead of manually entering IDs, the app can fetch your voice library from the Speechify API and display your clones in the picker.

### Changes

1. **New Edge Function `speechify-voices/index.ts`**
   - Accepts the user's Speechify API key
   - Calls `GET https://api.sws.speechify.com/v1/voices` with the key
   - Returns the list of voices (including clones) to the client

2. **Update `SpeechifyVoicePicker` in `ElevenLabsSettingsTab.tsx`**
   - Add a "Fetch My Voices" button that calls the new edge function
   - Display cloned/custom voices in a separate section above the default presets
   - Cache fetched voices in localStorage (similar to ElevenLabs voice cache)
   - Each voice shows its name and type (e.g., "cloned" vs "default")

3. **Update `tts-utils.ts`**
   - Add Speechify voice cache helpers (similar to existing ElevenLabs ones)

### What stays the same
- The custom voice ID text input remains as a manual fallback
- The TTS playback logic is unchanged — it already passes any `voice_id`
- No database changes needed

