

# Add Narration Speed Control for ElevenLabs TTS

## Approach

Use the HTML5 Audio `playbackRate` property to control reading speed client-side. This requires no edge function changes and works instantly — the audio is already decoded locally, so adjusting playback rate is free and lossless.

ElevenLabs does not expose a server-side speed parameter in their standard TTS endpoint, so client-side `playbackRate` is the correct approach.

## Changes

### 1. Persistence helpers in `src/lib/tts-utils.ts`

Add `loadNarrationSpeed()` and `saveNarrationSpeed()` functions using localStorage key `dnd-elevenlabs-narration-speed`. Default value: `1.0`. Valid range: `0.5` to `2.0`.

### 2. Apply playback rate in `src/hooks/use-narrator.ts`

After creating the `Audio` element (line 116), set `audio.playbackRate = loadNarrationSpeed()` before calling `audio.play()`. No other changes needed — the speed applies to the entire concatenated audio blob.

### 3. Speed slider UI in `src/components/settings/ApiKeySettings.tsx`

Below the `ElevenLabsVoicePicker`, add a "Narration Speed" slider when an ElevenLabs key is saved:

- Label showing current speed (e.g., "1.0x")
- `Slider` component: min 0.5, max 2.0, step 0.1
- Preset labels: "0.5x Slow", "1.0x Normal", "2.0x Fast"
- Persists on change via `saveNarrationSpeed()`

## Files Changed

| File | Change |
|------|--------|
| `src/lib/tts-utils.ts` | Add `loadNarrationSpeed()` / `saveNarrationSpeed()` with localStorage |
| `src/hooks/use-narrator.ts` | Set `audio.playbackRate` from saved speed before playback |
| `src/components/settings/ApiKeySettings.tsx` | Add speed slider below voice picker |

## Technical Details

- `HTMLAudioElement.playbackRate` accepts values from 0.25 to 4.0 in all modern browsers. We clamp to 0.5–2.0 for usable narration range.
- No edge function or API changes needed — speed is applied entirely client-side after audio is fetched.
- Both solo and party DM modes use the same `useNarrator` hook, so the speed setting applies to both automatically.

## Testing

1. Open Settings, go to API Keys, save an ElevenLabs key — speed slider should appear below the voice picker
2. Set speed to 1.5x, trigger narration on an AI DM message — audio should play noticeably faster
3. Set speed to 0.7x — audio should play slower
4. Close and reopen the app — speed setting should persist
5. Verify both solo and party DM narration respect the same speed setting

