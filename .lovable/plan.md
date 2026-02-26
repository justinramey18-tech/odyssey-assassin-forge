

# AI Assistant GM Guide Creator

## Overview

Add an AI-powered guide generator at the top of the GM Guides page. Users provide a prompt, choose an AI model, and the system generates a complete GM guide using contextual awareness of chat history, campaign summary, and existing guides. The guide auto-saves to the library on completion.

## Architecture

```text
GMGuidesManager (existing full-screen overlay)
  ├── Header + Budget Bar (unchanged)
  ├── ★ NEW: AIGuideCreator (collapsible panel, hidden when editor is open)
  │     ├── Collapsed: "✨ AI Guide Creator" banner button
  │     ├── Expanded:
  │     │   ├── Model dropdown (DM_MODELS — all models incl. Claude)
  │     │   ├── Context chips (campaign summary, N messages, N guides)
  │     │   ├── Prompt textarea (free-form, no presets)
  │     │   ├── Generate button → non-streaming call to guide-creator edge function
  │     │   └── Loading spinner → result auto-saved, panel resets
  ├── Campaign Summary card (unchanged)
  └── Guide list (unchanged)
```

## Changes

### 1. New Edge Function: `supabase/functions/guide-creator/index.ts`

**Non-streaming** edge function (user chose "wait then show result"). Accepts:

```typescript
interface GuideRequest {
  prompt: string;
  campaignSummary?: string;
  existingGuides?: Array<{ name: string; snippet: string }>;
  chatHistory?: Array<{ role: string; content: string }>;
  model?: string;
  user_api_key?: string;
}
```

Returns `{ guide: string, suggestedName: string }`.

- Reuses the exact same dual-routing pattern from `ai-dm/index.ts`: `LOVABLE_MODELS` set → Lovable gateway, `ANTHROPIC_MODELS` map → Anthropic API with `user_api_key` fallback
- Auth: JWT validation via `supabase.auth.getClaims()` (same as `ai-dm`)
- System prompt instructs the AI to produce a structured markdown GM guide, be aware of existing guides to avoid duplication, reference campaign context, and stay within 30k chars
- Handles 429/402 rate limit errors with user-friendly messages
- `max_tokens: 8000` for Lovable gateway, same for Anthropic

### 2. New Component: `src/components/ai-dm/AIGuideCreator.tsx`

Collapsible panel with:

- **Collapsed**: Tappable banner "✨ AI Guide Creator" with Sparkles icon
- **Expanded**:
  - Model selector using existing `DM_MODELS` from `dm-models.ts`, defaults to `google/gemini-3-flash-preview` (fast + cheap for utility task)
  - Context indicator chips: "📜 Summary" (if campaign summary exists), "💬 N messages" (if chat history provided), "📖 N guides" (existing enabled guides count)
  - Prompt textarea, placeholder "Describe the guide you want to create..."
  - "Generate" button with loading state
  - On completion: auto-saves via `onAdd(suggestedName, guide)`, shows success toast, resets panel
  - Error handling: toast on failure, re-enables generate button

Client call pattern: `supabase.functions.invoke('guide-creator', { body: { ... } })` — non-streaming since user chose "wait then show result".

For Anthropic models, reads the user's API key via `loadApiKey('anthropic')` and passes it as `user_api_key`.

### 3. Update `GMGuidesManager.tsx`

Add new props:
- `chatMessages?: Array<{ role: string; content: string }>` — last ~20 messages for context
- `selectedModel?: string` — current DM model selection

Render `<AIGuideCreator>` between the budget bar and the content area, hidden when the guide editor is open (`showEditor`).

### 4. Update `AIDMScreen.tsx` (Solo DM)

Pass `messages` (last 20) and `selectedModel` to `GMGuidesManager`.

### 5. Update `StandalonePartyDMScreen.tsx` (Party DM)

Pass `partyDm.messages` (last 20) to `GMGuidesManager`. No model state exists in party mode, so omit it (creator will use its own default).

### 6. Update `supabase/config.toml`

Add:
```toml
[functions.guide-creator]
verify_jwt = false
```

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/guide-creator/index.ts` | **New** — Non-streaming edge function for guide generation |
| `src/components/ai-dm/AIGuideCreator.tsx` | **New** — Collapsible AI guide creator panel |
| `src/components/ai-dm/GMGuidesManager.tsx` | Add `chatMessages` + `selectedModel` props, render AIGuideCreator |
| `src/components/ai-dm/AIDMScreen.tsx` | Pass messages + selectedModel to GMGuidesManager |
| `src/components/ai-dm/StandalonePartyDMScreen.tsx` | Pass messages to GMGuidesManager |
| `supabase/config.toml` | Add `[functions.guide-creator]` entry |

## Edge Function System Prompt

The system prompt will instruct the AI to:
1. Generate a structured markdown GM guide with clear headings
2. Include sections appropriate to the request (setting, NPCs, rules, lore, encounters, factions, etc.)
3. Reference campaign summary and chat history for contextual relevance
4. Avoid duplicating content from existing guides (provided as name + snippet pairs)
5. Keep output under 25,000 characters to stay within the 30k guide limit
6. Start with a `# Title` heading (used to auto-extract `suggestedName`)

## Testing

1. Open GM Guides in Solo DM, expand the AI Creator, type "Create a haunted forest setting guide", generate, verify it auto-saves
2. Test with an Anthropic model (requires user API key) — verify it routes correctly
3. Test with no chat history / no campaign summary — verify it generates without errors
4. Test the 429/402 error paths — verify user-friendly toasts appear
5. Verify the creator panel is hidden when the manual guide editor is open
6. Open GM Guides in Party DM — verify the creator is present and functional

