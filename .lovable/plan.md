

# Quest Extraction System — Implementation Plan

## Overview
Add automatic quest extraction to all three DM modes (solo, empyrean, party) plus manual quest creation in the World State panel, and enhance the Telegram `/quests` command to include party quests.

## Changes

### 1. `src/hooks/use-ai-dm.ts` — Add `onQuestExtracted` callback
- Add `onQuestExtracted` to `UseAIDMOptions` interface (line 53-69)
- Accept it in the `useAIDM` function, store in a ref (same pattern as `onMessageCompleteRef`, around line 150-152)
- After `onMessageCompleteRef.current?.(narrative)` (line 428), add non-blocking quest extraction via fetch to `/functions/v1/ai-dm` using `gemini-2.5-flash-lite`, wrapped in try/catch
- Import `supabase` from `@/integrations/supabase/client` for auth token access

### 2. `src/components/ai-dm/AIDMScreen.tsx` — Wire up solo quest extraction
- In the `useAIDM` call (line 484), add `onQuestExtracted` callback that calls `setQuestFlag` for each extracted quest

### 3. `src/components/empyrean/EmpyreanDMScreen.tsx` — Wire up empyrean quest extraction
- In the `useAIDM` call (line 245), add `onQuestExtracted` callback that calls `gameState.setQuestFlag` for each extracted quest

### 4. `supabase/functions/party-timer-generate/index.ts` — Server-side party quest extraction
- After the AI response is inserted as a party message (line 588-589), add non-blocking quest extraction using Lovable AI gateway
- Store extracted quests in `party_shared_state` with `state_type: 'quest_flags'`, using the party creator's user_id
- Upsert pattern: check for existing state row, merge flags, update or insert

### 5. `supabase/functions/telegram-poll/index.ts` — Enhance `/quests` command
- After the existing `dm_game_state` query (lines 480-506), add a query to `party_members` to find the user's parties, then query `party_shared_state` for `quest_flags` state type
- Display party quests in a separate section with proper formatting
- Update the display format to handle the `{status, notes}` object structure from `QuestFlag`

### 6. `src/components/ai-dm/WorldStatePanel.tsx` — Manual quest creation form
- Add state for `newQuestName` and `newQuestNotes`
- Add a compact form at the top of the quests tab with text inputs and an "Add" button
- Convert quest name to snake_case key, call `onSetQuestFlag` with status `'active'`
- Style to match existing panel aesthetic (dark theme, amber accents)

## Technical Notes
- All quest extraction calls are non-blocking (fire-and-forget with `.catch(() => {})` or try/catch)
- Uses `gemini-2.5-flash-lite` for cheap/fast extraction
- Party quests stored in `party_shared_state` table (already has RLS policies for party members)
- No migration files needed — uses existing tables

