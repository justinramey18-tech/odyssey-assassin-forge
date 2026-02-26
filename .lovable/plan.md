

# Fix: AI Guide Creator Should Follow the Prompt, Not Force Context

## Problem

The system prompt unconditionally injects campaign summary, chat history, and existing guides as context, and instructs the AI to use them to "make the guide contextually relevant." This causes the AI to generate scene/setting guides even when the user simply wants a narration style guide. The AI treats the context as mandatory input rather than optional reference.

## Root Cause

In `supabase/functions/guide-creator/index.ts`, the `buildSystemPrompt` function:
1. Always appends campaign context with "Use the following campaign summary to make the guide contextually relevant" — this actively tells the AI to incorporate it
2. Always appends chat history as "additional context" — the AI interprets this as content to build upon
3. The quality standards section lists only world-building content types (NPCs, locations, encounters, factions) — biasing the AI toward scene generation even for non-scene prompts

## Fix (single file change)

**File: `supabase/functions/guide-creator/index.ts`** — Rewrite `buildSystemPrompt` (lines 38-74)

Changes:
1. **Core instruction**: Add a top-level directive: "Follow the user's prompt exactly. Only create what they ask for."
2. **Broaden guide types**: Replace the world-building-only quality standards with a note that guides can be about anything — narration style, house rules, tone, pacing, etc.
3. **Context framing**: Change context injection from "use this to make the guide relevant" to "reference this ONLY if it's relevant to what the user asked for." Make it clear the AI should not force-fit context.
4. **Existing guides**: Keep the deduplication note but soften it — "be aware of these, don't duplicate" rather than treating them as a creative constraint.

Revised system prompt structure:

```
## PRIME DIRECTIVE
Follow the user's prompt exactly. Create only what they ask for.
Do NOT expand the scope beyond the prompt. If they ask for a narration 
style guide, write a narration style guide — not a setting or scene guide.

## OUTPUT FORMAT
- Start with a single # Title heading
- Use ## and ### headings to organize sections
- Write content a DM can reference during play
- Keep output under 25,000 characters
- No meta-commentary

## GUIDE TYPES
Guides can cover ANY topic: narration style, prose tone, house rules, 
pacing guidelines, NPC behavior templates, combat style, setting details, 
encounter design, faction politics, random tables, etc. Match the type 
to what the user requests.

## CONTEXT (reference only if relevant)
[campaign summary — "Available for reference IF the user's request 
relates to campaign-specific content. Do not force this into the guide."]

[chat history — "Available for reference IF relevant to what the user 
asked. Do not base the guide on this unless the prompt calls for it."]

[existing guides — "These already exist. Avoid duplicating their content."]
```

This is a single-file change to the edge function. No component or prop changes needed.

