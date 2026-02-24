
## I understand exactly what you’re saying, and we have concrete evidence now

You are not crazy; this is reproducible from backend logs.

### What the logs prove
1. `scribe-ai` is receiving requests and in at least one case returning **504 after ~150s**:
   - `POST ... /functions/v1/scribe-ai | 504 | execution_time_ms: 150122`
2. There are also separate requests with:
   - `Anthropic error: 401 ... "invalid x-api-key"`
3. Screenshot confirms UI only shows generic:
   - “Failed to send a request to the Edge Function”

So this is a **multi-cause failure**:
- **Primary**: long-running Anthropic generations timing out at the platform limit (credits can still be consumed upstream).
- **Secondary**: some requests are using an invalid/old key value.
- **UX bug**: frontend collapses all failures into one useless generic error.

---

## Implementation Plan (approved-scope + hard fix path)

## 1) Make Narrative Forge resilient to timeout by chunking Anthropic requests
**File:** `src/components/scribe/NarrativeForgeScreen.tsx`  
**Primary locations:** around `handleProcess` (~line 513), model routing block (~582-624), state declarations near top (~66-140)

### Changes
- Add a chunked Anthropic processing path for **paste mode** when input is large.
- Reuse existing utility:
  - `splitTextIntoChunks(...)`
  - `reassembleChunks(...)`
- Execute chunk requests sequentially to `scribe-ai`, update progress UI per chunk.
- Keep per-chunk payload under a safe target (e.g. ~35k–45k chars chunk text), while still honoring the global 200k gate.

### Why
A single giant call is hitting the 150s backend timeout. Chunking prevents one request from running too long, so output returns reliably instead of dying at 504.

---

## 2) Include **all context** in the char counter (paste + upload)
**File:** `src/components/scribe/NarrativeForgeScreen.tsx`  
**Primary locations:** existing `currentTotalChars` memo (~130-140), context build area (~586-590), counter UI (~1725+)

### Changes
Replace current counter logic with a full request estimate:
- Base text:
  - paste: `inputText.length` (or stripped text length when `stripGamePrompts` is on)
  - upload: sum of selected session `charCount`
- Plus context payload lengths:
  - campaign summary
  - story context tail
  - enabled character cards
  - enabled protagonist cards
- Keep warn+block behavior:
  - Warn at 80%
  - Hard block at >200,000
- Add mini breakdown (Input / Summary / Story / Cards / Total) so user sees exactly what consumes budget.

### Why
Current counter undercounts and can greenlight oversized real payloads.

---

## 3) Fix upload-mode Anthropic routing (currently wrong function path)
**Files:**
- `src/hooks/use-campaign-processor.ts`
- `src/components/scribe/NarrativeForgeScreen.tsx`

### Changes
- Extend processor API to accept model + context + user key inputs.
- In upload AI mode, route by provider:
  - Anthropic models -> `scribe-ai` with `user_api_key`
  - Others -> `narrative-forge`
- Preserve existing offline behavior.
- Ensure retries/resume use same routing metadata.

### Why
Right now upload path always calls `narrative-forge`, which is inconsistent with selected Claude model and key behavior.

---

## 4) Harden `scribe-ai` against timeout and improve diagnostics
**File:** `supabase/functions/scribe-ai/index.ts`  
**Primary locations:** request parsing/auth block (~99-150), model map (~227+), Anthropic fetch block (~238+), error mapping (~255+)

### Changes
- Add explicit request timing guard:
  - Wrap Anthropic call with abort timeout below platform cutoff (e.g. 110–120s).
  - Return structured timeout JSON instead of letting platform return opaque 504.
- Add dynamic `max_tokens` policy for large inputs to reduce long generations:
  - smaller output caps for larger input bands.
- Add structured error responses with actionable codes:
  - `invalid_api_key`
  - `request_timeout`
  - `context_too_large`
  - `model_not_available`
- Include safe response metadata (`request_id`, elapsed ms, estimated chars) for debugging (never expose secrets).

### Why
Prevents silent hard timeouts and gives frontend enough detail to display real cause.

---

## 5) Fix model validity / fallback behavior
**Files:**
- `src/lib/scribe-models.ts`
- `supabase/functions/scribe-ai/index.ts`

### Changes
- Validate Anthropic model IDs against supported set.
- If unsupported model selected (including stale localStorage values), auto-fallback to a known-good model (4.5) and report fallback in response metadata.
- Update selector options accordingly to prevent selecting invalid models.

### Why
Eliminates “worked yesterday, broken today” from stale/invalid model IDs persisted in local storage.

---

## 6) Replace generic UI error with precise user-facing diagnostics
**File:** `src/components/scribe/NarrativeForgeScreen.tsx`  
**Location:** catch block in `handleProcess` (~634-640), plus upload result/error display zones

### Changes
- Parse function error body (not only `error.message`).
- Show targeted messages:
  - timeout: “Request timed out. Reduce chunk size or context.”
  - invalid key: “Anthropic key invalid. Re-save key in Settings.”
  - over limit: show exact per-section overage
  - model fallback warning when applied
- Preserve detailed session-level errors in upload mode live preview.

### Why
This removes the dead-end “Failed to send request” and tells exactly what to fix.

---

## Exact File Change List
1. `src/components/scribe/NarrativeForgeScreen.tsx`
2. `src/hooks/use-campaign-processor.ts`
3. `supabase/functions/scribe-ai/index.ts`
4. `src/lib/scribe-models.ts`
5. `src/lib/scribe/request-size.ts` (new shared estimator utility)

---

## Technical Details (implementation-level)
- Keep `MAX_AI_CHARS = 200000` as requested.
- Introduce shared estimator:
  - `getRequestSizeBreakdown({ text, ctxState, summary, stories, cards, protags, inputSource, selectedSessions })`
- Add “safe chunk mode” threshold for Anthropic in paste flow (e.g. >35k).
- Ensure chunk calls include same context only when necessary; avoid duplicating huge context every chunk if it causes bloat (cap context for chunked mode or include once when semantically acceptable).
- Use immutable state updates and current project hook patterns.
- No database schema changes required.

---

## Verification Plan (must pass before closing)
1. Paste mode + Anthropic + medium text (<35k): single request succeeds with narrative output.
2. Paste mode + Anthropic + large text (80k–180k): chunked processing completes and returns merged narrative.
3. Upload mode + Anthropic model: confirms `scribe-ai` route and output appears.
4. Invalid Anthropic key: immediate clear error (“Invalid API key”), no generic edge-function message.
5. Near-limit and over-limit counters reflect full context (including summary/cards/story context).
6. End-to-end mobile test on route `/` reproduces prior case and confirms it now returns narrative instead of failing.
7. Backend logs show no 150s platform 504 for these scenarios.
