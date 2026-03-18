# Add "Full Campaign Summarization" Button

## What It Does

A button in the Campaign Summary card (inside GMGuidesManager) that fetches the **entire** party DM chat history from the database, sends it to the `ai-dm-summarize` edge function in batches (to avoid context window limits), and writes the final merged summary back as the campaign summary.

## Changes

### 1. GMGuidesManager — Add button + callback prop

**File:** `src/components/ai-dm/GMGuidesManager.tsx`

- Add new props: `onFullSummarize?: () => Promise<void>`, `isFullSummarizing?: boolean`
- In the Campaign Summary card (line ~200-229), add a "Summarize All" button next to the edit button — shows a spinner when `isFullSummarizing` is true
- Use a book/scroll icon to differentiate from edit

### 2. `use-party-dm.ts` — Add `fullSummarize` function

**File:** `src/hooks/use-party-dm.ts`

New exported function `fullSummarize()` that:

1. Queries **all** rows from `party_dm_messages` for the current `partyId`, ordered by `created_at asc`
2. Splits them into batches of ~20 messages (safe for the summarizer's context window)
3. For each batch, calls `ai-dm-summarize` with `previousSummary` set to the running summary from prior batches — so each batch merges into the accumulating summary
4. After all batches complete, writes the final summary to `sessionConfig.campaignSummary` via shared state update
5. Fires `silentAutoSave` to persist to `ai_dm_campaigns`

The edge function already supports `previousSummary` merging, so no backend changes needed.

### 3. StandalonePartyDMScreen — Wire the prop

**File:** `src/components/ai-dm/StandalonePartyDMScreen.tsx`

- Pass `onFullSummarize={partyDm.fullSummarize}` and `isFullSummarizing={partyDm.isFullSummarizing}` to `GMGuidesManager`

### 4. Expose state from hook

**File:** `src/hooks/use-party-dm.ts`

- Add `isFullSummarizing` boolean state
- Export both `fullSummarize` and `isFullSummarizing` from the hook return

## Batch Strategy

- Batch size: ~20 messages per call
- Each batch sends `previousSummary` from the prior batch result
- The summarizer prompt already handles merging ("If a PREVIOUS SUMMARY is provided, UPDATE it with new events")
- Final result replaces the campaign summary entirely
- No edge function changes needed