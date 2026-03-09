

# Prompt Synthesizer — Full Implementation Plan (All 5 Improvements)

## Overview
A lightweight pre-processing step that fuses multiple player prompts into a single "director's note" before sending to the main DM. Includes: scene context, structured JSON output, UI feedback, synthesis memory, and single-prompt mode passthrough.

## New Files

### 1. `src/lib/narrative-synthesis-prompt.ts`
Exports `SYNTHESIS_SYSTEM_PROMPT` (~600 tokens) containing:
- Instructions to analyze prompts across spatial/temporal/causal/thematic dimensions
- List of 10 presentation modes (one-line each): Impressionist, Staccato, Deep Focus, Ensemble, Dialogue-Driven, Sensory Immersion, Fractal, Stream of Consciousness, Reportage, Mythic
- Anti-pattern rules (no sequential chains, no repeated structures, no transition crutches, no equal-time fallacy)
- Instruction to avoid `recentModes` passed in the user message (synthesis memory)
- **Structured output instruction**: Return JSON `{ mode, spine, focusCharacter, fusedPrompt }` — no prose wrapper

Also exports `SINGLE_PROMPT_SYNTHESIS_PROMPT` — a slimmed variant for when only 1 prompt exists. Picks a presentation mode and wraps the solo action with a style directive. Same JSON output shape.

### 2. `src/hooks/use-synthesis-memory.ts`
Simple hook using scoped storage key `odyssey-synthesis-recent-modes`:
- Stores last 3 modes used (string array)
- `addMode(mode: string)` — pushes and caps at 3
- `recentModes` — current array
- Listens for `odyssey-character-loaded` event (standard pattern)
- Register key in `scoped-keys.ts`, `resetApp.ts`, `use-auto-save.ts`

## Modified Files

### 3. `src/hooks/use-party-dm.ts`

**New helper: `synthesizePrompts()`** (~40 lines)
- Takes: `rawPrompts: PartyDmPrompt[]`, `lastDmMessage: string | null`, `recentModes: string[]`
- Calls `ai-dm` edge function with `systemPromptOverride` set to `SYNTHESIS_SYSTEM_PROMPT`
- User message format:
  ```
  PREVIOUS DM MESSAGE (context):
  <last 500 chars of previous assistant message, or "None">

  RECENT MODES USED (avoid repeating):
  [Ensemble, Deep Focus, Staccato]

  PLAYER PROMPTS:
  [Thistle]: I drag the bodies
  [Xeyle]: I carve drow signatures
  ```
- Uses non-streaming `supabase.functions.invoke('ai-dm', ...)` (no need to stream the synthesis)
- Parses JSON response → returns `{ mode, spine, focusCharacter, fusedPrompt }` or `null` on failure
- Model: uses `google/gemini-2.5-flash-lite` via a `modelOverride` param (fast + cheap)

**Normal mode changes** (lines ~1113-1143):
- After collecting `readyPrompts`, call `synthesizePrompts()` if 2+ prompts (or 1 prompt if single-prompt mode)
- If synthesis succeeds:
  - Use `result.fusedPrompt` as the combined prompt instead of raw concatenation
  - Prepend `<!-- SYNTHESIS: mode=${result.mode} spine=${result.spine} focus=${result.focusCharacter} -->` as an HTML comment in the user message (invisible to players but available for debugging)
  - Call `addMode(result.mode)` to update synthesis memory
  - Set `synthesisMode` state for UI feedback
- If synthesis fails: fall back to current `formatPromptLine` concatenation
- Add `fusedPrompt` to the guides section: `\n\n## NARRATIVE DIRECTION\nPresentation mode: ${result.mode}. Focus character: ${result.focusCharacter}. Narrative spine: ${result.spine}`

**Split mode changes** (lines ~966-1040):
- Same synthesis for alpha and beta prompt groups independently

**New state**: `const [synthesisMode, setSynthesisMode] = useState<string | null>(null)`
- Set when synthesis completes, cleared after DM generation finishes
- Exposed from hook return value

### 4. `supabase/functions/party-timer-generate/index.ts`

**Server-side synthesis** (after line ~404):
- Inline the synthesis system prompt (can't import from `src/`)
- After building `submittedPrompts`, if 2+ prompts:
  - Call Lovable AI gateway directly (`google/gemini-2.5-flash-lite`, non-streaming)
  - Include last assistant message from `recentMessages` as context
  - Fetch `recentModes` from a new `party_shared_state` entry (`state_type: 'synthesis_memory'`)
  - Parse JSON, use `fusedPrompt` as `combinedPrompt`
  - Update `synthesis_memory` state with new mode
- For 1 prompt: use the single-prompt variant
- Fallback to raw concatenation on any error

### 5. UI Feedback in `src/components/party/PartyChat.tsx` (or equivalent DM chat component)

During generation, if `synthesisMode` is set, show a small pill/badge above the loading indicator:
```
✨ Weaving prompts... (Ensemble)
```
- Uses `text-amber-400/70`, `text-xs`, fades in with `animate-fade-in`
- Disappears when generation completes (`synthesisMode` resets to null)
- Host-only visibility (other players just see normal loading)

### 6. Storage Key Registration
Add `odyssey-synthesis-recent-modes` to:
- `src/lib/scoped-keys.ts` → `SCOPED_KEYS`
- `src/lib/resetApp.ts` → `ALL_STORAGE_KEYS`
- `src/hooks/use-auto-save.ts` → `SaveData` interface

## Data Flow Summary
```text
2+ prompts ready → synthesizePrompts()
  Input:  raw prompts + last DM message (500 chars) + recentModes[3]
  Model:  gemini-2.5-flash-lite (fast, ~200ms)
  Output: { mode: "Ensemble", spine: "...", focusCharacter: "Thistle", fusedPrompt: "..." }
    ↓
  fusedPrompt replaces raw concatenation → sent to main DM
  mode added to recentModes ring buffer
  synthesisMode set for UI pill
    ↓
  Main DM generates narrative using fusedPrompt as the user message
  + NARRATIVE DIRECTION section in guides
```

## Edge Cases
- **1 prompt**: Still synthesizes (picks a mode, adds style direction) — improvement #5
- **0 prompts / all AFK**: Skip synthesis, use existing AFK handling
- **Synthesis timeout/error**: Silent fallback to raw concatenation, no user-facing error
- **Split mode**: Each team synthesized independently with its own context

