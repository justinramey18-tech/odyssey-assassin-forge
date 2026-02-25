# ElevenLabs TTS Integration — Implementation Complete

## What Was Built

### Edge Functions
- `supabase/functions/elevenlabs-tts/index.ts` — Streaming TTS proxy with tiered API key resolution (user key → backend secret fallback), CORS headers, `eleven_turbo_v2_5` model, narration-optimized voice settings (stability 0.6, similarity 0.75)
- `supabase/functions/elevenlabs-voices/index.ts` — Voice list proxy returning all voices (premade, cloned, custom) from user's ElevenLabs account

### Client Infrastructure
- `src/lib/api-keys.ts` — Extended with `elevenlabs` provider
- `src/lib/tts-utils.ts` — `stripMarkdownForTTS()`, `splitTextForStitching()` (request stitching for >5000 char messages), voice cache with 1-hour TTL, voice ID persistence
- `src/hooks/use-narrator.ts` — Playback hook with blob URL cleanup on end/unmount, `fetch().blob()` for binary audio, loading/playing state
- `src/components/settings/ElevenLabsVoicePicker.tsx` — Voice selector grouped by category (Cloned, Custom, Premade) with refresh button and localStorage cache
- `src/components/settings/ApiKeySettings.tsx` — Refactored with reusable `ApiKeyInput` component, added ElevenLabs key section + voice picker

### DM Screen Integration
- `src/components/ai-dm/AIDMScreen.tsx` — Speaker button (🔊/🔇) after Send button, reads last assistant message
- `src/components/ai-dm/PartyDMScreen.tsx` — Speaker button in media attachment row and "Ready! Waiting..." state

## Architecture

```
User clicks 🔊 → useNarrator.playMessage(text)
  → stripMarkdownForTTS(text)
  → splitTextForStitching(text, 5000) if needed
  → fetch(elevenlabs-tts edge function) with user API key + voiceId
  → Edge function → ElevenLabs /stream endpoint
  → Returns chunked audio binary
  → Client builds blob URL → Audio.play()
  → URL.revokeObjectURL() on end/unmount
```
