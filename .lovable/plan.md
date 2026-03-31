

## Upgrade Deadpool Commands to Claude Sonnet 4.5 with Gemini 3 Pro Fallback

### What changes
All 5 Deadpool commands (`/lore`, `/scene`, `/who`, `/ask`, `/suggest`) will try Claude Sonnet 4.5 first using the server-side `ANTHROPIC_API_KEY` secret, falling back to `google/gemini-3.1-pro-preview` via the Lovable AI Gateway if the key is missing or the call fails.

### File changed
**`supabase/functions/telegram-poll/index.ts`**

### Implementation

1. **Add a shared helper function** `callDeadpoolAI(systemPrompt, userContent, maxTokens, lovableKey)` near the top of the file that:
   - Reads `ANTHROPIC_API_KEY` from `Deno.env`
   - If present: calls Anthropic API directly (`https://api.anthropic.com/v1/messages`) with model `claude-sonnet-4-5-20250929`, converts the response to extract text content
   - If missing OR if the Anthropic call fails (non-2xx): falls back to the Lovable AI Gateway with model `google/gemini-3.1-pro-preview`
   - Returns the text answer string (or a fallback error message)
   - Uses the existing `callAnthropicNonStreaming` from `../_shared/anthropic-helper.ts` for the Claude call

2. **Replace all 5 Deadpool command fetch blocks** (`/lore`, `/scene`, `/who`, `/ask`, `/suggest`) to call `callDeadpoolAI()` instead of directly fetching `AI_GATEWAY_URL` with the Gemini model. The system prompts and user content stay identical.

3. **Import** the shared anthropic helper at the top of the file.

### What stays the same
- `/bond` command — untouched (separate dragon persona, not Deadpool)
- All non-AI commands — untouched
- All system prompts, comedy persona, word limits — identical
- `sendTelegram` chunking logic — untouched
- Token limits per command — unchanged

### Technical detail

```text
callDeadpoolAI(system, user, maxTokens, lovableKey)
  ├─ ANTHROPIC_API_KEY exists?
  │   ├─ YES → call Anthropic API (claude-sonnet-4-5-20250929)
  │   │         ├─ success → return text
  │   │         └─ failure → fall through to gateway
  │   └─ NO  → fall through to gateway
  └─ Gateway: google/gemini-3.1-pro-preview via AI_GATEWAY_URL
```

