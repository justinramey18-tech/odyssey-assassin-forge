

## Novel Builder Campaign Summary Editor and Story Context UX Fix

### Overview
Two changes: (1) Add an inline campaign summary textarea to the Novel Builder's context panel that uses its own dedicated storage key, superseding the AI DM's campaign summary. (2) Fix the confusing "None" option in Story Context with descriptive helper text.

### 1. Dedicated Novel Builder Campaign Summary

The Novel Builder gets its own campaign summary stored under a separate key (`dnd-novel-builder-campaign-summary`), completely independent from the AI DM's summary (`dnd-ai-dm-campaign-summary`). When the campaign summary toggle is enabled, an inline textarea (up to 50,000 characters) expands below it where users can write/edit their summary. It auto-saves (debounced 1 second) and persists across sessions.

The AI DM's campaign summary is completely ignored in Novel Builder mode -- only the Novel Builder's own summary is sent down the pipeline.

### 2. Story Context Helper Text

The Story Context dropdown gets descriptive helper text:
- When no stories are saved: "Save a story from your output to use as voice and plot context here"
- When stories exist but none selected: "Select a saved story -- its last section provides voice and plot continuity"

---

### Technical Details

#### New storage key and helpers

**`src/lib/campaign-summary-storage.ts`**
- Add a new constant: `NOVEL_BUILDER_SUMMARY_KEY = 'dnd-novel-builder-campaign-summary'`
- Increase `SUMMARY_MAX_CHARS` to 50,000
- Add new functions: `loadNovelBuilderSummary()`, `saveNovelBuilderSummary(summary)`, `clearNovelBuilderSummary()`
- These mirror the existing functions but use the novel-builder-specific key

**`src/hooks/use-cloud-save.ts`**
- Add `'dnd-novel-builder-campaign-summary'` to the `SCOPED_KEYS` array so it syncs to cloud saves

#### ScribeContextPanel changes

**`src/components/scribe/ScribeContextPanel.tsx`**
- Add optional prop: `novelBuilderMode?: boolean` (default false)
- When `novelBuilderMode` is true:
  - Replace the simple toggle with a toggle that expands an inline `Textarea` (max 50,000 chars, `resize-none`, `min-h-[120px]`)
  - Load from `loadNovelBuilderSummary()` on mount into local state
  - Auto-save on change via `saveNovelBuilderSummary()` with a 1-second debounce (`useRef` timer)
  - Show character count: "12,345 / 50,000"
  - The toggle is always enabled (no `disabled` guard) -- toggling on reveals editor, toggling off hides it but keeps saved text
- When `novelBuilderMode` is false (Scribe Drawer, Narrative Forge): keep current behavior (reads from `loadCampaignSummary()`)
- Add helper text below Story Context dropdown based on whether stories exist

#### ChroniclerHomeView changes

**`src/components/home/ChroniclerHomeView.tsx`**
- Pass `novelBuilderMode={true}` to `ScribeContextPanel`
- In `handleAiProcess`: replace `loadCampaignSummary()` with `loadNovelBuilderSummary()` so the Novel Builder's own summary is sent to the edge function, ignoring the AI DM's summary entirely

#### No edge function changes needed
The edge functions already accept `campaignSummary` as a string field -- they don't care which storage key it came from.

### Files Summary

**Modify:**
- `src/lib/campaign-summary-storage.ts` -- Add novel-builder-specific storage functions, increase max to 50,000
- `src/hooks/use-cloud-save.ts` -- Add novel builder summary key to SCOPED_KEYS
- `src/components/scribe/ScribeContextPanel.tsx` -- Add `novelBuilderMode` prop, inline textarea editor, debounced save, character count, story context helper text
- `src/components/home/ChroniclerHomeView.tsx` -- Pass `novelBuilderMode={true}`, use `loadNovelBuilderSummary()` in AI handler

