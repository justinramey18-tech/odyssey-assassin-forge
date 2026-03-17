

# Fix Oracle Recap — Edge Function Has Stale Prompt

## The Problem

The recap prompt you updated in `src/components/oracle/modes.ts` is **client-side only and never used by the actual AI call**. The real prompt lives in the **backend function** at `supabase/functions/oracle-assistant/index.ts` (lines 916-930), which still says:

- "There is NO length limit for recap mode"
- "Write as much as needed"
- "Be thorough, detailed, and comprehensive"
- Uses a 3-section format (Story / Situation / Next Move)
- Token budget set to **8,192 tokens** (lines 1020-1025)

No wonder it writes a novel.

## Changes

### 1. Update edge function recap prompt (`supabase/functions/oracle-assistant/index.ts`)

Replace the recap case (lines 916-930) with the same 2-section, ~400-word, bullet-point format already defined client-side:

- **📖 What Happened** — 8-12 chronological bullet points, one sentence each
- **⚔️ Current Situation** — 2-3 sentences on current state
- Hard limit: ~400 words, no prose paragraphs, no "Next Move" section

### 2. Cap token budget (line 1025)

Reduce the default recap `maxTokens` from `8192` to `1024` (plenty for ~400 words). Keep "quick catch-up" at ~600 and "tactical briefing" at ~800.

### 3. Remove the "exhaustive" quick prompt (`src/components/oracle/modes.ts`)

Line 80: `'Give me an exhaustive, detailed recap of everything that has happened — leave nothing out'` directly contradicts the new concise format. Remove it.

