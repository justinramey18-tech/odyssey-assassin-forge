# Plan Improvements for ElevenLabs TTS Integration

## Issues Found in the Current Plan

### 1. API Key Architecture — Use the Existing Proxy Pattern, Not a Server Secret

The current plan says the user's ElevenLabs API key is "passed in the request body" to the edge function, which is correct. But it should explicitly follow the **tiered resolution pattern** already established for Anthropic keys:

- Edge function checks `user_api_key` from request body first
- Falls back to a backend secret (`ELEVENLABS_API_KEY`) if none provided
- This means you could optionally store a platform-wide ElevenLabs key as a secret for a default/demo experience, while power users bring their own

The plan should also note that these edge functions should set `verify_jwt = false` in `config.toml` and skip JWT checks when `user_api_key` is provided — matching the existing security pattern for narrative functions.

### 2. Streaming TTS Instead of Full File Generation

The plan proposes fetching a complete audio file before playback. For DM narration messages that can be 500+ words, this means a noticeable delay before any audio plays. The knowledge docs show ElevenLabs supports **streaming TTS** (`/v1/text-to-speech/${voiceId}/stream`) which returns chunked audio immediately.

**Improvement:** Use the streaming endpoint with `eleven_turbo_v2_5` and pipe `response.body` directly back to the client. On the client side, use `MediaSource` API or simply pass the stream to an `Audio` element via a blob URL built from the streamed response. This cuts time-to-first-audio dramatically.

### 3. Binary Audio Fetching — Documented Pitfall

The plan correctly says "use `fetch().blob()` not supabase SDK" but should elevate this to a prominent warning. The knowledge doc explicitly states: *"use `fetch()` with `.blob()` instead of `supabase.functions.invoke()` because the SDK defaults to parsing responses as JSON, which corrupts binary audio data."* This is critical and easy to miss during implementation.

### 4. CORS Headers — Must Use the Exact Required Format

The edge function knowledge specifies exact CORS headers that must be included. The plan doesn't mention CORS at all. Both edge functions need:

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, ...',
}
```

Plus the `OPTIONS` preflight handler.

### 5. Voice Picker Should Cache Voices

Fetching voices from ElevenLabs on every Settings open is wasteful. **Improvement:** Cache the voice list in localStorage with a TTL (e.g., 1 hour). Show cached voices immediately, with a refresh button to re-fetch. This also handles the case where the user opens Settings offline.

### 6. Missing: Markdown Stripping Details

The plan mentions "strip markdown syntax" but doesn't specify how. DM messages contain headers (`##`), bold (`**`), italic (`*`), lists (`-` ), and sometimes code blocks. **Improvement:** Define a `stripMarkdownForTTS` utility that:

- Removes `#`, `**`, `*`, ```, `---`
- Converts `-`  list items to natural pauses (periods)
- Preserves quoted dialogue text
- Handles the `>`  blockquote syntax common in DM narration

### 7. Missing: Request Stitching for Long Messages

DM messages can exceed 5000 characters. The plan mentions "truncate with a toast warning" — but the knowledge docs describe **request stitching** using `previous_text` / `next_text` parameters. **Improvement:** For messages over 5000 chars, split at paragraph boundaries, use request stitching for prosody continuity, and concatenate the audio blobs before playback. This is a better UX than silently cutting off narration.

### 8. Missing: `config.toml` Entry

Both edge functions need entries in `supabase/config.toml`:

```toml
[functions.elevenlabs-tts]
verify_jwt = false

[functions.elevenlabs-voices]
verify_jwt = false
```

### 9. Voice Settings Tuning for DM Narration

The plan uses default voice settings. The knowledge docs recommend specific settings for narration: **stability 0.5–0.7, similarity_boost 0.75**. The plan should hardcode these as sensible defaults for the DM narrator use case, with potential future exposure in settings.

### 10. Missing: Cleanup of Audio Object URLs

The `useNarrator` hook creates blob URLs via `URL.createObjectURL()`. These must be revoked with `URL.revokeObjectURL()` when playback ends or the component unmounts, otherwise they leak memory. Add cleanup in the `onended` handler and in a `useEffect` cleanup function.

## Revised Plan Summary


| Area            | Original               | Improved                                                   |
| --------------- | ---------------------- | ---------------------------------------------------------- |
| TTS endpoint    | Full file generation   | **Streaming** (`/stream`) for faster first-audio           |
| Long messages   | Truncate at 5000 chars | **Request stitching** with paragraph splitting             |
| API key pattern | Pass in body           | **Tiered resolution** (user key → backend secret fallback) |
| JWT             | Not specified          | `verify_jwt = false` + skip when `user_api_key` present    |
| Voice cache     | Fetch on every open    | **localStorage cache with 1-hour TTL**                     |
| Markdown        | "Strip it"             | **Dedicated `stripMarkdownForTTS` utility**                |
| Voice settings  | Defaults               | **Narration-optimized** (stability 0.6, similarity 0.75)   |
| Memory          | Not mentioned          | **Revoke blob URLs** on end/unmount                        |
| CORS            | Not mentioned          | **Required CORS headers** per edge function spec           |


These improvements align the plan with the existing codebase patterns and the documented best practices for both ElevenLabs and the edge function architecture.