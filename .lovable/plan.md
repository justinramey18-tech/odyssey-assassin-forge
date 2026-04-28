# Cinematic Mode → Structured Beats Redesign

Replace the current "tag the original DM text" cinematic flow with an AI-distilled **beats array** (3, 5, or 7 beats). The center beat is always the peak (intensity 5) with the heaviest SFX/VFX; surrounding beats ramp up (setup) and ramp down (consequence). Original DM text stays untouched in chat history — cinematic mode just shows the distilled overlay.

## Files modified

### 1. `supabase/functions/tag-cinematic/index.ts` — full rewrite
- Switch from text-tagging to structured **tool-calling** (`build_cinematic_beats`).
- Model: `google/gemini-2.5-flash`, `tool_choice` forced to the function.
- Schema enforces `beats[]` with `text`, `intensity` (1–5), `sfx[]`, `ambience`, `vfx[]`, `mood`, with strict enum lists (same SFX/AMBIENCE/VFX/MOOD library as today).
- System prompt instructs: pick exactly 3, 5, or 7 beats based on scene length; rewrite each beat in own voice ≤30 words; peak in the middle gets primary SFX + heavy VFX; setup/consequence ramp.
- Server-side sanitization: clamp word count to 30, clamp intensity to 1–5, filter tag arrays against allowed enums, reject non-{3,5,7} counts (return `beats: null`), force middle beat to intensity 5 defensively.
- Always returns `{ beats: CinematicBeat[] | null }` with HTTP 200 on AI failure (fail-open so caller silently skips cinematic).

### 2. `src/lib/parseSlides.ts` — additive
- Add optional `intensity?: number` to existing `Slide` interface.
- Add new exported `CinematicBeat` interface and `parseBeatsIntoSlides(beats)` function.
  - Maps each beat → Slide. `displayType`: index 0 → `firstLine`, intensity 5 → `pullQuote`, others → `normal`. Carries through `sfx`, `ambience`, `vfx`, `mood`, `intensity`. `music` always null, `speaker` undefined.
- Keep `parseResponseIntoSlides` and `stripCinematicTags` in place (still used by `PartyDMScreen` for display stripping of legacy messages — don't break old chat history).

### 3. `src/components/empyrean/EmpyreanDMScreen.tsx` — call site swap
- Add `parseBeatsIntoSlides` to existing import (keep `parseResponseIntoSlides`/`stripCinematicTags` since they may still be referenced elsewhere in file).
- Replace the `tag-cinematic` fetch block (~lines 742–768): drop `taggedText` handling and `parseResponseIntoSlides(textForSlides)`. Instead, expect `data.beats` (array). If `Array.isArray(data.beats) && data.beats.length > 0`, build slides via `parseBeatsIntoSlides` and launch slideshow. If `beats` is `null`/empty, silently skip — full text remains in chat.

### 4. `src/components/ai-dm/PartyDMScreen.tsx` — call site swap
- Same refactor at ~line 1124: switch from tagged-text path to beats path, add `parseBeatsIntoSlides` to import.
- **Keep** `stripCinematicTags` import and the local `stripCinematicTagsFromDisplay` helper — they're still used in 3 places (lines 573, 793, 796) to clean legacy message content for display. Untouched.

### 5. `src/components/empyrean/CinematicSlideshow.tsx` — peak emphasis
- Compute `const isPeak = currentSlide?.intensity === 5;`.
- Apply subtle scale + amber drop-shadow on the slide content container (the `<div>` wrapping `SlideRenderer` at ~line 111) when `isPeak`. Tailwind: `scale-105 transition-transform duration-300 [filter:drop-shadow(0_0_12px_rgba(251,191,36,0.4))]`.
- Audio engine, ambience, VFX wiring all unchanged — they consume the same Slide shape.

## Guardrails (explicit no-touches)

- `slideshowAudioEngine`, `slideshowAudioLoader`, `SlideshowVFX` — unchanged.
- `use-cinematic-mode.ts` — unchanged.
- `EMPYREAN_FEATURE_FLAGS.showCinematicSlideshow` gate — unchanged.
- DM response generation/storage — unchanged. Full text still saved to chat history.
- Tag enums (SFX/AMBIENCE/VFX/MOOD) — exact same values, no new tags.
- No caching/persistence of beats — fresh per response.
- `parseResponseIntoSlides` and `stripCinematicTags` retained (cleanup is a future pass).

## Technical notes

- The new endpoint contract is `POST /functions/v1/tag-cinematic { text } → { beats: CinematicBeat[] | null }`. Both call sites updated atomically; no parallel old/new mode.
- `Slide.intensity` is optional, so `parseResponseIntoSlides` (which doesn't set it) keeps compiling.
- AI fail-open: 4xx/5xx from gateway, missing tool call, JSON parse errors, or invalid beat count all return `{ beats: null }` with status 200. Caller's `Array.isArray(...) && length > 0` check naturally skips cinematic; chat text still renders normally.
- Edge function will be auto-deployed by the platform after the file write — no manual deploy step needed.

## Verification after deploy

- TypeScript compiles clean.
- Cinematic ON + medium DM response → slideshow with 3/5/7 beats, middle beat scaled + glowing, primary SFX on peak.
- Cinematic OFF → no slideshow, full text in chat (no regression).
- Party DM with cinematic ON for one player → slideshow plays for that player only.
- AI failure path → no slideshow, no error toast, chat text intact.
- Legacy messages with old `<!--SFX:...-->` tags in their content still render correctly via existing `stripCinematicTagsFromDisplay`.
