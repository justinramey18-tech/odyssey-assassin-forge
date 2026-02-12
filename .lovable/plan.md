

# Campaign Summary -- Auto-Generated Every 10 AI DM Messages

## Overview
Add an automatic campaign summary that the AI DM generates every 10 assistant messages. The summary captures key events, NPC names, locations, plot threads, and decisions so far. It is stored as a special GM Guide (30,000 char limit) that counts toward the 200,000 total context budget, and is injected into the system prompt so the DM maintains long-term narrative continuity even as older messages fall out of the 100-message window.

---

## How It Works

1. After every 10th assistant message, the client automatically triggers a separate (non-streaming) API call to a new edge function `ai-dm-summarize`
2. The summarizer receives the full conversation history and the previous summary (if any), and returns a condensed campaign summary
3. The summary is stored in localStorage under a dedicated key (`dnd-ai-dm-campaign-summary`)
4. On every regular DM message send, the current summary is passed alongside custom guides in the API payload
5. The summary is injected into the system prompt as a `## CAMPAIGN SUMMARY` section before custom guides
6. The summary counts as context characters against the 200,000 total budget (visible in the Guides manager UI)

---

## Files to Create

### 1. `supabase/functions/ai-dm-summarize/index.ts`
A non-streaming edge function that:
- Receives the conversation messages and the previous campaign summary
- Uses `google/gemini-3-flash-preview` (fast, cheap -- summaries don't need Pro)
- System prompt instructs: "Summarize this D&D campaign session. Include: key events, NPC names and dispositions, locations visited, active quests/plot threads, important player decisions, combat outcomes, and unresolved hooks. Keep it under 25,000 characters. If a previous summary is provided, update it with new events rather than replacing it."
- Returns `{ summary: string }` as JSON
- Enforces 30,000 char cap on output
- Standard CORS and 429/402 error handling

### 2. `src/lib/campaign-summary-storage.ts`
Simple localStorage utility:
- `SUMMARY_STORAGE_KEY = 'dnd-ai-dm-campaign-summary'`
- `loadCampaignSummary(): string | null`
- `saveCampaignSummary(summary: string): void`
- `clearCampaignSummary(): void`
- `SUMMARY_MAX_CHARS = 30000`

---

## Files to Modify

### 3. `src/hooks/use-ai-dm.ts`
- Track assistant message count (count messages where `role === 'assistant'` in the current session)
- After a successful assistant response completes streaming, check if `assistantCount % 10 === 0`
- If so, fire an async summarize call (non-blocking -- don't set `isLoading`)
- Pass all current messages + existing summary to the summarize endpoint
- Save the returned summary to localStorage via the storage utility
- On `clearMessages` / `newGame`, also clear the campaign summary
- Accept and expose `campaignSummary` state
- Include `campaignSummary` in the payload sent to `ai-dm` edge function

### 4. `supabase/functions/ai-dm/index.ts`
- Add `campaignSummary?: string` to the `DMRequest` interface
- In `buildDMSystemPrompt`, inject it as a `## CAMPAIGN SUMMARY` section after the character state and before custom guides
- Cap at 30,000 chars server-side

### 5. `src/components/ai-dm/AIDMScreen.tsx`
- Show a small indicator when a summary is being generated (e.g., a subtle "Updating campaign summary..." toast or inline text)
- Display the current summary character count in the context banner or guides area

### 6. `src/lib/gm-guides-storage.ts`
- Update `getTotalCharacterCount` and `canAddContent` to accept an optional `campaignSummaryLength` parameter so the summary's characters count against the 200,000 budget
- Or: the hook layer handles the math (simpler approach -- preferred)

### 7. `src/hooks/use-gm-guides.ts`
- Accept `campaignSummaryLength` as a parameter or expose the budget calculation so `AIDMScreen` can validate that guides + summary stay under 200,000

### 8. `supabase/config.toml`
- Register `[functions.ai-dm-summarize]` with `verify_jwt = false`

---

## Technical Details

### Summary Trigger Logic (in `use-ai-dm.ts`)
```text
After streaming completes successfully:
  1. Count assistant messages in current session
  2. If count % 10 === 0 and count > 0:
     a. Call ai-dm-summarize with { messages, previousSummary }
     b. On success, save to localStorage
     c. Show brief toast: "Campaign summary updated"
  3. On error, log but don't interrupt gameplay
```

### Budget Accounting
- Campaign summary: up to 30,000 chars (same limit as a single GM guide)
- Total budget: 200,000 chars shared between all GM guides + campaign summary
- The Guides manager UI will show the summary as a read-only entry with its character count
- When adding/editing guides, available budget = 200,000 - (sum of all guide chars) - (summary chars)

### Edge Function System Prompt Injection Order
1. Base DM instructions + character state
2. Campaign summary (if exists)
3. Custom GM guides (if any enabled)

This ordering ensures the DM prioritizes campaign continuity over custom guide context.

### Summary Persistence
- Stored in its own localStorage key, separate from messages and guides
- Cleared when user clicks "New Game" or "Clear" (fresh campaign = fresh summary)
- Survives page reloads alongside the message history

### Summarizer Prompt Design
The summarizer system prompt will instruct the model to produce a structured summary with sections:
- **Story So Far**: Narrative recap of major events
- **Active Quests**: Current objectives and hooks
- **Key NPCs**: Names, dispositions, last known status
- **Locations**: Places visited and current location
- **Player Decisions**: Important choices and consequences
- **Combat Log**: Notable encounters and outcomes
- **Unresolved Threads**: Loose ends and foreshadowing

