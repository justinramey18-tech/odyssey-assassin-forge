

## Context-Aware SFX During Narration

### Overview
When narration plays, the system will use AI to analyze the narrative text and generate a scene-appropriate SFX prompt (e.g., "swords clashing on stone, distant screaming" for a battle scene). This replaces the current static style prompt with a dynamic one derived from the actual content. A limited LRU cache (last 15 prompts) prevents redundant API calls for similar scenes.

### Architecture

```text
User triggers narration
        │
        ▼
┌─────────────────────┐
│ use-narrator.ts     │
│ playMessage(text)   │
│                     │
│ if contextSfx ON:   │
│   check cache ──────┼──► hit? reuse blob
│   miss? ──────────── │
│     ▼               │
│   call edge fn      │
│   "detect-sfx-prompt"│──► AI analyzes text → returns SFX prompt string
│     ▼               │
│   call edge fn      │
│   "elevenlabs-sfx"  │──► generates audio from prompt
│     ▼               │
│   play alongside    │
│   narration at 25%  │
└─────────────────────┘
```

### Changes Required

**1. New edge function: `supabase/functions/detect-sfx-prompt/index.ts`**
- Accepts `{ text: string }` — the narrative content being narrated
- Uses Lovable AI (gemini-3-flash-preview) to produce a short (~15 word) ElevenLabs SFX prompt describing the soundscape
- System prompt instructs: "Read this D&D narrative. Output ONLY a short sound effect description suitable for ElevenLabs SFX generation. Focus on the dominant auditory elements — combat sounds, environment, weather, creatures. Be specific and cinematic. Max 20 words."
- Returns `{ sfx_prompt: string }`

**2. Update `SoundEffectsWidget.tsx` — Add context-aware toggle**
- Add a new localStorage key `dnd-elevenlabs-context-sfx-enabled`
- Add a second toggle: "Context-Aware SFX" with description "AI analyzes narrative to generate scene-appropriate sounds"
- Export `isContextSfxEnabled()` function
- When context-aware is ON, the static style prompt section is shown as a fallback label only

**3. Update `use-narrator.ts` — Replace static SFX with context-aware**
- Import `isContextSfxEnabled`
- When context SFX is enabled and narration starts:
  1. Call `detect-sfx-prompt` edge function with the narrative text
  2. Check a simple in-memory Map cache (keyed by a hash of first 200 chars of the prompt result, limited to 15 entries)
  3. On cache miss: call `elevenlabs-sfx` with the AI-generated prompt, store blob in cache
  4. On cache hit: reuse the cached audio blob
  5. Play alongside narration at 25% volume (same as current ambient SFX)
- When context SFX is disabled, fall back to current static style prompt behavior
- Both fetches (detect-sfx-prompt + elevenlabs-sfx) run in parallel with TTS fetching

**4. SFX prompt cache utility (inline in `use-narrator.ts`)**
- Simple Map-based LRU cache: `Map<string, Blob>` with max 15 entries
- Key = the AI-generated SFX prompt string (short enough to use directly)
- Evict oldest entry when limit reached
- Cache lives for the session (resets on page reload)

### Files to Create/Modify
- **Create**: `supabase/functions/detect-sfx-prompt/index.ts`
- **Modify**: `src/components/settings/SoundEffectsWidget.tsx` — add context-aware toggle
- **Modify**: `src/hooks/use-narrator.ts` — integrate context-aware SFX with caching
- **Modify**: `supabase/config.toml` — add detect-sfx-prompt function config (verify_jwt = false)

