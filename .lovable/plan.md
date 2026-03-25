

## Problem

When you `@NPC` in Empyrean solo mode, the NPC voicing instruction is prepended to the system prompt, but the full DM system prompt follows — including "Write RICH, NOVELISTIC prose" and "multiple paragraphs per exchange." The AI model treats the longer, more detailed narrative instructions as dominant, ignoring the short voicing directive.

## Solution

Make the NPC voicing context **override** the narrative style rather than just sitting in front of it. Two changes:

### 1. Strengthen the `npcVoicingContext` in `use-ai-dm.ts`

Update the voicing prompt to explicitly countermand the narrative style instructions:

> `"## NPC VOICING MODE — ABSOLUTE PRIORITY\nThis overrides ALL narrative style instructions below. Do NOT write novelistic prose. Do NOT write scene description, atmosphere, sensory detail, or action narration.\n\nYou are responding AS the NPC named ${npcName} ONLY.\nWrite 1-3 sentences of pure in-character dialogue. Nothing else.\nFormat: **${npcName}:** Their dialogue here.\nIf the NPC would react physically (a shrug, a glare), include it as a single parenthetical action beat, not a paragraph of description.\nDo NOT exceed 3 sentences under any circumstances."`

### 2. Strip the NARRATIVE STYLE section in the edge function when voicing is active

In `supabase/functions/ai-dm/index.ts`, after building the system prompt and before prepending the voicing context, strip or replace the `## NARRATIVE STYLE` section from the base prompt when `npcVoicingContext` is present. This eliminates the conflicting instructions entirely rather than relying on the model to prioritize correctly.

Specifically: use a regex to remove everything between `## NARRATIVE STYLE` and the next `##` heading, replacing it with a one-liner: `## NARRATIVE STYLE\nDialogue mode active. See NPC VOICING MODE above.`

### Files Changed
- `src/hooks/use-ai-dm.ts` — stronger voicing prompt text
- `supabase/functions/ai-dm/index.ts` — strip narrative style section when NPC voicing is active

