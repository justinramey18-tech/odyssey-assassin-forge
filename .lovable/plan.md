

## Add AI Chat Assistant to AFK Personality Guide

The AFK guide screen currently has only a plain textarea. This plan adds a collapsible AI chat widget that conducts a guided interview about the character, then generates a ready-to-use AFK personality guide the player can insert into the textarea.

### Architecture

**New edge function: `supabase/functions/afk-guide-chat/index.ts`**
- Accepts `{ messages, characterName, user_api_key }` — a multi-turn chat history
- System prompt: a character interview persona that asks structured questions one at a time about combat style, personality, speech patterns, risk tolerance, party role, and situational preferences
- Uses the user's Anthropic API key with Claude 4.5 Sonnet via direct Anthropic streaming (same pattern as `_shared/anthropic-helper.ts`)
- Falls back to Lovable AI gateway if no Anthropic key provided
- Returns SSE stream for token-by-token rendering
- After ~4-5 exchanges, the AI proactively offers to synthesize a complete guide and outputs it in a `[GUIDE_START]...[GUIDE_END]` block the client can detect
- `verify_jwt = false` in config.toml

**System prompt design — guided questionnaire flow:**
1. Opens with: "Let's build an AFK guide for {characterName}. First — what's their go-to approach in combat? (aggressive, defensive, support, ranged, etc.)"
2. Follow-up questions cover: personality/demeanor, how they talk, risk tolerance (retreat thresholds), party role priorities, and any hard rules (e.g., "never harm civilians")
3. After gathering enough info (~4-5 answers), automatically synthesizes a concise AFK guide and wraps it in `[GUIDE_START]...[GUIDE_END]` markers
4. Player can continue refining by chatting more, and the AI re-generates updated guide blocks

**UI changes to `AfkPersonalityGuide.tsx`:**
- Add a collapsible "AI Guide Builder" section between the description and the textarea
- Toggle button with `Sparkles` + `MessageSquare` icons
- When expanded, shows a mini chat interface:
  - Scrollable message list (compact bubbles, user right-aligned, AI left-aligned)
  - Text input + send button at the bottom
  - Streams responses token-by-token
- When AI outputs a `[GUIDE_START]...[GUIDE_END]` block, show an "Insert into Guide" button that populates the main textarea
- If no Anthropic API key is set, show a subtle notice: "Add your Anthropic key in Settings to use the AI assistant" with the widget still accessible via Lovable AI fallback
- Chat state is local (not persisted) — resets when the sheet closes

### Files

| Action | File |
|--------|------|
| Create | `supabase/functions/afk-guide-chat/index.ts` |
| Modify | `src/components/ai-dm/AfkPersonalityGuide.tsx` |

