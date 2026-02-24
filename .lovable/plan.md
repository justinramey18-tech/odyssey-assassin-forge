

## Root Cause: Output Token Cap Too High

The backend logs prove it: a modest 27k-character request is timing out because `max_tokens` is set to 10,000 tokens for that input size. Claude Sonnet typically generates ~50-80 tokens/second under load. At 10,000 tokens, that's 125-200 seconds — exceeding the 120s abort timer every time.

Your credits are consumed because Anthropic starts generating tokens immediately. When our abort fires at 120s, Anthropic has already billed for the partial generation, but we throw the response away.

## The Fix

### File 1: `supabase/functions/scribe-ai/index.ts`

**Change `getMaxTokens` to cap at 4096 tokens max for reliability:**

Current (lines 107-112):
```typescript
function getMaxTokens(inputCharCount: number): number {
  if (inputCharCount > 100_000) return 16000;
  if (inputCharCount > 50_000) return 12000;
  if (inputCharCount > 20_000) return 10000;
  return 8000;
}
```

New:
```typescript
function getMaxTokens(inputCharCount: number): number {
  // Keep output caps low for reliable sub-120s completion
  // Claude Sonnet generates ~50-80 tok/s; 4096 tokens ≈ 50-80s
  if (inputCharCount > 100_000) return 4096;
  if (inputCharCount > 50_000) return 4096;
  if (inputCharCount > 20_000) return 4096;
  return 4096;
}
```

This guarantees Claude finishes generating within ~50-80 seconds, well under the 120s abort.

### File 2: `src/components/scribe/NarrativeForgeScreen.tsx`

**Lower the chunking threshold from 40,000 to 15,000 characters** (line 624):

```typescript
const CHUNK_THRESHOLD = 15_000;
```

With a 4096 token output cap, each chunk produces ~3,000 words of narrative. By chunking at 15k chars, we ensure:
- Each chunk completes in ~50-80s (no timeout)
- Larger texts get split into more chunks, each finishing reliably
- The chunks are reassembled into the full narrative

This is the "reliable shorter output" approach: more chunks, each fast and reliable, merged into the full result.

### File 3: `src/components/home/ChroniclerHomeView.tsx`

**Same fix for Novel Builder's single-request AI path** — it doesn't chunk at all currently. The backend fix (max_tokens cap) covers it, but we should also add basic error code parsing to the catch block (lines ~103-118) so the user sees "timed out" instead of "Failed to send":

Add error code parsing in the catch block similar to what NarrativeForgeScreen already has.

## Why This Works

- 27k input + 4096 max output tokens = Claude finishes in ~60s
- No more 120s timeouts
- No more wasted Anthropic credits on aborted generations  
- Chunking at 15k means even moderate inputs get split, each completing fast
- The reassembled output is the same quality, just built from reliable smaller pieces

## Files Changed
1. `supabase/functions/scribe-ai/index.ts` — reduce `getMaxTokens` to 4096 cap
2. `src/components/scribe/NarrativeForgeScreen.tsx` — lower chunk threshold to 15k
3. `src/components/home/ChroniclerHomeView.tsx` — add error code parsing

## Verification
1. Paste ~10k chars, select Claude 4.5 Sonnet, hit Forge → narrative returns in <90s
2. Paste ~30k chars → auto-chunks into 2 pieces, both complete, merged output appears
3. No more "Failed to send" errors
4. Anthropic credits only consumed for successful generations

