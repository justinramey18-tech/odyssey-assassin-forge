

## Plan: "Use Claude Everywhere" Toggle

### What This Does
Adds a toggle in Settings below the Anthropic API key input. When enabled, ALL AI features use Claude 4.5 Sonnet via your personal Anthropic API key instead of the default models.

### Step 1: Add Toggle Utilities to `src/lib/api-keys.ts`
- Add `isClaudeEverywhereEnabled()` / `setClaudeEverywhere()` helpers using localStorage key `dnd-use-claude-everywhere`

### Step 2: Add Toggle UI to `src/components/settings/ApiCredentials.tsx`
- Add a Switch component below the Anthropic key input (only visible when a key is saved)
- Label: "Use Claude for all AI features"
- Description text explaining it routes Oracle, Homebrew, World Builder, etc. through Claude

### Step 3: Update Frontend Callers (5 files)
Pass `user_api_key` in request bodies when toggle is enabled:
- `src/hooks/use-homebrew-assistant.ts` — add key to fetch body
- `src/hooks/use-oracle.ts` — add key to fetch body  
- `src/hooks/use-worldbuilder.ts` — add key to fetch body
- `src/components/inventory/HomebrewGearAI.tsx` — add key to `supabase.functions.invoke` body
- `src/components/magic/HomebrewSpellCreateSheet.tsx` — add key to fetch body

For features that already support model selection (AI DM, Scribe, Guide Creator), auto-force model to `anthropic/claude-sonnet-4-5` when toggle is on:
- `src/hooks/use-ai-dm.ts`
- Scribe/Narrative Forge model selector
- Guide Creator caller

### Step 4: Update Edge Functions (9 functions)
Add an Anthropic code path to each function — when `user_api_key` is present, call `api.anthropic.com/v1/messages` with `claude-sonnet-4-5-20250929` instead of the Lovable gateway. Reuse the same SSE transform pattern already in `ai-dm/index.ts`.

| Edge Function | Streaming? | Change |
|---|---|---|
| `homebrew-assistant` | No | Add non-streaming Anthropic path |
| `oracle-assistant` | Yes | Add streaming Anthropic path with SSE transform |
| `ai-dm-worldbuilder` | No | Add non-streaming Anthropic path |
| `ai-dm-summarize` | No | Add non-streaming Anthropic path |
| `ai-dm-extract` | No | Add non-streaming Anthropic path (tool calling) |
| `ai-dm-memory-extract` | No | Add non-streaming Anthropic path (tool calling) |
| `combat-log-synthesize` | No | Add non-streaming Anthropic path |
| `chronicle-sync` | No | Add non-streaming Anthropic path |
| `parse-protagonist` | No | Add non-streaming Anthropic path (tool calling) |

### Technical Detail

**Edge function pattern** (non-streaming):
```text
const user_api_key = body.user_api_key;
if (user_api_key) {
  → call api.anthropic.com/v1/messages with claude-sonnet-4-5-20250929
  → parse response.content[0].text (or tool_use block)
  → return same JSON shape as current Lovable gateway path
} else {
  → existing Lovable gateway logic (unchanged)
}
```

**Edge function pattern** (streaming, oracle-assistant):
```text
if (user_api_key) {
  → call api.anthropic.com/v1/messages with stream:true
  → transform Anthropic SSE → OpenAI-compatible SSE (same transform from ai-dm)
  → return transformed stream
} else {
  → existing Lovable gateway streaming (unchanged)
}
```

**Tool-calling functions** (extract, memory-extract, parse-protagonist): Anthropic has native tool calling — convert the existing OpenAI-format tool definitions to Anthropic's `tools` format and extract results from `tool_use` content blocks.

