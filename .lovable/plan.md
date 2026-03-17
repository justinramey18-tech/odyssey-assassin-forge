

# Inject Missing Context into Party AI DM

## Problem

The Party AI DM is missing several context sources that are available but never passed to the AI:

1. **Memory Anchors** — extracted and stored by the host, passed to Oracle but never to the AI DM
2. **Party inline chat (last 5 messages)** — never fetched or passed to the AI DM
3. **GM Guides** — already passed via `customGuidesContent` (working correctly, 200K cap in edge function)
4. **Campaign Summary** — already passed via `campaignSummary` (working correctly)
5. **Player prompts** — already included as the consolidated user message each round (working correctly)

Items 1 and 2 are the gaps.

## Changes

### 1. Add `memoryAnchors` field to the AI DM edge function

**File:** `supabase/functions/ai-dm/index.ts`

- Add `memoryAnchors?: string` to the `DMRequest` interface
- Accept it in `buildDMSystemPrompt` and append it as a new `## MEMORY ANCHORS` section in the system prompt (after campaign summary, before custom guides)
- Cap at ~8K characters (memory anchors are short facts, shouldn't be large)

### 2. Add `recentPartyChat` field to the AI DM edge function

**File:** `supabase/functions/ai-dm/index.ts`

- Add `recentPartyChat?: Array<{ sender: string; message: string }>` to `DMRequest`
- Append as a `## RECENT PARTY CHAT` section in the system prompt so the DM is aware of what players discussed out-of-character

### 3. Pass memory anchors from `usePartyDm` hook

**File:** `src/hooks/use-party-dm.ts`

- Add `memoryAnchorsContent?: string` to `UsePartyDmOptions`
- Include it in the request body sent to the AI DM edge function as `memoryAnchors`

### 4. Fetch last 5 party chat messages before generation

**File:** `src/hooks/use-party-dm.ts`

- In the generation function (before calling `streamAIResponse`), query `party_messages` table for the last 5 messages ordered by `created_at desc`, limited to the current `partyId`
- Pass them as `recentPartyChat` in the request body

### 5. Wire memory anchors through `StandalonePartyDMScreen`

**File:** `src/components/ai-dm/StandalonePartyDMScreen.tsx`

- Pass `memoryAnchors.formattedForOracle` (or a similar formatted string) into `usePartyDm` as the new `memoryAnchorsContent` option

### 6. Redeploy the edge function

The `ai-dm` edge function will be redeployed with the new fields.

