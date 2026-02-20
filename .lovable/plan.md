
## Automatic Memory Anchor Extraction for Solo AI DM

### What We're Building

After every AI DM response, a lightweight background AI call will scan the narrative for:
- **NPCs** met or mentioned (name + relationship/disposition)
- **Locations** entered or discovered
- **Consequences** (major decisions, reputations, debts, injuries, secrets)

These are automatically added to `dm_game_state.memory_anchors` — silently, without interrupting the conversation. The AI DM then sees these facts on the next turn, ensuring world continuity.

---

### How It Fits the Existing Architecture

The current flow is:
```text
User sends message
  → useAIDM.sendMessage() streams AI response
  → onMessageComplete(content) callback fires
    → useDmAutoSync.extractAndApply() runs the ai-dm-extract edge function (HP, gold, items, XP)
```

We piggyback on the same `onMessageComplete` callback. After auto-sync extraction runs, we fire a second call to a new edge function `ai-dm-memory-extract` that extracts world facts, then calls `addMemoryAnchor()` from `useDMGameState`.

---

### Technical Plan

#### 1. New Edge Function: `supabase/functions/ai-dm-memory-extract/index.ts`

A focused, fast edge function using `google/gemini-2.5-flash-lite` (cheap + fast) with tool-calling to extract structured world facts.

The tool schema returns:
```json
{
  "npcs": [{ "name": "...", "relationship": "...", "notes": "..." }],
  "locations": [{ "name": "...", "type": "...", "notes": "..." }],
  "consequences": [{ "category": "reputation|debt|injury|secret|fact", "key": "...", "value": "..." }]
}
```

Rules injected in the system prompt:
- Only extract **newly introduced** facts (not things already in the existing memory anchors list passed from context)
- Skip minor/fleeting details — only persist things that could matter later
- Never extract things that are purely flavor/atmospheric

The edge function accepts:
- `message` (the AI DM text to analyze)
- `existingAnchors` (current memory anchor keys to deduplicate against)
- `characterContext` (name/level for context)

JWT auth required (same pattern as `ai-dm-extract`).

#### 2. New Hook: `src/hooks/use-dm-memory-extraction.ts`

A slim hook that:
- Holds `isExtracting: boolean` state
- Exposes `extractMemory(assistantMessage: string, existingAnchors: MemoryAnchor[], characterContext: CharacterContext): Promise<void>`
- Calls the new edge function
- For each returned NPC: calls `addMemoryAnchor({ category: 'npc', key: name, value: relationship + notes })`
- For each returned location: calls `addMemoryAnchor({ category: 'location', key: name, value: notes })`
- For each consequence: calls `addMemoryAnchor({ category, key, value })`
- Silently ignores errors (fire-and-forget — never disrupts the chat)
- Shows a subtle toast only when ≥1 anchor was actually added (e.g., "📌 2 world facts remembered")

#### 3. Wire into `AIDMScreen.tsx`

In the `handleMessageComplete` callback (lines 329–333), add memory extraction after auto-sync:

```typescript
const handleMessageComplete = useCallback((content: string) => {
  if (autoSync.autoSyncEnabled && autoSyncCallbacks) {
    autoSync.extractAndApply(content, characterContext);
  }
  // NEW: always run memory extraction (no toggle needed — it's passive)
  memoryExtraction.extractMemory(content, gameState.memory_anchors, characterContext);
}, [...]);
```

Memory extraction is **always on** (no user toggle needed) — it runs silently in the background and only persists meaningful facts.

#### 4. Deduplication Strategy

The existing `addMemoryAnchor` in `use-dm-game-state.ts` already handles deduplication: if an anchor with the same `category + key` exists, it updates the value instead of creating a duplicate. The edge function also receives `existingAnchors` so the AI can skip re-extracting already-known facts.

---

### Files Created

- `supabase/functions/ai-dm-memory-extract/index.ts` — New edge function

- `src/hooks/use-dm-memory-extraction.ts` — New hook

### Files Modified

- `src/components/ai-dm/AIDMScreen.tsx`
  - Import `useDmMemoryExtraction`
  - Instantiate the hook (passing `addMemoryAnchor` from `useDMGameState`)
  - Call `extractMemory()` inside `handleMessageComplete`

---

### What It Does NOT Do

- It does **not** replace the existing auto-sync (HP/gold/XP extraction stays separate)
- It does **not** show a UI toggle — memory extraction is always passive
- It does **not** block or slow down the chat — it fires after the response is complete, in the background
- It does **not** overwrite manually added anchors — the deduplication logic in `addMemoryAnchor` only updates the `value` field if the key matches

---

### User Experience

1. Player chats with the AI DM: *"I approach the mysterious merchant."*
2. AI DM responds with narrative introducing "Zara the Silk Merchant" who is wary of outsiders.
3. In the background (0.5–2s after response), memory extraction runs.
4. A subtle toast appears: *"📌 1 world fact remembered"*
5. The World State panel (Globe icon) now shows Zara under NPCs.
6. On the next message, the AI DM's system prompt includes: *"NPCs: Zara the Silk Merchant — Wary of outsiders, met at the bazaar"*
7. Even if the user starts a new chat session later, Zara is still remembered.

