

# Speech-to-Text for Player Input

## Approach

Use the **Web Speech API** (`SpeechRecognition` / `webkitSpeechRecognition`) — it's built into mobile browsers (Chrome, Safari), requires zero API keys, zero backend changes, and runs entirely on-device. This is the right choice because:

- No credits consumed, no edge functions needed
- Works offline on most mobile devices
- Stays in-app (no backgrounding risk)
- Instant — text appears as the player speaks

## What Gets Built

**A microphone button** added to the input row in `PartyDMInput.tsx`, positioned between the textarea and the Send button. Tap to start listening, tap again (or auto-stop on silence) to finish. Transcribed text appends into the textarea in real-time as the player speaks.

### Visual behavior:
- **Idle**: Mic icon (`Mic` from lucide), subtle styling matching the send button's muted state
- **Listening**: Pulsing red/amber dot + `MicOff` icon, amber border glow — clearly indicates recording is active
- **Unsupported browser**: Button hidden entirely (graceful degradation)

## Technical Details

### New hook: `src/hooks/use-speech-to-text.ts`

Encapsulates the Web Speech API:
- Creates a `SpeechRecognition` instance with `continuous = true`, `interimResults = true`, `lang = 'en-US'`
- Exposes `{ isListening, isSupported, transcript, start, stop, toggle }`
- `onresult` callback accumulates final + interim results
- `onend` auto-restarts if still in listening state (handles mobile auto-stop)
- Accepts an `onTranscript(finalText: string)` callback for when speech finalizes

### Changes to `PartyDMInput.tsx`

1. Import the hook and `Mic` / `MicOff` icons
2. Call `useSpeechToText` with an `onTranscript` callback that calls `setInput(prev => prev ? prev + ' ' + text : text)` and auto-resizes the textarea
3. Add a mic toggle button in the input row, between textarea and Send button:

```text
[ textarea                        ] [🎤] [➤]
```

4. When listening, show interim transcript as a subtle overlay or just let it flow into the textarea live
5. The mic button is only rendered if `isSupported` is true

### Files to create:
- `src/hooks/use-speech-to-text.ts`

### Files to modify:
- `src/components/ai-dm/PartyDMInput.tsx` — add mic button + hook integration

No backend, database, or edge function changes needed.

